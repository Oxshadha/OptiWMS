import { apiClient } from './client';

export interface MaterialDefaultLocation {
  id: string;
  materialId: string;
  warehouseId: string;
  locationCode: string;
  priority: number;
  materialType: string | null;
  notes: string | null;
}

export interface MaterialWithLocation {
  materialId: string;
  materialCode: string;
  description: string;
  materialType: string | null;
  locationCode: string;
  priority: number;
}

export const materialDefaultLocationsApi = {
  /**
   * Assign default location to a material in a warehouse
   */
  assignDefaultLocation: async (
    materialId: string,
    warehouseId: string,
    locationCode: string,
    priority?: number,
    materialType?: string
  ): Promise<MaterialDefaultLocation> => {
    return apiClient.post<MaterialDefaultLocation>('/master/material-default-locations', {
      materialId,
      warehouseId,
      locationCode,
      priority: priority || 1,
      materialType,
    });
  },

  /**
   * Get default locations for a material in a warehouse
   */
  getDefaultLocations: async (
    materialId: string,
    warehouseId: string
  ): Promise<MaterialDefaultLocation[]> => {
    return apiClient.get<MaterialDefaultLocation[]>(
      `/master/material-default-locations/material/${materialId}/warehouse/${warehouseId}`
    );
  },

  /**
   * Get all materials with their default locations in a warehouse
   * Useful for catalog management UI
   */
  getMaterialsWithLocations: async (
    warehouseId: string
  ): Promise<MaterialWithLocation[]> => {
    return apiClient.get<MaterialWithLocation[]>(
      `/master/material-default-locations/warehouse/${warehouseId}/materials`
    );
  },

  /**
   * Remove default location assignment
   */
  removeDefaultLocation: async (
    materialId: string,
    warehouseId: string,
    locationCode: string
  ): Promise<void> => {
    return apiClient.delete<void>(
      `/master/material-default-locations/material/${materialId}/warehouse/${warehouseId}/location/${locationCode}`
    );
  },

  /**
   * Bulk assign default locations to all materials in a warehouse
   * Useful for initial setup
   */
  assignAllMaterials: async (warehouseId: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post<{ success: boolean; message: string }>(
      `/master/material-default-locations/warehouse/${warehouseId}/assign-all`
    );
  },

  /**
   * Sync inventory location_code from existing material default locations
   * Use when default locations exist but inventory shows N/A
   */
  syncInventoryLocations: async (warehouseId: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post<{ success: boolean; message: string }>(
      `/master/material-default-locations/warehouse/${warehouseId}/sync-inventory`
    );
  },
};
