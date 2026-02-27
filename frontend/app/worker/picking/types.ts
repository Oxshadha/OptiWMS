export interface Pick {
  id: string;
  taskId: string;
  order: string;
  orderId?: string;
  location: string;
  item: string;
  sku: string;
  materialId: string;
  qty: number;
  taskStatus?: string;
  skipReason?: string;
  allocationPolicy?: string;
  status: "current" | "upcoming" | "completed";
  pickedLocations?: string[];
}
