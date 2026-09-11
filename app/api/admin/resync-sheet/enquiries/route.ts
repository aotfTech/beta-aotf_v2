import { handleApiError } from "@/lib/api-utils";
import { reportError } from "@/lib/sentry-report";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import EnquiryLedger from "@/lib/models/EnquiryLedger";
import { getGoogleSheetsClient } from "@/lib/googleSheets";
import {
  enquiryLedgerToSheetRowValues,
  ENQUIRIES_TAB,
  ENQUIRIES_HEADERS,
} from "@/lib/services/enquiryLedger.service";

function toRowIndexFromDataRowOffset(offsetFromRow2: number): number {
  return 2 + offsetFromRow2;
}

/**
 * POST /api/admin/resync-sheet/enquiries
 * Clears the `Enquiries` sheet from row 1, rewrites headers, then bulk-syncs
 * all EnquiryLedger rows sorted by serial number.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metadata = sessionClaims?.publicMetadata as Record<string, unknown>;
    if (metadata?.isAdmin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const currentAdmin = await Admin.findOne({ clerkId: userId }).lean();
    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (currentAdmin.role === "support_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      reportError(new Error("Missing env var: GOOGLE_SHEET_ID"), {
        route: "POST /api/admin/resync-sheet/enquiries",
        tags: { integration: "google-sheets", operation: "enquiry-resync" },
      });
      return NextResponse.json(
        { error: "Missing env var: GOOGLE_SHEET_ID" },
        { status: 500 },
      );
    }

    const sheets = await getGoogleSheetsClient();

    const ledgers = await EnquiryLedger.find({})
      .sort({ serialNumber: 1 })
      .exec();

    // 1) Clear sheet from row 1
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${ENQUIRIES_TAB}!A1:F`,
    });

    // 2) Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${ENQUIRIES_TAB}!A1:F1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [ENQUIRIES_HEADERS] },
    });

    // 3) Write data rows in chunks
    const CHUNK_SIZE = 500;
    const valuesRows = ledgers.map((l) => enquiryLedgerToSheetRowValues(l));
    const startRow = 2;

    for (let i = 0; i < valuesRows.length; i += CHUNK_SIZE) {
      const chunk = valuesRows.slice(i, i + CHUNK_SIZE);
      const chunkStartRow = startRow + i;
      const chunkEndRow = chunkStartRow + chunk.length - 1;
      const range = `${ENQUIRIES_TAB}!A${chunkStartRow}:F${chunkEndRow}`;

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [{ range, values: chunk }],
        },
      });
    }

    // 4) Reset sheetRowIndex in DB
    const ops: Parameters<typeof EnquiryLedger.bulkWrite>[0] = ledgers.map(
      (ledger, idx) => ({
        updateOne: {
          filter: { enquiryId: ledger.enquiryId },
          update: { $set: { sheetRowIndex: toRowIndexFromDataRowOffset(idx) } },
        },
      }),
    );

    const BULK_CHUNK = 500;
    for (let i = 0; i < ops.length; i += BULK_CHUNK) {
      await EnquiryLedger.bulkWrite(ops.slice(i, i + BULK_CHUNK));
    }

    return NextResponse.json({ success: true, totalSynced: ledgers.length });
  } catch (error) {
    return handleApiError(error, "POST /api/admin/resync-sheet/enquiries", { legacyAdminShape: true });
  }
}
