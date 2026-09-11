/**
 * CalendarEventService
 *
 * Single writer for the `calendar_events` collection.
 * All source models (Application, Enquiry, Feedback, TodoEvent) funnel through
 * `upsertFromSource` / `deleteFromSource` so the read API only ever queries
 * one collection.
 *
 * SYNC VERSION: bump CURRENT_SYNC_VERSION whenever the mapping logic changes
 * so a targeted re-sync can be run for stale records.
 */

import dbConnect from "@/lib/db";
import CalendarEvent from "@/lib/models/CalendarEvent";
import type {
  CalendarEventCategory,
  CalendarEventSourceType,
  ICalendarEventOwner,
  ICalendarEventRef,
  ICalendarEventSource,
} from "@/lib/models/CalendarEvent";
import type { TEventColor } from "@/calendar/types";
import { reportBackgroundError } from "@/lib/sentry-report";

// ─── Sync version ─────────────────────────────────────────────────────────────

export const CURRENT_SYNC_VERSION = 1;

// ─── Shared payload type passed into upsertFromSource ────────────────────────

export interface CalendarEventInput {
  eventKey: string;
  source: ICalendarEventSource;
  title: string;
  description: string;
  category: CalendarEventCategory;
  status: string;
  rawStatus: string;
  color: TEventColor;
  startAt: Date;
  /** Duration in minutes; defaults to 60 if not provided */
  durationMinutes?: number;
  allDay?: boolean;
  owner: ICalendarEventOwner;
  ref: ICalendarEventRef;
  isDone?: boolean;
  visibility?: "admin" | "system";
}

// ─── Status lookup tables (mirrors current route.ts logic exactly) ────────────

const TUITION_APP_STATUS: Record<string, { label: string; color: TEventColor }> = {
  applied:       { label: "Demo Reminder",      color: "blue"   },
  DC:            { label: "Demo Confirmation",  color: "yellow" },
  GC:            { label: "Guardian Confirmed", color: "orange" },
  approved:      { label: "Completed",          color: "green"  },
  decline:       { label: "Declined",           color: "red"    },
  auto_declined: { label: "Declined",           color: "red"    },
  withdrawn:     { label: "Withdrawn",          color: "gray"   },
};

const ENQ_STATUS: Record<string, { label: string; color: TEventColor }> = {
  new:         { label: "Pending",  color: "orange" },
  in_progress: { label: "Pending",  color: "yellow" },
  contacted:   { label: "Pending",  color: "blue"   },
  unreachable: { label: "Pending",  color: "red"    },
  resolved:    { label: "Resolved", color: "green"  },
  closed:      { label: "Resolved", color: "gray"   },
};

const FB_STATUS: Record<string, { label: string; color: TEventColor }> = {
  open:     { label: "Needs Review", color: "red"    },
  seen:     { label: "Under Review", color: "yellow" },
  resolved: { label: "Resolved",     color: "green"  },
};

