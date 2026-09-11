"use client";

import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Avatar } from "@heroui/avatar";
import { Badge } from "@heroui/badge";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Camera, Shield, Mail, User, ShieldCheck } from "lucide-react";
import { ADMIN_PERMISSION_CATALOG } from "@/lib/admin/admin-permissions";
import { addToast } from "@heroui/toast";
import { reportClientError } from "@/lib/client-report-error";

export default function AdminProfilePage() {
  const { user, isLoaded } = useUser();
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2">
        <p className="text-lg font-semibold text-danger">User not found</p>
      </div>
    );
  }

  const permissions = (user.publicMetadata?.permissions || {}) as Record<string, boolean>;
  const role = (user.publicMetadata?.role as string) || "admin";
  const aotfRole = (user.publicMetadata?.aotfRole as string);
  const isSuperAdmin = role === "super_admin" || aotfRole === "SUPER_ADMIN";

  let activePermissions = ADMIN_PERMISSION_CATALOG.filter(p => permissions[p.key] === true);
  
  // Super Admins typically have all permissions implicitly, so we can display them all or note it
  if (isSuperAdmin && activePermissions.length === 0) {
     activePermissions = ADMIN_PERMISSION_CATALOG; // assume full catalog if no granular perms
  }

  const updateAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      addToast({ description: "Please choose a valid image file.", color: "danger" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast({ description: "Avatar size must be 5MB or less.", color: "danger" });
      return;
    }

    setIsAvatarSaving(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      addToast({ description: "Avatar updated successfully.", color: "success" });
    } catch (error) {
      reportClientError(error, { feature: "admin-profile-avatar" });
      addToast({ description: "Failed to update avatar. Please try again.", color: "danger" });
    } finally {
      setIsAvatarSaving(false);
    }
  };

  const handleAvatarInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await updateAvatar(file);
    event.target.value = "";
  };

  return (
    <div className="container mx-auto px-4 max-w-5xl space-y-6 py-6 w-full">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="text-primary" size={28} />
        <h1 className="text-2xl font-bold">My Profile</h1>
      </div>

      {/* Profile Header */}
      <Card className="p-4 md:p-6 w-full shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <label className="cursor-pointer relative group">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarInputChange}
              disabled={isAvatarSaving}
            />
            <Badge
              isOneChar
              color="success"
              content={<Camera size={14} className="text-white" />}
              placement="bottom-right"
              shape="circle"
              size="lg"
              className="cursor-pointer z-10"
            >
              <Avatar
                className={`w-28 h-28 text-large transition-opacity shadow-md ${isAvatarSaving ? 'opacity-50' : 'opacity-100 group-hover:opacity-80'}`}
                src={user.imageUrl}
                name={user.fullName || "Admin"}
              />
            </Badge>
            {isAvatarSaving && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <Spinner size="sm" color="white" />
              </div>
            )}
          </label>
          
          <div className="flex flex-col items-center md:items-start gap-2 flex-1">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{user.fullName || "Administrator"}</h2>
            <Chip size="sm" color="primary" variant="flat" className="uppercase font-semibold tracking-wider text-xs">
              {role.replace('_', ' ')}
            </Chip>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md text-center md:text-left">
              Update your avatar by clicking on your profile image. Your username and email are securely managed by your organization.
            </p>
          </div>
        </div>
      </Card>

      {/* Account Details & Permissions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Account Details */}
        <Card className="p-4 lg:col-span-1 h-fit shadow-sm">
          <CardHeader className="p-0 pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
              <User size={18} className="text-primary" />
              Account Details
            </h3>
          </CardHeader>
          <CardBody className="p-0 pt-4 space-y-4">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
                <User size={14} /> Username
              </p>
              <p className="font-semibold text-sm bg-zinc-100 dark:bg-zinc-800/50 p-2.5 rounded-xl truncate border border-zinc-200 dark:border-zinc-800">
                {user.username || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
                <Mail size={14} /> Email Address
              </p>
              <p className="font-semibold text-sm bg-zinc-100 dark:bg-zinc-800/50 p-2.5 rounded-xl truncate border border-zinc-200 dark:border-zinc-800">
                {user.primaryEmailAddress?.emailAddress || "—"}
              </p>
            </div>
            <div className="pt-2">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                These fields are read-only. Contact super admin for changes.
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Permissions */}
        <Card className="p-4 lg:col-span-2 shadow-sm">
          <CardHeader className="p-0 pb-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
              <Shield size={18} className="text-primary" />
              My Permissions
            </h3>
            {isSuperAdmin && (
              <Chip size="sm" color="success" variant="flat">Full Access</Chip>
            )}
          </CardHeader>
          <CardBody className="p-0 pt-4">
            {activePermissions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activePermissions.map(permission => (
                  <div key={permission.key} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition-colors">
                    <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100 mb-1">{permission.label}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{permission.explanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 dark:text-zinc-400">
                <Shield size={32} className="mb-2 opacity-50" />
                <p className="font-medium text-sm">No specific permissions assigned</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
