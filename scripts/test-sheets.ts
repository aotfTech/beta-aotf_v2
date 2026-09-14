import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getGoogleSheetsClient, ensureTabExists } from "../lib/googleSheets";

/**
 * Simple local test for Google Sheets service account auth.
 *
 * Requires env vars:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 * - GOOGLE_SHEET_ID
 *
 * Optional:
 * - GOOGLE_SHEET_TEST_TAB (default: "PostLedger")
 */
async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || "1dkLzzjqZbs0nZHLYGpGNFp8PCwJfjT2AvqsUtVzsDJ4";
  if (!spreadsheetId) throw new Error("Missing env var: GOOGLE_SHEET_ID");

  const tab = process.env.GOOGLE_SHEET_TEST_TAB || "Sheet1";

  const sheets = await getGoogleSheetsClient();
  
  // Ensure the tab exists before trying to read or write to it
  await ensureTabExists(sheets, spreadsheetId, tab);

  // 1) Read A1
  const readRange = `${tab}!A1:B2`;
  const read = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: readRange,
  });

  console.log("\n[GoogleSheets] Read", readRange);
  console.log(JSON.stringify(read.data.values ?? [], null, 2));

  // 2) Write a timestamp to A1
  const now = new Date();
  const writeRange = `${tab}!A1`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: writeRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[`Sheets OK @ ${now.toISOString()}`]],
    },
  });

  console.log("\n[GoogleSheets] Wrote to", writeRange);

  // 3) Append a row to A:C
  const appendRange = `${tab}!A:C`;
  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: appendRange,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [["test-sheets", now.toISOString(), "ok"]],
    },
  });

  console.log("\n[GoogleSheets] Appended to", appendRange);
  console.log("updatedRange:", appendRes.data.updates?.updatedRange);
}

main().catch((err) => {
  console.error("\n[test-sheets] Failed:");
  console.error(err);
  process.exitCode = 1;
});
