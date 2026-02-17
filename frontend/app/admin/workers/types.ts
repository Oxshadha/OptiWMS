import { WorkerRole } from "@/lib/worker-roles";
import type { StatusTone } from "@/components/StatusChip";

export interface WorkerDisplay {
  id: string;
  workerId: string;
  name: string;
  warehouseName: string;
  availabilityStatus: "available" | "busy" | "offline";
  shiftStart?: string;
  shiftEnd?: string;
  tasksToday: number;
  totalTasksCompleted: number;
  avgTaskTime?: number;
  lastActive: string;
  avatar: string;
  role: WorkerRole;
}

export const statusConfig = {
  available: { label: "Available", tone: "success" as StatusTone },
  busy: { label: "Busy", tone: "warning" as StatusTone },
  offline: { label: "Offline", tone: "danger" as StatusTone },
} as const;
