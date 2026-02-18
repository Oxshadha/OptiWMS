import { apiClient } from './client';

// Receiving Operations
export interface OrderDetail {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  warehouseId: string;
}

export interface ReceiveItem {
  materialId: string;
  quantity: string;
  locationCode?: string;
  batchNumber?: string;
  expiryDate?: string;
}

export interface ReceiveRequest {
  orderNumber: string;
  items: ReceiveItem[];
  notes?: string;
  photos?: string[];
  warehouseId?: string; // Worker's warehouse ID for blind receive
}

export interface ReceiveResponse {
  success: boolean;
  message: string;
  grnId?: string;
}

// Picking Operations
export interface PickedItem {
  materialId: string;
  quantity: string;
  locationCode: string;
}

export interface CompletePickingRequest {
  items: PickedItem[];
}

export interface PickingResponse {
  success: boolean;
  message: string;
  taskId?: string;
}

export interface PickingIssueRequest {
  materialId: string;
  locationCode: string;
  requestedQuantity: string;
  availableQuantity: string;
  reason: string;
}

export interface PickingIssueResponse {
  success: boolean;
  message: string;
  anomalyId?: string;
  taskId?: string;
}

// Putaway Operations
export interface CompletePutawayRequest {
  locationCode: string;
  lpn?: string;
  quantity?: number; // Optional - will be determined from order item if not provided
  materialId?: string; // Optional - will be determined from order item if not provided
  workerId?: string;
}

export interface PutawayResponse {
  success: boolean;
  message: string;
  taskId?: string;
}

export interface SkipPutawayRequest {
  reason: string;
  workerId?: string;
}

export interface PutawaySplitPlanRequest {
  warehouseId: string;
  materialId: string;
  quantity: number;
  preferredLocationCode?: string;
}

export interface PutawaySplitCapacitySnapshot {
  quantityUsed?: number | null;
  quantityCapacity?: number | null;
  quantityFillPercent?: string | null;
  weightUsedKg?: string | null;
  weightCapacityKg?: string | null;
  weightFillPercent?: string | null;
  volumeUsedCm3?: string | null;
  volumeCapacityCm3?: string | null;
  volumeFillPercent?: string | null;
  lpnUsed?: number | null;
  lpnCapacity?: number | null;
  lpnFillPercent?: string | null;
}

export interface PutawaySplitPlanLine {
  locationCode: string;
  allocatedQuantity: number;
  reason: string;
  projectedAfter?: PutawaySplitCapacitySnapshot;
}

export interface PutawaySplitPlanResponse {
  feasible: boolean;
  requestedQuantity: number;
  plannedQuantity: number;
  unplannedQuantity: number;
  requiredPalletSlots?: number | null;
  availablePalletSlots?: number | null;
  unitsPerPallet?: string | null;
  allocations: PutawaySplitPlanLine[];
  notes: string[];
}

// Stock Transfer Operations
export interface StockTransfer {
  id: string;
  transferNumber: string;
  transferType: string;
  materialId?: string;
  sourceWarehouseId?: string;
  sourceLocationCode?: string;
  destWarehouseId?: string;
  destLocationCode?: string;
  quantity: string;
  status: string;
  createdBy?: string;
  releasedBy?: string;
  releasedAt?: string;
  notes?: string;
  lines?: StockTransferLine[];
}

export interface StockTransferLine {
  id: string;
  transferId: string;
  lineNumber: number;
  materialId: string;
  sourceWarehouseId: string;
  sourceLocationCode: string;
  destWarehouseId: string;
  destLocationCode: string;
  requestedQuantity: number;
  movedQuantity: number;
  status: string;
  assignedWorkerId?: string;
  notes?: string;
}

export interface CreateStockTransferRequest {
  transferNumber?: string;
  transferType: string;
  materialId?: string;
  sourceWarehouseId?: string;
  sourceLocationCode?: string;
  destWarehouseId?: string;
  destLocationCode?: string;
  quantity?: string;
  status?: string;
  createdBy?: string;
  lines?: CreateStockTransferLineRequest[];
  notes?: string;
}

