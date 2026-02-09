import { apiClient } from './client';

export interface GenerateUsersRequest {
  adminCount?: number;
  warehouseManagerCount?: number;
  workerCount?: number;
}

export interface GenerateUsersResponse {
  success: boolean;
  created: number;
  admins: number;
  warehouseManagers: number;
  workers: number;
  message: string;
  error?: string;
}

export interface MigratePasswordsResponse {
  success: boolean;
  migrated: number;
  message: string;
  error?: string;
}

export interface ImportActiveStockResponse {
  success: boolean;
  message: string;
  materialsProcessed: number;
  inventoryCreated: number;
  supplyPlansCreated: number;
  errors: number;
}

export const integrationApi = {
  generateUsers: async (request: GenerateUsersRequest): Promise<GenerateUsersResponse> => {
    return apiClient.post<GenerateUsersResponse>('/integration/users/generate', request);
  },

  migratePasswords: async (): Promise<MigratePasswordsResponse> => {
    return apiClient.post<MigratePasswordsResponse>('/integration/users/migrate-passwords', {});
  },

  /**
   * Import Active stock.csv data including ROP, Buffer Stock, MOQ, Lead Time
   */
  importActiveStock: async (warehouseId?: string): Promise<ImportActiveStockResponse> => {
    const params = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return apiClient.post<ImportActiveStockResponse>(`/integration/data-import/import-active-stock${params}`, {});
  },
};
