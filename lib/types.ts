// Unified status vocabulary shared by every leaf node in the tree, whether it
// started life as a checklist item, a phase, or a phase sub-task. "N/A" means
// "doesn't apply to this project" and is excluded from rollup percentages.
export type Status = "Not Started" | "In Progress" | "Completed" | "Blocked" | "N/A";

// The coarser state a *non-leaf* node is displayed in, computed by rolling up
// its leaf descendants (see lib/tree.ts). Kept separate from Status because a
// list node never has its own Status cell in the sheet — its state is always
// derived, never entered directly.
export type RollupState = "complete" | "active" | "blocked" | "upcoming";

// One row of the "Project Tree" sheet tab, and one node of the tree it builds.
// A node with an empty `children` array is a leaf (has a Status); a node with
// one or more children is a list (its status is always a computed rollup).
export interface TreeNode {
  id: string;
  parentId: string;
  title: string;
  status: Status | string;
  notes: string;
  children: TreeNode[];
}

export interface ClientInfo {
  clientName: string;
  projectName: string;
  startDate: string;
  targetLaunch: string;
  platform: string;
  primaryContact: string;
  contactEmail: string;
  projectOwner: string;
}

export interface DashboardData {
  client: ClientInfo;
  // Top-level branches of the tree, e.g. "Intake Checklist" and
  // "Project Phases". Row order in the sheet controls order here.
  roots: TreeNode[];
  fetchedAt: string;
}
