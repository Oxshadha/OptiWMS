import { apiClient } from './client';

export interface User {
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
  status: string;
  deviceId?: string;
  blindReceivingMode?: boolean;
  lastLoginAt?: string;
}

export const usersApi = {
  getAll: async (role?: string, warehouseId?: string, status?: string): Promise<User[]> => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (status) params.append('status', status);
    const query = params.toString();
    return apiClient.get<User[]>(`/users${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<User> => {
    return apiClient.get<User>(`/users/${id}`);
  },

  getByUsername: async (username: string): Promise<User> => {
    return apiClient.get<User>(`/users/username/${username}`);
  },

  create: async (user: Omit<User, 'id'> & { password: string }): Promise<User> => {
    return apiClient.post<User>('/users', user);
  },

  update: async (id: string, user: Partial<User> & { password?: string }): Promise<User> => {
    return apiClient.put<User>(`/users/${id}`, user);
  },

  updateLastLogin: async (id: string): Promise<void> => {
    return apiClient.put<void>(`/users/${id}/last-login`, {});
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/users/${id}`);
  },

  updatePreferences: async (id: string, preferences: { blindReceivingMode?: boolean }): Promise<User> => {
    return apiClient.put<User>(`/users/${id}/preferences`, preferences);
  },

  assignWarehouse: async (id: string, warehouseId: string): Promise<User> => {
    return apiClient.put<User>(`/users/${id}/assign-warehouse`, { warehouseId });
  },
};

