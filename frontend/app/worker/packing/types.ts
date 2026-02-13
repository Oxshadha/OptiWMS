export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  pickedQuantity: number;
  verified: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  priority: "normal" | "express";
  items: OrderItem[];
  status: "ready_to_pack" | "in_progress" | "packed";
}

export interface PackingData {
  orderId: string;
  orderNumber: string;
  packagingType: string;
  boxDimensions?: { length: number; width: number; height: number };
  dunnageMaterials: string[];
  hasFragileItems: boolean;
  actualWeight: number;
  dimensionalWeight: number;
  trackingNumber: string;
  packingNotes: string;
  photos: string[];
}

export interface PackagingType {
  id: string;
  name: string;
  dimensions: { length: number; width: number; height: number };
  maxWeight: number;
}
