import { apiClient } from './client';

export interface Anomaly {
  id: string;
  anomalyType: string;
  materialId?: string;
  warehouseId?: string;
  locationId?: string;
  detectedValue?: string;
  expectedValue?: string;
  variancePercentage?: string;
  severity: string;
  confidenceScore?: string;
  description?: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  resolutionNotes?: string;
  createdAt?: string;
}

export const anomaliesApi = {
  getAll: async (warehouseId?: string, status?: string, severity?: string): Promise<Anomaly[]> => {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (status) params.append('status', status);
    if (severity) params.append('severity', severity);
    const query = params.toString();
    return apiClient.get<Anomaly[]>(`/anomalies${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Anomaly> => {
    return apiClient.get<Anomaly>(`/anomalies/${id}`);
  },

  resolve: async (id: string, status: string, reviewedBy?: string, resolutionNotes?: string): Promise<Anomaly> => {
    return apiClient.put<Anomaly>(`/anomalies/${id}/resolve`, {
      status,
      reviewedBy,
      resolutionNotes,
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/anomalies/${id}`);
  },
};
