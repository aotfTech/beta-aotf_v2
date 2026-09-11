import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { canActorManageRole } from "@/lib/admin/hierarchyCheck";
import { logActivity } from "@/lib/admin/logActivity";
import { PERMISSIONS } from "@/lib/admin/permissions";
import { requirePermission } from "@/lib/admin/requirePermission";
import AdminUser from "@/lib/models/admin/AdminUser";
import Admin from "@/lib/models/Admin";
import { withApiErrorHandling } from "@/lib/api-utils";

async function patch(
  req: Request,
  { params }: { params: Promise<{ adminUserId: string }> },
) {
  await dbConnect();
  const permissionCheck = await requirePermission(PERMISSIONS.ADMIN_ROLE_CHANGE)(req);
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

  const body = (await req.json()) as { newRole?: string };
  if (!body.newRole) {
    return NextResponse.json({ error: "newRole is required" }, { status: 400 });
  }

  const target = await AdminUser.findById(adminUserId);
  if (!target) {
    return NextResponse.json({ error: "Target admin not found" }, { status: 404 });
  }

  const canManageCurrent = await canActorManageRole(actor.role, target.role);
  const canAssignNewRole = await canActorManageRole(actor.role, body.newRole);
  if (!canManageCurrent || !canAssignNewRole) {
    return NextResponse.json(
      { error: "Hierarchy violation: cannot change this role" },
      { status: 403 },
    );
  }

  if (
    body.newRole === "SUPER_ADMIN" &&
    actor.role !== "FOUNDER"
  ) {
    return NextResponse.json(
      { error: "Only founder can assign SUPER_ADMIN" },
      { status: 403 },
    );
  }

  const before = { role: target.role };
  target.role = body.newRole;
  await target.save();

  const client = await clerkClient();
  await client.users.updateUserMetadata(target.clerkUserId, {
    publicMetadata: { aotfRole: body.newRole },
  });

  // ACTIVITY LOG
  const adminActor = await Admin.findOne({ clerkId: actor.clerkUserId }).lean();
  if (adminActor) {
    await logActivity({
      admin: adminActor as any,
      action: PERMISSIONS.ADMIN_ROLE_CHANGE,
    module: "ADMIN_MGMT",
    targetType: "AdminUser",
    targetId: target._id as mongoose.Types.ObjectId,
    before,
    after: { role: target.role },
    targetSnapshot: { email: target.email, name: target.name },
    metadata: {
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
    });
  }

  return NextResponse.json({ success: true, adminUserId, newRole: target.role });
}

export const PATCH = withApiErrorHandling(
  patch,
  "PATCH /api/admin/users/[adminUserId]/role",
);
