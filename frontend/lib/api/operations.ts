import { apiClient } from './client';

// Stock Transfers
export interface StockTransfer {
  id: string;
  transferNumber: string;
  transferType: string;
  materialId: string;
  sourceWarehouseId: string;
  sourceLocationCode?: string;
  destWarehouseId: string;
  destLocationCode?: string;
  quantity: string;
  status: string;
  notes?: string;
}

export const stockTransfersApi = {
  getAll: async (): Promise<StockTransfer[]> => {
    return apiClient.get<StockTransfer[]>('/operations/stock-transfers');
  },

  getById: async (id: string): Promise<StockTransfer> => {
    return apiClient.get<StockTransfer>(`/operations/stock-transfers/${id}`);
  },

  create: async (transfer: Omit<StockTransfer, 'id'>): Promise<StockTransfer> => {
    return apiClient.post<StockTransfer>('/operations/stock-transfers', transfer);
  },

  dispatch: async (id: string, userId: string): Promise<StockTransfer> => {
    return apiClient.post<StockTransfer>(`/operations/stock-transfers/${id}/dispatch?userId=${userId}`, {});
  },

  receive: async (id: string, userId: string): Promise<StockTransfer> => {
    return apiClient.post<StockTransfer>(`/operations/stock-transfers/${id}/receive?userId=${userId}`, {});
  },
};

// Cycle Counts
export interface CycleCount {
  id: string;
  countNumber: string;
  warehouseId: string;
  locationCode?: string;
  status: string;
  variance?: string;
}

export const cycleCountsApi = {
  getAll: async (): Promise<CycleCount[]> => {
    return apiClient.get<CycleCount[]>('/operations/cycle-counts');
  },

  getById: async (id: string): Promise<CycleCount> => {
    return apiClient.get<CycleCount>(`/operations/cycle-counts/${id}`);
  },

  recordCount: async (id: string, materialId: string, countedQuantity: string, countedBy: string): Promise<{ success: boolean; message: string; variance: string }> => {
    return apiClient.post(`/operations/cycle-counts/${id}/record`, {
      materialId,
      countedQuantity,
      countedBy,
    });
  },
};

// Receiving
export interface OrderDetail {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  warehouseId: string;
}

export interface ReceivedItem {
  materialId: string;
  quantity: string;
  locationCode: string;
}

export const receivingApi = {
  getOrderByNumber: async (orderNumber: string): Promise<OrderDetail> => {
    return apiClient.get<OrderDetail>(`/operations/receiving/order/${orderNumber}`);
  },

  receiveOrder: async (orderNumber: string, items: ReceivedItem[]): Promise<{ success: boolean; message: string; orderId: string }> => {
    return apiClient.post('/operations/receiving/receive', {
      orderNumber,
      items,
    });
  },
};

// Putaway
export interface PutawayRequest {
  locationCode: string;
  lpn: string;
}

export interface PutawayResponse {
  success: boolean;
  message: string;
  taskId: string | null;
}

export const putawayApi = {
  completePutaway: async (taskId: string, locationCode: string, lpn: string): Promise<PutawayResponse> => {
    return apiClient.post<PutawayResponse>(`/operations/putaway/complete/${taskId}`, {
      locationCode,
      lpn,
    });
  },
};

// Picking
export interface PickedItem {
  materialId: string;
  quantity: string;
  locationCode: string;
}

export interface PickingRequest {
  items: PickedItem[];
}

export interface PickingResponse {
  success: boolean;
  message: string;
  taskId: string | null;
}

export const pickingApi = {
  completePicking: async (taskId: string, items: PickedItem[]): Promise<PickingResponse> => {
    return apiClient.post<PickingResponse>(`/operations/picking/complete/${taskId}`, {
      items,
    });
  },
};

