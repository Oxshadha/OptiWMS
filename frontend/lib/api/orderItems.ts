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

export const orderItemsApi = {
  getByOrderId: async (orderId: string): Promise<OrderItem[]> => {
    return apiClient.get<OrderItem[]>(`/orders/${orderId}/items`);
  },
};

