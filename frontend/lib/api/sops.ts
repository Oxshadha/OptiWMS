import { apiClient } from './client';

export interface Sop {
  id: string;
  title: string;
  category: string;
  content: string;
  version: string;
  status: 'active' | 'draft' | 'archived';
  createdBy?: string;
  applicableRoles?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSopRequest {
  title: string;
  category: string;
  content: string;
  version: string;
  status: 'active' | 'draft' | 'archived';
  createdBy?: string;
  applicableRoles?: string[];
}

export interface UpdateSopRequest {
  title?: string;
  category?: string;
  content?: string;
  version?: string;
  status?: 'active' | 'draft' | 'archived';
  createdBy?: string;
  applicableRoles?: string[];
}

export const sopsApi = {
  getAll: async (category?: string, status?: string): Promise<Sop[]> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    const query = params.toString();
    return apiClient.get<Sop[]>(`/sops${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Sop> => {
    return apiClient.get<Sop>(`/sops/${id}`);
  },

  create: async (request: CreateSopRequest): Promise<Sop> => {
    return apiClient.post<Sop>('/sops', request);
  },

  update: async (id: string, request: UpdateSopRequest): Promise<Sop> => {
    return apiClient.put<Sop>(`/sops/${id}`, request);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/sops/${id}`);
  },
};
