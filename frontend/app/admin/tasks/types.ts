export interface TaskDisplay {
  id: string;
  taskNumber: string;
  taskType: string;
  workerName: string;
  warehouseId?: string;
  warehouseName: string;
  priority: string;
  status: string;
  assignedDate: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  locationCode?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  details?: string;
}

export const taskTypeConfig = {
  receiving: { label: "Receiving", icon: "input", class: "badge-primary" },
  quality_check: {
    label: "Quality Check",
    icon: "verified",
    class: "badge-info",
  },
  putaway: { label: "Putaway", icon: "move_to_inbox", class: "badge-success" },
  picking: { label: "Picking", icon: "shopping_cart", class: "badge-warning" },
  packing: { label: "Packing", icon: "inventory_2", class: "badge-info" },
  cycle_count: {
    label: "Cycle Count",
    icon: "autorenew",
    class: "badge-accent",
  },
  returns: {
    label: "Returns",
    icon: "keyboard_return",
    class: "badge-warning",
  },
  relocation: { label: "Relocation", icon: "swap_horiz", class: "badge-info" },
  shipment: {
    label: "Shipment",
    icon: "local_shipping",
    class: "badge-primary",
  },
};

export const statusConfig = {
  pending: { label: "Pending", class: "badge-outline" },
  assigned: { label: "Assigned", class: "badge-info" },
  in_progress: { label: "In Progress", class: "badge-primary" },
  completed: { label: "Completed", class: "badge-success" },
  cancelled: { label: "Cancelled", class: "badge-error" },
};

export const priorityConfig = {
  low: { label: "Low", class: "badge-outline" },
  normal: { label: "Normal", class: "badge-info" },
  high: { label: "High", class: "badge-warning" },
  urgent: { label: "Urgent", class: "badge-error" },
};
