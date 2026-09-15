export type ChecklistStatus = "Not Started" | "Requested" | "Received" | "N/A";

export type PhaseStatus = "Not Started" | "In Progress" | "Complete" | "Blocked";

export type SubtaskStatus = "Not Started" | "In Progress" | "Completed";

export interface ChecklistItem {
  category: string;
  item: string;
  status: ChecklistStatus | string;
  notes: string;
  dateReceived: string;
  owner: string;
}

export interface CategorySummary {
  category: string;
  total: number;
  done: number;
}

export interface PhaseTask {
  name: string;
  status: SubtaskStatus | string;
}

export interface Phase {
  name: string;
  status: PhaseStatus | string;
  startDate: string;
  completeDate: string;
  notes: string;
  tasks: PhaseTask[];
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
  items: ChecklistItem[];
  categories: CategorySummary[];
  percentComplete: number;
  phases: Phase[];
  fetchedAt: string;
}
