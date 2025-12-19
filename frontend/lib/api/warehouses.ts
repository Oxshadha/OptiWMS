import { apiClient } from './client';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  status: string;
}

export const warehousesApi = {
  getAll: async (): Promise<Warehouse[]> => {
    return apiClient.get<Warehouse[]>('/master/warehouses');
  },

  getById: async (id: string): Promise<Warehouse> => {
    return apiClient.get<Warehouse>(`/master/warehouses/${id}`);
  },

  create: async (warehouse: Omit<Warehouse, 'id'>): Promise<Warehouse> => {
    return apiClient.post<Warehouse>('/master/warehouses', warehouse);
  },

  update: async (id: string, warehouse: Partial<Warehouse>): Promise<Warehouse> => {
    return apiClient.put<Warehouse>(`/master/warehouses/${id}`, warehouse);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/master/warehouses/${id}`);
  },
};

