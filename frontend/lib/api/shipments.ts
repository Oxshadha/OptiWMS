import { apiClient } from './client';

export interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId?: string;
  deliveryPartnerId?: string;
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

export interface PagedShipmentsResponse {
  data: Shipment[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const shipmentsApi = {
  getAll: async (
    orderId?: string,
    status?: string,
    deliveryPartnerId?: string
  ): Promise<Shipment[]> => {
    const params = new URLSearchParams();
    if (orderId) params.append('orderId', orderId);
    if (status) params.append('status', status);
    if (deliveryPartnerId) params.append('deliveryPartnerId', deliveryPartnerId);
    const query = params.toString();
    return apiClient.get<Shipment[]>(`/shipments${query ? `?${query}` : ''}`);
  },

  getPaged: async ({
    page = 0,
    size = 10,
    sortBy = "createdAt",
    sortDir = "desc",
    orderId,
    deliveryPartnerId,
    status,
    q,
  }: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    orderId?: string;
    deliveryPartnerId?: string;
    status?: string;
    q?: string;
  }): Promise<PagedShipmentsResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("size", String(size));
    params.append("sortBy", sortBy);
    params.append("sortDir", sortDir);
    if (orderId) params.append("orderId", orderId);
    if (deliveryPartnerId) params.append("deliveryPartnerId", deliveryPartnerId);
    if (status) params.append("status", status);
    if (q && q.trim()) params.append("q", q.trim());
    return apiClient.get<PagedShipmentsResponse>(`/shipments/paged?${params.toString()}`);
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
