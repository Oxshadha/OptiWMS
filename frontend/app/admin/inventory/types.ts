export interface InventoryDisplayItem {
  id: string;
  sku: string;
  name: string;
  qty: number;
  location: string;
  status: "Available" | "Low" | "Out of Stock";
  category: string;
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

export const statusClass = (s: string) => {
  if (s === "Available") return "badge-success";
  if (s === "Low") return "badge-warning";
  if (s === "Out of Stock") return "badge-error";
  return "badge-outline";
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
