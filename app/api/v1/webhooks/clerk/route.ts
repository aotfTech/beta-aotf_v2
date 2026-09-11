import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Admin from "@/lib/models/Admin";
import Profile from "@/lib/models/Profile";
import OnboardingDetails from "@/lib/models/OnboardingDetails";
import WebhookEvent from "@/lib/models/WebhookEvent";
import mongoose from "mongoose";

import { reportError } from "@/lib/sentry-report";

export async function POST(req: NextRequest) {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    evt = await verifyWebhook(req, {
      signingSecret: process.env.CLERK_WEBHOOK_SECRET!,
    });
  } catch (err) {
    console.error("[clerk-webhook] Verification failed:", err);
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 400 },
    );
  }

  const eventType = evt.type;
  const data = evt.data as unknown as Record<string, unknown>;
  const entityId = (data.id as string) ?? "";

  console.log(`[clerk-webhook] Received event: ${eventType} for ${entityId}`);

  await dbConnect();

  // Idempotency guard + event processing are kept in a single try block so
  // that a failed handler never leaves behind an unprocessed WebhookEvent
  // document that would permanently block future retries for the same event.
  try {
    // Write the idempotency record first. A duplicate-key error (11000) means
    // we already handled this delivery — return 200 immediately.
    try {
      await WebhookEvent.create({
        provider: "clerk",
        event: eventType,
        entityId,
        payload: data,
        signature: req.headers.get("svix-signature") ?? "",
      });
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        console.log(`[clerk-webhook] Duplicate event ${entityId}, skipping`);
        return NextResponse.json({ received: true });
      }
      throw err;
    }

    switch (eventType) {
      case "user.created":
        await handleUserCreated(data);
        break;
      case "user.updated":
        await handleUserUpdated(data);
        break;
      case "user.deleted":
        await handleUserDeleted(data);
        break;
      default:
        console.log(`[clerk-webhook] Unhandled event type: ${eventType}`);
    }

    await WebhookEvent.updateOne(
      { provider: "clerk", event: eventType, entityId },
      { processed: true, processedAt: new Date() },
    );
  } catch (err) {
    console.error(`[clerk-webhook] Error processing ${eventType}:`, err);
    reportError(err, {
      tags: { provider: "clerk", eventType },
      extra: { entityId },
    });
    // Delete the idempotency record so that Clerk's automatic retry can
    // attempt the event again on the next delivery.
    await WebhookEvent.deleteOne({
      provider: "clerk",
      event: eventType,
      entityId,
    }).catch((cleanupError) => {
      reportError(cleanupError, {
        tags: { provider: "clerk", operation: "delete-failed-idempotency-record" },
        extra: { eventType, entityId },
      });
    });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

async function handleUserCreated(data: Record<string, unknown>) {
  const clerkId = data.id as string;

  if (!clerkId) {
    throw new Error("Missing clerkId in user.created event");
  }

  // Check if this is an admin user
  const publicMetadata =
    (data.public_metadata as Record<string, unknown>) || {};
  const isAdmin = publicMetadata.isAdmin === true;

  if (isAdmin) {
    // Handle admin user creation
    await handleAdminCreated(data);
    return;
  }

  // Handle regular user creation
  // username is null when Clerk is configured without a username requirement,
  // during OAuth sign-ups, and in every Clerk test-event payload.
  // Derive a stable, URL-safe fallback from the primary email + clerkId suffix.
  let username = (data.username as string)?.toLowerCase().trim();

  if (!username) {
    const emails =
      (data.email_addresses as
        | Array<{ id: string; email_address: string }>
        | undefined) ?? [];
    const primaryEmailId = data.primary_email_address_id as string | undefined;
    const primaryEmail =
      (emails.find((e) => e.id === primaryEmailId) ?? emails[0])
        ?.email_address ?? "";

    // Keep only alphanumeric chars from the local part, limit to 15 chars.
    const localPart = primaryEmail
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 15);

    // Append last 8 chars of clerkId (after "user_") to guarantee uniqueness.
    const suffix = clerkId.replace("user_", "").slice(-8);
    username = `${localPart || "user"}${suffix}`;
  }

  const firstName = (data.first_name as string) || "";
  const lastName = (data.last_name as string) || "";
  const accountHolderName = `${firstName} ${lastName}`.trim() || null;
  const avatarUrl = (data.image_url as string) || null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Find by clerkId (clean re-delivery) or by username (orphaned doc
      //    left by a previous failed attempt with a different/null clerkId).
      //    If found by username, adopt it by writing the correct clerkId.
      let userDoc = await User.findOneAndUpdate(
        { $or: [{ clerkId }, { username }] },
        { $set: { clerkId, status: "active" } },
        { new: true, session },
      );

      if (!userDoc) {
        // First-ever delivery — create fresh.
        const created = await User.create(
          [
            {
              clerkId,
              username,
              role: "teacher",
              plan: {
                current: "teacher",
                hasTuitionAccess: false,
                hasCandidateAccess: false,
                activatedAt: null,
              },
              onboardingCompleted: false,
              status: "active",
              registrationPaymentId: null,
            },
          ],
          { session },
        );
        userDoc = created[0];
      }

      // Same pattern for Profile.
      const existingProfile = await Profile.findOneAndUpdate(
        { $or: [{ clerkId }, { username }] },
        { $set: { clerkId, userId: userDoc._id } },
        { new: true, session },
      );

      if (!existingProfile) {
        await Profile.create(
          [
            {
              userId: userDoc._id,
              clerkId,
              username,
              displayName: accountHolderName,
              bio: null,
              avatarUrl,
              location: null,
              websiteUrl: null,
              socialLinks: {},
              subjects: [],
              experience: null,
              isPublic: true,
            },
          ],
          { session },
        );
      } else {
        const profileUpdate: Record<string, unknown> = {};

        if (avatarUrl) {
          profileUpdate.avatarUrl = avatarUrl;
        }

        if (!existingProfile.displayName && accountHolderName) {
          profileUpdate.displayName = accountHolderName;
        }

        if (Object.keys(profileUpdate).length > 0) {
          await Profile.updateOne(
            { _id: existingProfile._id },
            { $set: profileUpdate },
            { session },
          );
        }
      }
    });
  } finally {
    await session.endSession();
  }

  // Mirror business state into Clerk publicMetadata so the JWT carries these
  // claims. MongoDB is the source of truth; Clerk publicMetadata is the read
  // cache. proxy.ts reads onboardingCompleted from sessionClaims to gate routes.
  //
  // For legacy-migrated users (migratedFromLegacy: true + registrationFeeStatus: "paid"
  // in publicMetadata), we preserve those flags in the metadata update so the
  // onboarding flow knows to skip Razorpay. We also seed an OnboardingDetails
  // document with expiresAt = null so MongoDB never auto-deletes their record.
  //
  // Retry with backoff: Clerk occasionally fires user.created before the user
  // is fully available via the Management API, causing a transient 404.

  // Read the metadata that was set by the migration script (present on the
  // event payload as public_metadata).
  const incomingMeta = (data.public_metadata as Record<string, unknown>) ?? {};
  const isMigratedLegacy =
    incomingMeta.migratedFromLegacy === true &&
    incomingMeta.registrationFeeStatus === "paid";

  // For migrated users: create an OnboardingDetails stub immediately with
  // expiresAt = null so the 30-day deletion TTL never fires.
  if (isMigratedLegacy) {
    const userDoc = await User.findOne({ clerkId });
    if (userDoc) {
      await OnboardingDetails.findOneAndUpdate(
        { clerkId },
        {
          $setOnInsert: {
            userId: userDoc._id,
            clerkId,
            phone: null,
            whatsapp: null,
            address: null,
            teachingExp: null,
            jobExp: null,
            qualification: null,
            board: null,
            plan: (incomingMeta.legacyPlan as string) ?? null,
            status: "incomplete",
            expiresAt: null, // no TTL — they already paid
          },
        },
        { upsert: true },
      );
      console.log(
        `[clerk-webhook] Seeded OnboardingDetails (no TTL) for migrated user ${clerkId}`,
      );
    }
  }

  const delays = [500, 1500, 3000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt - 1]));
    }
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(clerkId, {
        publicMetadata: isMigratedLegacy
          ? {
              // Preserve all migration flags so the onboarding page and
              // activate-legacy endpoint can read them from the JWT.
              role: (incomingMeta.legacyPlan as string) ?? "teacher",
              onboardingCompleted: false,
              migratedFromLegacy: true,
              registrationFeeStatus: "paid",
              legacyPlan: incomingMeta.legacyPlan ?? "teacher",
              legacyTeacherId: incomingMeta.legacyTeacherId ?? null,
            }
          : {
              role: "teacher",
              onboardingCompleted: false,
            },
      });
      lastErr = null;
      break;
    } catch (err: unknown) {
      lastErr = err;
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status: number }).status
          : null;
      // Only retry on 404 (transient propagation delay); bail immediately for other errors
      if (status !== 404) break;
      console.warn(
        `[clerk-webhook] updateUserMetadata 404 for ${clerkId}, attempt ${attempt + 1}/${delays.length + 1} — retrying…`,
      );
    }
  }
  if (lastErr) {
    // Non-fatal: MongoDB record exists. Log for investigation.
    console.error(
      `[clerk-webhook] Failed to set publicMetadata for ${clerkId} after retries:`,
      lastErr,
    );
  }

  console.log(`[clerk-webhook] Created user and profile for ${clerkId}`);
}

