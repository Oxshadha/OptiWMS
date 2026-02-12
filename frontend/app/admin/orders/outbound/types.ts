export interface OutboundOrderDisplay {
  id: string;
  orderNumber: string;
  customerName: string;
  warehouseName: string;
  orderDate: string;
  requiredDelivery: string;
  priority: string;
  status: string;
  totalItems: number;
  pickedItems: number;
}
