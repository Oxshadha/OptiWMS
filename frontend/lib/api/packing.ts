import { apiClient } from './client';

export interface PackingRecord {
  id: string;
  orderId?: string;
  orderNumber?: string;
  packagingTypeId?: string;
  boxType?: string;
  boxDimensions?: string;
  dunnageMaterials?: string;
  hasFragileItems?: boolean;
  actualWeightKg?: string;
  dimensionalWeightKg?: string;
  chargeableWeightKg?: string;
  trackingNumber?: string;
  shippingLabelUrl?: string;
  packingSlipUrl?: string;
  packingNotes?: string;
  packingPhotos?: string;
  packerId?: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PagedPackingResponse {
  data: PackingRecord[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const packingApi = {
  getAll: async (orderId?: string, orderNumber?: string, status?: string, packerId?: string): Promise<PackingRecord[]> => {
    const params = new URLSearchParams();
    if (orderId) params.append('orderId', orderId);
    if (orderNumber) params.append('orderNumber', orderNumber);
    if (status) params.append('status', status);
    if (packerId) params.append('packerId', packerId);
    const query = params.toString();
    return apiClient.get<PackingRecord[]>(`/packing${query ? `?${query}` : ''}`);
  },

  getPaged: async ({
    page = 0,
    size = 10,
    sortBy = "createdAt",
    sortDir = "desc",
    status,
    packerId,
    q,
  }: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    status?: string;
    packerId?: string;
    q?: string;
  }): Promise<PagedPackingResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("size", String(size));
    params.append("sortBy", sortBy);
    params.append("sortDir", sortDir);
    if (status) params.append("status", status);
    if (packerId) params.append("packerId", packerId);
    if (q && q.trim()) params.append("q", q.trim());
    return apiClient.get<PagedPackingResponse>(`/packing/paged?${params.toString()}`);
  },

  getById: async (id: string): Promise<PackingRecord> => {
    return apiClient.get<PackingRecord>(`/packing/${id}`);
  },

  create: async (record: Omit<PackingRecord, 'id'>): Promise<PackingRecord> => {
    return apiClient.post<PackingRecord>('/packing', record);
  },

  update: async (id: string, record: Partial<PackingRecord>): Promise<PackingRecord> => {
    return apiClient.put<PackingRecord>(`/packing/${id}`, record);
  },

  /**
   * Manager sign-off releasing a packing job to the floor.
   *
   * Distinct from updateStatus: approval also raises the packer's task, and must not be
   * reachable by posting an arbitrary status string.
   */
  approve: async (id: string, approvedBy?: string): Promise<PackingRecord> => {
    return apiClient.post<PackingRecord>(`/packing/${id}/approve`, { approvedBy });
  },

  updateStatus: async (id: string, status: string, workerId?: string): Promise<PackingRecord> => {
    const request: any = { status };
    if (workerId) {
      request.workerId = workerId;
    }
    return apiClient.put<PackingRecord>(`/packing/${id}/status`, request);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/packing/${id}`);
  },
};