async function handleAdminCreated(data: Record<string, unknown>) {
  const clerkId = data.id as string;
  const username = (data.username as string)?.toLowerCase().trim();
  const publicMetadata =
    (data.public_metadata as Record<string, unknown>) || {};
  const rawRole = (publicMetadata.role as string) || "support_admin";
  const normalizedRole =
    rawRole === "moderator"
      ? "support_admin"
      : rawRole === "super_admin" || rawRole === "admin" || rawRole === "support_admin"
        ? rawRole
        : "support_admin";

  const emails =
    (data.email_addresses as
      | Array<{ id: string; email_address: string }>
      | undefined) ?? [];
  const primaryEmailId = data.primary_email_address_id as string | undefined;
  const email =
    (emails.find((e) => e.id === primaryEmailId) ?? emails[0])?.email_address ??
    "";

  const firstName = (data.first_name as string) || "";
  const lastName = (data.last_name as string) || "";
  const name = `${firstName} ${lastName}`.trim();

  if (!clerkId || !username || !email) {
    throw new Error("Missing required fields for admin creation");
  }

  // Check if admin already exists
  let adminDoc = await Admin.findOne({ clerkId });

  if (!adminDoc) {
    // Create new admin with default permissions based on role
    const permissions = Admin.getDefaultPermissions(normalizedRole);

    adminDoc = await Admin.create({
      clerkId,
      username,
      email,
      name,
      role: normalizedRole as "super_admin" | "admin" | "support_admin",
      permissions,
      isActive: true,
      isLocked: false,
      requirePasswordChange: publicMetadata.requirePasswordChange === true,
      createdBy: null, // Will be updated via API when admin creates another admin
    });

    console.log(`[clerk-webhook] Created admin ${clerkId} with role ${normalizedRole}`);
  }

  // Update Clerk metadata with adminId
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        ...publicMetadata,
        adminId: adminDoc._id.toString(),
      },
    });
  } catch (err) {
    console.error(
      `[clerk-webhook] Failed to update admin metadata for ${clerkId}:`,
      err,
    );
  }
}

