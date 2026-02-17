import { apiClient } from './client';

export interface Supplier {
  id: string;
  code?: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  leadTimeDays?: number;
  rating?: string;
  status: string;
}

export interface SupplierMaterial {
  id: string;
  materialCode: string;
  description: string;
  materialType?: string | null;
}

export const suppliersApi = {
  getAll: async (): Promise<Supplier[]> => {
    return apiClient.get<Supplier[]>('/master/suppliers');
  },

  getById: async (id: string): Promise<Supplier> => {
    return apiClient.get<Supplier>(`/master/suppliers/${id}`);
  },

  create: async (supplier: Omit<Supplier, 'id'>): Promise<Supplier> => {
    return apiClient.post<Supplier>('/master/suppliers', supplier);
  },

  update: async (id: string, supplier: Partial<Supplier>): Promise<Supplier> => {
    return apiClient.put<Supplier>(`/master/suppliers/${id}`, supplier);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/master/suppliers/${id}`);
  },

  getMaterials: async (id: string): Promise<SupplierMaterial[]> => {
    return apiClient.get<SupplierMaterial[]>(`/master/suppliers/${id}/materials`);
  },

  replaceMaterials: async (id: string, materialIds: string[]): Promise<void> => {
    return apiClient.put<void>(`/master/suppliers/${id}/materials`, { materialIds });
  },
};
