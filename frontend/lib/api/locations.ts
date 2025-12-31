import { apiClient } from './client';

export interface Location {
  id: string;
  warehouseId: string;
  locationCode: string;
  area?: string;
  rowNumber?: string;
  bayNumber?: string;
  levelNumber?: number;
  binPosition?: string;
  locationType?: string;
  capacity?: number;
  isActive: boolean;
  qrCode?: string;
  createdAt?: string;
  // Rack system fields
  rackStatus?: string;
  description?: string;
  notes?: string;
  accessibilityRating?: number;
  coordinateX?: number;
  coordinateY?: number;
  maxPalletCapacity?: number;
  currentPalletCount?: number;
}

export interface CreateLocationRequest {
  warehouseId: string;
  locationCode: string;
  area?: string;
  rowNumber?: string;
  bayNumber?: string;
  levelNumber?: number;
  binPosition?: string;
  locationType?: string;
  capacity?: number;
  isActive?: boolean;
}

export interface UpdateLocationRequest {
  area?: string;
  rowNumber?: string;
  bayNumber?: string;
  levelNumber?: number;
  binPosition?: string;
  locationType?: string;
  capacity?: number;
  isActive?: boolean;
  rackStatus?: string;
  description?: string;
  notes?: string;
  accessibilityRating?: number;
  coordinateX?: number;
  coordinateY?: number;
  maxPalletCapacity?: number;
  currentPalletCount?: number;
}

export interface UpdateRackRequest {
  rackStatus?: string;
  description?: string;
  notes?: string;
  accessibilityRating?: number;
}

export interface LocationHierarchy {
  warehouseId: string;
  hierarchy: {
    [area: string]: {
      [row: string]: {
        [bay: string]: Location[];
      };
    };
  };
}

export const locationsApi = {
  getAll: async (): Promise<Location[]> => {
    return apiClient.get<Location[]>('/master/locations');
  },

  getById: async (id: string): Promise<Location> => {
    return apiClient.get<Location>(`/master/locations/${id}`);
  },

  getByCode: async (locationCode: string): Promise<Location> => {
    return apiClient.get<Location>(`/master/locations/code/${locationCode}`);
  },

  getByWarehouse: async (warehouseId: string): Promise<Location[]> => {
    return apiClient.get<Location[]>(`/master/locations/warehouse/${warehouseId}`);
  },

  getHierarchyByWarehouse: async (warehouseId: string): Promise<LocationHierarchy> => {
    // Backend returns { warehouseId, hierarchy } but we need to transform it
    const response = await apiClient.get<{ warehouseId: string; hierarchy: any }>(`/master/locations/hierarchy?warehouseId=${warehouseId}`);
    return {
      warehouseId: response.warehouseId,
      hierarchy: response.hierarchy,
    };
  },
  
  getHierarchy: async (warehouseId: string): Promise<LocationHierarchy> => {
    // Alias for getHierarchyByWarehouse
    return locationsApi.getHierarchyByWarehouse(warehouseId);
  },

  create: async (location: CreateLocationRequest): Promise<Location> => {
    return apiClient.post<Location>('/master/locations', location);
  },

  update: async (id: string, location: UpdateLocationRequest): Promise<Location> => {
    return apiClient.put<Location>(`/master/locations/${id}`, location);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/master/locations/${id}`);
  },

  // Rack-specific endpoints
  updateRack: async (id: string, updates: UpdateRackRequest): Promise<Location> => {
    return apiClient.put<Location>(`/master/locations/racks/${id}`, updates);
  },
};

