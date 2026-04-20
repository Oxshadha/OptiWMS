import { apiClient } from "./client";

export interface ForecastSkuMapping {
  id: string;
  dataset?: string | null;
  forecastSku: string;
  wmsMaterialId: string;
  wmsSku?: string | null;
  wmsDescription?: string | null;
  warehouseId?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const forecastSkuMappingApi = {
  list: async (filters?: {
    dataset?: string;
    warehouseId?: string;
    activeOnly?: boolean;
  }): Promise<ForecastSkuMapping[]> => {
    const params = new URLSearchParams();
    if (filters?.dataset) params.append("dataset", filters.dataset);
    if (filters?.warehouseId) params.append("warehouseId", filters.warehouseId);
    if (typeof filters?.activeOnly === "boolean") params.append("activeOnly", String(filters.activeOnly));
    const query = params.toString();
    return apiClient.get<ForecastSkuMapping[]>(`/planning/bom/forecast-sku-mappings${query ? `?${query}` : ""}`);
  },

  create: async (payload: {
    dataset?: string | null;
    forecastSku: string;
    wmsMaterialId: string;
    warehouseId?: string | null;
    isActive?: boolean;
    notes?: string | null;
  }): Promise<ForecastSkuMapping> => {
    return apiClient.post<ForecastSkuMapping>("/planning/bom/forecast-sku-mappings", payload);
  },

  update: async (
    id: string,
    payload: {
      dataset?: string | null;
      forecastSku?: string;
      wmsMaterialId?: string;
      warehouseId?: string | null;
      isActive?: boolean;
      notes?: string | null;
    },
  ): Promise<ForecastSkuMapping> => {
    return apiClient.put<ForecastSkuMapping>(`/planning/bom/forecast-sku-mappings/${id}`, payload);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/planning/bom/forecast-sku-mappings/${id}`);
  },
};
