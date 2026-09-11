import mongoose, { Schema, Document, Model, models } from "mongoose";
import {
  upsertCalendarEvent,
  deleteCalendarEvent,
  mapTodo,
  todoEventKey,
} from "@/lib/services/calendar-event.service";
import { reportBackgroundError } from "@/lib/sentry-report";

// ─── Category + status enums ─────────────────────────────────────────────

export const TODO_CATEGORIES = [
  "tuition",
  "enquiry",
  "job",
  "feedback",
] as const;
export type TodoCategory = (typeof TODO_CATEGORIES)[number];

export const TUITION_TODO_STATUSES = [
  "demo_reminder",
  "demo_confirmation",
  "guardian_confirmed",
  "completed",
] as const;

export const ENQUIRY_TODO_STATUSES = ["pending", "resolved"] as const;

export const JOB_TODO_STATUSES = ["pending", "sent_to_company"] as const;

export const FEEDBACK_TODO_STATUSES = [
  "open",
  "under_review",
  "action_taken",
  "resolved",
] as const;

export const ALL_TODO_STATUSES = [
  ...TUITION_TODO_STATUSES,
  ...ENQUIRY_TODO_STATUSES,
  ...JOB_TODO_STATUSES,
  ...FEEDBACK_TODO_STATUSES,
] as const;

export type TodoStatus = (typeof ALL_TODO_STATUSES)[number];

// ─── Document interface ───────────────────────────────────────────────────

export interface ITodoEvent extends Document {
  category: TodoCategory;
  status: TodoStatus;
  /** Human-readable event title */
  title: string;
  /** Optional note / description */
  note?: string | null;
  /** ISO string — when this todo is due */
  dueAt: Date;
  /** Ref to the linked document (_id of Post / Enquiry / Job / Feedback) */
  refId?: mongoose.Types.ObjectId | null;
  /** Human-readable identifier shown in UI (postId / enquiryId / jobId) */
  refLabel?: string | null;
  /** Admin who owns / handles this todo */
  handledByAdminId?: mongoose.Types.ObjectId | null;
  handledByAdminName?: string | null;
  /** Whether the todo has been completed */
  isDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────

const TodoEventSchema = new Schema<ITodoEvent>(
  {
    category: {
      type: String,
      enum: TODO_CATEGORIES,
      required: true,
    },
    status: {
      type: String,
      enum: ALL_TODO_STATUSES,
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    note: { type: String, trim: true, default: null },
    dueAt: { type: Date, required: true },
    refId: { type: Schema.Types.ObjectId, default: null },
    refLabel: { type: String, trim: true, default: null },
    handledByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    handledByAdminName: { type: String, trim: true, default: null },
    isDone: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "todo_events",
  },
);

TodoEventSchema.index({ dueAt: 1, isDone: 1 });
TodoEventSchema.index({ category: 1, dueAt: -1 });
TodoEventSchema.index({ refId: 1 });
TodoEventSchema.index({ handledByAdminId: 1, dueAt: 1 });

// ─── Calendar write-through hooks ──────────────────────────────────────────

TodoEventSchema.post("save", function (doc) {
  void upsertCalendarEvent(mapTodo(doc.toObject())).catch((err) =>
    reportBackgroundError(err, { operation: "upsert-todo-calendar", integration: "calendar" }),
  );
});

TodoEventSchema.post("findOneAndUpdate", function (doc) {
  if (!doc) return;
  const raw = typeof doc.toObject === "function" ? doc.toObject() : (doc as unknown as Record<string, any>);
  void upsertCalendarEvent(mapTodo(raw)).catch((err) =>
    reportBackgroundError(err, { operation: "upsert-todo-calendar", integration: "calendar" }),
  );
});

TodoEventSchema.post("findOneAndDelete", function (doc) {
  if (!doc) return;
  const raw = typeof doc.toObject === "function" ? doc.toObject() : (doc as unknown as Record<string, any>);
  void deleteCalendarEvent(todoEventKey(raw._id?.toString?.() ?? "")).catch((err) =>
    reportBackgroundError(err, { operation: "delete-todo-calendar", integration: "calendar" }),
  );
});

const TodoEvent: Model<ITodoEvent> =
  models.TodoEvent ||
  mongoose.model<ITodoEvent>("TodoEvent", TodoEventSchema);

export default TodoEvent;
