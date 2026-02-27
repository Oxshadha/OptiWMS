import { apiClient } from './client';

export interface Material {
  id: string;
  materialCode: string;
  description: string;
  unitType?: string;
  storageType?: string;
  materialType?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
  volumeCm3?: number;
  palletSpaces?: number;
  maxPalletWeightKg?: number;
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

export interface PagedMaterialsResponse {
  data: Material[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const materialsApi = {
  getAll: async (materialType?: string, supplierId?: string): Promise<Material[]> => {
    const params = new URLSearchParams();
    if (materialType) params.append('materialType', materialType);
    if (supplierId) params.append('supplierId', supplierId);
    const query = params.toString();
    return apiClient.get<Material[]>(`/master/materials${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Material> => {
    return apiClient.get<Material>(`/master/materials/${id}`);
  },

  getPaged: async ({
    page = 0,
    size = 10,
    sortBy = "createdAt",
    sortDir = "desc",
    materialType,
    supplierId,
    q,
  }: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    materialType?: string;
    supplierId?: string;
    q?: string;
  }): Promise<PagedMaterialsResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("size", String(size));
    params.append("sortBy", sortBy);
    params.append("sortDir", sortDir);
    if (materialType) params.append("materialType", materialType);
    if (supplierId) params.append("supplierId", supplierId);
    if (q && q.trim()) params.append("q", q.trim());
    return apiClient.get<PagedMaterialsResponse>(`/master/materials/paged?${params.toString()}`);
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
