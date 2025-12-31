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

export const integrationApi = {
  generateUsers: async (request: GenerateUsersRequest): Promise<GenerateUsersResponse> => {
    return apiClient.post<GenerateUsersResponse>('/integration/users/generate', request);
  },

  migratePasswords: async (): Promise<MigratePasswordsResponse> => {
    return apiClient.post<MigratePasswordsResponse>('/integration/users/migrate-passwords', {});
  },
};

