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
  ordered: { label: "Ordered" },
  in_transit: { label: "In Transit" },
  arrived: { label: "Arrived" },
  receiving: { label: "Receiving" },
  quality_check: { label: "Quality Check" },
  putaway: { label: "Putaway" },
  completed: { label: "Completed" },
  cancelled: { label: "Cancelled" },
};
