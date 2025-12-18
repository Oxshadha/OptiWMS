import { apiClient } from './client';

export interface InventoryItem {
  id: string;
  materialId: string;
  warehouseId: string;
  locationCode?: string;
  quantity: string;
  availableQuantity: string;
  reservedQuantity: string;
  bufferStock?: string;
  maxStock?: string;
  minStock?: string;
  reorderPoint?: string;
  stackingQuantity?: number;
  moq?: string;
  leadTimeDays?: number;
  lastCountedAt?: string;
  status: string;
}

export const inventoryApi = {
  getAll: async (): Promise<InventoryItem[]> => {
    return apiClient.get<InventoryItem[]>('/inventory');
  },

  getById: async (id: string): Promise<InventoryItem> => {
    return apiClient.get<InventoryItem>(`/inventory/${id}`);
  },

  getByMaterial: async (materialId: string): Promise<InventoryItem[]> => {
    return apiClient.get<InventoryItem[]>(`/inventory/material/${materialId}`);
  },

  getByWarehouse: async (warehouseId: string): Promise<InventoryItem[]> => {
    return apiClient.get<InventoryItem[]>(`/inventory/warehouse/${warehouseId}`);
  },

  updateQuantity: async (id: string, quantityChange: number): Promise<InventoryItem> => {
    return apiClient.patch<InventoryItem>(`/inventory/${id}/quantity?quantityChange=${quantityChange}`, {});
  },
};

