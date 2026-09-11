import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import User from "@/lib/models/User";
import { logActivity } from "@/lib/admin/logActivity";
import { reportError } from "@/lib/sentry-report";
import { withApiErrorHandling } from "@/lib/api-utils";

const allowedStatuses = new Set(["active", "blocked", "deleted"]);

async function patch(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  await dbConnect();

  const { userId: clerkId, sessionClaims } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let metadata = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(clerkId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      // Ignore and fall through to DB lookup.
    }
  }

  if (metadata?.isAdmin !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentAdmin = await Admin.findOne({ clerkId });
  if (!currentAdmin || !currentAdmin.isActive) {
    return NextResponse.json({ error: "Forbidden: admin not active" }, { status: 403 });
  }

  if (currentAdmin.role !== "super_admin" && !currentAdmin.permissions.canManageUsers) {
    return NextResponse.json(
      { error: "You don't have permission to manage users" },
      { status: 403 },
    );
  }

  const { userId } = await params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const body = (await req.json()) as { status?: string };
  if (!body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json(
      { error: "status must be one of active, blocked, deleted" },
      { status: 400 },
    );
  }

  const target = await User.findById(userId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  target.status = body.status as "active" | "blocked" | "deleted";
  await target.save();

  try {
    const client = await clerkClient();
    if (body.status === "blocked" || body.status === "deleted") {
      const sessions = await client.sessions.getSessionList({ userId: target.clerkId });
      await Promise.all(sessions.data.map((session) => client.sessions.revokeSession(session.id)));
    }

    await client.users.updateUserMetadata(target.clerkId, {
      publicMetadata: {
        accountStatus: body.status,
      },
    });
  } catch (err) {
    // Non-fatal: DB status is the source of truth.
    reportError(err, {
      route: "PATCH /api/admin/app-users/[userId]/status",
      tags: { integration: "clerk", operation: "sync-account-status" },
    });
  }

  try {
    const actionName = body.status === "active" ? "UNBLOCK_USER" : "BLOCK_USER";
    await logActivity({
      admin: currentAdmin,
      action: actionName,
      module: "USER_MGMT",
      targetType: "User",
      targetId: target._id as any,
      targetRefId: target.clerkId,
      metadata: { status: body.status },
    });
  } catch (e) {
    console.error(`Failed to log ${body.status} user`, e);
  }

  return NextResponse.json({
    success: true,
    user: {
      id: String(target._id),
      status: target.status,
    },
  });
}

export const PATCH = withApiErrorHandling(
  patch,
  "PATCH /api/admin/app-users/[userId]/status",
);
