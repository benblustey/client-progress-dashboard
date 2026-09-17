import type { RollupState, Status, TreeNode } from "./types";

// The one root branch that gets the special horizontal-stepper treatment on
// the dashboard (see components/PhaseStepper.tsx). Every other root, and
// everything nested below this one's direct children, uses the generic
// TreeAccordion instead.
export const PHASES_ROOT_TITLE = "Project Phases";

// The root listed ahead of the phases in the combined "Project Phases"
// section (see app/page.tsx).
export const INTAKE_ROOT_TITLE = "Intake Checklist";

// Synthetic root any row with a broken ParentID reference (or one caught in a
// cycle) gets filed under, so a typo makes something visibly orphaned instead
// of silently disappearing from the dashboard.
export const UNLINKED_ROOT_TITLE = "⚠ Unlinked rows (check ParentID)";

const KNOWN_STATUSES: Status[] = ["Not Started", "In Progress", "Completed", "Blocked", "N/A"];

export function normalizeStatus(raw: string): Status {
  const trimmed = raw.trim();
  return (KNOWN_STATUSES as string[]).includes(trimmed) ? (trimmed as Status) : "Not Started";
}

export interface TreeRow {
  id: string;
  parentId: string;
  title: string;
  status: string;
  notes: string;
}

/**
 * Builds the node forest from flat sheet rows, linking children to parents by
 * ID rather than by row position. Sibling order follows sheet row order.
 *
 * Rows are forgiving by design (this sheet is hand-edited): a blank id or
 * title is skipped, a duplicate id keeps its first occurrence, and a row
 * whose ParentID doesn't resolve to a real row (typo, or a cycle) is filed
 * under a synthetic "Unlinked rows" root instead of vanishing — check the
 * server logs for which row and why.
 */
export function buildTree(rows: TreeRow[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const parentOf = new Map<string, string>();
  const order: string[] = [];

  for (const row of rows) {
    const id = row.id.trim();
    const title = row.title.trim();
    if (!id || !title) continue;
    if (nodeMap.has(id)) {
      console.error(
        `Project Tree: duplicate row ID "${id}" — keeping the first occurrence, ignoring the rest.`
      );
      continue;
    }
    nodeMap.set(id, {
      id,
      parentId: row.parentId.trim(),
      title,
      status: row.status.trim(),
      notes: row.notes.trim(),
      children: [],
    });
    parentOf.set(id, row.parentId.trim());
    order.push(id);
  }

  const roots: TreeNode[] = [];
  const unresolved: TreeNode[] = [];

  for (const id of order) {
    const node = nodeMap.get(id)!;
    const parentId = parentOf.get(id)!;

    if (!parentId) {
      roots.push(node);
      continue;
    }
    if (parentId === id) {
      console.error(
        `Project Tree: row "${id}" lists itself as its own ParentID — treating as unlinked.`
      );
      unresolved.push(node);
      continue;
    }
    const parent = nodeMap.get(parentId);
    if (!parent) {
      console.error(
        `Project Tree: row "${id}" has ParentID "${parentId}", which doesn't match any row ID — treating as unlinked.`
      );
      unresolved.push(node);
      continue;
    }
    parent.children.push(node);
  }

  // Catch cycles between two or more non-root rows (A's parent is B, B's
  // parent is A): both get attached as each other's child above, but neither
  // is reachable from an actual root, so they'd otherwise render nowhere.
  const visited = new Set<string>();
  function visit(node: TreeNode) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    node.children.forEach(visit);
  }
  roots.forEach(visit);
  unresolved.forEach(visit);

  for (const id of order) {
    if (!visited.has(id)) {
      const node = nodeMap.get(id)!;
      console.error(`Project Tree: row "${id}" is part of a ParentID cycle — treating as unlinked.`);
      unresolved.push(node);
      visit(node);
    }
  }

  if (unresolved.length > 0) {
    roots.push({
      id: "__unlinked__",
      parentId: "",
      title: UNLINKED_ROOT_TITLE,
      status: "",
      notes: "",
      children: unresolved,
    });
  }

  return roots;
}

export interface Rollup {
  percent: number;
  state: RollupState;
  completed: number;
  total: number;
}

/**
 * Derives a list node's displayed status by walking its leaf descendants.
 * N/A leaves are excluded from the denominator entirely. Any Blocked leaf
 * marks the whole subtree blocked, regardless of how far complete it is.
 */
export function computeRollup(node: TreeNode): Rollup {
  let total = 0;
  let completed = 0;
  let anyBlocked = false;
  let anyStarted = false;

  function walk(n: TreeNode) {
    if (n.children.length === 0) {
      const status = normalizeStatus(n.status);
      if (status === "N/A") return;
      total += 1;
      if (status === "Completed") completed += 1;
      if (status === "Blocked") anyBlocked = true;
      if (status === "In Progress" || status === "Completed") anyStarted = true;
      return;
    }
    n.children.forEach(walk);
  }

  node.children.forEach(walk);

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  let state: RollupState;
  if (anyBlocked) state = "blocked";
  else if (total > 0 && completed === total) state = "complete";
  else if (anyStarted) state = "active";
  else state = "upcoming";

  return { percent, state, completed, total };
}