async function handleUserUpdated(data: Record<string, unknown>) {
  const clerkId = data.id as string;
  const newUsername = (data.username as string)?.toLowerCase().trim();
  const avatarUrl = (data.image_url as string) || null;
  const firstName = (data.first_name as string) || "";
  const lastName = (data.last_name as string) || "";
  const accountHolderName = `${firstName} ${lastName}`.trim();

  if (!clerkId) return;

  // Check if this is an admin
  const publicMetadata =
    (data.public_metadata as Record<string, unknown>) || {};
  const isAdmin = publicMetadata.isAdmin === true;

  if (isAdmin) {
    // Handle admin update
    const admin = await Admin.findOne({ clerkId });
    if (!admin) {
      console.warn(
        `[clerk-webhook] user.updated: Admin not found for ${clerkId}`,
      );
      return;
    }

    // Only sync if username actually changed
    if (newUsername && newUsername !== admin.username) {
      await Admin.updateOne({ clerkId }, { username: newUsername });
      console.log(
        `[clerk-webhook] Synced admin username for ${clerkId}: ${admin.username} → ${newUsername}`,
      );
    }

    // Sync name if changed
    const firstName = (data.first_name as string) || "";
    const lastName = (data.last_name as string) || "";
    const newName = `${firstName} ${lastName}`.trim();

    if (newName && newName !== admin.name) {
      await Admin.updateOne({ clerkId }, { name: newName });
      console.log(`[clerk-webhook] Synced admin name for ${clerkId}`);
    }

    return;
  }

  // Handle regular user update
  const user = await User.findOne({ clerkId });
  if (!user) {
    console.warn(`[clerk-webhook] user.updated: User not found for ${clerkId}`);
    return;
  }

  // Only sync if username actually changed
  if (newUsername && newUsername !== user.username) {
    // Username is immutable in this app after account creation.
    console.warn(
      `[clerk-webhook] Ignoring username change for ${clerkId}: ${newUsername} (locked)`,
    );
  }

  if (avatarUrl) {
    await Profile.updateOne({ clerkId }, { avatarUrl });
  }

  if (accountHolderName) {
    await Profile.updateOne(
      {
        clerkId,
        $or: [{ displayName: null }, { displayName: "" }],
      },
      { displayName: accountHolderName },
    );
  }

  if (avatarUrl || accountHolderName) {
    console.log(
      `[clerk-webhook] Synced profile fields for ${clerkId} (avatar/name policy applied)`,
    );
  }
}

async function handleUserDeleted(data: Record<string, unknown>) {
  const clerkId = data.id as string;
  if (!clerkId) return;

  // Check if this is an admin
  const publicMetadata =
    (data.public_metadata as Record<string, unknown>) || {};
  const isAdmin = publicMetadata.isAdmin === true;

  if (isAdmin) {
    // Soft delete admin (set inactive)
    await Admin.updateOne(
      { clerkId },
      { isActive: false, terminatedAt: new Date() },
    );
    console.log(`[clerk-webhook] Soft-deleted admin ${clerkId}`);
    return;
  }

  // Handle regular user deletion
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await User.updateOne({ clerkId }, { status: "deleted" }, { session });
      await Profile.updateOne({ clerkId }, { isPublic: false }, { session });
      // Also remove OnboardingDetails (if any) since the account is gone
      await OnboardingDetails.deleteOne({ clerkId }).session(session);
    });
  } finally {
    await session.endSession();
  }

  console.log(`[clerk-webhook] Soft-deleted user ${clerkId}`);
}
