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

  create: async (data: {
    materialId: string;
    warehouseId: string;
    locationCode?: string;
    quantity?: number;
    availableQuantity?: number;
    reservedQuantity?: number;
    bufferStock?: number;
    maxStock?: number;
    minStock?: number;
    reorderPoint?: number;
    stackingQuantity?: number;
    moq?: number;
    leadTimeDays?: number;
    status?: string;
  }): Promise<InventoryItem> => {
    return apiClient.post<InventoryItem>('/inventory', data);
  },

  updateQuantity: async (id: string, quantityChange: number): Promise<InventoryItem> => {
    return apiClient.patch<InventoryItem>(`/inventory/${id}/quantity?quantityChange=${quantityChange}`, {});
  },

  update: async (id: string, data: {
    locationCode?: string;
    quantity?: number;
    availableQuantity?: number;
    reservedQuantity?: number;
    bufferStock?: number;
    maxStock?: number;
    minStock?: number;
    reorderPoint?: number;
    stackingQuantity?: number;
    moq?: number;
    leadTimeDays?: number;
    status?: string;
  }): Promise<InventoryItem> => {
    return apiClient.put<InventoryItem>(`/inventory/${id}`, data);
  },
};

