export interface ShipmentDisplay {
  shipmentId: string;
  id: string;
  carrier: string;
  status: string;
  eta: string;
  tracking: string;
  destination: string;
  weight: string;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  orders: string[];
  shipmentDate: string;
}

export const shipmentStatusTone = (s: string): "success" | "info" | "warning" | "danger" | "neutral" => {
  if (s === "Delivered") return "success";
  if (s === "In Transit") return "info";
  if (s === "Label Created" || s === "Ready to Ship") return "warning";
  if (s === "Cancelled") return "danger";
  return "neutral";
};

export const tabs = ["All", "In Transit", "Delivered", "Label Created", "Ready to Ship"];
