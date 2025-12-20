import { apiClient } from './client';

export interface Task {
  id: string;
  taskNumber: string;
  taskType: string;
  warehouseId?: string;
  assignedTo?: string;
  priority: string;
  status: string;
  dueDate?: string;
  completedAt?: string;
  locationCode?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}

export const tasksApi = {
  getAll: async (): Promise<Task[]> => {
    return apiClient.get<Task[]>('/tasks');
  },

  getById: async (id: string): Promise<Task> => {
    return apiClient.get<Task>(`/tasks/${id}`);
  },

  create: async (task: Omit<Task, 'id'>): Promise<Task> => {
    return apiClient.post<Task>('/tasks', task);
  },

  update: async (id: string, task: Partial<Task>): Promise<Task> => {
    return apiClient.put<Task>(`/tasks/${id}`, task);
  },

  assign: async (id: string, assignedTo: string): Promise<Task> => {
    return apiClient.post<Task>(`/tasks/${id}/assign`, { assignedTo });
  },

  complete: async (id: string): Promise<Task> => {
    return apiClient.post<Task>(`/tasks/${id}/complete`, {});
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/tasks/${id}`);
  },
};

