import { apiClient } from './client';

export interface Material {
  id: string;
  materialCode: string;
  description: string;
  weightKg?: number;
  unitType?: string;
  storageType?: string;
  materialType?: string;
  // ABC/FMS Classification for storage zone assignment
  abcClass?: string;      // A, B, C (volume-based)
  fmsClass?: string;      // F, M, S (frequency-based)
  preferredZone?: string; // A, B, C, D (derived from amalgamated analysis)
}

export interface ImportResponse {
  successCount: number;
  errorCount: number;
  errors: string[];
}

export const materialsApi = {
  getAll: async (materialType?: string): Promise<Material[]> => {
    const params = new URLSearchParams();
    if (materialType) params.append('materialType', materialType);
    const query = params.toString();
    return apiClient.get<Material[]>(`/master/materials${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Material> => {
    return apiClient.get<Material>(`/master/materials/${id}`);
  },

  getByCode: async (materialCode: string): Promise<Material> => {
    // URL encode the material code to handle special characters
    const encodedCode = encodeURIComponent(materialCode.trim());
    return apiClient.get<Material>(`/master/materials/code/${encodedCode}`);
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
