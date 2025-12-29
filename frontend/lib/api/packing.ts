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

  getById: async (id: string): Promise<PackingRecord> => {
    return apiClient.get<PackingRecord>(`/packing/${id}`);
  },

  create: async (record: Omit<PackingRecord, 'id'>): Promise<PackingRecord> => {
    return apiClient.post<PackingRecord>('/packing', record);
  },

  update: async (id: string, record: Partial<PackingRecord>): Promise<PackingRecord> => {
    return apiClient.put<PackingRecord>(`/packing/${id}`, record);
  },

  updateStatus: async (id: string, status: string): Promise<PackingRecord> => {
    return apiClient.put<PackingRecord>(`/packing/${id}/status`, { status });
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/packing/${id}`);
  },
};

