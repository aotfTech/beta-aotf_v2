import mongoose, { Schema, type Document, type Model, models } from "mongoose";

// ─── Enums ──────────────────────────────────────────────────────────────

export const POST_LEDGER_STATUSES = ["open", "assigned", "closed"] as const;
export type PostLedgerStatus = (typeof POST_LEDGER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "partial"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ─── Sub-documents ──────────────────────────────────────────────────────

export interface IPostLedgerStudent {
  className: string;
  board: string;
  subjects: string[];
  // Stored to keep your existing search/normalization behavior consistent.
  subjectsNormalized: string[];
}

const PostLedgerStudentSchema = new Schema<IPostLedgerStudent>(
  {
    className: { type: String, required: true },
    board: { type: String, required: true },
    subjects: { type: [String], required: true },
    subjectsNormalized: { type: [String], default: [] },
  },
  { _id: false },
);

export interface IPostLedgerStatusHistoryEntry {
  status: PostLedgerStatus;
  changedAt: Date;
  changedByClerkId: string | null;
}

const PostLedgerStatusHistoryEntrySchema =
  new Schema<IPostLedgerStatusHistoryEntry>(
    {
      status: { type: String, enum: POST_LEDGER_STATUSES, required: true },
      changedAt: { type: Date, required: true },
      changedByClerkId: { type: String, default: null },
    },
    { _id: false },
  );

// ─── Main document ─────────────────────────────────────────────────────

export interface IPostLedger extends Document {
  serialNumber: number | null;
  postId: string;
  postCreatedAt: Date;

  enquiryId: string | null;

  guardianName: string;
  guardianPhone: string;
  students: IPostLedgerStudent[];

  classType: string;
  location: string;
  monthlyBudget: number;
  notes?: string | null;

  postStatus: PostLedgerStatus;

  // ─── Teacher fields ──────────────────────────────────────────────────────
  assignedTeacherId: string | null;
  assignedTeacherUsername: string | null;
  assignedTeacherName: string | null;
  assignedTeacherPhone: string | null;
  assignedAt: Date | null;

  processedByAdminClerkId: string | null;
  processedByAdminName: string | null;

  assignedTeacherStatus: string | null;
  source: string | null;
  referrerName: string | null;
  referrerPhone: string | null;

  // ─── New Tuitions-sheet fields ────────────────────────────────────────────
  /** Whether the post has been cancelled (Post.status === 'cancelled') */
  cancelledOrNot: boolean;
  /** Human-readable summary of student requirements (class / board / subjects) */
  requirement: string | null;
  /** Teacher's gender — resolved from Profile.gender at assignment time */
  teacherGender: string | null;
  /** Demo call scheduled date — from Application.dcDate on the approved application */
  teacherDemoDate: Date | null;
  /** Tuition start date — admin-entered after approval */
  startingDate: Date | null;
  /** Whether AOTF has paid the teacher */
  teacherHasBeenPaid: boolean;
  /** Date AOTF paid the teacher */
  teacherPaymentDate: Date | null;
  /** Whether an invoice has been generated for this post */
  invoiceGenerated: boolean;
  /** The invoice ID (string) for the latest invoice linked to this post */
  invoiceId: string | null;

  // ─── Guardian payment ─────────────────────────────────────────────────────
  paymentStatus: PaymentStatus;
  paymentDate: Date | null;
  paymentAmount: number | null;

  lastUpdatedAt: Date;

  sheetRowIndex: number | null;
  statusHistory: IPostLedgerStatusHistoryEntry[];
  teacherChangeCount: number;
}

const PostLedgerSchema = new Schema<IPostLedger>(
  {
    serialNumber: { type: Number, default: null },

    postId: { type: String, required: true, unique: true, index: true },

    postCreatedAt: { type: Date, required: true },
    enquiryId: { type: String, default: null, index: true },

    guardianName: { type: String, required: true },
    guardianPhone: { type: String, required: true },
    students: { type: [PostLedgerStudentSchema], required: true },

    classType: { type: String, required: true },
    location: { type: String, required: true },
    monthlyBudget: { type: Number, required: true },
    notes: { type: String, default: null },

    postStatus: {
      type: String,
      enum: POST_LEDGER_STATUSES,
      required: true,
      default: "open",
    },

    assignedTeacherId: { type: String, default: null, index: true },
    assignedTeacherUsername: { type: String, default: null },
    assignedTeacherName: { type: String, default: null },
    assignedTeacherPhone: { type: String, default: null },
    assignedAt: { type: Date, default: null },

    processedByAdminClerkId: { type: String, default: null },
    processedByAdminName: { type: String, default: null },

    assignedTeacherStatus: { type: String, default: null },
    source: { type: String, default: null },
    referrerName: { type: String, default: null },
    referrerPhone: { type: String, default: null },

    // ─── New Tuitions-sheet fields ──────────────────────────────────────────
    cancelledOrNot: { type: Boolean, default: false },
    requirement: { type: String, default: null },
    teacherGender: { type: String, default: null },
    teacherDemoDate: { type: Date, default: null },
    startingDate: { type: Date, default: null },
    teacherHasBeenPaid: { type: Boolean, default: false },
    teacherPaymentDate: { type: Date, default: null },
    invoiceGenerated: { type: Boolean, default: false },
    invoiceId: { type: String, default: null },

    // ─── Guardian payment ────────────────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: "unpaid",
    },
    paymentDate: { type: Date, default: null },
    paymentAmount: { type: Number, default: null },

    lastUpdatedAt: { type: Date, required: true, default: () => new Date() },

    sheetRowIndex: { type: Number, default: null },
    statusHistory: {
      type: [PostLedgerStatusHistoryEntrySchema],
      default: () => [],
    },

    teacherChangeCount: { type: Number, default: 0 },
  },
  {
    collection: "post_ledgers",
  },
);

PostLedgerSchema.index({ postStatus: 1, lastUpdatedAt: -1 });

const PostLedger: Model<IPostLedger> =
  models.PostLedger || mongoose.model<IPostLedger>("PostLedger", PostLedgerSchema);

export default PostLedger;

