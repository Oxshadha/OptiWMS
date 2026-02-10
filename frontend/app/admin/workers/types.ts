import { WorkerRole } from "@/lib/worker-roles";

export interface WorkerDisplay {
  id: string;
  workerId: string;
  name: string;
  warehouseName: string;
  availabilityStatus: "available" | "busy" | "offline";
  shiftStart: string;
  shiftEnd: string;
  tasksToday: number;
  totalTasksCompleted: number;
  avgTaskTime: number;
  lastActive: string;
  avatar: string;
  role: WorkerRole;
}

export const statusConfig = {
  available: { label: "Available", class: "badge-success" },
  busy: { label: "Busy", class: "badge-warning" },
  offline: { label: "Offline", class: "badge-error" },
} as const;
