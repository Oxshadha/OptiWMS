export interface ReturnDisplay {
  id: string;
  returnNumber: string;
  originalOrderId: string | null;
  originalOrder: string;
  originalOrderType?: string | null;
  customerName: string;
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

export const statusConfig = {
  pending: { label: "Pending", class: "badge-warning" },
  received: { label: "Received", class: "badge-info" },
  inspecting: { label: "Inspecting", class: "badge-warning" },
  approved: { label: "Approved", class: "badge-success" },
  rejected: { label: "Rejected", class: "badge-error" },
  restocked: { label: "Restocked", class: "badge-success" },
  disposed: { label: "Disposed", class: "badge-error" },
};

export const resolutionConfig = {
  refund: { label: "Refund", class: "badge-info" },
  replace: { label: "Replace", class: "badge-warning" },
  repair: { label: "Repair", class: "badge-warning" },
  reject: { label: "Reject", class: "badge-error" },
};
