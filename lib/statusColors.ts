// Shared badge color mappings, kept in one place so the checklist, phase,
// and sub-task status badges stay visually consistent across components.

const base =
  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium";

const emerald = `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300`;
const sky = `${base} bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300`;
const amber = `${base} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`;
const rose = `${base} bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300`;
const slate = `${base} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400`;

const checklistStatusStyles: Record<string, string> = {
  Received: emerald,
  "N/A": emerald,
  Requested: amber,
  "Not Started": slate,
};

const phaseStatusStyles: Record<string, string> = {
  Complete: emerald,
  "In Progress": sky,
  Blocked: rose,
  "Not Started": slate,
};

const subtaskStatusStyles: Record<string, string> = {
  Completed: emerald,
  "In Progress": sky,
  "Not Started": slate,
};

export function checklistStatusClass(status: string): string {
  return checklistStatusStyles[status] ?? slate;
}

export function phaseStatusClass(status: string): string {
  return phaseStatusStyles[status] ?? slate;
}

export function subtaskStatusClass(status: string): string {
  return subtaskStatusStyles[status] ?? slate;
}
