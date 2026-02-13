import { apiClient } from './client';

export interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId?: string;
  carrier?: string;
  trackingNumber?: string;
  destination?: string;
  weightKg?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  status: string;
  eta?: string;
  shippedAt?: string;
  deliveredAt?: string;
  deliveryConfirmedBy?: string;
  deliveryConfirmedAt?: string;
}

export const shipmentsApi = {
  getAll: async (orderId?: string, status?: string): Promise<Shipment[]> => {
    const params = new URLSearchParams();
    if (orderId) params.append('orderId', orderId);
    if (status) params.append('status', status);
    const query = params.toString();
    return apiClient.get<Shipment[]>(`/shipments${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Shipment> => {
    return apiClient.get<Shipment>(`/shipments/${id}`);
  },

  getByOrderId: async (orderId: string): Promise<Shipment[]> => {
    return apiClient.get<Shipment[]>(`/shipments?orderId=${orderId}`);
  },

  create: async (shipment: Omit<Shipment, 'id'>): Promise<Shipment> => {
    return apiClient.post<Shipment>('/shipments', shipment);
  },

  update: async (id: string, shipment: Partial<Shipment>): Promise<Shipment> => {
    return apiClient.put<Shipment>(`/shipments/${id}`, shipment);
  },

  updateStatus: async (id: string, status: string, workerId?: string): Promise<Shipment> => {
    return apiClient.put<Shipment>(`/shipments/${id}/status`, { status, workerId });
  },

  confirmDelivery: async (id: string): Promise<Shipment> => {
    return apiClient.put<Shipment>(`/shipments/${id}/confirm-delivery`, {});
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/shipments/${id}`);
  },
};
