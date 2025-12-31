import { apiClient } from './client';

export interface Return {
  id: string;
  returnNumber: string;
  originalOrderId?: string;
  customerId?: string;
  warehouseId?: string;
  returnDate?: string;
  reason?: string;
  status: string;
  resolution?: string;
  receivedBy?: string;
  inspectedBy?: string;
}

export const returnsApi = {
  getAll: async (orderId?: string, customerId?: string, status?: string): Promise<Return[]> => {
    const params = new URLSearchParams();
    if (orderId) params.append('orderId', orderId);
    if (customerId) params.append('customerId', customerId);
    if (status) params.append('status', status);
    const query = params.toString();
    return apiClient.get<Return[]>(`/returns${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Return> => {
    return apiClient.get<Return>(`/returns/${id}`);
  },

  create: async (returnRecord: Omit<Return, 'id'>): Promise<Return> => {
    return apiClient.post<Return>('/returns', returnRecord);
  },

  update: async (id: string, returnRecord: Partial<Return>): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}`, returnRecord);
  },

  updateStatus: async (id: string, status: string): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}/status`, { status });
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/returns/${id}`);
  },

  approve: async (id: string, approvedBy?: string): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}/approve`, { approvedBy });
  },

  submitInspection: async (id: string, inspectionData: {
    overallResolution: string;
    notes?: string;
    inspectedBy?: string;
  }): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}/inspection`, inspectionData);
  },

  assignWorker: async (id: string, workerId: string): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}/assign`, { workerId });
  },
};

