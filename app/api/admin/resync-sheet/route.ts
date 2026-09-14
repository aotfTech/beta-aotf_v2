import { handleApiError } from "@/lib/api-utils";
import { reportError } from "@/lib/sentry-report";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import PostLedger, { type IPostLedger } from "@/lib/models/PostLedger";
import { getGoogleSheetsClient } from "@/lib/googleSheets";
import {
  postLedgerToSheetRowValues,
  TUITIONS_TAB,
  TUITIONS_HEADERS,
} from "@/lib/services/postLedger.service";

const OLD_TAB_NAME = "PostLedger"; // legacy name to auto-rename

function toRowIndexFromDataRowOffset(offsetFromRow2: number): number {
  return 2 + offsetFromRow2;
}

function sortBySerialNumberNullsLast(ledgers: IPostLedger[]): IPostLedger[] {
  return [...ledgers].sort((a, b) => {
    const aSN = a.serialNumber ?? Number.MAX_SAFE_INTEGER;
    const bSN = b.serialNumber ?? Number.MAX_SAFE_INTEGER;
    return aSN - bSN;
  });
}

/**
 * Renames a sheet tab if the old name still exists.
 * Uses spreadsheets.batchUpdate with updateSheetProperties.
 */
async function ensureTabName(
  sheets: Awaited<ReturnType<typeof getGoogleSheetsClient>>,
  spreadsheetId: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets ?? [];

  // Check if old name exists
  const oldSheet = sheetList.find((s) => s.properties?.title === oldName);
  if (!oldSheet) return; // already renamed or never existed

  // Already renamed: nothing to do
  const alreadyNew = sheetList.find((s) => s.properties?.title === newName);
  if (alreadyNew) return;

  const sheetId = oldSheet.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, title: newName },
            fields: "title",
          },
        },
      ],
    },
  });

  console.log(`[resync-sheet] Renamed tab "${oldName}" → "${newName}"`);
}

/**
 * POST /api/admin/resync-sheet
 * Clears the `Tuitions` sheet from row 1 downward, rewrites the header row,
 * then bulk-writes all PostLedger rows. Also auto-renames the legacy
 * "PostLedger" tab to "Tuitions" if needed.
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
        route: "POST /api/admin/resync-sheet",
        tags: { integration: "google-sheets", operation: "full-resync" },
      });
      return NextResponse.json(
        { error: "Missing env var: GOOGLE_SHEET_ID" },
        { status: 500 },
      );
    }

    const sheets = await getGoogleSheetsClient();

    // 1) Auto-rename legacy tab if needed
    await ensureTabName(sheets, spreadsheetId, OLD_TAB_NAME, TUITIONS_TAB);

    const ledgers = await PostLedger.find({}).sort({ serialNumber: 1 }).exec();
    const sortedLedgers = sortBySerialNumberNullsLast(ledgers);

    // 2) Clear sheet from row 1 downward (we'll rewrite headers too)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${TUITIONS_TAB}!A1:AD`,
    });

    // 3) Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TUITIONS_TAB}!A1:AD1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [TUITIONS_HEADERS] },
    });

    // 4) Write data rows in chunks
    const CHUNK_SIZE = 500;
    const valuesRows = sortedLedgers.map((l) => postLedgerToSheetRowValues(l));
    const startRow = 2;

    for (let i = 0; i < valuesRows.length; i += CHUNK_SIZE) {
      const chunk = valuesRows.slice(i, i + CHUNK_SIZE);
      const chunkStartRow = startRow + i;
      const chunkEndRow = chunkStartRow + chunk.length - 1;
      const range = `${TUITIONS_TAB}!A${chunkStartRow}:AD${chunkEndRow}`;

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [{ range, values: chunk }],
        },
      });
    }

    // 5) Reset sheetRowIndex in DB to match new positions
    const ops: Parameters<typeof PostLedger.bulkWrite>[0] =
      sortedLedgers.map((ledger, idx) => ({
        updateOne: {
          filter: { postId: ledger.postId },
          update: { $set: { sheetRowIndex: toRowIndexFromDataRowOffset(idx) } },
        },
      }));

    const BULK_CHUNK = 500;
    for (let i = 0; i < ops.length; i += BULK_CHUNK) {
      await PostLedger.bulkWrite(ops.slice(i, i + BULK_CHUNK));
    }

    return NextResponse.json({ success: true, totalSynced: sortedLedgers.length });
  } catch (error) {
    return handleApiError(error, "POST /api/admin/resync-sheet", { legacyAdminShape: true });
  }
}
