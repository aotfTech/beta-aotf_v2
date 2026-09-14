import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Admin from "@/lib/models/Admin";
import { reportError } from "@/lib/sentry-report";

// ─── Route matchers ─────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/admin/login(.*)",
  "/admin/join(.*)",
  "/admin/change-password",
  "/api/admin/join(.*)",
  "/api/v1/webhooks(.*)",
  "/api/v1/posts(.*)",
  "/api/v1/jobs(.*)",
  "/api/v1/renowned-teachers(.*)",
  "/api/v1/reviews(.*)",
  "/api/v1/subjects(.*)", // Subject catalogue is public for onboarding/profile forms
  "/api/v1/verify(.*)",
  "/about(.*)",
  "/contact(.*)",
  "/enquiry(.*)",
  "/jobs(.*)",
  "/tuitions(.*)",
  "/posts(.*)",
  "/invoice(.*)",
  "/privacy-policy(.*)",
  "/refund-policy(.*)",
  "/terms(.*)",
  "/services(.*)",
  "/sso-callback(.*)",
  "/verify(.*)",
  "/test(.*)", // Temporary public route for testing/debugging purposes
  "/admin/invoices(.*)", // Admin route that doesn't require onboarding, so skip the check in the middleware (API route still checks admin auth)
  "/docs(.*)", // Docs are public, but skip onboarding check to avoid unnecessary DB calls for unauthenticated users accessing docs pages. If we need onboarding for docs in the future, we can remove this from the public routes list and add an explicit onboarding check in the /docs/[[...slug]] route handler instead.
  "/api/search(.*)", // Docs search API endpoint should be public
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminApiRoute = createRouteMatcher([
  "/api/v1/admin(.*)",
  "/api/admin(.*)",
]);
const isEnquiryApiRoute = createRouteMatcher(["/api/v1/enquiry(.*)"]);

const isOnboardingRoute = createRouteMatcher(["/onboarding"]);
// API routes called during onboarding — must be reachable before onboarding is complete
const isOnboardingApiRoute = createRouteMatcher([
  "/api/v1/profile(.*)",
  "/api/v1/onboarding(.*)",
  "/api/v1/payments(.*)",
  "/api/v1/users(.*)",
  "/api/v1/feedback(.*)", // Admin-only route, skip onboarding check (API handles auth)
]);
// ─── Clerk middleware instance ───────────────────────────────────────

