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

export const statusClass = (s: string): string => {
  if (s === "Delivered") return "badge-success";
  if (s === "In Transit") return "badge-info";
  if (s === "Label Created") return "badge-warning";
  if (s === "Ready to Ship") return "badge-warning";
  return "badge-outline";
};

export const tabs = ["All", "In Transit", "Delivered", "Label Created", "Ready to Ship"];
