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
  getAll: async (taskType?: string, status?: string, assignedTo?: string): Promise<Task[]> => {
    const params = new URLSearchParams();
    if (taskType) params.append('taskType', taskType);
    if (status) params.append('status', status);
    if (assignedTo) params.append('assignedTo', assignedTo);
    const query = params.toString();
    return apiClient.get<Task[]>(`/tasks${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Task> => {
    return apiClient.get<Task>(`/tasks/${id}`);
  },

  create: async (task: Omit<Task, 'id'>): Promise<Task> => {
    return apiClient.post<Task>('/tasks', task);
  },

  updateStatus: async (id: string, status: string): Promise<Task> => {
    return apiClient.put<Task>(`/tasks/${id}/status`, { status });
  },
};

