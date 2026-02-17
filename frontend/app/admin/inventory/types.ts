export interface InventoryDisplayItem {
  id: string;
  sku: string;
  name: string;
  qty: number;
  location: string;
  locations?: string[];
  status: "Available" | "Low" | "Out of Stock";
  warehouseName: string;
  itemType: "Product" | "Raw Material" | "Packaging";
  materialId: string;
  warehouseId: string;
  reorderPoint?: string;
  bufferStock?: string;
  maxStock?: string;
  minStock?: string;
  moq?: string;
  leadTimeDays?: number;
  stackingQuantity?: number;
  bufferDays?: number;
  leadTimeMonths?: string;
  ropInDays?: string;
  varianceDemand?: string;
  varianceLeadTimeDemand?: string;
  difference?: string;
  orderDeliveryDays?: number;
  orderQuantity?: string;
  palletRequirement?: string;
}

export const inventoryStatusTone = (s: string): "success" | "warning" | "danger" | "neutral" => {
  if (s === "Available") return "success";
  if (s === "Low") return "warning";
  if (s === "Out of Stock") return "danger";
  return "neutral";
};

export const formatDecimal = (value: number): string => {
  if (value === 0) return "0";
  if (value % 1 === 0) {
    return value.toLocaleString();
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};
