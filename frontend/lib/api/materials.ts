import { apiClient } from './client';

export interface Material {
  id: string;
  materialCode: string;
  description: string;
  unitType?: string;
  storageType?: string;
}

export interface ImportResponse {
  successCount: number;
  errorCount: number;
  errors: string[];
}

export const materialsApi = {
  getAll: async (): Promise<Material[]> => {
    return apiClient.get<Material[]>('/master/materials');
  },

  getById: async (id: string): Promise<Material> => {
    return apiClient.get<Material>(`/master/materials/${id}`);
  },

  create: async (material: Omit<Material, 'id'>): Promise<Material> => {
    return apiClient.post<Material>('/master/materials', material);
  },

  update: async (id: string, material: Partial<Material>): Promise<Material> => {
    return apiClient.put<Material>(`/master/materials/${id}`, material);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/master/materials/${id}`);
  },

  importCsv: async (file: File): Promise<ImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postFormData<ImportResponse>('/master/materials/import', formData);
  },

  importInventoryCsv: async (file: File): Promise<ImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postFormData<ImportResponse>('/master/materials/inventory/import', formData);
  },
};

