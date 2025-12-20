import { apiClient } from './client';

export interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId?: string;
  carrier?: string;
  trackingNumber?: string;
  destination?: string;
  weightKg?: number;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  status: string;
  eta?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export const shipmentsApi = {
  getAll: async (): Promise<Shipment[]> => {
    return apiClient.get<Shipment[]>('/shipments');
  },

  getById: async (id: string): Promise<Shipment> => {
    return apiClient.get<Shipment>(`/shipments/${id}`);
  },

  create: async (shipment: Omit<Shipment, 'id'>): Promise<Shipment> => {
    return apiClient.post<Shipment>('/shipments', shipment);
  },

  update: async (id: string, shipment: Partial<Shipment>): Promise<Shipment> => {
    return apiClient.put<Shipment>(`/shipments/${id}`, shipment);
  },

  process: async (id: string): Promise<Shipment> => {
    return apiClient.post<Shipment>(`/shipments/${id}/process`, {});
  },

  track: async (id: string, trackingNumber: string): Promise<Shipment> => {
    return apiClient.post<Shipment>(`/shipments/${id}/track`, { trackingNumber });
  },
};