const TODO_STATUS: Record<string, { label: string; color: TEventColor }> = {
  demo_reminder:      { label: "Demo Reminder",      color: "yellow" },
  demo_confirmation:  { label: "Demo Confirmation",  color: "blue"   },
  guardian_confirmed: { label: "Guardian Confirmed", color: "orange" },
  completed:          { label: "Completed",          color: "green"  },
  pending:            { label: "Pending",            color: "orange" },
  resolved:           { label: "Resolved",           color: "green"  },
  sent_to_company:    { label: "Sent to Company",    color: "blue"   },
  open:               { label: "Open",               color: "red"    },
  under_review:       { label: "Under Review",       color: "yellow" },
  action_taken:       { label: "Action Taken",       color: "purple" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function safeDate(value: unknown, fallback = new Date()): Date {
  const d = new Date(value as string | number | Date);
  return isNaN(d.getTime()) ? fallback : d;
}

// ─── Mapping helpers (exported so they can be unit-tested) ────────────────────

/**
 * Generates the deterministic event key for a tuition application.
 * Format: "application:<_id>:tuition"
 */
export function tuitionApplicationEventKey(sourceId: string): string {
  return `application:${sourceId}:tuition`;
}

/**
 * Generates the deterministic event key for a job application.
 * Format: "application:<_id>:job"
 */
export function jobApplicationEventKey(sourceId: string): string {
  return `application:${sourceId}:job`;
}

/**
 * Generates the deterministic event key for an enquiry.
 * Format: "enquiry:<_id>"
 */
export function enquiryEventKey(sourceId: string): string {
  return `enquiry:${sourceId}`;
}

/**
 * Generates the deterministic event key for a feedback record.
 * Format: "feedback:<_id>"
 */
export function feedbackEventKey(sourceId: string): string {
  return `feedback:${sourceId}`;
}

/**
 * Generates the deterministic event key for a todo event.
 * Format: "todo:<_id>"
 */
export function todoEventKey(sourceId: string): string {
  return `todo:${sourceId}`;
}

// ─── Source mappers ───────────────────────────────────────────────────────────

/**
 * Map a lean Application document to a CalendarEventInput.
 * Handles both tuition (postId) and job (jobIdPublic) applications.
 * Returns null if the document is neither.
 */
export function mapApplication(doc: Record<string, any>): CalendarEventInput | null {
  const id = doc._id?.toString?.() ?? "";
  const isTuition = typeof doc.postId === "string" && doc.postId;
  const isJob = typeof doc.jobIdPublic === "string" && doc.jobIdPublic;

  if (!isTuition && !isJob) return null;

  if (isTuition) {
    const st =
      TUITION_APP_STATUS[doc.status] ?? { label: doc.status, color: "blue" as TEventColor };

    // Date selection: DC date → GC date → updatedAt → now
    const rawDate =
      (doc.status === "DC" && doc.dcMeta?.scheduledDate) ||
      (doc.status === "GC" && doc.gcMeta?.scheduledDate) ||
      doc.updatedAt ||
      new Date();
    const startAt = safeDate(rawDate);

    const adminId =
      doc.dcMeta?.setByAdminId?.toString?.() ||
      doc.gcMeta?.setByAdminId?.toString?.() ||
      doc.approvalMeta?.approvedByAdminId?.toString?.() ||
      null;

    const description = [
      "[Tuition Application]",
      `Status: ${st.label}`,
      `Teacher: ${doc.applicantSnapshot?.name ?? "—"}`,
      `Phone: ${doc.applicantSnapshot?.phone ?? "—"}`,
      `Email: ${doc.applicantSnapshot?.email ?? "—"}`,
      `Post ID: ${doc.postId}`,
    ].join("\n");

    const source: ICalendarEventSource = {
      type: "application" as CalendarEventSourceType,
      collectionName: "Application",
      sourceId: id,
      sourceUpdatedAt: safeDate(doc.updatedAt),
    };

    return {
      eventKey: tuitionApplicationEventKey(id),
      source,
      title: `📚 ${doc.applicantSnapshot?.name ?? "Teacher"} — ${st.label}`,
      description,
      category: "tuition",
      status: st.label,
      rawStatus: doc.status,
      color: st.color,
      startAt,
      durationMinutes: 60,
      owner: { adminId, adminName: null },
      ref: { label: doc.postId ?? null, meta: {} },
      isDone: false,
      visibility: "admin",
    };
  }

  // Job application
  const isForwarded = ["DC", "GC", "approved"].includes(doc.status);
  const label = isForwarded
    ? "Sent to Company"
    : doc.status === "applied"
    ? "Pending"
    : (TUITION_APP_STATUS[doc.status]?.label ?? doc.status);
  const color: TEventColor = isForwarded
    ? "blue"
    : doc.status === "applied"
    ? "orange"
    : (TUITION_APP_STATUS[doc.status]?.color ?? "blue");

  const adminId = doc.approvalMeta?.approvedByAdminId?.toString?.() ?? null;

  const description = [
    "[Job Application]",
    `Status: ${label}`,
    `Applicant: ${doc.applicantSnapshot?.name ?? "—"}`,
    `Phone: ${doc.applicantSnapshot?.phone ?? "—"}`,
    `Email: ${doc.applicantSnapshot?.email ?? "—"}`,
    `Job ID: ${doc.jobIdPublic}`,
  ].join("\n");

  const source: ICalendarEventSource = {
    type: "application" as CalendarEventSourceType,
    collectionName: "Application",
    sourceId: id,
    sourceUpdatedAt: safeDate(doc.updatedAt),
  };

  return {
    eventKey: jobApplicationEventKey(id),
    source,
    title: `💼 ${doc.applicantSnapshot?.name ?? "Applicant"} — ${label}`,
    description,
    category: "job",
    status: label,
    rawStatus: doc.status,
    color,
    startAt: safeDate(doc.updatedAt),
    durationMinutes: 60,
    owner: { adminId, adminName: null },
    ref: { label: doc.jobIdPublic ?? null, meta: {} },
    isDone: false,
    visibility: "admin",
  };
}

/**
 * Map a lean Enquiry document to a CalendarEventInput.
 */
export function mapEnquiry(doc: Record<string, any>): CalendarEventInput {
  const id = doc._id?.toString?.() ?? "";
  const st =
    ENQ_STATUS[doc.currentStatus] ??
    { label: doc.currentStatus ?? "new", color: "orange" as TEventColor };

  const adminId = doc.lastActionByAdminId?.toString?.() ?? null;

  const description = [
    "[Enquiry]",
    `Status: ${st.label}`,
    `Name: ${doc.name}`,
    `Phone: ${doc.phoneNumber}`,
    `Query: ${(doc.query ?? "").slice(0, 120)}`,
    doc.lastActionNote ? `Note: ${String(doc.lastActionNote).slice(0, 80)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const source: ICalendarEventSource = {
    type: "enquiry" as CalendarEventSourceType,
    collectionName: "Enquiry",
    sourceId: id,
    sourceUpdatedAt: safeDate(doc.updatedAt),
  };

  return {
    eventKey: enquiryEventKey(id),
    source,
    title: `📋 ${doc.name} — ${st.label}`,
    description,
    category: "enquiry",
    status: st.label,
    rawStatus: doc.currentStatus,
    color: st.color,
    startAt: safeDate(doc.lastActionAt ?? doc.updatedAt),
    durationMinutes: 30,
    owner: { adminId, adminName: null },
    ref: { label: doc.enquiryId ?? null, meta: {} },
    isDone: false,
    visibility: "admin",
  };
}

/**
 * Map a lean Feedback document to a CalendarEventInput.
 */
export function mapFeedback(doc: Record<string, any>): CalendarEventInput {
  const id = doc._id?.toString?.() ?? "";
  const st =
    FB_STATUS[doc.status] ?? { label: doc.status ?? "open", color: "purple" as TEventColor };

  const adminId = doc.handledByAdminId?.toString?.() ?? null;

  const description = [
    "[Feedback]",
    `Status: ${st.label}`,
    `From: ${doc.userSnapshot?.name ?? "—"} (${(doc.userSnapshot?.role ?? "").replace("_", " ")})`,
    `Email: ${doc.userSnapshot?.email ?? "—"}`,
    `Category: ${doc.category}`,
    `Subject: ${doc.subject}`,
    `Rating: ${doc.rating ?? "N/A"}`,
    (doc.message ?? "").slice(0, 100),
    doc.adminNotes ? `Admin Notes: ${String(doc.adminNotes).slice(0, 60)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const source: ICalendarEventSource = {
    type: "feedback" as CalendarEventSourceType,
    collectionName: "Feedback",
    sourceId: id,
    sourceUpdatedAt: safeDate(doc.updatedAt),
  };

  return {
    eventKey: feedbackEventKey(id),
    source,
    title: `💬 ${doc.userSnapshot?.name ?? "User"} — ${doc.category} · ${st.label}`,
    description,
    category: "feedback",
    status: st.label,
    rawStatus: doc.status,
    color: st.color,
    startAt: safeDate(doc.handledAt ?? doc.updatedAt),
    durationMinutes: 30,
    owner: { adminId, adminName: null },
    ref: { label: null, meta: {} },
    isDone: false,
    visibility: "admin",
  };
}

const CAT_EMOJI: Record<string, string> = {
  tuition: "📚",
  enquiry: "📋",
  job: "💼",
  feedback: "💬",
};

/**
 * Map a lean TodoEvent document to a CalendarEventInput.
 */
export function mapTodo(doc: Record<string, any>): CalendarEventInput {
  const id = doc._id?.toString?.() ?? "";
  const st =
    TODO_STATUS[doc.status] ?? { label: doc.status ?? "", color: "blue" as TEventColor };

  // Completed todos get a gray colour override
  const color: TEventColor = doc.isDone ? "gray" : st.color;
  const adminId = doc.handledByAdminId?.toString?.() ?? null;
  const doneTag = doc.isDone ? "✅ DONE · " : "";
  const emoji = CAT_EMOJI[doc.category] ?? "✅";

  const description = [
    `[Reminder · ${String(doc.category).toUpperCase()} — ${st.label}]`,
    doc.note ?? "",
    doc.refLabel ? `Ref: ${doc.refLabel}` : "",
    `By: ${doc.handledByAdminName ?? "—"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const source: ICalendarEventSource = {
    type: "todo" as CalendarEventSourceType,
    collectionName: "TodoEvent",
    sourceId: id,
    sourceUpdatedAt: safeDate(doc.updatedAt),
  };

  return {
    eventKey: todoEventKey(id),
    source,
    title: `${emoji} ${doneTag}${doc.title}`,
    description,
    category: "reminder",
    status: st.label,
    rawStatus: doc.status,
    color,
    startAt: safeDate(doc.dueAt),
    durationMinutes: 60,
    owner: { adminId, adminName: doc.handledByAdminName ?? null },
    ref: { label: doc.refLabel ?? null, meta: {} },
    isDone: Boolean(doc.isDone),
    visibility: "admin",
  };
}

// ─── Core service functions ───────────────────────────────────────────────────

/**
 * Upsert a calendar event from a normalised input payload.
 * Fire-and-forget safe — errors are logged but never thrown.
 */
export async function upsertCalendarEvent(
  input: CalendarEventInput,
): Promise<void> {
  try {
    await dbConnect();

    const durationMs = (input.durationMinutes ?? 60) * 60_000;
    const endAt = new Date(input.startAt.getTime() + durationMs);

    const payload = {
      source: input.source,
      title: input.title,
      description: input.description,
      category: input.category,
      status: input.status,
      rawStatus: input.rawStatus,
      color: input.color,
      startAt: input.startAt,
      endAt,
      allDay: input.allDay ?? false,
      owner: input.owner,
      ref: input.ref,
      isDone: input.isDone ?? false,
      visibility: input.visibility ?? "admin",
      lastSyncedAt: new Date(),
      syncVersion: CURRENT_SYNC_VERSION,
    };

    await CalendarEvent.findOneAndUpdate(
      { eventKey: input.eventKey },
      { $set: payload, $setOnInsert: { eventKey: input.eventKey } },
      { upsert: true, new: true },
    );
  } catch (err) {
    console.error(
      `[CalendarEventService] upsert failed for key="${input.eventKey}":`,
      err,
    );
    reportBackgroundError(err, {
      operation: "upsert-calendar-event",
      integration: "calendar",
      extra: { eventKey: input.eventKey },
    });
  }
}

/**
 * Hard-delete a calendar event by its deterministic event key.
 * Fire-and-forget safe — errors are logged but never thrown.
 */
export async function deleteCalendarEvent(eventKey: string): Promise<void> {
  try {
    await dbConnect();
    await CalendarEvent.deleteOne({ eventKey });
  } catch (err) {
    console.error(
      `[CalendarEventService] delete failed for key="${eventKey}":`,
      err,
    );
    reportBackgroundError(err, {
      operation: "delete-calendar-event",
      integration: "calendar",
      extra: { eventKey },
    });
  }
}

/**
 * Bulk-upsert calendar events from an array of normalised inputs.
 * Used by the auto-decline path which may affect multiple applications at once.
 * Errors per event are individually caught and logged.
 */
export async function bulkUpsertCalendarEvents(
  inputs: CalendarEventInput[],
): Promise<void> {
  await Promise.allSettled(inputs.map((input) => upsertCalendarEvent(input)));
}
