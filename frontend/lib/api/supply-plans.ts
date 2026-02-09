import { apiClient } from './client';

export interface SupplyPlan {
  id: string;
  materialId: string;
  warehouseId: string;
  planYear: number;
  planMonth: number;
  plannedQuantity: string;
  actualQuantity?: string;
  variance?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplyPlanFilters {
  materialId?: string;
  warehouseId?: string;
  planYear?: number;
  planMonth?: number;
}

export const supplyPlansApi = {
  getAll: async (filters?: SupplyPlanFilters): Promise<SupplyPlan[]> => {
    const params = new URLSearchParams();
    if (filters?.materialId) params.append('materialId', filters.materialId);
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId);
    if (filters?.planYear) params.append('planYear', filters.planYear.toString());
    if (filters?.planMonth) params.append('planMonth', filters.planMonth.toString());
    const query = params.toString();
    return apiClient.get<SupplyPlan[]>(`/planning/supply-plans${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<SupplyPlan> => {
    return apiClient.get<SupplyPlan>(`/planning/supply-plans/${id}`);
  },

  create: async (plan: {
    materialId: string;
    warehouseId: string;
    planYear: number;
    planMonth: number;
    plannedQuantity: string;
    actualQuantity?: string;
    variance?: string;
  }): Promise<SupplyPlan> => {
    return apiClient.post<SupplyPlan>('/planning/supply-plans', plan);
  },

  update: async (id: string, plan: {
    plannedQuantity?: string;
    actualQuantity?: string;
    variance?: string;
  }): Promise<SupplyPlan> => {
    return apiClient.put<SupplyPlan>(`/planning/supply-plans/${id}`, plan);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/planning/supply-plans/${id}`);
  },
};
