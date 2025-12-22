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

  blindReceive: async (orderNumber: string, items: ReceivedItem[]): Promise<{ success: boolean; message: string; orderId: string }> => {
    return apiClient.post('/operations/receiving/blind-receive', {
      orderNumber,
      items,
    });
  },
};

// Dock Management
export interface DockDoor {
  id: string;
  doorNumber: string;
  warehouseId: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  currentAppointmentId?: string;
  location?: string;
}

export interface DockAppointment {
  id: string;
  appointmentNumber: string;
  dockDoorId: string;
  dockDoorNumber: string;
  warehouseId: string;
  inboundOrderId?: string;
  inboundOrderNumber?: string;
  supplierName?: string;
  carrierName?: string;
  trailerNumber?: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface YardTrailer {
  id: string;
  trailerNumber: string;
  carrierName: string;
  inboundOrderId?: string;
  inboundOrderNumber?: string;
  supplierName?: string;
  arrivedAt: string;
  waitTimeMinutes: number;
  status: 'waiting' | 'assigned' | 'unloading' | 'completed';
  assignedDockDoorId?: string;
  assignedDockDoorNumber?: string;
}

export const dockManagementApi = {
  getDockDoors: async (warehouseId?: string): Promise<DockDoor[]> => {
    const params = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return apiClient.get<DockDoor[]>(`/operations/dock-doors${params}`);
  },

  getDockAppointments: async (warehouseId?: string, startDate?: string, endDate?: string): Promise<DockAppointment[]> => {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<DockAppointment[]>(`/operations/dock-appointments${query}`);
  },

  createAppointment: async (appointment: Omit<DockAppointment, 'id' | 'appointmentNumber' | 'status'>): Promise<DockAppointment> => {
    return apiClient.post<DockAppointment>('/operations/dock-appointments', appointment);
  },

  updateAppointment: async (id: string, appointment: Partial<DockAppointment>): Promise<DockAppointment> => {
    return apiClient.put<DockAppointment>(`/operations/dock-appointments/${id}`, appointment);
  },

  cancelAppointment: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post(`/operations/dock-appointments/${id}/cancel`, {});
  },

  getYardTrailers: async (warehouseId?: string): Promise<YardTrailer[]> => {
    const params = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return apiClient.get<YardTrailer[]>(`/operations/yard-trailers${params}`);
  },
};

