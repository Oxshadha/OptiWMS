import { apiClient } from './client';

export interface Order {
  id: string;
  orderNumber: string;
  orderType: 'inbound' | 'outbound';
  customerId?: string;
  supplierId?: string;
  warehouseId?: string;
  status: string;
  priority: string;
  orderDate: string;
  expectedDate?: string;
  totalAmount?: number;
  notes?: string;
}

export const ordersApi = {
  getAll: async (): Promise<Order[]> => {
    return apiClient.get<Order[]>('/orders');
  },

  getById: async (id: string): Promise<Order> => {
    return apiClient.get<Order>(`/orders/${id}`);
  },

  getInbound: async (): Promise<Order[]> => {
    return apiClient.get<Order[]>('/orders/inbound');
  },

  getOutbound: async (): Promise<Order[]> => {
    return apiClient.get<Order[]>('/orders/outbound');
  },

  create: async (order: Omit<Order, 'id'>): Promise<Order> => {
    return apiClient.post<Order>('/orders', order);
  },

  update: async (id: string, order: Partial<Order>): Promise<Order> => {
    return apiClient.put<Order>(`/orders/${id}`, order);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/orders/${id}`);
  },
};

