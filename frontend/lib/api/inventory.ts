import { apiClient } from './client';
import { logger } from "@/lib/utils/logger";

export interface InventoryItem {
  id: string;
  materialId: string;
  warehouseId: string;
  locationCode?: string;
  lpnCode?: string; // License Plate Number
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
  materialType?: string; // raw_material, packaging_material, product
  // Additional planning fields
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

export const inventoryApi = {
  getAll: async (materialType?: string): Promise<InventoryItem[]> => {
    const params = materialType ? `?materialType=${materialType}` : '';
    return apiClient.get<InventoryItem[]>(`/inventory${params}`);
  },

  getById: async (id: string): Promise<InventoryItem> => {
    return apiClient.get<InventoryItem>(`/inventory/${id}`);
  },

  getByMaterial: async (materialId: string): Promise<InventoryItem[]> => {
    return apiClient.get<InventoryItem[]>(`/inventory/material/${materialId}`);
  },

  getByMaterialAndWarehouse: async (materialId: string, warehouseId: string): Promise<InventoryItem | null> => {
    const isDev = process.env.NODE_ENV === 'development';
    
    try {
      // Validate UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(materialId)) {
        if (isDev) logger.error(`[Inventory API] Invalid materialId format`);
        throw new Error('Invalid material ID format');
      }
      if (!uuidRegex.test(warehouseId)) {
        if (isDev) logger.error(`[Inventory API] Invalid warehouseId format`);
        throw new Error('Invalid warehouse ID format');
      }
      
      const url = `/inventory?materialId=${encodeURIComponent(materialId)}&warehouseId=${encodeURIComponent(warehouseId)}`;
      const items = await apiClient.get<InventoryItem[]>(url);
      
      if (items && Array.isArray(items) && items.length > 0) {
        return items[0];
      } else {
        return null;
      }
    } catch (error: any) {
      // Only log errors in development, and without sensitive data
      if (isDev) {
        logger.error(`[Inventory API] Error fetching inventory:`, error?.message || 'Unknown error');
      }
      throw error;
    }
  },

  getByWarehouse: async (warehouseId: string): Promise<InventoryItem[]> => {
    return apiClient.get<InventoryItem[]>(`/inventory/warehouse/${warehouseId}`);
  },

  updateQuantity: async (id: string, quantityChange: number): Promise<InventoryItem> => {
    return apiClient.patch<InventoryItem>(`/inventory/${id}/quantity?quantityChange=${quantityChange}`, {});
  },

  // Quarantine Management
  quarantineBin: async (sku: string, locationCode: string, qualityCheckId: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post('/inventory/quarantined', {
      sku,
      locationCode,
      qualityCheckId,
    });
  },

  getQuarantinedItems: async (warehouseId?: string): Promise<Array<{
    id: string;
    sku: string;
    locationCode: string;
    quantity: string;
    quarantinedAt: string;
    qualityCheckId?: string;
    reason?: string;
  }>> => {
    const params = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return apiClient.get(`/inventory/quarantined${params}`);
  },

  releaseQuarantine: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post(`/inventory/quarantined/${id}/release`, {});
  },

  create: async (inventory: {
    materialId: string;
    warehouseId: string;
    locationCode?: string;
    lpnCode?: string; // License Plate Number
    quantity?: string;
    availableQuantity?: string;
    reservedQuantity?: string;
    bufferStock?: string;
    maxStock?: string;
    minStock?: string;
    reorderPoint?: string;
    stackQuantity?: number;
    moq?: string;
    leadTimeDays?: number;
    status?: string;
  }): Promise<InventoryItem> => {
    return apiClient.post<InventoryItem>('/inventory', inventory);
  },

  update: async (id: string, inventory: {
    warehouseId?: string;
    locationCode?: string;
    lpnCode?: string; // License Plate Number
    quantity?: string;
    availableQuantity?: string;
    reservedQuantity?: string;
    bufferStock?: string;
    maxStock?: string;
    minStock?: string;
    reorderPoint?: string;
    stackingQuantity?: number;
    moq?: string;
    leadTimeDays?: number;
    status?: string;
  }): Promise<InventoryItem> => {
    return apiClient.put<InventoryItem>(`/inventory/${id}`, inventory);
  },

  // Calculate missing planning fields
  calculateMissingFields: async (): Promise<{ itemsUpdated: number; message: string }> => {
    return apiClient.post<{ itemsUpdated: number; message: string }>('/inventory/calculate/missing-fields', {});
  },

  recalculateItem: async (inventoryId: string): Promise<{ itemsUpdated: number; message: string }> => {
    return apiClient.post<{ itemsUpdated: number; message: string }>(`/inventory/calculate/${inventoryId}`, {});
  },
};
