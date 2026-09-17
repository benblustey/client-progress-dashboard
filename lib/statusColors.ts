// Shared badge/dot color mappings so leaf statuses and computed rollup states
// stay visually consistent between TreeAccordion and Stepper.
import type { RollupState } from "./types";
import { normalizeStatus } from "./tree";

const badgeBase = "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium";

const emerald = `${badgeBase} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300`;
const sky = `${badgeBase} bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300`;
const rose = `${badgeBase} bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300`;
const slate = `${badgeBase} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400`;

// Leaf status → badge, for the five-value vocabulary entered directly in the
// sheet. N/A is muted rather than "done" green since it's excluded from every
// rollup percentage — it isn't progress, it's "doesn't apply here".
export function leafStatusClass(status: string): string {
  switch (normalizeStatus(status)) {
    case "Completed":
      return emerald;
    case "In Progress":
      return sky;
    case "Blocked":
      return rose;
    case "N/A":
    case "Not Started":
    default:
      return slate;
  }
}

// Computed rollup state → badge, for list nodes (categories, phases, any
// nested grouping) whose displayed status is always derived, never entered.
export function rollupBadgeClass(state: RollupState): string {
  switch (state) {
    case "complete":
      return emerald;
    case "active":
      return sky;
    case "blocked":
      return rose;
    case "upcoming":
    default:
      return slate;
  }
}

// Dot + connecting-line fills for the stepper, keyed by the same rollup
// state so a step's dot always matches its badge color elsewhere.
export const stepperDotClasses: Record<RollupState, string> = {
  complete: "bg-emerald-500 border-emerald-500",
  active: "bg-sky-500 border-sky-500",
  blocked: "bg-rose-500 border-rose-500",
  upcoming: "bg-slate-200 border-slate-300 dark:bg-slate-700 dark:border-slate-600",
};

export const stepperLineClasses: Record<RollupState, string> = {
  complete: "bg-emerald-400",
  active: "bg-sky-300",
  blocked: "bg-rose-300",
  upcoming: "bg-slate-200 dark:bg-slate-700",
};
