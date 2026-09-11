import dbConnect from "@/lib/db";
import { InternalError, NotFoundError } from "@/lib/errors";
import Enquiry, { type IEnquiry } from "@/lib/models/Enquiry";
import Post from "@/lib/models/Post";
import Job from "@/lib/models/Job";
import EnquiryLedger, {
  type IEnquiryLedger,
  type EnquiryResult,
} from "@/lib/models/EnquiryLedger";
import { getGoogleSheetsClient, ensureTabExists } from "@/lib/googleSheets";
import { formatDateIST } from "./postLedger.service";
import { reportBackgroundError } from "@/lib/sentry-report";

// ─── Constants ────────────────────────────────────────────────────────────────

export const ENQUIRIES_TAB = "Enquiries";

export const ENQUIRIES_HEADERS = [
  "Date",       // A
  "Sl No",      // B
  "Enquiry ID", // C
  "Post/Job ID",// D
  "Status",     // E
  "Result",     // F
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveResult(status: IEnquiry["currentStatus"]): EnquiryResult {
  if (status === "resolved") return "converted";
  if (status === "closed") return "declined";
  return "pending";
}

// ─── Sheet row mapper ─────────────────────────────────────────────────────────

export function enquiryLedgerToSheetRowValues(
  ledger: IEnquiryLedger,
): (string | number)[] {
  // Combine linked post and job IDs into one cell
  const linkedId = [ledger.linkedPostId, ledger.linkedJobId]
    .filter(Boolean)
    .join(", ");

  return [
    // A: Date
    formatDateIST(ledger.date),

    // B: Sl No
    ledger.serialNumber ?? "",

    // C: Enquiry ID
    ledger.enquiryId,

    // D: Post / Job ID
    linkedId,

    // E: Status
    ledger.currentStatus,

    // F: Result
    ledger.result,
  ];
}

// ─── Sheet row index parser ───────────────────────────────────────────────────

function parseRowNumberFromA1Range(updatedRange: string | undefined): number | null {
  if (!updatedRange) return null;
  const tail = updatedRange.split(":").at(-1);
  const match = tail?.match(/(\d+)\s*$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Sheet sync ───────────────────────────────────────────────────────────────

export async function syncEnquiryLedgerRowToSheet(
  ledger: IEnquiryLedger,
): Promise<void> {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.error("[syncEnquiryLedgerRowToSheet] Missing env var: GOOGLE_SHEET_ID");
      reportBackgroundError(new Error("Missing env var: GOOGLE_SHEET_ID"), {
        operation: "sync-enquiry-ledger-row",
        integration: "google-sheets",
        extra: { enquiryId: ledger.enquiryId, reason: "missing-spreadsheet-id" },
      });
      return;
    }

    const sheets = await getGoogleSheetsClient();
    await ensureTabExists(sheets, spreadsheetId, ENQUIRIES_TAB, ENQUIRIES_HEADERS);
    const rowValues = enquiryLedgerToSheetRowValues(ledger);
    const lastCol = "F";

    // For Enquiries, the row index is always serialNumber + 1 (to preserve header at row 1).
    // If serialNumber is somehow missing, fallback to sheetRowIndex, but this should be rare.
    let rowIndex = ledger.sheetRowIndex;
    if (ledger.serialNumber) {
      rowIndex = ledger.serialNumber + 1;
    }

    if (!rowIndex) {
      console.error("[syncEnquiryLedgerRowToSheet] No valid rowIndex available", ledger);
      reportBackgroundError(new Error("Enquiry ledger has no sheet row index"), {
        operation: "sync-enquiry-ledger-row",
        integration: "google-sheets",
        extra: { enquiryId: ledger.enquiryId, reason: "missing-row-index" },
      });
      return;
    }

    const range = `${ENQUIRIES_TAB}!A${rowIndex}:${lastCol}${rowIndex}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
  } catch (err) {
    console.error(
      "[syncEnquiryLedgerRowToSheet] Error syncing for enquiryId:",
      ledger.enquiryId,
      err,
    );
    reportBackgroundError(err, {
      operation: "sync-enquiry-ledger-row",
      integration: "google-sheets",
      extra: { enquiryId: ledger.enquiryId },
    });
  }
}

// ─── Upsert EnquiryLedger ─────────────────────────────────────────────────────

export async function upsertEnquiryLedger(enquiryId: string): Promise<IEnquiryLedger> {
  await dbConnect();

  const enquiry = await Enquiry.findOne({ enquiryId }).lean<IEnquiry>();
  if (!enquiry) {
    throw new NotFoundError("Enquiry");
  }

  const existingLedger = await EnquiryLedger.findOne({ enquiryId }).lean<IEnquiryLedger>();

  // ─── Resolve linked Post / Job ────────────────────────────────────────────
  const [linkedPost, linkedJob] = await Promise.all([
    Post.findOne({ enquiryId: enquiry._id })
      .select("postId")
      .lean<{ postId: string }>(),
    Job.findOne({ enquiryId: enquiry._id })
      .select("jobId")
      .lean<{ jobId: string }>(),
  ]);

  const linkedPostId: string | null = linkedPost?.postId ?? null;
  const linkedJobId: string | null = linkedJob?.jobId ?? null;

  // ─── Derived result ────────────────────────────────────────────────────────
  const result: EnquiryResult = deriveResult(enquiry.currentStatus);

  // ─── Serial number: assign once ───────────────────────────────────────────
  const serialNumber: number | null = existingLedger?.serialNumber ?? null;
  const serialNumberFinal: number | null =
    serialNumber === null
      ? (await EnquiryLedger.countDocuments()) + 1
      : serialNumber;

  const sheetRowIndex: number | null = existingLedger?.sheetRowIndex ?? null;

  const ledgerData = {
    enquiryId,
    enquiryObjectId: enquiry._id,
    serialNumber: serialNumberFinal,
    date: enquiry.createdAt,
    linkedPostId,
    linkedJobId,
    currentStatus: enquiry.currentStatus,
    result,
    sheetRowIndex,
    lastUpdatedAt: new Date(),
  };

  const upserted = await EnquiryLedger.findOneAndUpdate(
    { enquiryId },
    { $set: ledgerData },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  if (!upserted) {
    throw new InternalError("Failed to upsert EnquiryLedger");
  }

  // Fire-and-forget
  syncEnquiryLedgerRowToSheet(upserted).catch((err) =>
    reportBackgroundError(err, {
      operation: "sync-enquiry-ledger-row",
      integration: "google-sheets",
      extra: { enquiryId },
    }),
  );

  return upserted;
}