export interface CreateStockTransferLineRequest {
  lineNumber?: number;
  materialId: string;
  sourceWarehouseId: string;
  sourceLocationCode: string;
  destWarehouseId: string;
  destLocationCode: string;
  quantity: string;
  assignedWorkerId?: string;
  status?: string;
  notes?: string;
}

// Cycle Count Operations
export interface CycleCount {
  id: string;
  countNumber: string;
  warehouseId: string;
  locationCode: string;
  assignedWorkers?: string[];
  materialId?: string;
  expectedQuantity?: string;
  countedQuantity?: string;
  variancePercentage?: string;
  anomalyLevel?: string;
  anomalyDetected?: boolean;
  approvalRequired?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  scheduledDate?: string;
  countedBy?: string;
  countedAt?: string;
  status: string;
  variance?: string | null;
  notes?: string;
}

export interface CycleCountResult {
  success: boolean;
  message: string;
  variance?: string | null;
  recountRequired?: boolean;
  approvalRequired?: boolean;
}

export const operationsApi = {
  // Receiving
  getOrderByNumber: async (orderNumber: string): Promise<OrderDetail> => {
    return apiClient.get<OrderDetail>(`/operations/receiving/order/${orderNumber}`);
  },

  receive: async (request: ReceiveRequest, workerId?: string): Promise<ReceiveResponse> => {
    const requestWithWorker = { ...request, workerId };
    return apiClient.post<ReceiveResponse>('/operations/receiving/receive', requestWithWorker);
  },

  blindReceive: async (request: ReceiveRequest, workerId?: string): Promise<ReceiveResponse> => {
    const requestWithWorker = { ...request, workerId };
    return apiClient.post<ReceiveResponse>('/operations/receiving/blind-receive', requestWithWorker);
  },
  
  // Legacy aliases for backward compatibility
  receiveOrder: async (orderNumber: string, items: ReceiveItem[]): Promise<ReceiveResponse> => {
    return operationsApi.receive({
      orderNumber,
      items,
    });
  },
  
  blindReceiveOrder: async (orderNumber: string, items: ReceiveItem[]): Promise<ReceiveResponse> => {
    return operationsApi.blindReceive({
      orderNumber,
      items,
    });
  },

  // Picking
  completePicking: async (taskId: string, request: CompletePickingRequest, workerId?: string): Promise<PickingResponse> => {
    const requestWithWorker = { ...request, workerId };
    return apiClient.post<PickingResponse>(`/operations/picking/complete/${taskId}`, requestWithWorker);
  },

  reportPickingIssue: async (taskId: string, request: PickingIssueRequest, workerId?: string): Promise<PickingIssueResponse> => {
    const requestWithWorker = { ...request, workerId };
    return apiClient.post<PickingIssueResponse>(`/operations/picking/issue/${taskId}`, requestWithWorker);
  },

  // Putaway
  completePutaway: async (taskId: string, request: CompletePutawayRequest): Promise<PutawayResponse> => {
    return apiClient.post<PutawayResponse>(`/operations/putaway/complete/${taskId}`, request);
  },

  skipPutaway: async (taskId: string, request: SkipPutawayRequest): Promise<PutawayResponse> => {
    return apiClient.post<PutawayResponse>(`/operations/putaway/skip/${taskId}`, request);
  },

  planPutawaySplit: async (request: PutawaySplitPlanRequest): Promise<PutawaySplitPlanResponse> => {
    return apiClient.post<PutawaySplitPlanResponse>('/operations/putaway/split-plan', request);
  },

  // Stock Transfer
  getStockTransfers: async (): Promise<StockTransfer[]> => {
    return apiClient.get<StockTransfer[]>('/operations/stock-transfers');
  },

  createStockTransfer: async (request: CreateStockTransferRequest): Promise<StockTransfer> => {
    return apiClient.post<StockTransfer>('/operations/stock-transfers', request);
  },

  createMultiStockTransfer: async (request: CreateStockTransferRequest): Promise<StockTransfer> => {
    return apiClient.post<StockTransfer>('/operations/stock-transfers/multi', request);
  },

  releaseStockTransfer: async (id: string, managerId: string): Promise<StockTransfer> => {
    return apiClient.post<StockTransfer>(`/operations/stock-transfers/${id}/release`, { managerId });
  },

  getStockTransferLines: async (id: string): Promise<StockTransferLine[]> => {
    return apiClient.get<StockTransferLine[]>(`/operations/stock-transfers/${id}/lines`);
  },

  getExecutableStockTransferLines: async (workerId: string, warehouseId?: string): Promise<StockTransferLine[]> => {
    const params = new URLSearchParams({ workerId });
    if (warehouseId) params.append('warehouseId', warehouseId);
    return apiClient.get<StockTransferLine[]>(`/operations/stock-transfers/lines/executable?${params.toString()}`);
  },

  assignStockTransferLine: async (lineId: string, workerId: string, assignedBy: string): Promise<StockTransferLine> => {
    return apiClient.post<StockTransferLine>(`/operations/stock-transfers/lines/${lineId}/assign`, { workerId, assignedBy });
  },

  executeStockTransferLine: async (
    lineId: string,
    request: {
      workerId: string;
      sourceScanLocation: string;
      destScanLocation: string;
      quantity: number;
      notes?: string;
    }
  ): Promise<StockTransferLine> => {
    return apiClient.post<StockTransferLine>(`/operations/stock-transfers/lines/${lineId}/execute`, request);
  },

  skipStockTransferLine: async (lineId: string, workerId: string, reason: string): Promise<StockTransferLine> => {
    return apiClient.post<StockTransferLine>(`/operations/stock-transfers/lines/${lineId}/skip`, { workerId, reason });
  },

  dispatchStockTransfer: async (id: string, userId: string): Promise<StockTransfer> => {
    return apiClient.post<StockTransfer>(`/operations/stock-transfers/${id}/dispatch?userId=${userId}`, {});
  },

  receiveStockTransfer: async (id: string, userId: string): Promise<StockTransfer> => {
    return apiClient.post<StockTransfer>(`/operations/stock-transfers/${id}/receive?userId=${userId}`, {});
  },

  cancelStockTransfer: async (id: string, reason?: string): Promise<StockTransfer> => {
    return apiClient.put<StockTransfer>(`/operations/stock-transfers/${id}/cancel`, { reason });
  },

  // Cycle Count
  getCycleCounts: async (): Promise<CycleCount[]> => {
    return apiClient.get<CycleCount[]>('/operations/cycle-counts');
  },

  getCycleCountById: async (id: string): Promise<CycleCount> => {
    return apiClient.get<CycleCount>(`/operations/cycle-counts/${id}`);
  },

  createCycleCount: async (request: {
    countNumber?: string;
    warehouseId: string;
    locationCode: string;
    assignedWorkers?: string[];
    scheduledDate?: string;
    status?: string;
    notes?: string;
  }): Promise<CycleCount> => {
    return apiClient.post<CycleCount>('/operations/cycle-counts', request);
  },

  updateCycleCount: async (id: string, request: Partial<CycleCount>): Promise<CycleCount> => {
    return apiClient.put<CycleCount>(`/operations/cycle-counts/${id}`, request);
  },

  cancelCycleCount: async (id: string, reason: string): Promise<CycleCount> => {
    return apiClient.put<CycleCount>(`/operations/cycle-counts/${id}/cancel`, { reason });
  },

  reviewCycleCount: async (id: string, notes?: string): Promise<CycleCount> => {
    return apiClient.put<CycleCount>(`/operations/cycle-counts/${id}/review`, { notes });
  },

  recordCycleCount: async (
    id: string,
    request: { materialId: string; countedQuantity: string; countedBy: string }
  ): Promise<CycleCountResult> => {
    return apiClient.post<CycleCountResult>(`/operations/cycle-counts/${id}/record`, request);
  },

  approveCycleCountAdjustment: async (
    id: string,
    request: { approvedBy: string; notes?: string }
  ): Promise<CycleCount> => {
    return apiClient.post<CycleCount>(`/operations/cycle-counts/${id}/approve-adjustment`, request);
  },

  rejectCycleCountAdjustment: async (
    id: string,
    request: { approvedBy: string; notes?: string }
  ): Promise<CycleCount> => {
    return apiClient.post<CycleCount>(`/operations/cycle-counts/${id}/reject-adjustment`, request);
  },
};

