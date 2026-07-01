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
  minOrderQuantity?: number;
  handlingUnitType?: string;
  unitsPerHandlingUnit?: number;
  orderMultiple?: number;
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

export interface MaterialOrderingProfile {
  material: Material;
  supplierMinimumOrderQuantity?: number | null;
  supplierOrderMultiple?: number | null;
  supplierUnitsPerHandlingUnit?: number | null;
  supplierLeadTimeDays?: number | null;
  effectiveMinimumOrderQuantity: number;
  effectiveOrderMultiple: number;
  effectiveUnitsPerHandlingUnit: number;
  warehouseAvailableQuantity?: number | null;
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

  getOrderingProfile: async (id: string, options?: { supplierId?: string; warehouseId?: string }): Promise<MaterialOrderingProfile> => {
    const params = new URLSearchParams();
    if (options?.supplierId) params.append("supplierId", options.supplierId);
    if (options?.warehouseId) params.append("warehouseId", options.warehouseId);
    const query = params.toString();
    return apiClient.get<MaterialOrderingProfile>(`/master/materials/${id}/ordering-profile${query ? `?${query}` : ""}`);
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

  importDimensionsCsv: async (file: File): Promise<DimensionImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postFormData<DimensionImportResponse>('/master/materials/import-dimensions', formData);
  },
};

export interface DimensionImportResponse {
  updated: number;
  skipped: number;
  errors: number;
  message: string;
}
