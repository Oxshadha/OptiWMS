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

export interface PagedOrdersResponse {
  data: Order[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CanonicalOrderRepairItem {
  orderId: string;
  oldOrderNumber?: string;
  newOrderNumber: string;
  orderType: string;
  orderDate?: string;
  aliasStatus: "alias_created" | "alias_exists" | string;
}

export interface CanonicalOrderRepairResult {
  dryRun: boolean;
  candidates: number;
  repaired: number;
  aliasesCreated: number;
  aliasesAlreadyPresent: number;
  items: CanonicalOrderRepairItem[];
}

export const ordersApi = {
  getAll: async (orderType?: string, status?: string): Promise<Order[]> => {
    const params = new URLSearchParams();
    if (orderType) params.append('orderType', orderType);
    if (status) params.append('status', status);
    const query = params.toString();
    return apiClient.get<Order[]>(`/orders${query ? `?${query}` : ''}`);
  },

  getPaged: async ({
    page = 0,
    size = 10,
    sortBy = "createdAt",
    sortDir = "desc",
    orderType,
    status,
    priority,
    warehouseId,
    supplierId,
    customerId,
    q,
  }: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    orderType?: string;
    status?: string;
    priority?: string;
    warehouseId?: string;
    supplierId?: string;
    customerId?: string;
    q?: string;
  }): Promise<PagedOrdersResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("size", String(size));
    params.append("sortBy", sortBy);
    params.append("sortDir", sortDir);
    if (orderType) params.append("orderType", orderType);
    if (status) params.append("status", status);
    if (priority) params.append("priority", priority);
    if (warehouseId) params.append("warehouseId", warehouseId);
    if (supplierId) params.append("supplierId", supplierId);
    if (customerId) params.append("customerId", customerId);
    if (q && q.trim()) params.append("q", q.trim());
    return apiClient.get<PagedOrdersResponse>(`/orders/paged?${params.toString()}`);
  },

  getById: async (id: string): Promise<Order> => {
    return apiClient.get<Order>(`/orders/${id}`);
  },

  getByOrderNumber: async (orderNumber: string): Promise<Order> => {
    return apiClient.get<Order>(`/orders/number/${orderNumber}`);
  },

  create: async (order: Omit<Order, 'id' | 'orderNumber'> & { orderNumber?: string }): Promise<Order> => {
    return apiClient.post<Order>('/orders', order);
  },

  repairCanonicalNumbers: async (dryRun = true): Promise<CanonicalOrderRepairResult> => {
    return apiClient.post<CanonicalOrderRepairResult>('/orders/repair/canonical-numbers', { dryRun });
  },

  createTasksByOrderId: async (id: string): Promise<{ success: boolean; message: string; tasksCreated: number }> => {
    return apiClient.post<{ success: boolean; message: string; tasksCreated: number }>(`/orders/${id}/create-tasks`, {});
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