// Dock Management
export interface DockDoor {
  id: string;
  doorNumber: string;
  warehouseId: string;
  location?: string | null;
  status: string;
  currentAppointmentId?: string | null;
}

export interface DockAppointment {
  id: string;
  appointmentNumber: string;
  dockDoorId?: string | null;
  dockDoorNumber?: string;
  warehouseId: string;
  appointmentType: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  inboundOrderId?: string | null;
  inboundOrderNumber?: string;
  outboundOrderId?: string | null;
  supplierId?: string | null;
  supplierName?: string;
  carrierName?: string | null;
  trailerNumber?: string | null;
  status: string;
  notes?: string | null;
}

export interface YardTrailer {
  id: string;
  trailerNumber: string;
  warehouseId: string;
  carrierName?: string | null;
  inboundOrderId?: string | null;
  inboundOrderNumber?: string;
  supplierId?: string | null;
  supplierName?: string;
  arrivedAt?: string | null;
  waitTimeMinutes?: number | null;
  status: string;
  assignedDockDoorId?: string | null;
  assignedDockDoorNumber?: string;
}

export interface CreateDockDoorRequest {
  doorNumber: string;
  warehouseId: string;
  location?: string;
  status?: string;
}

export interface CreateDockAppointmentRequest {
  dockDoorId?: string;
  warehouseId: string;
  appointmentType: string;
  scheduledStart: string;
  scheduledEnd: string;
  inboundOrderId?: string;
  outboundOrderId?: string;
  supplierId?: string;
  carrierName?: string;
  trailerNumber?: string;
  notes?: string;
}

