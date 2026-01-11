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

  update: async (id: string, order: Partial<Order>): Promise<Order> => {
    return apiClient.put<Order>(`/orders/${id}`, order);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/orders/${id}`);
    // 204 No Content response - no body to return
  },

  cancel: async (id: string): Promise<Order> => {
    return ordersApi.updateStatus(id, "cancelled");
  },

  getAllInbound: async (): Promise<Order[]> => {
    return ordersApi.getAll("inbound");
  },

  getAllOutbound: async (): Promise<Order[]> => {
    return ordersApi.getAll("outbound");
  },

  /**
   * Get orders that need putaway (received but not yet put away)
   * For putaway workers to see available orders
   */
  getOrdersNeedingPutaway: async (warehouseId: string): Promise<Order[]> => {
    return apiClient.get<Order[]>(`/orders/warehouse/${warehouseId}/needs-putaway`);
  },

  /**
   * Get orders that need receiving (pending inbound orders)
   * For receiving workers to see available orders
   */
  getOrdersNeedingReceiving: async (warehouseId: string): Promise<Order[]> => {
    return apiClient.get<Order[]>(`/orders/warehouse/${warehouseId}/needs-receiving`);
  },
};

