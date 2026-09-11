import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { version } from "@/package.json";
import { reportError } from "@/lib/sentry-report";

// Force this route to be dynamic so it always runs fresh (never cached)
export const dynamic = "force-dynamic";

// Bound repeated probe failures so database outages do not flood the free tier.
const HEALTH_ERROR_REPORT_INTERVAL_MS = 5 * 60 * 1000;
let lastHealthErrorReportAt = 0;

/**
 * GET /api/health
 *
 * Lightweight health-check endpoint. Returns the DB connection state,
 * process uptime, and the application version.
 *
 * Intended for:
 *   - Vercel health checks / uptime monitors
 *   - CI smoke tests after deployment
 *   - Manual confirmation that the server + DB are reachable
 *
 * Response shape:
 * {
 *   status:    "ok" | "degraded",
 *   db:        "connected" | "disconnected",
 *   uptime:    number,   // seconds since process start
 *   version:   string,   // from package.json
 *   timestamp: string,   // ISO-8601
 * }
 *
 * HTTP status codes:
 *   200 — server is up; DB may or may not be reachable (check `db` field)
 *   503 — server is up but DB is confirmed unreachable after retries
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor(process.uptime());

  let dbStatus: "connected" | "disconnected" = "disconnected";
  let httpStatus = 503;

  try {
    // Uses the cached connection when warm; retries on cold start
    await dbConnect();
    dbStatus = "connected";
    httpStatus = 200;
  } catch (error) {
    // DB unreachable — still return a response so monitors know the app is alive
    dbStatus = "disconnected";
    const now = Date.now();
    if (now - lastHealthErrorReportAt >= HEALTH_ERROR_REPORT_INTERVAL_MS) {
      lastHealthErrorReportAt = now;
      reportError(error, {
        route: "GET /api/health",
        tags: { layer: "health", dependency: "mongodb" },
        extra: { httpStatus: 503 },
      });
    }
  }

  return NextResponse.json(
    {
      status: dbStatus === "connected" ? "ok" : "degraded",
      db: dbStatus,
      uptime,
      version: version ?? "unknown",
      timestamp,
    },
    { status: httpStatus },
  );
}
