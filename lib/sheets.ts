import { google } from "googleapis";
import type { ClientInfo, DashboardData } from "./types";
import { buildTree, type TreeRow } from "./tree";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID ?? "";
const TREE_SHEET_NAME = process.env.TREE_SHEET_NAME ?? "Project Tree";

/**
 * Builds an authenticated Sheets client from a service account.
 *
 * Supports two ways of supplying credentials (pick one):
 *  - GOOGLE_SERVICE_ACCOUNT_KEY_BASE64: the full service-account JSON key, base64-encoded
 *    (easiest to paste into a single-line env var in Coolify).
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: the two fields
 *    pulled out of that same JSON key individually.
 *
 * This file must only ever be imported from server-side code (Server Components,
 * Route Handlers). Never import it from a "use client" file, or these credentials
 * would ship to the browser.
 */
function getCredentials(): { client_email: string; private_key: string } {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
    return { client_email: json.client_email, private_key: json.private_key };
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (email && key) {
    return { client_email: email, private_key: key.replace(/\\n/g, "\n") };
  }

  throw new Error(
    "Missing Google service account credentials. Set GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, " +
      "or both GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
  );
}

async function getSheetsClient() {
  const { client_email, private_key } = getCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

type Grid = string[][];

async function fetchSheetGrid(sheetName: string): Promise<Grid> {
  if (!SPREADSHEET_ID) {
    throw new Error("Missing SPREADSHEET_ID environment variable.");
  }
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:Z500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  return rows.map((row) => row.map((cell) => (cell ?? "").toString()));
}

function findHeaderRow(grid: Grid, requiredHeaders: string[]): number {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r].map((c) => c.trim());
    if (requiredHeaders.every((h) => row.includes(h))) {
      return r;
    }
  }
  return -1;
}

function colIndex(headerRow: string[], name: string): number {
  return headerRow.findIndex((h) => h.trim() === name);
}

// The client info block (Client Name:, Project Name:, etc.) sits above the
// ID/ParentID/Title/Status/Notes table on the same tab — scan the whole grid
// for "Label:" / value cell pairs rather than assuming fixed coordinates.
function parseClientInfo(grid: Grid): ClientInfo {
  const labels: Record<string, string> = {};
  for (const row of grid) {
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] ?? "").trim();
      if (cell.endsWith(":")) {
        const label = cell.slice(0, -1).trim();
        const value = (row[c + 1] ?? "").trim();
        labels[label] = value;
      }
    }
  }

  return {
    clientName: labels["Client Name"] ?? "",
    projectName: labels["Project Name"] ?? "",
    startDate: labels["Start Date"] ?? "",
    targetLaunch: labels["Target Launch"] ?? "",
    platform: labels["Platform (Payload / Squarespace)"] ?? "",
    primaryContact: labels["Primary Contact"] ?? "",
    contactEmail: labels["Contact Email"] ?? "",
    projectOwner: labels["Project Owner"] ?? "",
  };
}

function parseTreeRows(grid: Grid): TreeRow[] {
  const headerRowIdx = findHeaderRow(grid, ["ID", "ParentID", "Title", "Status"]);
  if (headerRowIdx === -1) return [];
  const header = grid[headerRowIdx];
  const iId = colIndex(header, "ID");
  const iParent = colIndex(header, "ParentID");
  const iTitle = colIndex(header, "Title");
  const iStatus = colIndex(header, "Status");
  const iNotes = colIndex(header, "Notes");

  const rows: TreeRow[] = [];
  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    const id = (row[iId] ?? "").trim();
    const title = (row[iTitle] ?? "").trim();
    if (!id && !title) continue;
    rows.push({
      id,
      parentId: (row[iParent] ?? "").trim(),
      title,
      status: (row[iStatus] ?? "").trim(),
      notes: iNotes === -1 ? "" : (row[iNotes] ?? "").trim(),
    });
  }
  return rows;
}

export async function getDashboardData(): Promise<DashboardData> {
  const grid = await fetchSheetGrid(TREE_SHEET_NAME);
  const client = parseClientInfo(grid);
  const rows = parseTreeRows(grid);
  const roots = buildTree(rows);

  return {
    client,
    roots,
    fetchedAt: new Date().toISOString(),
  };
}
