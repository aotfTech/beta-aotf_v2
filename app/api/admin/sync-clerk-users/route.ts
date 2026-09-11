import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import { syncClerkAppUsers } from "@/lib/migration/sync-clerk-app-users";
import { withApiErrorHandling } from "@/lib/api-utils";

async function requireManageUsersAdmin(userId: string) {
  const { sessionClaims } = await auth();
  let metadata = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;

  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      // Fall through to DB admin lookup.
    }
  }

  if (metadata?.isAdmin !== true) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const currentAdmin = await Admin.findOne({ clerkId: userId });
  if (!currentAdmin || !currentAdmin.isActive) {
    return {
      error: NextResponse.json({ error: "Forbidden: admin not active" }, { status: 403 }),
    };
  }

  if (currentAdmin.role !== "super_admin" && !currentAdmin.permissions.canManageUsers) {
    return {
      error: NextResponse.json(
        { error: "You don't have permission to sync users" },
        { status: 403 },
      ),
    };
  }

  return { admin: currentAdmin };
}

async function post() {
  await dbConnect();

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await requireManageUsersAdmin(userId);
  if (access.error) return access.error;

  const sync = await syncClerkAppUsers();
  return NextResponse.json({ ok: true, ...sync });
}

export const POST = withApiErrorHandling(post, "POST /api/admin/sync-clerk-users");
