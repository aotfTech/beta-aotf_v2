import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import AdminRole from "@/lib/models/admin/AdminRole";
import { ADMIN_PERMISSION_KEYS } from "@/lib/admin/admin-permissions";
import { logActivity } from "@/lib/admin/logActivity";
import { withApiErrorHandling } from "@/lib/api-utils";

const SYSTEM_ROLES = ["super_admin"] as const;

function toPermissionArray(input: Record<string, boolean> | undefined) {
  if (!input) return [] as string[];
  return ADMIN_PERMISSION_KEYS.filter((key) => Boolean(input[key]));
}

async function ensureSystemRoles() {
  // Global sanitizeFilter strips $in operators, so we query each role individually
  // using plain equality — the same pattern used throughout this codebase.
  const existingDocs = await Promise.all(
    SYSTEM_ROLES.map((name) => AdminRole.findOne({ name }).lean()),
  );
  const existingNames = new Set(
    existingDocs.filter(Boolean).map((role) => role!.name),
  );

  const missing = SYSTEM_ROLES.filter((name) => !existingNames.has(name));
  if (missing.length === 0) return;

  const defaultsByRole: Record<string, Record<string, boolean>> = {
    super_admin: Admin.getDefaultPermissions("super_admin"),
  };

  const insert = missing.map((name) => ({
    name,
    displayName: name
      .split("_")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
    level: name === "super_admin" ? 100 : 50,
    permissions: toPermissionArray(defaultsByRole[name]),
    isSystemRole: true,
  }));

  await AdminRole.insertMany(insert, { ordered: false });
}

async function get(req: Request) {
  await dbConnect();
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let metadata = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      // Ignore and fall through.
    }
  }

  if (metadata?.isAdmin !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentAdmin = await Admin.findOne({ clerkId: userId });
  if (!currentAdmin || !currentAdmin.isActive) {
    return NextResponse.json({ error: "Forbidden: admin not active" }, { status: 403 });
  }

  await ensureSystemRoles();

  const roles = await AdminRole.find({}).sort({ level: -1, createdAt: 1 }).lean();
  return NextResponse.json({ roles });
}

async function post(req: Request) {
  await dbConnect();
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let metadata = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      // Ignore and fall through.
    }
  }

  if (metadata?.isAdmin !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentAdmin = await Admin.findOne({ clerkId: userId });
  if (!currentAdmin || !currentAdmin.isActive || currentAdmin.role !== "super_admin") {
    return NextResponse.json({ error: "Only super_admin can create roles" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    displayName?: string;
    permissions?: string[];
    level?: number;
  };

  const rawName = body.name?.trim();
  const displayName = body.displayName?.trim();
  if (!rawName || !displayName) {
    return NextResponse.json(
      { error: "name and displayName are required" },
      { status: 400 },
    );
  }

  const normalizedName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 64);

  if (!normalizedName) {
    return NextResponse.json({ error: "Invalid role name" }, { status: 400 });
  }

  if (SYSTEM_ROLES.includes(normalizedName as (typeof SYSTEM_ROLES)[number])) {
    return NextResponse.json(
      { error: "System roles cannot be recreated" },
      { status: 400 },
    );
  }

  const permissions = (body.permissions ?? []).filter((perm) =>
    ADMIN_PERMISSION_KEYS.includes(perm as any),
  );

  const role = await AdminRole.create({
    name: normalizedName,
    displayName,
    level: Number.isFinite(body.level) ? Math.max(0, Number(body.level)) : 50,
    permissions,
    isSystemRole: false,
  });

  await logActivity({
    admin: currentAdmin as any,
    action: "CREATE_ADMIN_ROLE",
    module: "ADMIN_MGMT",
    targetType: "AdminRole",
    targetId: role._id as any,
    targetRefId: role.name,
    metadata: { displayName, level: role.level, permissionsCount: permissions.length },
  });

  return NextResponse.json({ role }, { status: 201 });
}

export const GET = withApiErrorHandling(get, "GET /api/v1/admin/roles");
export const POST = withApiErrorHandling(post, "POST /api/v1/admin/roles");
