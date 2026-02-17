import type { StatusTone } from "@/components/StatusChip";

export type TransferType = "intra_warehouse" | "inter_warehouse";
export type TransferStatus =
  | "draft"
  | "released"
  | "in_progress"
  | "partially_completed"
  | "in_transit"
  | "completed"
  | "received"
  | "cancelled";

export interface StockTransfer {
  id: string;
  transferNumber: string;
  transferType: TransferType;
  sourceWarehouse?: string;
  sourceLocationCode: string;
  destWarehouse?: string;
  destLocationCode: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  status: TransferStatus;
  notes?: string;
  dispatchedBy?: string;
  dispatchedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  createdAt: string;
}

export const transferStatusTone = (status: TransferStatus): StatusTone => {
  if (status === "completed" || status === "received") return "success";
  if (status === "cancelled") return "danger";
  if (status === "partially_completed" || status === "draft") return "warning";
  if (status === "in_progress" || status === "in_transit" || status === "released") return "info";
  return "neutral";
};
