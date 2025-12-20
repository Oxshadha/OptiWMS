import { apiClient } from './client';

export interface Anomaly {
  id: string;
  anomalyNumber: string;
  anomalyType?: string;
  warehouseId?: string;
  materialId?: string;
  locationCode?: string;
  severity?: string;
  status: string;
  description?: string;
  resolution?: string;
  detectedBy?: string;
  resolvedBy?: string;
  detectedAt?: string;
  resolvedAt?: string;
}

export const anomaliesApi = {
  getAll: async (): Promise<Anomaly[]> => {
    return apiClient.get<Anomaly[]>('/anomalies');
  },

  getById: async (id: string): Promise<Anomaly> => {
    return apiClient.get<Anomaly>(`/anomalies/${id}`);
  },

  resolve: async (id: string, resolvedBy: string, resolution: string): Promise<Anomaly> => {
    return apiClient.post<Anomaly>(`/anomalies/${id}/resolve`, { resolvedBy, resolution });
  },
};

