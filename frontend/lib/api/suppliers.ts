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
  minimumOrderQuantity?: number | null;
  orderMultiple?: number | null;
  unitsPerHandlingUnit?: number | null;
  leadTimeDays?: number | null;
  preferred?: boolean | null;
}

export interface SupplierMaterialRulePayload {
  materialId: string;
  minimumOrderQuantity?: number | null;
  orderMultiple?: number | null;
  unitsPerHandlingUnit?: number | null;
  leadTimeDays?: number | null;
  preferred?: boolean | null;
}

export interface PagedSuppliersResponse {
  data: Supplier[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const suppliersApi = {
  getAll: async (): Promise<Supplier[]> => {
    return apiClient.get<Supplier[]>('/master/suppliers');
  },

  getPaged: async ({
    page = 0,
    size = 10,
    sortBy = "createdAt",
    sortDir = "desc",
    status,
    q,
  }: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    status?: string;
    q?: string;
  }): Promise<PagedSuppliersResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("size", String(size));
    params.append("sortBy", sortBy);
    params.append("sortDir", sortDir);
    if (status) params.append("status", status);
    if (q && q.trim()) params.append("q", q.trim());
    return apiClient.get<PagedSuppliersResponse>(`/master/suppliers/paged?${params.toString()}`);
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

  replaceMaterialRules: async (id: string, materialRules: SupplierMaterialRulePayload[]): Promise<void> => {
    return apiClient.put<void>(`/master/suppliers/${id}/materials`, { materialRules });
  },
};
