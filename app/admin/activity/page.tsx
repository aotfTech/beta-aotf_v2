"use client";

import { reportClientError } from "@/lib/client-report-error";
import React, { useEffect, useState, useCallback } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Pagination } from "@heroui/pagination";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import {
  Activity,
  Monitor,
  MapPin,
  RefreshCw,
  Clock,
  Info,
  Search,
  FileText,
  Briefcase,
  ClipboardList,
  Shield,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type ActivityLog = {
  _id: string;
  adminId: { _id: string; name: string; username?: string; email: string; role: string } | null;
  adminName?: string;
  adminUsername?: string;
  adminRole: string;
  action: string;
  module: string;
  targetType: string;
  targetRefId?: string | null;
  targetId: string;
  targetSnapshot?: any;
  diff: { before?: any; after?: any };
  metadata: {
    postId?: string;
    jobId?: string;
    enquiryId?: string;
    fromStatus?: string;
    toStatus?: string;
    action?: string;
    notes?: string;
    [key: string]: any;
  };
  ipAddress?: string;
  os?: string;
  browser?: string;
  location?: { city?: string; country?: string };
  sessionId?: string;
  createdAt: string;
};

// Human-readable action map
const ACTION_LABELS: Record<string, { label: string; verb: string; color: "success" | "primary" | "danger" | "warning" | "default" }> = {
  CREATE_POST:           { label: "Created Tuition Post",   verb: "created tuition post",   color: "success" },
  UPDATE_POST:           { label: "Updated Tuition Post",   verb: "updated tuition post",   color: "primary" },
  DELETE_POST:           { label: "Deleted Tuition Post",   verb: "deleted tuition post",   color: "danger" },
  CREATE_JOB:            { label: "Created Job Post",       verb: "created job post",       color: "success" },
  UPDATE_JOB:            { label: "Updated Job Post",       verb: "updated job post",       color: "primary" },
  DELETE_JOB:            { label: "Deleted Job Post",       verb: "deleted job post",       color: "danger" },
  UPDATE_ENQUIRY_STATUS: { label: "Updated Enquiry Status", verb: "updated enquiry status", color: "warning" },
  CREATE_ENQUIRY:        { label: "Created Enquiry",        verb: "created enquiry",        color: "success" },
  UPDATE_STARTING_DATE:  { label: "Updated Starting Date",  verb: "updated starting date",  color: "primary" },
  UPDATE_APPLICATION_STATUS: { label: "Updated Application", verb: "updated application status", color: "primary" },
  GENERATE_INVOICE:      { label: "Generated Invoice",      verb: "generated invoice",      color: "success" },
  UPDATE_INVOICE_STATUS: { label: "Updated Invoice Status", verb: "updated invoice status", color: "warning" },
  BLOCK_USER:            { label: "Blocked User",           verb: "blocked user",           color: "danger" },
  UNBLOCK_USER:          { label: "Unblocked User",         verb: "unblocked user",         color: "success" },
  ADMIN_INVITE:          { label: "Invited Admin",          verb: "invited admin",          color: "success" },
  ADMIN_ROLE_CHANGE:     { label: "Changed Admin Role",     verb: "changed admin role",     color: "warning" },
  ADMIN_TERMINATE:       { label: "Terminated Admin",       verb: "terminated admin",       color: "danger" },
  UPDATE_FEEDBACK:       { label: "Updated Feedback",       verb: "updated feedback",       color: "primary" },
  CREATE_AD:             { label: "Created Ad",             verb: "created ad",             color: "success" },
  UPDATE_AD:             { label: "Updated Ad",             verb: "updated ad",             color: "primary" },
  DELETE_AD:             { label: "Deleted Ad",             verb: "deleted ad",             color: "danger" },
  CREATE_RENOWNED_TEACHER: { label: "Added Renowned Teacher", verb: "added renowned teacher", color: "success" },
  UPDATE_RENOWNED_TEACHER: { label: "Updated Renowned Teacher", verb: "updated renowned teacher", color: "primary" },
  DELETE_RENOWNED_TEACHER: { label: "Deleted Renowned Teacher", verb: "deleted renowned teacher", color: "danger" },
  CREATE_ADMIN_ROLE:     { label: "Created Admin Role",     verb: "created admin role",     color: "success" },
  CREATE_SUBJECT:        { label: "Created Subject",        verb: "created subject",        color: "success" },
  CREATE_SOURCE:         { label: "Created Lead Source",    verb: "created lead source",    color: "success" },
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  CRM:        <FileText size={14} />,
  FRM:        <Briefcase size={14} />,
  COMMS:      <ClipboardList size={14} />,
  ADMIN_MGMT: <Shield size={14} />,
};

function getAdminDisplayName(log: ActivityLog) {
  // Prefer populated data, then denormalized fallback
  const populated = log.adminId;
  if (populated) return { name: populated.name, username: populated.username ?? log.adminUsername ?? null };
  return { name: log.adminName ?? "Unknown Admin", username: log.adminUsername ?? null };
}

type AdminOption = {
  _id: string;
  name: string;
  username?: string;
  email: string;
  role: string;
};

function toAdminOption(admin: any): AdminOption {
  const fallbackName = [admin?.firstName, admin?.lastName].filter(Boolean).join(" ");
  const id = admin?._id ?? admin?.id ?? admin?.clerkId ?? admin?.email ?? fallbackName ?? "unknown";

  return {
    _id: String(id),
    name: admin?.name ?? fallbackName ?? admin?.username ?? "Unknown Admin",
    username: admin?.username,
    email: admin?.email ?? "",
    role: admin?.role ?? "",
  };
}

function mergeAdminOptions(existing: AdminOption[], incoming: any[]): AdminOption[] {
  const merged = new Map<string, AdminOption>();

  existing.forEach((admin) => {
    if (admin._id) merged.set(admin._id, admin);
  });

  incoming.map(toAdminOption).forEach((admin) => {
    if (admin._id && !merged.has(admin._id)) merged.set(admin._id, admin);
  });

  return Array.from(merged.values());
}

function buildNarrative(log: ActivityLog): React.ReactNode {
  const { name, username } = getAdminDisplayName(log);
  const actionInfo = ACTION_LABELS[log.action];
  const verb = actionInfo?.verb ?? log.action.toLowerCase().replace(/_/g, " ");

  const adminLabel = (
    <span className="font-semibold text-foreground">
      {name}
      {username && <span className="text-default-400 font-normal"> @{username}</span>}
    </span>
  );

  const role = (
    <Chip size="sm" variant="flat" color="secondary" className="h-4 text-[9px] px-1.5 py-0 inline-flex ml-1">
      {log.adminRole}
    </Chip>
  );
  <br />

  const meta = log.metadata ?? {};

  // Post-related actions
  if (log.action === "CREATE_POST" || log.action === "UPDATE_POST") {
    const postRef = meta.postId ?? log.targetRefId;
    const enquiryRef = meta.enquiryId;
    return (
      <span>
        {adminLabel}{role} {verb}{" "}
        {postRef ? (
          <a href={`/admin/tuitions?search=${postRef}`} className="font-mono font-semibold text-primary underline underline-offset-2 hover:text-primary-400" target="_blank" rel="noreferrer">
            {postRef}
          </a>
        ) : <span className="font-mono text-default-500">{log.targetId}</span>}
        {enquiryRef && (
          <> against enquiry{" "}
            <a href={`/admin/enquiries?search=${enquiryRef}`} className="font-mono font-semibold text-warning-600 underline underline-offset-2 hover:text-warning-400" target="_blank" rel="noreferrer">
              {enquiryRef}
            </a>
          </>
        )}
      </span>
    );
  }

  if (log.action === "DELETE_POST") {
    const postRef = meta.postId ?? log.targetRefId;
    return (
      <span>{adminLabel}{role} deleted tuition post <span className="font-mono font-semibold text-danger">{postRef ?? log.targetId}</span></span>
    );
  }

  // Job-related actions
  if (log.action === "CREATE_JOB" || log.action === "UPDATE_JOB") {
    const jobRef = meta.jobId ?? log.targetRefId;
    const enquiryRef = meta.enquiryId;
    return (
      <span>
        {adminLabel}{role} {verb}{" "}
        {jobRef ? (
          <a href={`/admin/jobs?search=${jobRef}`} className="font-mono font-semibold text-primary underline underline-offset-2 hover:text-primary-400" target="_blank" rel="noreferrer">
            {jobRef}
          </a>
        ) : <span className="font-mono text-default-500">{log.targetId}</span>}
        {enquiryRef && (
          <> against enquiry{" "}
            <a href={`/admin/enquiries?search=${enquiryRef}`} className="font-mono font-semibold text-warning-600 underline underline-offset-2 hover:text-warning-400" target="_blank" rel="noreferrer">
              {enquiryRef}
            </a>
          </>
        )}
      </span>
    );
  }

  if (log.action === "DELETE_JOB") {
    const jobRef = meta.jobId ?? log.targetRefId;
    return (
      <span>{adminLabel}{role} deleted job post <span className="font-mono font-semibold text-danger">{jobRef ?? log.targetId}</span></span>
    );
  }

  // Enquiry status update
  if (log.action === "UPDATE_ENQUIRY_STATUS") {
    const enquiryRef = meta.enquiryId ?? log.targetRefId;
    return (
      <span>
        {adminLabel}{role} updated status of enquiry{" "}
        {enquiryRef ? (
          <a href={`/admin/enquiries?search=${enquiryRef}`} className="font-mono font-semibold text-warning-600 underline underline-offset-2 hover:text-warning-400" target="_blank" rel="noreferrer">
            {enquiryRef}
          </a>
        ) : <span className="font-mono text-default-500">{log.targetId}</span>}
        {meta.fromStatus && meta.toStatus && (
          <> from <span className="font-semibold text-default-500">{meta.fromStatus}</span> → <span className="font-semibold text-success-600">{meta.toStatus}</span></>
        )}
      </span>
    );
  }

  // Application status update
  if (log.action === "UPDATE_APPLICATION_STATUS") {
    const postRef = meta.postId ?? log.targetRefId;
    return (
      <span>
        {adminLabel}{role} updated application status to <span className="font-semibold text-primary">{meta.status}</span> for post{" "}
        {postRef ? (
          <a href={`/admin/tuitions?search=${postRef}`} className="font-mono font-semibold text-primary underline underline-offset-2 hover:text-primary-400" target="_blank" rel="noreferrer">
            {postRef}
          </a>
        ) : <span className="font-mono text-default-500">{log.targetId}</span>}
      </span>
    );
  }

  // Starting date update
  if (log.action === "UPDATE_STARTING_DATE") {
    const postRef = meta.postId ?? log.targetRefId;
    return (
      <span>
        {adminLabel}{role} updated starting date{" "}
        {meta.startingDate ? (
          <>to <span className="font-semibold text-primary">{format(new Date(meta.startingDate), "MMM d, yyyy")}</span>{" "}</>
        ) : (
          <>to <span className="font-semibold text-default-500">TBA</span>{" "}</>
        )}
        for post{" "}
        {postRef ? (
          <a href={`/admin/tuitions?search=${postRef}`} className="font-mono font-semibold text-primary underline underline-offset-2 hover:text-primary-400" target="_blank" rel="noreferrer">
            {postRef}
          </a>
        ) : <span className="font-mono text-default-500">{log.targetId}</span>}
      </span>
    );
  }

  // Invoice generation/update
  if (log.action === "GENERATE_INVOICE" || log.action === "UPDATE_INVOICE_STATUS") {
    const invoiceRef = meta.invoiceId ?? log.targetRefId;
    return (
      <span>
        {adminLabel}{role} {verb}{" "}
        {invoiceRef ? (
          <a href={`/admin/invoices?search=${invoiceRef}`} className="font-mono font-semibold text-success-600 underline underline-offset-2 hover:text-success-400" target="_blank" rel="noreferrer">
            {invoiceRef}
          </a>
        ) : <span className="font-mono text-default-500">{log.targetId}</span>}
        {meta.status && (
          <> to <span className="font-semibold">{meta.status}</span></>
        )}
      </span>
    );
  }

  // User Mgmt
  if (log.action === "BLOCK_USER" || log.action === "UNBLOCK_USER") {
    return (
      <span>
        {adminLabel}{role} {verb} <a href={`/u/${log.targetRefId}`} className="font-semibold text-primary underline underline-offset-2 hover:text-primary-400" target="_blank" rel="noreferrer">{log.targetRefId}</a>
      </span>
    );
  }

  // Admin Mgmt
  if (log.action === "ADMIN_INVITE") {
    return (
      <span>
        {adminLabel}{role} invited <span className="font-semibold text-primary">{meta.inviteeName ?? (log.targetSnapshot as any)?.email}</span> as <span className="font-semibold">{meta.assignedRole}</span>
      </span>
    );
  }

  if (log.action === "ADMIN_ROLE_CHANGE") {
    return (
      <span>
        {adminLabel}{role} changed role of <span className="font-semibold">{log.diff?.after?.role}</span> admin
      </span>
    );
  }

  if (log.action === "ADMIN_TERMINATE") {
    return (
      <span>
        {adminLabel}{role} terminated an admin
      </span>
    );
  }

  if (log.action === "CREATE_ADMIN_ROLE") {
    return (
      <span>
        {adminLabel}{role} created a new admin role <span className="font-semibold text-primary">{meta.displayName ?? log.targetRefId}</span>
      </span>
    );
  }

  if (log.action === "CREATE_SUBJECT") {
    return (
      <span>
        {adminLabel}{role} added a new subject <span className="font-semibold text-primary">{meta.label ?? log.targetRefId}</span>
      </span>
    );
  }

  if (log.action === "CREATE_SOURCE") {
    return (
      <span>
        {adminLabel}{role} added a new lead source <span className="font-semibold text-primary">{meta.label ?? log.targetRefId}</span>
      </span>
    );
  }

  // Comms / Feedback
  if (log.action === "UPDATE_FEEDBACK") {
    return (
      <span>
        {adminLabel}{role} updated feedback <a href={`/admin/feedback?id=${log.targetId}`} className="font-semibold text-primary underline underline-offset-2 hover:text-primary-400" target="_blank" rel="noreferrer">{log.targetId.slice(-6)}</a>
        {meta.status && <> to <span className="font-semibold">{meta.status}</span></>}
      </span>
    );
  }

  // Renowned Teachers
  if (["CREATE_RENOWNED_TEACHER", "UPDATE_RENOWNED_TEACHER", "DELETE_RENOWNED_TEACHER"].includes(log.action)) {
    const teacherName = (log.targetSnapshot as any)?.name ?? log.targetId.slice(-6);
    return (
      <span>
        {adminLabel}{role} {verb} <span className="font-semibold text-primary">{teacherName}</span>
      </span>
    );
  }

  // Ads
  if (["CREATE_AD", "UPDATE_AD", "DELETE_AD"].includes(log.action)) {
    const placement = meta.placement ?? log.targetRefId ?? log.targetId.slice(-6);
    return (
      <span>
        {adminLabel}{role} {verb} for placement <span className="font-semibold text-primary">{placement}</span>
      </span>
    );
  }

  // Generic fallback
  return (
    <span>{adminLabel}{role} {verb} <span className="font-mono text-xs text-default-500">{log.targetRefId ?? log.targetId}</span></span>
  );
}

const PAGE_SIZE = 10;

export default function SuperadminActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/admins");
      if (!res.ok) throw new Error("Failed to load admin list.");

      const data = await res.json();
      const rawAdmins = Array.isArray(data?.admins)
        ? data.admins
        : Array.isArray(data?.users)
          ? data.users
          : [];

      setAdmins((prev) => mergeAdminOptions(prev, rawAdmins));
    } catch (err) {
      console.error("Failed to load admin list", err);
    }
  }, []);

  const fetchLogs = useCallback(async (p: number, adminId?: string, query?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_SIZE),
      });

      const trimmedAdminId = adminId?.trim();
      const trimmedQuery = query?.trim();

      if (trimmedAdminId) params.set("adminId", trimmedAdminId);
      if (trimmedQuery) params.set("search", trimmedQuery);

      const res = await fetch(`/api/admin/activity-logs?${params.toString()}`);
      if (res.status === 403 || res.status === 401) {
        throw new Error("Unauthorized. Only Superadmins can view activity logs.");
      }
      if (!res.ok) throw new Error("Failed to load activity logs.");
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);

      const logAdmins = (data.logs ?? []).map((log: ActivityLog) => ({
        _id: log.adminId?._id ?? log.adminId ?? log._id,
        name: log.adminId?.name ?? log.adminName ?? "Unknown Admin",
        username: log.adminId?.username ?? log.adminUsername,
        email: log.adminId?.email ?? "",
        role: log.adminId?.role ?? log.adminRole,
      }));

      setAdmins((prev) => mergeAdminOptions(prev, logAdmins));
    } catch (err) {
      reportClientError(err, { feature: "admin-activity" });
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdmins();
    void fetchLogs(1);
  }, [fetchAdmins, fetchLogs]);

  const viewDetails = (log: ActivityLog) => { setSelectedLog(log); onOpen(); };

  const handleApplyFilters = () => {
    setPage(1);
    void fetchLogs(1, selectedAdminId, searchTerm);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    void fetchLogs(nextPage, selectedAdminId, searchTerm);
  };

  const handleAdminChange = (value: string) => {
    setSelectedAdminId(value);
    setPage(1);
    void fetchLogs(1, value, searchTerm);
  };

  const filteredLogs = logs;

  return (
    <div className="w-full space-y-5 px-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-primary" />
            Superadmin Activity Tracker
          </h1>
          <p className="text-sm text-default-500 mt-1">
            Real-time narrative log of all admin actions, with device and location details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedAdminId}
            onChange={(e) => handleAdminChange(e.target.value)}
            className="h-9 min-w-[12rem] rounded-lg border border-default-200 bg-background px-3 text-sm text-foreground"
          >
            <option value="">All admins</option>
            {admins.map((admin) => (
              <option key={admin._id} value={admin._id}>
                {admin.name} ({admin.email})
              </option>
            ))}
          </select>
          <Input
            placeholder="Search admin / post ID / job ID"
            size="sm"
            startContent={<Search size={14} className="text-default-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApplyFilters();
              }
            }}
            className="w-64"
          />
          <Button
            variant="flat"
            color="primary"
            size="sm"
            startContent={<RefreshCw size={14} />}
            onPress={handleApplyFilters}
          >
            Apply
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border border-danger-200 bg-danger-50">
          <CardBody className="text-danger-700 text-sm py-4">{error}</CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-default-400 text-sm py-10 text-center">Loading activity logs…</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-default-400 text-sm py-10 text-center">No activity logs found.</div>
          ) : (
            filteredLogs.map((log) => {
              const actionInfo = ACTION_LABELS[log.action];
              return (
                <Card key={log._id} className="border border-default-100 shadow-none hover:shadow-sm transition-shadow">
                  <CardBody className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Action icon */}
                      <div className={`mt-0.5 rounded-lg p-1.5 shrink-0 ${
                        actionInfo?.color === "success" ? "bg-success-100 text-success-700" :
                        actionInfo?.color === "danger"  ? "bg-danger-100 text-danger-700" :
                        actionInfo?.color === "warning" ? "bg-warning-100 text-warning-700" :
                        "bg-primary-100 text-primary-700"
                      }`}>
                        {MODULE_ICONS[log.module] ?? <Activity size={14} />}
                      </div>

                      {/* Narrative */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug text-default-700">
                          {buildNarrative(log)}
                        </p>

                        {/* Device + Location row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-default-400">
                            <Clock size={11} />
                            <span title={format(new Date(log.createdAt), "PPpp")}>
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </span>
                          </span>
                          {log.ipAddress && (
                            <span className="flex items-center gap-1 text-xs text-default-400">
                              <Monitor size={11} />
                              {log.ipAddress}
                              {log.os && <> · {log.os}</>}
                              {log.browser && <> / {log.browser}</>}
                            </span>
                          )}
                          {(log.location?.city || log.location?.country) && (
                            <span className="flex items-center gap-1 text-xs text-default-400">
                              <MapPin size={11} />
                              {[log.location.city, log.location.country].filter(Boolean).join(", ")}
                            </span>
                          )}
                          <Chip size="sm" variant="dot" color={actionInfo?.color ?? "default"} className="h-4 text-[9px] px-1.5 py-0">
                            {actionInfo?.label ?? log.action}
                          </Chip>
                        </div>
                      </div>

                      {/* Details button */}
                      <Button
                        size="sm"
                        isIconOnly
                        variant="light"
                        color="default"
                        onPress={() => viewDetails(log)}
                        className="shrink-0"
                      >
                        <Info size={16} />
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}

          {totalPages > 1 && (
            <div className="flex w-full justify-center pt-3 pb-2">
              <Pagination
                isCompact
                showControls
                showShadow
                color="primary"
                page={page}
                total={totalPages}
                onChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-0.5">
                <span>Activity Details</span>
                <span className="text-sm font-normal text-default-500">
                  {ACTION_LABELS[selectedLog?.action ?? ""]?.label ?? selectedLog?.action}
                </span>
              </ModalHeader>
              <ModalBody>
                {selectedLog && (
                  <div className="space-y-5">
                    {/* Narrative summary */}
                    <div className="bg-default-50 border border-default-200 rounded-xl p-3 text-sm">
                      {buildNarrative(selectedLog)}
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="bg-default-50 border-none shadow-none">
                        <CardBody className="p-3 space-y-0.5">
                          <p className="text-[10px] text-default-400 uppercase font-semibold">Admin</p>
                          <p className="text-sm font-medium">{selectedLog.adminId?.name ?? selectedLog.adminName}</p>
                          <p className="text-xs text-default-500">@{selectedLog.adminId?.username ?? selectedLog.adminUsername}</p>
                          <p className="text-xs text-default-400">{selectedLog.adminId?.email}</p>
                        </CardBody>
                      </Card>
                      <Card className="bg-default-50 border-none shadow-none">
                        <CardBody className="p-3 space-y-0.5">
                          <p className="text-[10px] text-default-400 uppercase font-semibold">Target</p>
                          <p className="text-sm font-medium">{selectedLog.targetType}</p>
                          {selectedLog.targetRefId && (
                            <p className="text-xs font-mono font-semibold text-primary">{selectedLog.targetRefId}</p>
                          )}
                          <p className="text-xs text-default-400 font-mono">{selectedLog.targetId}</p>
                        </CardBody>
                      </Card>
                      <Card className="bg-default-50 border-none shadow-none">
                        <CardBody className="p-3 space-y-0.5">
                          <p className="text-[10px] text-default-400 uppercase font-semibold">Device</p>
                          <p className="text-sm font-medium">{selectedLog.ipAddress ?? "Unknown IP"}</p>
                          <p className="text-xs text-default-500">{selectedLog.os} • {selectedLog.browser}</p>
                        </CardBody>
                      </Card>
                      <Card className="bg-default-50 border-none shadow-none">
                        <CardBody className="p-3 space-y-0.5">
                          <p className="text-[10px] text-default-400 uppercase font-semibold">Location & Time</p>
                          <p className="text-sm font-medium">{selectedLog.location?.city ?? "Unknown"}{selectedLog.location?.country ? `, ${selectedLog.location.country}` : ""}</p>
                          <p className="text-xs text-default-400">{format(new Date(selectedLog.createdAt), "PPpp")}</p>
                        </CardBody>
                      </Card>
                    </div>

                    {/* Context metadata */}
                    {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-default-500 uppercase mb-2">Action Context</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(selectedLog.metadata).map(([key, val]) =>
                            val != null ? (
                              <div key={key} className="bg-default-100 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-default-400 uppercase font-semibold">{key}</p>
                                <p className="text-sm font-mono font-medium truncate">{String(val)}</p>
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}

                    {/* Diff viewer */}
                    {(selectedLog.diff?.before || selectedLog.diff?.after) && (
                      <div>
                        <p className="text-xs font-semibold text-default-500 uppercase mb-2">State Changes</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-danger-50 border border-danger-100 rounded-lg p-3">
                            <p className="text-xs font-semibold text-danger-700 mb-2">Before</p>
                            <pre className="text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap text-danger-900">
                              {JSON.stringify(selectedLog.diff.before || {}, null, 2)}
                            </pre>
                          </div>
                          <div className="bg-success-50 border border-success-100 rounded-lg p-3">
                            <p className="text-xs font-semibold text-success-700 mb-2">After</p>
                            <pre className="text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap text-success-900">
                              {JSON.stringify(selectedLog.diff.after || {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="primary" variant="light" onPress={onClose}>Close</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
