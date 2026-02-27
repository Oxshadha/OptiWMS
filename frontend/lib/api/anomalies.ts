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

export interface PagedAnomaliesResponse {
  data: Anomaly[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
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

  getPaged: async ({
    page = 0,
    size = 10,
    sortBy = "createdAt",
    sortDir = "desc",
    warehouseId,
    status,
    severity,
    domain,
    q,
  }: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    warehouseId?: string;
    status?: string;
    severity?: string;
    domain?: string;
    q?: string;
  }): Promise<PagedAnomaliesResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("size", String(size));
    params.append("sortBy", sortBy);
    params.append("sortDir", sortDir);
    if (warehouseId) params.append("warehouseId", warehouseId);
    if (status) params.append("status", status);
    if (severity) params.append("severity", severity);
    if (domain) params.append("domain", domain);
    if (q && q.trim()) params.append("q", q.trim());
    return apiClient.get<PagedAnomaliesResponse>(`/anomalies/paged?${params.toString()}`);
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
