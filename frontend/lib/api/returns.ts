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
  getAll: async (): Promise<Return[]> => {
    return apiClient.get<Return[]>('/returns');
  },

  getById: async (id: string): Promise<Return> => {
    return apiClient.get<Return>(`/returns/${id}`);
  },

  register: async (returnData: Omit<Return, 'id'>): Promise<Return> => {
    return apiClient.post<Return>('/returns', returnData);
  },

  update: async (id: string, returnData: Partial<Return>): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}`, returnData);
  },

  process: async (id: string): Promise<Return> => {
    return apiClient.post<Return>(`/returns/${id}/process`, {});
  },

  inspect: async (id: string, inspectedBy: string, resolution: string): Promise<Return> => {
    return apiClient.post<Return>(`/returns/${id}/inspect`, { inspectedBy, resolution });
  },
};

