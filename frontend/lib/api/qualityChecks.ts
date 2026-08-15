import { apiClient } from './client';

export interface QualityCheck {
  id: string;
  grnId?: string;
  materialId?: string;
  status?: string;
  qtyReceived: string;
  qtyPassed: string;
  qtyRejected: string;
  rejectionReason?: string;
  approvalStatus?: string;
  approvedBy?: string;
  approvedAt?: string;
  checkedBy?: string;
  checkDate?: string;
  /**
   * Resolved server-side. The materials reference list only carries operational
   * materials, so archived ones can only be named from these fields.
   */
  materialCode?: string;
  materialDescription?: string;
}

export const qualityChecksApi = {
  getAll: async (grnId?: string, materialId?: string): Promise<QualityCheck[]> => {
    const params = new URLSearchParams();
    if (grnId) params.append('grnId', grnId);
    if (materialId) params.append('materialId', materialId);
    const query = params.toString();
    return apiClient.get<QualityCheck[]>(`/quality-checks${query ? `?${query}` : ''}`);
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

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/quality-checks/${id}`);
  },

  approve: async (id: string, approvedBy?: string): Promise<QualityCheck> => {
    return apiClient.put<QualityCheck>(`/quality-checks/${id}/approve`, { approvedBy });
  },

  reject: async (id: string, rejectionReason: string, rejectedBy?: string): Promise<QualityCheck> => {
    return apiClient.put<QualityCheck>(`/quality-checks/${id}/reject`, {
      rejectionReason,
      rejectedBy,
    });
  },
};
