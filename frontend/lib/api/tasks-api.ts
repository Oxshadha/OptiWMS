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

export interface CreateTaskRequest {
  taskNumber: string;
  taskType: string;
  warehouseId: string;
  assignedTo?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  locationCode?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}

export interface AssignTaskRequest {
  workerId: string;
  assignedBy: string;
  warnings?: string[];
}

export const tasksApi = {
  getAll: async (
    taskType?: string, 
    status?: string, 
    assignedTo?: string,
    warehouseId?: string,
    availableOnly?: boolean
  ): Promise<Task[]> => {
    const params = new URLSearchParams();
    if (taskType) params.append('taskType', taskType);
    if (status) params.append('status', status);
    if (assignedTo) params.append('assignedTo', assignedTo);
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (availableOnly) params.append('availableOnly', 'true');
    const query = params.toString();
    return apiClient.get<Task[]>(`/tasks${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Task> => {
    return apiClient.get<Task>(`/tasks/${id}`);
  },

  create: async (task: CreateTaskRequest): Promise<Task> => {
    return apiClient.post<Task>('/tasks', task);
  },

  updateStatus: async (id: string, status: string, workerId?: string): Promise<Task> => {
    return apiClient.put<Task>(`/tasks/${id}/status`, { status, workerId });
  },

  assign: async (id: string, request: AssignTaskRequest): Promise<Task> => {
    return apiClient.post<Task>(`/tasks/${id}/assign`, request);
  },

  claim: async (id: string, workerId: string): Promise<Task> => {
    return apiClient.post<Task>(`/tasks/${id}/claim`, { workerId });
  },
};
