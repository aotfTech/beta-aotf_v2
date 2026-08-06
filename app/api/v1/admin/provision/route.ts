import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import AdminRole from "@/lib/models/admin/AdminRole";
import { ADMIN_PERMISSION_KEYS } from "@/lib/admin/admin-permissions";
import { reportError } from "@/lib/sentry-report";

function splitName(name: string) {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName || "Admin";
  return {
    firstName: firstName || "Admin",
    lastName,
  };
}

function mapAotfRole(role: string) {
  return role
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getClerkErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const clerkError = error as {
    errors?: Array<{ code?: string }>;
    code?: string;
    status?: number;
  };

  return (
    clerkError.errors?.[0]?.code ??
    clerkError.code ??
    (typeof clerkError.status === "number" ? String(clerkError.status) : "")
  );
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function isClerkDuplicateError(error: unknown) {
  const code = getClerkErrorCode(error);
  return code === "form_identifier_exists" || code === "422";
}

function sanitizePermissionOverrides(overrides?: Record<string, boolean>) {
  if (!overrides) return {} as Record<string, boolean>;
  return ADMIN_PERMISSION_KEYS.reduce<Record<string, boolean>>((acc, key) => {
    if (typeof overrides[key] === "boolean") {
      acc[key] = overrides[key];
    }
    return acc;
  }, {});
}

async function findClerkUser(
  client: Awaited<ReturnType<typeof clerkClient>>,
  params: { email: string; username: string },
) {
  const clerk = client as any;
  const [byEmail, byUsername] = await Promise.all([
    clerk.users.getUserList({ emailAddress: [params.email] }),
    clerk.users.getUserList({ username: [params.username] }),
  ]);

  return byEmail.data[0] ?? byUsername.data[0] ?? null;
}

export async function POST(req: Request) {
  let clerkId = "";
  let username = "";
  let email = "";
  let name = "";
  let password: string | undefined;
  let role = "";
  let permissions:
    | Record<string, boolean>
    | undefined;

  try {
    const { userId, sessionClaims } = await auth();
    clerkId = userId ?? "";
    if (!clerkId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    let meta = sessionClaims?.publicMetadata as
      | Record<string, unknown>
      | undefined;

    // If session claims don't include isAdmin (e.g., metadata was updated),
    // fall back to fetching the user's metadata from Clerk to avoid a 403
    // when the user just had their metadata updated.
    if (meta?.isAdmin !== true) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(clerkId);
        meta = clerkUser.publicMetadata as Record<string, unknown> | undefined;
      } catch (err) {
        console.warn("Failed to fetch Clerk user metadata fallback:", err);
      }
    }

    if (meta?.isAdmin !== true) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    await dbConnect();

    // Verify the requesting admin exists and has rights to provision admins
    const requestingAdmin = await Admin.findOne({ clerkId, isActive: true });
    if (!requestingAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Only super_admin can provision admins through the dashboard.
    if (requestingAdmin.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super_admin can create admins" },
        { status: 403 },
      );
    }

    const body = (await req.json()) as {
      username: string;
      email: string;
      name: string;
      password?: string;
      role: string;
      permissions?: Record<string, boolean>;
    };

    username = body.username;
    email = body.email;
    name = body.name;
    password = body.password;
    role = body.role;
    permissions = body.permissions;

    if (!username || !email || !name || !role) {
      return NextResponse.json(
        { error: "username, email, name, and role are required" },
        { status: 400 },
      );
    }

    const normalizedRole = role.trim().toLowerCase();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const roleDoc = await AdminRole.findOne({ name: normalizedRole }).lean();
    const isSystemRole = ["super_admin", "admin", "support_admin"].includes(
      normalizedRole,
    );
    if (!roleDoc && !isSystemRole) {
      return NextResponse.json(
        { error: "Unknown role. Create the role first." },
        { status: 400 },
      );
    }

    // Generate a secure temporary password (used only if we create a Clerk user)
    const tempPassword = crypto.randomBytes(12).toString("base64url") + "!A1";
    const selectedPassword = password && password.length >= 8 ? password : tempPassword;
    const { firstName, lastName } = splitName(name);

    // Create or reuse Clerk user
    const client = await clerkClient();

    let newClerkUser;
    let createdNewUser = false;
    const rolePermissions = roleDoc?.permissions ?? [];
    const defaultPermissions = isSystemRole
      ? Admin.getDefaultPermissions(normalizedRole)
      : ADMIN_PERMISSION_KEYS.reduce<Record<string, boolean>>((acc, key) => {
          acc[key] = rolePermissions.includes(key);
          return acc;
        }, {});
    const resolvedPermissions = {
      ...defaultPermissions,
      ...sanitizePermissionOverrides(permissions),
    };
    const aotfRole = mapAotfRole(normalizedRole);

    const existing = await findClerkUser(client, {
      email: normalizedEmail,
      username: normalizedUsername,
    });

    if (existing) {
      newClerkUser = existing;
      await client.users.updateUser(newClerkUser.id, {
        firstName,
        lastName,
      });
      // Update metadata to mark as admin and set role/permissions
      await client.users.updateUserMetadata(newClerkUser.id, {
        publicMetadata: {
          isAdmin: true,
          role: normalizedRole,
          aotfRole,
          requirePasswordChange: false,
          permissions: resolvedPermissions,
        },
      });
    } else {
      // No existing user, create one with a temporary password
      try {
        newClerkUser = await client.users.createUser({
          username: normalizedUsername,
          emailAddress: [normalizedEmail],
          password: selectedPassword,
          firstName,
          lastName,
        });
      } catch (createError: unknown) {
        if (!isClerkDuplicateError(createError)) {
          throw createError;
        }

        const fallbackUser = await findClerkUser(client, {
          email: normalizedEmail,
          username: normalizedUsername,
        });

        if (fallbackUser) {
          newClerkUser = fallbackUser;
          await client.users.updateUser(newClerkUser.id, {
            firstName,
            lastName,
          });
        } else {
          throw createError;
        }
      }

      createdNewUser = Boolean(newClerkUser?.id);

      await client.users.updateUserMetadata(newClerkUser.id, {
        publicMetadata: {
          isAdmin: true,
          role: normalizedRole,
          aotfRole,
          requirePasswordChange: false,
          permissions: resolvedPermissions,
        },
      });
    }

    const clerkUsername = (newClerkUser.username ?? normalizedUsername).toLowerCase();
    const clerkEmail =
      newClerkUser.emailAddresses[0]?.emailAddress?.toLowerCase() ??
      normalizedEmail;

    // Create or update admin doc in MongoDB (upsert)
    const admin = await Admin.findOneAndUpdate(
      {
        $or: [
          { clerkId: newClerkUser.id },
          { email: clerkEmail },
          { username: clerkUsername },
        ],
      },
      {
        $set: {
          clerkId: newClerkUser.id,
          username: clerkUsername,
          email: clerkEmail,
          name,
          role: normalizedRole,
          permissions: resolvedPermissions,
          isActive: true,
          isLocked: false,
          requirePasswordChange: false,
          createdBy: requestingAdmin._id,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    console.log(
      `[admin-provision] Admin ${name} (${email}) provisioned by ${clerkId}`,
    );

    const responseBody: Record<string, unknown> = {
      success: true,
      adminId: admin._id,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
      },
    };
    if (createdNewUser) responseBody.tempPassword = selectedPassword;

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("[admin-provision] Error:", error);

    // If Clerk or Mongo reports a duplicate, try to reuse the existing record instead of failing.
    if (clerkId && username && email && name && role) {
      try {
        const client = await clerkClient();
        const existing = await findClerkUser(client, {
          email: email.trim().toLowerCase(),
          username: username.trim().toLowerCase(),
        });

        if (existing) {
          const normalizedRole = role.trim().toLowerCase();
          const roleDoc = await AdminRole.findOne({ name: normalizedRole }).lean();
          const isSystemRole = ["super_admin", "admin", "support_admin"].includes(
            normalizedRole,
          );
          const rolePermissions = roleDoc?.permissions ?? [];
          const defaultPermissions = isSystemRole
            ? Admin.getDefaultPermissions(normalizedRole)
            : ADMIN_PERMISSION_KEYS.reduce<Record<string, boolean>>((acc, key) => {
                acc[key] = rolePermissions.includes(key);
                return acc;
              }, {});
          const resolvedPermissions = {
            ...defaultPermissions,
            ...sanitizePermissionOverrides(permissions),
          };
          const aotfRole = mapAotfRole(normalizedRole);
          const { firstName, lastName } = splitName(name);
          const clerkUsername = (existing.username ?? username.trim().toLowerCase()).toLowerCase();
          const clerkEmail =
            existing.emailAddresses[0]?.emailAddress?.toLowerCase() ??
            email.trim().toLowerCase();

          await client.users.updateUser(existing.id, {
            firstName,
            lastName,
          });
          await client.users.updateUserMetadata(existing.id, {
            publicMetadata: {
              isAdmin: true,
              role: normalizedRole,
              aotfRole,
              requirePasswordChange: false,
              permissions: resolvedPermissions,
            },
          });

          const admin = await Admin.findOneAndUpdate(
            {
              $or: [
                { clerkId: existing.id },
                { email: clerkEmail },
                { username: clerkUsername },
              ],
            },
            {
              $set: {
                clerkId: existing.id,
                username: clerkUsername,
                email: clerkEmail,
                name,
                role: normalizedRole,
                permissions: resolvedPermissions,
                isActive: true,
                isLocked: false,
                requirePasswordChange: false,
                createdBy: null,
              },
            },
            { upsert: true, returnDocument: "after" },
          );

          return NextResponse.json({
            success: true,
            adminId: admin?._id,
            admin: admin
              ? {
                  id: admin._id,
                  username: admin.username,
                  email: admin.email,
                  name: admin.name,
                  role: admin.role,
                  isActive: admin.isActive,
                  createdAt: admin.createdAt,
                }
              : undefined,
          });
        }
      } catch (fallbackError) {
        console.warn("[admin-provision] Duplicate fallback failed:", fallbackError);
      }
    }

    if (isDuplicateKeyError(error) && clerkId && username && email && name && role) {
      return NextResponse.json(
        {
          error: "Admin already exists with one of those identifiers",
        },
        { status: 409 },
      );
    }

    reportError(error, { route: "POST /api/v1/admin/provision" });
    
    const errObj = error as any;
    const clerkErrorMsg = errObj?.errors?.[0]?.longMessage || errObj?.errors?.[0]?.message;
    
    return NextResponse.json(
      { error: clerkErrorMsg || "Failed to provision admin" },
      { status: errObj?.status || 500 },
    );
  }
}
