import { apiClient } from './client';
import { WarehouseLayout, RackUnit, RackStatus } from '@/lib/types/warehouse-layout';

export const warehouseLayoutApi = {
  /**
   * Get layout for a specific warehouse
   */
  getLayout: async (warehouseId: string): Promise<WarehouseLayout> => {
    return apiClient.get<WarehouseLayout>(`/warehouses/${warehouseId}/layout`);
  },

  /**
   * Update rack status
   */
  updateRackStatus: async (
    warehouseId: string,
    rackId: string,
    status: RackStatus
  ): Promise<RackUnit> => {
    return apiClient.put<RackUnit>(
      `/warehouses/${warehouseId}/racks/${rackId}/status`,
      { status }
    );
  },

  /**
   * Update rack description/notes
   */
  updateRackDescription: async (
    warehouseId: string,
    rackId: string,
    description?: string,
    notes?: string
  ): Promise<RackUnit> => {
    return apiClient.put<RackUnit>(
      `/warehouses/${warehouseId}/racks/${rackId}/description`,
      { description, notes }
    );
  },

  /**
   * Update entire rack
   */
  updateRack: async (
    warehouseId: string,
    rackId: string,
    updates: Partial<Pick<RackUnit, 'status' | 'description' | 'notes'>>
  ): Promise<RackUnit> => {
    return apiClient.put<RackUnit>(
      `/warehouses/${warehouseId}/racks/${rackId}`,
      updates
    );
  },
};