const middleware = clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const meta = sessionClaims?.publicMetadata as
    | Record<string, unknown>
    | undefined;

  const { pathname } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  const host = requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host") ?? "";
  const isDocsHost = host === "docs.aotf.in" || host === "www.docs.aotf.in";

  if (isDocsHost && pathname === "/") {
    return NextResponse.redirect(new URL("/docs", req.url));
  }

  if (
    isDocsHost &&
    !pathname.startsWith("/docs") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    pathname !== "/favicon.ico" &&
    !pathname.startsWith("/monitoring")
  ) {
    return NextResponse.redirect(new URL("/docs", req.url));
  }

  requestHeaders.set("x-aotf-pathname", pathname);
  const forward = () => NextResponse.next({ request: { headers: requestHeaders } });
  const method = req.method;
  const start = Date.now();
  const isApiRequest = pathname.startsWith("/api/");
  const isProtectedEnquiryApiRequest =
    isEnquiryApiRoute(req) &&
    !(pathname === "/api/v1/enquiry" && method === "POST");
  const isProtectedAdminRequest =
    isAdminRoute(req) || isAdminApiRoute(req) || isProtectedEnquiryApiRequest;
  const onboardingRequiredResponse = () =>
    isApiRequest
      ? NextResponse.json(
          { error: "Onboarding required", redirectTo: "/onboarding" },
          { status: 403 },
        )
      : NextResponse.redirect(new URL("/onboarding", req.url));

  // Debug logging for API routes
  if (pathname === "/api/v1/posts") {
    console.log("[proxy DEBUG] /api/v1/posts request");
    console.log("  - userId:", userId);
    console.log("  - meta?.isAdmin:", meta?.isAdmin);
    console.log("  - method:", method);
  }
  // 0. /dashboard/redirect → /u/[username]/dashboard
  // username is NOT in the Clerk JWT by default, so we always look it up from DB.
  if (pathname === "/dashboard/redirect" && userId) {
    try {
      await dbConnect();
      const userDoc = await User.findOne(
        { clerkId: userId },
        { username: 1, onboardingCompleted: 1 },
      ).lean();
      if (userDoc?.onboardingCompleted && userDoc?.username) {
        return NextResponse.redirect(
          new URL(`/u/${userDoc.username}/dashboard`, req.url),
        );
      }
      // Payment not completed yet — send to onboarding
      return NextResponse.redirect(new URL("/onboarding", req.url));
    } catch (err) {
      reportError(err, {
        tags: { layer: "proxy" },
        extra: { pathname, userId, phase: "dashboard-redirect" },
      });
      // DB unreachable — send to home as safe fallback
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // 1. Admin route guard
  // Track if user is an admin to skip onboarding checks later
  let isUserAdmin = false;

  const shouldResolveAdminStatus =
    userId && (isProtectedAdminRequest || isOnboardingRoute(req) || isOnboardingApiRoute(req));

  if (shouldResolveAdminStatus) {
    try {
      await dbConnect();
      const adminDoc = await Admin.findOne(
        { clerkId: userId },
        { isActive: 1, isLocked: 1, requirePasswordChange: 1 },
      ).lean();

      if (adminDoc) {
        isUserAdmin = true;
      }
    } catch (err) {
      console.error("[proxy] Error resolving admin status for onboarding check:", err);
      reportError(err, {
        tags: { layer: "proxy" },
        extra: { pathname, userId, phase: "admin-status-onboarding" },
      });
    }
  }

  if (isProtectedAdminRequest && !isPublicRoute(req)) {
    // Must be signed in
    if (!userId) {
      if (isApiRequest) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      return NextResponse.redirect(new URL("/", req.url));
    }

    // Check admin status — use JWT claim first, but fall back to DB if stale
    // (Clerk JWT may not have updated publicMetadata immediately after sign-in)
    let isAdminConfirmed = meta?.isAdmin === true;
    let adminDoc: {
      isActive?: boolean;
      isLocked?: boolean;
      requirePasswordChange?: boolean;
    } | null = null;

    try {
      await dbConnect();
      adminDoc = await Admin.findOne(
        { clerkId: userId },
        { isActive: 1, isLocked: 1, requirePasswordChange: 1 },
      ).lean();

      // DB is the source of truth — if admin record exists, they're an admin
      if (adminDoc) {
        isAdminConfirmed = true;
        isUserAdmin = true;
      }
    } catch (err) {
      console.error("[proxy] Error checking admin status:", err);
      reportError(err, {
        tags: { layer: "proxy" },
        extra: { pathname, userId, phase: "admin-guard" },
      });
      // If DB is down, fall back to JWT claim to avoid blocking admins
    }

    if (!isAdminConfirmed || !adminDoc) {
      // Neither JWT nor DB confirms admin status — redirect to home
      if (isApiRequest) {
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 },
        );
      }

      return NextResponse.redirect(new URL("/", req.url));
    }

    // Additional admin-specific checks for authenticated admins
    if (!adminDoc.isActive) {
      // Admin account is deactivated
      if (isApiRequest) {
        return NextResponse.json(
          { error: "Admin account is deactivated" },
          { status: 403 },
        );
      }

      return NextResponse.redirect(
        new URL("/admin/login?error=deactivated", req.url),
      );
    }

    if (adminDoc.isLocked) {
      // Admin account is locked (failed login attempts or manual lock)
      if (isApiRequest) {
        return NextResponse.json(
          { error: "Admin account is locked" },
          { status: 403 },
        );
      }

      return NextResponse.redirect(
        new URL("/admin/login?error=locked", req.url),
      );
    }

    // If admin requires password change, only allow access to password change page
    if (
      adminDoc.requirePasswordChange &&
      pathname !== "/admin/change-password"
    ) {
      if (isApiRequest) {
        return NextResponse.json(
          { error: "Password change required" },
          { status: 403 },
        );
      }

      return NextResponse.redirect(new URL("/admin/change-password", req.url));
    }
  }

  if (userId && meta?.isAdmin === true) {
    // Preserve admin access for non-admin page routes when metadata is fresh.
    isUserAdmin = true;
  }

  // Short-circuit onboarding requests for admins to avoid repeated client/server
  // calls when an admin is signed in. This prevents page POSTs to `/onboarding`
  // and API calls to `/api/v1/onboarding` from being processed.
  if (isUserAdmin && (pathname === "/api/v1/onboarding" || pathname === "/onboarding")) {
    if (isApiRequest || pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: true, message: "Onboarding skipped for admin" },
        { status: 200 },
      );
    }

    // For non-API POSTs to the onboarding page, redirect admins to home.
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 2. Auth guard for all protected routes
  if (!isPublicRoute(req) && !userId) {
    if (isEnquiryApiRoute(req) && method === "POST") {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isAdminRoute(req) || isAdminApiRoute(req)) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // 3. Onboarding gate — JWT claim first, DB fallback if claim is absent
  // Skip onboarding check for admins
  if (
    userId &&
    !isUserAdmin &&
    !isPublicRoute(req) &&
    !isAdminRoute(req) &&
    !isAdminApiRoute(req) &&
    !isOnboardingRoute(req) &&
    !isOnboardingApiRoute(req)
  ) {
    // Fast path: JWT already carries the flag (normal case after first login
    // post-payment, or after Clerk propagates the metadata update).
    if (meta?.onboardingCompleted === true) {
      // allowed through — fall to NextResponse.next() below
    } else {
      // Slow path: JWT claim is missing or stale (happens on the first re-login
      // after payment because Clerk issues the session token before the
      // publicMetadata update propagates). Check the DB as the source of truth.
      try {
        await dbConnect();
        const userDoc = await User.findOne(
          { clerkId: userId },
          { onboardingCompleted: 1 },
        ).lean();

        if (!userDoc?.onboardingCompleted) {
          return onboardingRequiredResponse();
        }
        // DB says completed — let the user through. Clerk metadata will catch
        // up on the next token refresh and the slow path won't be needed again.
      } catch (err) {
        reportError(err, {
          tags: { layer: "proxy" },
          extra: { pathname, userId, phase: "onboarding-gate" },
        });
        // If the DB is unreachable, fall back to the JWT claim to avoid
        // blocking the user with a redirect loop.
        if (meta?.onboardingCompleted !== true) {
          return onboardingRequiredResponse();
        }
      }
    }
  }

  // 4. Request logging for API routes
  if (pathname.startsWith("/api/")) {
    const duration = Date.now() - start;
    console.log(`[${method}] ${pathname} — ${duration}ms`);
  }

  return forward();
});

// ─── Proxy ───────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  // Bypass clerkMiddleware entirely for webhook routes.
  // clerkMiddleware rebuilds the request Headers object internally, which
  // strips the svix-id / svix-timestamp / svix-signature headers that
  // Clerk attaches to every webhook delivery. Those headers must reach
  // the route handler intact so verifyWebhook() can authenticate the call.
  if (request.nextUrl.pathname.startsWith("/api/v1/webhooks/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-aotf-pathname", request.nextUrl.pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const event = {
    sourcePage: "/",
    waitUntil: () => { },
    passThroughOnException: () => { },
  } as unknown as NextFetchEvent;

  return middleware(request, event);
}

// ─── Matcher ────────────────────────────────────────────────────────────

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
