import mongoose, { Schema, Document, Model, models } from "mongoose";
import {
  upsertCalendarEvent,
  deleteCalendarEvent,
  mapFeedback,
  feedbackEventKey,
} from "@/lib/services/calendar-event.service";
import { reportBackgroundError } from "@/lib/sentry-report";

export const FEEDBACK_USER_TYPES = ["teacher", "teacher_candidate"] as const;
export const FEEDBACK_CATEGORIES = [
  "bug",
  "suggestion",
  "complaint",
  "payment",
  "general",
] as const;
export const FEEDBACK_STATUSES = ["open", "seen", "resolved"] as const;

export type FeedbackUserType = (typeof FEEDBACK_USER_TYPES)[number];
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackUserSnapshot {
  name: string;
  username: string;
  role: FeedbackUserType;
  email: string;
}

export interface IFeedback extends Document {
  userId: mongoose.Types.ObjectId;
  userType: FeedbackUserType;
  userSnapshot: FeedbackUserSnapshot;
  category: FeedbackCategory;
  subject: string;
  message: string;
  rating?: number | null;
  status: FeedbackStatus;
  handledByAdminId?: mongoose.Types.ObjectId | null;
  handledAt?: Date | null;
  adminNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackUserSnapshotSchema = new Schema<FeedbackUserSnapshot>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true, lowercase: true },
    role: {
      type: String,
      enum: FEEDBACK_USER_TYPES,
      required: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false },
);

const FeedbackSchema = new Schema<IFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userType: {
      type: String,
      enum: FEEDBACK_USER_TYPES,
      required: true,
    },
    userSnapshot: {
      type: feedbackUserSnapshotSchema,
      required: true,
    },
    category: {
      type: String,
      enum: FEEDBACK_CATEGORIES,
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, default: null },
    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      required: true,
      default: "open",
    },
    handledByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    handledAt: { type: Date, default: null },
    adminNotes: { type: String, trim: true, default: null },
  },
  {
    timestamps: true,
    collection: "feedbacks",
  },
);

FeedbackSchema.index({ userId: 1, createdAt: -1 }, { background: true });
FeedbackSchema.index({ status: 1, createdAt: -1 }, { background: true });
FeedbackSchema.index(
  { category: 1, createdAt: -1 },
  { background: true, name: "feedbackType_1_createdAt_-1" },
);

// ─── Calendar write-through hooks ──────────────────────────────────────────

FeedbackSchema.post("save", function (doc) {
  void upsertCalendarEvent(mapFeedback(doc.toObject())).catch((err) =>
    reportBackgroundError(err, { operation: "upsert-feedback-calendar", integration: "calendar" }),
  );
});

FeedbackSchema.post("findOneAndUpdate", function (doc) {
  if (!doc) return;
  const raw = typeof doc.toObject === "function" ? doc.toObject() : (doc as unknown as Record<string, any>);
  void upsertCalendarEvent(mapFeedback(raw)).catch((err) =>
    reportBackgroundError(err, { operation: "upsert-feedback-calendar", integration: "calendar" }),
  );
});

FeedbackSchema.post("findOneAndDelete", function (doc) {
  if (!doc) return;
  const raw = typeof doc.toObject === "function" ? doc.toObject() : (doc as unknown as Record<string, any>);
  void deleteCalendarEvent(feedbackEventKey(raw._id?.toString?.() ?? "")).catch((err) =>
    reportBackgroundError(err, { operation: "delete-feedback-calendar", integration: "calendar" }),
  );
});

const Feedback: Model<IFeedback> =
  models.Feedback || mongoose.model<IFeedback>("Feedback", FeedbackSchema);

export default Feedback;
