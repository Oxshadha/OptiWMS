import { apiClient } from "./client";

export interface BomHeader {
  id: string;
  parentMaterialId: string;
  warehouseId?: string | null;
  version: string;
  status: "active" | "inactive" | "draft" | "retired";
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BomComponent {
  id: string;
  bomHeaderId: string;
  componentMaterialId: string;
  componentType: string;
  qtyPerParent: number;
  scrapRate: number;
  leadTimeDays?: number | null;
  uom?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BomAuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actor?: string | null;
  payloadJson?: string | null;
  createdAt?: string;
}

export const bomMasterApi = {
  listHeaders: async (filters?: {
    parentMaterialId?: string;
    warehouseId?: string;
    status?: string;
  }): Promise<BomHeader[]> => {
    const params = new URLSearchParams();
    if (filters?.parentMaterialId) params.append("parentMaterialId", filters.parentMaterialId);
    if (filters?.warehouseId) params.append("warehouseId", filters.warehouseId);
    if (filters?.status) params.append("status", filters.status);
    const query = params.toString();
    return apiClient.get<BomHeader[]>(`/planning/bom/headers${query ? `?${query}` : ""}`);
  },

  createHeader: async (payload: {
    parentMaterialId: string;
    warehouseId?: string | null;
    version?: string;
    status?: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    notes?: string | null;
  }): Promise<BomHeader> => {
    return apiClient.post<BomHeader>("/planning/bom/headers", payload);
  },

  updateHeader: async (
    id: string,
    payload: {
      version?: string;
      status?: string;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      notes?: string | null;
    },
  ): Promise<BomHeader> => {
    return apiClient.put<BomHeader>(`/planning/bom/headers/${id}`, payload);
  },

  deleteHeader: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/planning/bom/headers/${id}`);
  },

  listComponents: async (headerId: string): Promise<BomComponent[]> => {
    return apiClient.get<BomComponent[]>(`/planning/bom/headers/${headerId}/components`);
  },

  createComponent: async (
    headerId: string,
    payload: {
      componentMaterialId: string;
      componentType: string;
      qtyPerParent: number;
      scrapRate?: number;
      leadTimeDays?: number | null;
      uom?: string | null;
    },
  ): Promise<BomComponent> => {
    return apiClient.post<BomComponent>(`/planning/bom/headers/${headerId}/components`, payload);
  },

  updateComponent: async (
    id: string,
    payload: {
      componentType?: string;
      qtyPerParent?: number;
      scrapRate?: number;
      leadTimeDays?: number | null;
      uom?: string | null;
    },
  ): Promise<BomComponent> => {
    return apiClient.put<BomComponent>(`/planning/bom/components/${id}`, payload);
  },

  deleteComponent: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/planning/bom/components/${id}`);
  },

  listAudit: async (limit = 100): Promise<BomAuditRow[]> => {
    const params = new URLSearchParams();
    params.append("limit", String(limit));
    return apiClient.get<BomAuditRow[]>(`/planning/bom/audit?${params.toString()}`);
  },
};
