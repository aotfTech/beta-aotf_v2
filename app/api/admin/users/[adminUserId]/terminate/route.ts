import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { canActorManageRole } from "@/lib/admin/hierarchyCheck";
import { logActivity } from "@/lib/admin/logActivity";
import { PERMISSIONS } from "@/lib/admin/permissions";
import { requirePermission } from "@/lib/admin/requirePermission";
import AdminInvite from "@/lib/models/admin/AdminInvite";
import AdminUser from "@/lib/models/admin/AdminUser";
import Admin from "@/lib/models/Admin";
import { withApiErrorHandling } from "@/lib/api-utils";

async function post(
  req: Request,
  { params }: { params: Promise<{ adminUserId: string }> },
) {
  await dbConnect();
  const permissionCheck = await requirePermission(PERMISSIONS.ADMIN_TERMINATE)(req);
  if (permissionCheck.error || !permissionCheck.admin) {
    return (
      permissionCheck.error ??
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
  }

  const actor = permissionCheck.admin;
  const { adminUserId } = await params;

  if (!mongoose.Types.ObjectId.isValid(adminUserId)) {
    return NextResponse.json({ error: "Invalid adminUserId" }, { status: 400 });
  }

  const target = await AdminUser.findById(adminUserId);
  if (!target) {
    return NextResponse.json({ error: "Target admin not found" }, { status: 404 });
  }

  if (!["ACTIVE", "SUSPENDED"].includes(target.status)) {
    return NextResponse.json(
      { error: "Only ACTIVE or SUSPENDED admins can be terminated" },
      { status: 400 },
    );
  }

  const canManageTarget = await canActorManageRole(actor.role, target.role);
  if (!canManageTarget) {
    return NextResponse.json(
      { error: "Hierarchy violation: cannot terminate this admin" },
      { status: 403 },
    );
  }

  const before = {
    status: target.status,
    terminatedAt: target.terminatedAt,
    terminatedBy: target.terminatedBy,
  };

  target.status = "TERMINATED";
  target.terminatedAt = new Date();
  target.terminatedBy = actor._id;
  await target.save();

  const client = await clerkClient();
  const sessions = await client.sessions.getSessionList({ userId: target.clerkUserId });
  await Promise.all(
    sessions.data.map((session) => client.sessions.revokeSession(session.id)),
  );

  await client.users.updateUserMetadata(target.clerkUserId, {
    publicMetadata: { aotfRole: null, terminated: true },
  });

  await AdminInvite.updateMany(
    { invitedBy: target._id, status: "PENDING" },
    { $set: { status: "REVOKED" } },
  );

  // ACTIVITY LOG
  const adminActor = await Admin.findOne({ clerkId: actor.clerkUserId }).lean();
  if (adminActor) {
    await logActivity({
      admin: adminActor as any,
      action: PERMISSIONS.ADMIN_TERMINATE,
    module: "ADMIN_MGMT",
    targetType: "AdminUser",
    targetId: target._id as mongoose.Types.ObjectId,
    before,
    after: {
      status: target.status,
      terminatedAt: target.terminatedAt,
      terminatedBy: target.terminatedBy,
    },
    targetSnapshot: { email: target.email, name: target.name },
    metadata: {
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
    });
  }

  return NextResponse.json({ success: true });
}

export const POST = withApiErrorHandling(
  post,
  "POST /api/admin/users/[adminUserId]/terminate",
);
