import { apiClient } from './client';

export type SopCategory =
  | 'equipment_operation'
  | 'cycle_count'
  | 'warehouse_operations'
  | 'safety'
  | 'inspection'
  | 'general';

export type SopStatus = 'active' | 'draft' | 'archived';

export interface Sop {
  id: string;
  title: string;
  category: SopCategory;
  content: string;
  version: string;
  status: SopStatus;
  createdBy: string;
  applicableRoles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSopRequest {
  title: string;
  category: SopCategory;
  content: string;
  version: string;
  status: SopStatus;
  createdBy?: string;
  applicableRoles?: string[];
}

export const sopsApi = {
  getAll: async (params?: { category?: SopCategory; status?: SopStatus }): Promise<Sop[]> => {
    const search = new URLSearchParams();
    if (params?.category) search.append('category', params.category);
    if (params?.status) search.append('status', params.status);
    const query = search.toString();
    return apiClient.get<Sop[]>(`/sops${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Sop> => {
    return apiClient.get<Sop>(`/sops/${id}`);
  },

  create: async (request: UpsertSopRequest): Promise<Sop> => {
    return apiClient.post<Sop>('/sops', request);
  },

  update: async (id: string, request: UpsertSopRequest): Promise<Sop> => {
    return apiClient.put<Sop>(`/sops/${id}`, request);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/sops/${id}`);
  },
};
