import { apiClient } from './client';

export interface Worker {
  id: string;
  username: string;
  email?: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  warehouseId?: string;
  phone?: string;
  avatarUrl?: string;
  status?: string;
  deviceId?: string;
  lastLoginAt?: string;
}

export const workersApi = {
  getAll: async (): Promise<Worker[]> => {
    return apiClient.get<Worker[]>('/workers');
  },

  getById: async (id: string): Promise<Worker> => {
    return apiClient.get<Worker>(`/workers/${id}`);
  },

  create: async (worker: Omit<Worker, 'id'>): Promise<Worker> => {
    return apiClient.post<Worker>('/workers', worker);
  },

  update: async (id: string, worker: Partial<Worker>): Promise<Worker> => {
    return apiClient.put<Worker>(`/workers/${id}`, worker);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/workers/${id}`);
  },
};

