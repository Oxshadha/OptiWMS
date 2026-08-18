import { apiClient } from './client';

export interface OrderItem {
  id: string;
  orderId: string;
  materialId: string;
  materialCode?: string;
  materialName?: string;
  quantity: number;
  unitPrice?: string;
  pickedQuantity: number;
  packedQuantity: number;
  locationCode?: string;
  weightKg?: number;
  heightCm?: number;
  lengthCm?: number;
  widthCm?: number;
  batchNumber?: string;
  manufactureDate?: string;
  expiryDate?: string;
  status: string;
}

export interface CreateOrderItemRequest {
  materialId: string;
  quantity: number;
  unitPrice?: string;
  locationCode?: string;
  weightKg?: number;
  heightCm?: number;
  lengthCm?: number;
  widthCm?: number;
  batchNumber?: string;
  manufactureDate?: string;
  expiryDate?: string;
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
   * The pallet moves this order needs, one entry per putaway task.
   * Each entry carries its own destination and its own quantity.
   */
  getPutawayItems: async (orderId: string, workerId?: string): Promise<PutawayItem[]> => {
    // Passing the worker hides pallets another driver has already claimed.
    const query = workerId ? `?workerId=${encodeURIComponent(workerId)}` : "";
    return apiClient.get<PutawayItem[]>(`/orders/${orderId}/putaway-items${query}`);
  },
};

/**
 * One pallet move. The backend plans a line into one task per pallet, each with its own bin, so
 * this is the unit of work a forklift driver actually performs -- not the order line.
 */
export interface PutawayItem {
  /** Task to complete. Null only for a line with no planned pallet task yet. */
  taskId: string | null;
  itemId: string;
  materialId: string;
  materialCode?: string | null;
  materialName?: string | null;
  /** Which pallet of the line this is, and how many there are: "pallet 3 of 6". */
  handlingUnitSeq: number;
  totalHandlingUnits: number;
  /** Units this pallet owes -- what the quantity box must default to. */
  palletQuantity: number;
  /** Units of this pallet already put away, for partial completion. */
  completedQuantity: number;
  /** Destination planned for this specific pallet. */
  plannedLocation: string | null;
  /** Units received on the parent line, shown for context only. */
  lineReceivedQuantity: number;
  status: string;
  skipReason?: string | null;
  existingLocations?: string[];
  splitPlan?: {
    feasible: boolean;
    requestedQuantity: number;
    plannedQuantity: number;
    unplannedQuantity: number;
    allocations: Array<{
      locationCode: string;
      allocatedQuantity: number;
      reason: string;
    }>;
    notes: string[];
  } | null;
}
