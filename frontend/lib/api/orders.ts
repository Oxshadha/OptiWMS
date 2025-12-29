import { apiClient } from './client';

export interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  customerId?: string;
  supplierId?: string;
  warehouseId: string;
  status: string;
  priority: string;
  orderDate?: string;
  expectedDate?: string;
  totalAmount?: string;
  notes?: string;
}

export const ordersApi = {
  getAll: async (orderType?: string, status?: string): Promise<Order[]> => {
    const params = new URLSearchParams();
    if (orderType) params.append('orderType', orderType);
    if (status) params.append('status', status);
    const query = params.toString();
    return apiClient.get<Order[]>(`/orders${query ? `?${query}` : ''}`);
  },

  getById: async (id: string): Promise<Order> => {
    return apiClient.get<Order>(`/orders/${id}`);
  },

  getByOrderNumber: async (orderNumber: string): Promise<Order> => {
    return apiClient.get<Order>(`/orders/number/${orderNumber}`);
  },

  create: async (order: Omit<Order, 'id'>): Promise<Order> => {
    return apiClient.post<Order>('/orders', order);
  },

  updateStatus: async (id: string, status: string): Promise<Order> => {
    return apiClient.put<Order>(`/orders/${id}/status`, { status });
  },

  getAllInbound: async (): Promise<Order[]> => {
    return ordersApi.getAll("inbound");
  },

  getAllOutbound: async (): Promise<Order[]> => {
    return ordersApi.getAll("outbound");
  },
};