export interface CreateYardTrailerRequest {
  trailerNumber: string;
  warehouseId: string;
  carrierName?: string;
  inboundOrderId?: string;
  supplierId?: string;
}

export const dockManagementApi = {
  // Dock Doors
  getDockDoors: async (warehouseId?: string): Promise<DockDoor[]> => {
    const params = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return apiClient.get<DockDoor[]>(`/dock-management/doors${params}`);
  },

  getDockDoorById: async (id: string): Promise<DockDoor> => {
    return apiClient.get<DockDoor>(`/dock-management/doors/${id}`);
  },

  createDockDoor: async (request: CreateDockDoorRequest): Promise<DockDoor> => {
    return apiClient.post<DockDoor>('/dock-management/doors', request);
  },

  updateDockDoor: async (id: string, request: CreateDockDoorRequest): Promise<DockDoor> => {
    return apiClient.put<DockDoor>(`/dock-management/doors/${id}`, request);
  },

  // Dock Appointments
  getDockAppointments: async (warehouseId?: string, status?: string): Promise<DockAppointment[]> => {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<DockAppointment[]>(`/dock-management/appointments${query}`);
  },

  getDockAppointmentById: async (id: string): Promise<DockAppointment> => {
    return apiClient.get<DockAppointment>(`/dock-management/appointments/${id}`);
  },

  createDockAppointment: async (request: CreateDockAppointmentRequest): Promise<DockAppointment> => {
    return apiClient.post<DockAppointment>('/dock-management/appointments', request);
  },

  checkInAppointment: async (id: string): Promise<DockAppointment> => {
    return apiClient.post<DockAppointment>(`/dock-management/appointments/${id}/check-in`, {});
  },

  checkOutAppointment: async (id: string): Promise<DockAppointment> => {
    return apiClient.post<DockAppointment>(`/dock-management/appointments/${id}/check-out`, {});
  },

  // Yard Trailers
  getYardTrailers: async (warehouseId?: string): Promise<YardTrailer[]> => {
    const params = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return apiClient.get<YardTrailer[]>(`/dock-management/yard-trailers${params}`);
  },

  getYardTrailerById: async (id: string): Promise<YardTrailer> => {
    return apiClient.get<YardTrailer>(`/dock-management/yard-trailers/${id}`);
  },

  createYardTrailer: async (request: CreateYardTrailerRequest): Promise<YardTrailer> => {
    return apiClient.post<YardTrailer>('/dock-management/yard-trailers', request);
  },
};
