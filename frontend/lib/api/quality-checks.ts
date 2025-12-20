import { apiClient } from './client';

export interface QualityCheck {
  id: string;
  checkNumber: string;
  orderId?: string;
  materialId?: string;
  warehouseId?: string;
  checkType?: string;
  status: string;
  result?: string;
  notes?: string;
  checkedBy?: string;
  checkedAt?: string;
}

export const qualityChecksApi = {
  getAll: async (): Promise<QualityCheck[]> => {
    return apiClient.get<QualityCheck[]>('/quality-checks');
  },

  getById: async (id: string): Promise<QualityCheck> => {
    return apiClient.get<QualityCheck>(`/quality-checks/${id}`);
  },

  create: async (check: Omit<QualityCheck, 'id'>): Promise<QualityCheck> => {
    return apiClient.post<QualityCheck>('/quality-checks', check);
  },

  update: async (id: string, check: Partial<QualityCheck>): Promise<QualityCheck> => {
    return apiClient.put<QualityCheck>(`/quality-checks/${id}`, check);
  },
};

