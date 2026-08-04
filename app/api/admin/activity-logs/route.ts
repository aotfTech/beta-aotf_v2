import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import AdminActivityLog from "@/lib/models/admin/AdminActivityLog";
import { handleApiError } from "@/lib/api-utils";

export async function GET(req: Request) {
  await dbConnect();
  
  const authData = await auth();
  const { userId, sessionClaims } = authData;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let metadata = sessionClaims?.publicMetadata as Record<string, any> | undefined;
  
  // Fallback to clerkClient if publicMetadata is not in the JWT token
  if (!metadata || Object.keys(metadata).length === 0) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      metadata = clerkUser.publicMetadata as Record<string, any> | undefined;
    } catch (error) {
      console.error("Failed to fetch user metadata from Clerk API", error);
    }
  }

  if (!metadata) {
    return NextResponse.json({ error: "Unauthorized. User metadata missing." }, { status: 401 });
  }
  
  // Superadmin check
  const isSuperAdminRole = metadata.role === "super_admin" || metadata.aotfRole === "SUPER_ADMIN";
  const permissions = metadata.permissions || {};
  const hasPermissionsObject = Object.keys(permissions).length > 0;
  
  // Ensure all permissions are explicitly true
  const allPermissionsTrue = hasPermissionsObject && Object.values(permissions).every(val => val === true);

  if (!isSuperAdminRole || !allPermissionsTrue) {
    return NextResponse.json({ error: "Forbidden: Superadmin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const module = searchParams.get("module");
  const action = searchParams.get("action");
  const adminId = searchParams.get("adminId");
  const search = searchParams.get("search")?.trim();
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10), 1), 100);
  const skip = (page - 1) * limit;

  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const query: any = {};
  if (module) query.module = module;
  if (action) query.action = action;
  if (adminId) query.adminId = adminId;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearch, "i");
    query.$or = [
      { adminName: searchRegex },
      { adminUsername: searchRegex },
      { targetRefId: searchRegex },
      { "metadata.postId": searchRegex },
      { "metadata.jobId": searchRegex },
      { "metadata.enquiryId": searchRegex },
      { "metadata.invoiceId": searchRegex },
      { "metadata.action": searchRegex },
      { "metadata.notes": searchRegex },
    ];
  }

  try {
    const logs = await AdminActivityLog.find(query)
      .populate("adminId", "name username email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
      
    const total = await AdminActivityLog.countDocuments(query);

    return NextResponse.json({ 
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/activity-logs");
  }
}
