import { apiClient } from './client';

export interface Return {
  id: string;
  returnNumber: string;
  originalOrderId?: string;
  customerId?: string;
  warehouseId?: string;
  returnDate?: string;
  reason?: string;
  status: string;
  resolution?: string;
  receivedBy?: string;
  inspectedBy?: string;
  returnFlow?: string;
  qcOutcome?: string;
  supplierResponseStatus?: string;
  supplierResponseNotes?: string;
  falseReturnRequest?: boolean;
  customerCareFlag?: boolean;
  followupOrderId?: string;
  closedAt?: string;
  lastStatusChangedAt?: string;
}

export interface PagedReturnsResponse {
  data: Return[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const returnsApi = {
  getAll: async (orderId?: string, customerId?: string, status?: string): Promise<Return[]> => {
    const params = new URLSearchParams();
    if (orderId) params.append('orderId', orderId);
    if (customerId) params.append('customerId', customerId);
    if (status) params.append('status', status);
    const query = params.toString();
    return apiClient.get<Return[]>(`/returns${query ? `?${query}` : ''}`);
  },

  getPaged: async ({
    page = 0,
    size = 25,
    sortBy = "createdAt",
    sortDir = "desc",
    orderId,
    customerId,
    warehouseId,
    status,
    returnFlow,
    q,
  }: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    orderId?: string;
    customerId?: string;
    warehouseId?: string;
    status?: string;
    returnFlow?: string;
    q?: string;
  }): Promise<PagedReturnsResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("size", String(size));
    params.append("sortBy", sortBy);
    params.append("sortDir", sortDir);
    if (orderId) params.append("orderId", orderId);
    if (customerId) params.append("customerId", customerId);
    if (warehouseId) params.append("warehouseId", warehouseId);
    if (status) params.append("status", status);
    if (returnFlow) params.append("returnFlow", returnFlow);
    if (q && q.trim()) params.append("q", q.trim());
    return apiClient.get<PagedReturnsResponse>(`/returns/paged?${params.toString()}`);
  },

  getById: async (id: string): Promise<Return> => {
    return apiClient.get<Return>(`/returns/${id}`);
  },

  create: async (returnRecord: Omit<Return, 'id'>): Promise<Return> => {
    return apiClient.post<Return>('/returns', returnRecord);
  },

  update: async (id: string, returnRecord: Partial<Return>): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}`, returnRecord);
  },

  updateStatus: async (id: string, status: string, notes?: string): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}/status`, { status, notes });
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/returns/${id}`);
  },

  approve: async (id: string, approvedBy?: string): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}/approve`, { approvedBy });
  },

  submitInspection: async (id: string, inspectionData: {
    overallResolution: string;
    notes?: string;
    inspectedBy?: string;
  }): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}/inspection`, inspectionData);
  },

  assignWorker: async (id: string, workerId: string): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}/assign`, { workerId });
  },

  reject: async (
    id: string,
    payload: { rejectionReason: string; resolution?: string; reviewedBy?: string }
  ): Promise<Return> => {
    return apiClient.put<Return>(`/returns/${id}/reject`, payload);
  },

  intakeOutbound: async (data: {
    orderNumber: string;
    reason?: string;
    workerId?: string;
  }): Promise<Return> => {
    return apiClient.post<Return>('/returns/intake/outbound', data);
  },
};
