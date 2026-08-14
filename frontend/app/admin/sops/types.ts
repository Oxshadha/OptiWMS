import type { StatusTone } from "@/components/StatusChip";

export type SOPCategory =
  | "equipment_operation"
  | "cycle_count"
  | "warehouse_operations"
  | "safety"
  | "inspection"
  | "general";

export type SOP = {
  id: string;
  title: string;
  category: SOPCategory;
  content: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  applicableRoles?: string[];
  status: "active" | "draft" | "archived";
  isSystem?: boolean;
};

export const SOP_CATEGORIES: Record<SOPCategory, string> = {
  equipment_operation: "Equipment Operation",
  cycle_count: "Cycle Count",
  warehouse_operations: "Warehouse Operations",
  safety: "Safety",
  inspection: "Inspection",
  general: "General",
};

export const statusConfig: Record<SOP["status"], { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  draft: { label: "Draft", tone: "warning" },
  archived: { label: "Archived", tone: "danger" },
};
