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
  actualWeightKg?: number;
  dimensionalWeightKg?: number;
  chargeableWeightKg?: number;
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
  getAll: async (): Promise<PackingRecord[]> => {
    return apiClient.get<PackingRecord[]>('/packing');
  },

  getById: async (id: string): Promise<PackingRecord> => {
    return apiClient.get<PackingRecord>(`/packing/${id}`);
  },

  getQueue: async (): Promise<PackingRecord[]> => {
    return apiClient.get<PackingRecord[]>('/packing/queue');
  },

  create: async (packing: Omit<PackingRecord, 'id'>): Promise<PackingRecord> => {
    return apiClient.post<PackingRecord>('/packing', packing);
  },

  complete: async (id: string): Promise<PackingRecord> => {
    return apiClient.post<PackingRecord>(`/packing/${id}/complete`, {});
  },
};

