import type { StatusTone } from "@/components/StatusChip";

export interface InboundOrderDisplay {
  id: string;
  orderNumber: string;
  supplierId: string | null;
  supplierName: string;
  warehouseName: string;
  orderDate: string;
  expectedDelivery: string;
  status: string;
  totalItems: number;
  receivedItems: number;
  totalQuantity: number;
  receivedQuantity: number;
}

/**
 * Every status the API can report for an inbound order.
 *
 * A missing key falls back to "Ordered", which read as "nothing has happened yet" on the
 * ~72% of orders whose real status is `received` or `put_away`. Keep this in step with the
 * statuses the backend actually writes.
 */
export const statusConfig = {
  ordered: { label: "Ordered" },
  in_transit: { label: "In Transit" },
  arrived: { label: "Arrived" },
  receiving: { label: "Receiving" },
  quality_check: { label: "Quality Check" },
  quality_approved: { label: "Quality Approved" },
  received: { label: "Received" },
  putaway: { label: "Putaway" },
  putaway_in_progress: { label: "Putaway In Progress" },
  put_away: { label: "Put Away" },
  return_initiated: { label: "Return Initiated" },
  completed: { label: "Completed" },
  cancelled: { label: "Cancelled" },
};

/** Chip colour for an inbound status. Kept beside statusConfig so the two cannot drift apart. */
export function getInboundStatusTone(status: string): StatusTone {
  if (status === "completed" || status === "put_away") return "success";
  if (status === "cancelled") return "danger";
  if (
    status === "arrived" ||
    status === "receiving" ||
    status === "putaway" ||
    status === "putaway_in_progress" ||
    status === "quality_check" ||
    status === "quality_approved" ||
    status === "received"
  ) {
    return "info";
  }
  return "warning";
}
