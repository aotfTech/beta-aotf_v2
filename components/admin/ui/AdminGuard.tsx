"use client";

import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import type { AdminPermissionKey } from "@/lib/admin/admin-permissions";
import { Spinner } from "@heroui/spinner";

// This should match the paths and permissions defined in AdminSidebar
export const ROUTE_PERMISSIONS: Record<string, AdminPermissionKey | null> = {
  "/admin": null,
  "/admin/agenda-view": null,
  "/admin/tuitions": "canManagePosts",
  "/admin/jobs": "canManageJobs",
  "/admin/enquiries": "canHandleEnquiries",
  "/admin/feedbacks": "canHandleFeedbacks",
  "/admin/reviews": "canHandleFeedbacks",
  "/admin/users": "canManageUsers",
  "/admin/whatsapp": "canManageWhatsAppGroups",
  "/admin/teachers": "canManageRenownedTeachers",
  "/admin/teacher-reviews": "canManageTeacherReviews",
  "/admin/ads": "canManagePosts",
  "/admin/invoices": "canViewPayments",
  "/admin/payments": "canViewPayments",
  "/admin/activity": "canViewAuditLogs",
  "/admin/settings": "canManageAdmins",
  "/admin/profile": null,
  "/admin/change-password": null,
};

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // If not loaded yet, do nothing
    if (!isLoaded) return;

    // If the path is login or join, allow it
    if (pathname.startsWith("/admin/login") || pathname.startsWith("/admin/join")) {
      setIsAuthorized(true);
      return;
    }

    if (!user) {
      router.replace("/admin/login");
      return;
    }

    const metadata = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const permissions = {
      ...(metadata as Record<string, boolean>),
      ...((metadata.permissions ?? {}) as Record<string, boolean>),
    };

    if (metadata.role === "super_admin") {
      setIsAuthorized(true);
      return;
    }

    // Find the required permission for the current path
    const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
      .sort((a, b) => b.length - a.length)
      .find((route) => pathname === route || pathname.startsWith(route + "/"));

    const requiredPermission = matchedRoute
      ? ROUTE_PERMISSIONS[matchedRoute]
      : null;

    if (requiredPermission && permissions[requiredPermission] !== true) {
      // User lacks the required permission, redirect to admin home
      router.replace("/admin");
    } else {
      setIsAuthorized(true);
    }
  }, [pathname, isLoaded, user, router]);

  if (!isLoaded || !isAuthorized) {
    // Show a spinner while checking auth status
    return (
      <div className="flex-1 min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return <>{children}</>;
}
