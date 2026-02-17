import type { StatusTone } from "@/components/StatusChip";

export interface ReturnDisplay {
  id: string;
  returnNumber: string;
  originalOrderId: string | null;
  originalOrder: string;
  originalOrderType?: string | null;
  returnFlow: "inbound" | "outbound" | "unknown";
  customerName: string;
  counterpartyName: string;
  counterpartyType: "supplier" | "customer" | "unknown";
  warehouseId: string | null;
  warehouse: string;
  returnDate: string;
  reason: string;
  totalItems: number;
  status: string;
  resolution: string | null;
  receivedBy: string | null;
  inspectedBy: string | null;
}

export const statusConfig: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "warning" },
  received: { label: "Received", tone: "info" },
  inspecting: { label: "Inspecting", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  restocked: { label: "Restocked", tone: "success" },
  disposed: { label: "Disposed", tone: "danger" },
};

export const resolutionConfig: Record<string, { label: string; tone: StatusTone }> = {
  refund: { label: "Refund", tone: "info" },
  replace: { label: "Replace", tone: "warning" },
  repair: { label: "Repair", tone: "warning" },
  reject: { label: "Reject", tone: "danger" },
};
