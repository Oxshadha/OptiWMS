export function mapOutboundOrderStatus(status: string | null | undefined): string {
  if (!status) return "pending";
  if (status === "processing") return "picking";
  if (status === "ready") return "ready_to_ship";
  return status;
}

export function mapInboundOrderStatus(status: string | null | undefined): string {
  if (!status) return "ordered";
  if (status === "pending") return "ordered";
  if (status === "shipped") return "in_transit";
  if (status === "delivered") return "arrived";
  if (status === "processing") return "receiving";
  if (status === "fulfilled") return "completed";
  return status;
}

export type PackingDisplayStatus =
  | "pending_approval"
  | "pending"
  | "in_progress"
  | "packed"
  | "shipped";

export function mapPackingStatus(status: string | null | undefined): PackingDisplayStatus {
  if (status === "pending_approval") return "pending_approval";
  if (status === "in_progress") return "in_progress";
  if (status === "packed") return "packed";
  if (status === "shipped") return "shipped";
  return "pending";
}
