import { handleApiError } from "@/lib/api-utils";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";

async function requireSuperAdmin(userId: string) {
  const { sessionClaims } = await auth();
  let metadata = sessionClaims?.publicMetadata as
    | Record<string, unknown>
    | undefined;

  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      metadata = undefined;
    }
  }

  if (metadata?.isAdmin !== true) return false;

  await dbConnect();
  const admin = await Admin.findOne({ clerkId: userId }, { role: 1 }).lean();
  return (
    admin?.role === "super_admin" ||
    admin?.role === "admin"
  );
}

/** PATCH /api/v1/admin/payments/payout-percentage
 *  Body: { adminClerkId: string; percentage: number }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await requireSuperAdmin(userId);
    if (!allowed)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as {
      adminClerkId?: string;
      percentage?: unknown;
    };
    const { adminClerkId, percentage } = body;

    if (!adminClerkId || typeof adminClerkId !== "string") {
      return NextResponse.json(
        { error: "adminClerkId is required" },
        { status: 400 },
      );
    }

    const pct = Number(percentage);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return NextResponse.json(
        { error: "percentage must be a number between 0 and 100" },
        { status: 400 },
      );
    }

    await dbConnect();
    const updated = await Admin.findOneAndUpdate(
      { clerkId: adminClerkId },
      { $set: { payoutPercentage: pct } },
      { new: true, select: { clerkId: 1, name: 1, payoutPercentage: 1 } },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, admin: updated });
  } catch (error) {
    return handleApiError(error, "PATCH /api/v1/admin/payments/payout-percentage");
  }
}
