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

export const statusClass = (status: TransferStatus): string => {
  if (status === "completed") return "badge-success";
  if (status === "received") return "badge-success";
  if (status === "partially_completed") return "badge-warning";
  if (status === "in_progress") return "badge-info";
  if (status === "released") return "badge-primary";
  if (status === "in_transit") return "badge-info";
  if (status === "draft") return "badge-warning";
  if (status === "cancelled") return "badge-error";
  return "badge-outline";
};
