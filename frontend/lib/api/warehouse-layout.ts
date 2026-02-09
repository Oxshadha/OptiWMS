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
    // Use locations API for rack updates
    const { locationsApi } = await import('./locations');
    const updated = await locationsApi.updateRack(rackId, {
      rackStatus: updates.status,
      description: updates.description,
      notes: updates.notes,
    });
    // Convert Location to RackUnit format (this is a simplified conversion)
    // In production, you'd want a proper mapping service
    return {
      id: updated.id,
      zone: updated.area || '',
      aisle: parseInt(updated.rowNumber || '0'),
      bay: parseInt(updated.bayNumber || '0'),
      status: (updated.rackStatus as any) || 'active',
      description: updated.description,
      notes: updated.notes,
      bins: [], // Would need to fetch from locations
      x: updated.coordinateX || 0,
      y: updated.coordinateY || 0,
      width: 100,
      height: 200,
      maxLevels: 5,
    } as RackUnit;
  },
};

