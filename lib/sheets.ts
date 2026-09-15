import { google } from "googleapis";
import type {
  CategorySummary,
  ChecklistItem,
  ClientInfo,
  DashboardData,
  Phase,
  PhaseTask,
} from "./types";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID ?? "";
const CHECKLIST_SHEET_NAME = process.env.CHECKLIST_SHEET_NAME ?? "Checklist Template";
const PHASES_SHEET_NAME = process.env.PHASES_SHEET_NAME ?? "Phases";
const PHASE_TASKS_SHEET_NAME = process.env.PHASE_TASKS_SHEET_NAME ?? "Phase Tasks";

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
    range: `'${sheetName}'!A1:Z200`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  return rows.map((row) => row.map((cell) => (cell ?? "").toString()));
}

// Phase sub-tasks live on a tab that older client spreadsheets (set up before
// this feature existed) won't have yet. Missing it shouldn't break the whole
// dashboard — phases just render with no sub-tasks until that tab is added.
async function fetchSheetGridOptional(sheetName: string): Promise<Grid> {
  try {
    return await fetchSheetGrid(sheetName);
  } catch {
    return [];
  }
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

function parseChecklist(grid: Grid): { items: ChecklistItem[]; client: ClientInfo } {
  const client = parseClientInfo(grid);

  const headerRowIdx = findHeaderRow(grid, ["Category", "Item", "Status"]);
  if (headerRowIdx === -1) {
    return { items: [], client };
  }
  const header = grid[headerRowIdx];
  const iCategory = colIndex(header, "Category");
  const iItem = colIndex(header, "Item");
  const iStatus = colIndex(header, "Status");
  const iNotes = colIndex(header, "Notes");
  const iDate = colIndex(header, "Date Received");
  const iOwner = colIndex(header, "Owner");

  const items: ChecklistItem[] = [];
  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    const category = (row[iCategory] ?? "").trim();
    const item = (row[iItem] ?? "").trim();
    if (!category && !item) continue; // stop-ish, but keep scanning in case of gaps
    if (!item) continue;
    items.push({
      category,
      item,
      status: (row[iStatus] ?? "Not Started").trim() || "Not Started",
      notes: (row[iNotes] ?? "").trim(),
      dateReceived: (row[iDate] ?? "").trim(),
      owner: (row[iOwner] ?? "").trim(),
    });
  }
  return { items, client };
}

function parsePhases(grid: Grid): Phase[] {
  const headerRowIdx = findHeaderRow(grid, ["Phase", "Status"]);
  if (headerRowIdx === -1) return [];
  const header = grid[headerRowIdx];
  const iPhase = colIndex(header, "Phase");
  const iStatus = colIndex(header, "Status");
  const iStart = colIndex(header, "Start Date");
  const iComplete = colIndex(header, "Complete Date");
  const iNotes = colIndex(header, "Notes");

  const phases: Phase[] = [];
  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    const name = (row[iPhase] ?? "").trim();
    if (!name) continue;
    phases.push({
      name,
      status: (row[iStatus] ?? "Not Started").trim() || "Not Started",
      startDate: (row[iStart] ?? "").trim(),
      completeDate: (row[iComplete] ?? "").trim(),
      notes: (row[iNotes] ?? "").trim(),
      tasks: [],
    });
  }
  return phases;
}

// Sub-tasks live on their own tab ("Phase Tasks" by default) shaped like the
// checklist: one row per sub-task, referencing its parent phase by name.
function parsePhaseTasks(grid: Grid): Map<string, PhaseTask[]> {
  const byPhase = new Map<string, PhaseTask[]>();
  const headerRowIdx = findHeaderRow(grid, ["Phase", "Sub-task", "Status"]);
  if (headerRowIdx === -1) return byPhase;
  const header = grid[headerRowIdx];
  const iPhase = colIndex(header, "Phase");
  const iTask = colIndex(header, "Sub-task");
  const iStatus = colIndex(header, "Status");

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    const phaseName = (row[iPhase] ?? "").trim();
    const taskName = (row[iTask] ?? "").trim();
    if (!phaseName || !taskName) continue;
    const task: PhaseTask = {
      name: taskName,
      status: (row[iStatus] ?? "Not Started").trim() || "Not Started",
    };
    if (!byPhase.has(phaseName)) byPhase.set(phaseName, []);
    byPhase.get(phaseName)!.push(task);
  }
  return byPhase;
}

function summarizeCategories(items: ChecklistItem[]): CategorySummary[] {
  const map = new Map<string, CategorySummary>();
  for (const item of items) {
    const key = item.category || "Uncategorized";
    if (!map.has(key)) map.set(key, { category: key, total: 0, done: 0 });
    const entry = map.get(key)!;
    entry.total += 1;
    if (item.status === "Received" || item.status === "N/A") entry.done += 1;
  }
  return Array.from(map.values());
}

export async function getDashboardData(): Promise<DashboardData> {
  const [checklistGrid, phasesGrid, phaseTasksGrid] = await Promise.all([
    fetchSheetGrid(CHECKLIST_SHEET_NAME),
    fetchSheetGrid(PHASES_SHEET_NAME),
    fetchSheetGridOptional(PHASE_TASKS_SHEET_NAME),
  ]);

  const { items, client } = parseChecklist(checklistGrid);
  const categories = summarizeCategories(items);
  const doneCount = items.filter((i) => i.status === "Received" || i.status === "N/A").length;
  const percentComplete = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const phaseTasksByPhase = parsePhaseTasks(phaseTasksGrid);
  const phases = parsePhases(phasesGrid).map((phase) => ({
    ...phase,
    tasks: phaseTasksByPhase.get(phase.name) ?? [],
  }));

  return {
    client,
    items,
    categories,
    percentComplete,
    phases,
    fetchedAt: new Date().toISOString(),
  };
}
