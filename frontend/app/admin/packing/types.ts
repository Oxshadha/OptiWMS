export type PackingStatus = "pending" | "in_progress" | "packed" | "shipped";

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

export const statusClass = (status: PackingStatus): string => {
  if (status === "shipped") return "badge-success";
  if (status === "packed") return "badge-info";
  if (status === "in_progress") return "badge-warning";
  return "badge-outline";
};
