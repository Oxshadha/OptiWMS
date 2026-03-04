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
  dashboardSettings?: string | Record<string, any>;
}

export interface PagedUsersResponse {
  data: User[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface WorkerTaskSummary {
  workerId: string;
  total: number;
  completed: number;
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

  getPaged: async ({
    page = 0,
    size = 10,
    sortBy = "createdAt",
    sortDir = "desc",
    role,
    warehouseId,
    status,
    q,
  }: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    role?: string;
    warehouseId?: string;
    status?: string;
    q?: string;
  }): Promise<PagedUsersResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("size", String(size));
    params.append("sortBy", sortBy);
    params.append("sortDir", sortDir);
    if (role) params.append("role", role);
    if (warehouseId) params.append("warehouseId", warehouseId);
    if (status) params.append("status", status);
    if (q && q.trim()) params.append("q", q.trim());
    return apiClient.get<PagedUsersResponse>(`/users/paged?${params.toString()}`);
  },

  getByUsername: async (username: string): Promise<User> => {
    return apiClient.get<User>(`/users/username/${username}`);
  },

  getWorkerTaskSummary: async (ids: string[]): Promise<WorkerTaskSummary[]> => {
    if (!ids.length) {
      return [];
    }

    const params = new URLSearchParams();
    params.append("ids", ids.join(","));
    return apiClient.get<WorkerTaskSummary[]>(`/users/worker-task-summary?${params.toString()}`);
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

  updatePreferences: async (id: string, preferences: { blindReceivingMode?: boolean; dashboardSettings?: Record<string, any> }): Promise<User> => {
    return apiClient.put<User>(`/users/${id}/preferences`, preferences);
  },

  assignWarehouse: async (id: string, warehouseId: string): Promise<User> => {
    return apiClient.put<User>(`/users/${id}/assign-warehouse`, { warehouseId });
  },
};
