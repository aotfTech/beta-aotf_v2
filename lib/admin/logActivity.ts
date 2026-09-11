import mongoose from "mongoose";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import AdminActivityLog, {
  type IAdminActivityLog,
} from "@/lib/models/admin/AdminActivityLog";
import { reportBackgroundError } from "@/lib/sentry-report";

interface LogActivityParams {
  // Admin doc from Admin.findOne() - the primary model across all routes
  admin: { _id: any; role: string; name?: string; username?: string };
  action: string;
  module: IAdminActivityLog["module"];
  targetType: string;
  targetId: mongoose.Types.ObjectId;
  // Human-readable ID shown in the UI (e.g. "P-310526001", "AOTF-ENQ-001", "J-310526001")
  targetRefId?: string | null;
  before?: unknown;
  after?: unknown;
  // Use metadata to pass context like: { enquiryId, postId, jobId, enquiryRefId, postRefId }
  metadata?: Record<string, unknown>;
  targetSnapshot?: unknown;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const {
      admin,
      action,
      module,
      targetType,
      targetId,
      targetRefId = null,
      before = null,
      after = null,
      metadata,
      targetSnapshot,
    } = params;

    let ipAddress: string | null = null;
    let city: string | null = null;
    let country: string | null = null;
    let os: string | null = null;
    let browser: string | null = null;
    let sessionId: string | null = null;

    try {
      const headerStore = await headers();
      ipAddress = headerStore.get("x-forwarded-for")?.split(",")[0] || null;
      city = headerStore.get("x-vercel-ip-city") || null;
      country = headerStore.get("x-vercel-ip-country") || null;

      const userAgent = headerStore.get("user-agent") || "";
      if (userAgent.includes("Windows")) os = "Windows";
      else if (userAgent.includes("Mac OS") || userAgent.includes("Macintosh")) os = "MacOS";
      else if (userAgent.includes("Linux")) os = "Linux";
      else if (userAgent.includes("Android")) os = "Android";
      else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

      if (userAgent.includes("Edg")) browser = "Edge";
      else if (userAgent.includes("Chrome")) browser = "Chrome";
      else if (userAgent.includes("Firefox")) browser = "Firefox";
      else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";

      const authData = await auth();
      sessionId = authData.sessionId;
    } catch (e) {
      // Ignore if called outside of a request context
    }

    await AdminActivityLog.create({
      adminId: admin._id,
      adminName: admin.name ?? null,
      adminUsername: admin.username ?? null,
      adminRole: admin.role,
      action,
      module,
      targetType,
      targetId,
      targetRefId,
      targetSnapshot: targetSnapshot ?? null,
      diff: {
        before,
        after,
      },
      metadata: metadata ?? {},
      ipAddress,
      os,
      browser,
      location: { city, country },
      sessionId,
    });
  } catch (error) {
    console.error("[logActivity] Failed to write admin activity log:", error);
    reportBackgroundError(error, {
      operation: "write-admin-activity-log",
      extra: { action: params.action, module: params.module },
    });
  }
}

export type { LogActivityParams };
