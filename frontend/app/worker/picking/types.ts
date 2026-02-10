export interface Pick {
  id: string;
  taskId: string;
  order: string;
  location: string;
  item: string;
  sku: string;
  materialId: string;
  qty: number;
  status: "current" | "upcoming" | "completed";
  pickedLocations?: string[];
}
