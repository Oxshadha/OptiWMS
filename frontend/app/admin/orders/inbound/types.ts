export interface InboundOrderDisplay {
  id: string;
  orderNumber: string;
  supplierName: string;
  warehouseName: string;
  orderDate: string;
  expectedDelivery: string;
  status: string;
  totalItems: number;
  receivedItems: number;
}

export const statusConfig = {
  ordered: { label: "Ordered", class: "badge-outline" },
  in_transit: { label: "In Transit", class: "badge-warning" },
  arrived: { label: "Arrived", class: "badge-info" },
  receiving: { label: "Receiving", class: "badge-primary" },
  quality_check: { label: "Quality Check", class: "badge-warning" },
  putaway: { label: "Putaway", class: "badge-info" },
  completed: { label: "Completed", class: "badge-success" },
  cancelled: { label: "Cancelled", class: "badge-error" },
};
