export interface CycleCountDisplay {
  id: string;
  countNumber: string;
  warehouseName: string;
  sectionName: string;
  countType: "scheduled" | "ad_hoc" | "full";
  scheduledDate: string;
  actualDate: string | null;
  status: string;
  assignedWorkers: string[];
  assignedBy: string;
  assignedDate: string;
  totalLocations: number;
  countedLocations: number;
  discrepanciesFound: number;
  performedBy: string | null;
}

export const countTypeConfig = {
  scheduled: { label: "Scheduled", class: "badge-info" },
  ad_hoc: { label: "Ad-Hoc", class: "badge-warning" },
  full: { label: "Full", class: "badge-primary" },
} as const;

export const statusConfig = {
  scheduled: { label: "Scheduled", class: "badge-outline" },
  in_progress: { label: "In Progress", class: "badge-primary" },
  pending_approval: { label: "Pending Approval", class: "badge-warning" },
  recount_required: { label: "Recount Required", class: "badge-info" },
  completed: { label: "Completed", class: "badge-success" },
  cancelled: { label: "Cancelled", class: "badge-error" },
} as const;
