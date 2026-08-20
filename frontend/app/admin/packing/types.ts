import type { StatusTone } from "@/components/StatusChip";

/**
 * Packing lifecycle. `pending_approval` is the manager gate a picked order lands in; nothing
 * reaches a packer until someone approves it.
 */
export type PackingStatus =
  | "pending_approval"
  | "pending"
  | "in_progress"
  | "packed"
  | "shipped";

export type PackingPriority = "normal" | "express";

export interface PackingRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customer: string;
  priority: PackingPriority;
  packagingType: string;
  boxDimensions?: { length: number; width: number; height: number };
  actualWeight: number;
  dimensionalWeight: number;
  chargeableWeight: number;
  trackingNumber?: string;
  packerId?: string;
  packerName?: string;
  status: PackingStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  warehouseName?: string;
}

export const packingStatusTone = (status: PackingStatus): StatusTone => {
  if (status === "pending_approval") return "warning";
  if (status === "shipped") return "success";
  if (status === "packed") return "info";
  if (status === "in_progress") return "warning";
  return "neutral";
};
