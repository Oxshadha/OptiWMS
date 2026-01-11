import { apiClient } from './client';

export interface OrderItem {
  id: string;
  orderId: string;
  materialId: string;
  quantity: number;
  unitPrice?: string;
  pickedQuantity: number;
  packedQuantity: number;
  locationCode?: string;
  status: string;
}

export interface CreateOrderItemRequest {
  materialId: string;
  quantity: number;
  unitPrice?: string;
  locationCode?: string;
}

export const orderItemsApi = {
  getByOrderId: async (orderId: string): Promise<OrderItem[]> => {
    return apiClient.get<OrderItem[]>(`/orders/${orderId}/items`);
  },

  create: async (orderId: string, item: CreateOrderItemRequest): Promise<OrderItem> => {
    return apiClient.post<OrderItem>(`/orders/${orderId}/items`, item);
  },

  update: async (itemId: string, item: Partial<CreateOrderItemRequest>): Promise<OrderItem> => {
    return apiClient.put<OrderItem>(`/orders/items/${itemId}`, item);
  },

  delete: async (itemId: string): Promise<void> => {
    return apiClient.delete<void>(`/orders/items/${itemId}`);
  },

  /**
   * Get order items for putaway - includes suggested locations
   * For putaway workers to see items in an order that need putaway
   */
  getPutawayItems: async (orderId: string): Promise<PutawayItem[]> => {
    return apiClient.get<PutawayItem[]>(`/orders/${orderId}/putaway-items`);
  },
};

export interface PutawayItem {
  itemId: string;
  materialId: string;
  receivedQuantity: number;
  orderedQuantity: number;
  suggestedLocation: string | null;
  status: string;
}

