import { handleApiError } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Payment from "@/lib/models/Payment";
import OnboardingDetails from "@/lib/models/OnboardingDetails";

/**
 * POST /api/v1/payments/activate-legacy
 *
 * Activates a user who already paid in the old system. This endpoint is only
 * reachable for users whose Clerk publicMetadata has:
 *   - migratedFromLegacy: true
 *   - registrationFeeStatus: "paid"
 *
 * It creates a zero-amount Payment record (purpose: "legacy_migration") and
 * sets onboardingCompleted: true on the User document, mirroring what the
 * normal /api/v1/payments/verify route does for Razorpay-paid users.
 *
 * The onboarding page calls this after /api/v1/payments/create-order returns
 * { alreadyPaid: true }.
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId, sessionClaims } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // ── Validate migration flags ──────────────────────────────────────────────
    const meta = (sessionClaims?.publicMetadata ?? {}) as Record<string, unknown>;
    if (
      meta.migratedFromLegacy !== true ||
      meta.registrationFeeStatus !== "paid"
    ) {
      return NextResponse.json(
        { error: "This endpoint is only available for migrated legacy users." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({})) as { plan?: string };
    const planFromBody = body.plan as "teacher" | "teacher_candidate" | undefined;

    // legacyPlan was stored in Clerk publicMetadata by the migration script.
    // The onboarding page also sends the plan the user selected in step 2 as a
    // fallback; use whichever is available.
    const toPlan = (
      (meta.legacyPlan as string | undefined) ??
      planFromBody ??
      "teacher"
    ) as "teacher" | "teacher_candidate";

    if (!["teacher", "teacher_candidate"].includes(toPlan)) {
      return NextResponse.json(
        { error: "Invalid plan in legacy metadata." },
        { status: 400 },
      );
    }

    const legacyTeacherId = (meta.legacyTeacherId as string | undefined) ?? "legacy";

    await dbConnect();

    const user = await User.findOne({ clerkId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── Idempotency guard ────────────────────────────────────────────────────
    // If the user is already activated (e.g. double-click), return success.
    if (user.onboardingCompleted) {
      console.log(
        `[activate-legacy] User ${clerkId} already activated — idempotent return`,
      );
      return NextResponse.json({ success: true });
    }

    // ── Create a zero-amount Payment record ──────────────────────────────────
    // purpose: "legacy_migration" distinguishes these from real Razorpay payments
    // for audit / admin dashboard purposes.
    const payment = await Payment.create({
      userId: user._id,
      clerkId,
      purpose: "legacy_migration",
      fromPlan: null,
      toPlan,
      amount: 0,
      currency: "INR",
      provider: "legacy",
      providerOrderId: legacyTeacherId, // legacy teacher/freelancer ID as reference
      providerPaymentId: legacyTeacherId,
      status: "paid",
      paidAt: new Date(),
    });

    // ── Activate the user ────────────────────────────────────────────────────
    await User.updateOne(
      { clerkId },
      {
        "plan.current": toPlan,
        "plan.hasTuitionAccess": true,
        "plan.hasCandidateAccess": toPlan === "teacher_candidate",
        "plan.activatedAt": new Date(),
        paymentCompleted: true,
        onboardingCompleted: true,
        registrationPaymentId: payment._id,
        role: toPlan,
      },
    );

    // Clear expiresAt (already null for migrated users, but be explicit) and
    // mark onboarding details as completed.
    await OnboardingDetails.updateOne(
      { clerkId },
      { $set: { expiresAt: null, status: "completed" } },
    );

    // ── Sync to Clerk publicMetadata ─────────────────────────────────────────
    // Keep migratedFromLegacy for historical tracking; update onboardingCompleted.
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        onboardingCompleted: true,
        role: toPlan,
        migratedFromLegacy: true,
        registrationFeeStatus: "paid",
      },
    });

    console.log(
      `[activate-legacy] Activated legacy user ${clerkId} → plan: ${toPlan}, legacyId: ${legacyTeacherId}`,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "POST /api/v1/payments/activate-legacy");
  }
}
