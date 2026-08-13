import { apiClient } from './client';

export interface SlottingPlanSummary {
  id: string;
  warehouseId: string;
  planCode: string;
  validFrom: string;
  validTo: string;
  status: string;
  version: number;
  algorithm?: string;
  relocationBudgetPct?: number;
  relocationMovesApplied?: number;
  totalMovesProposed?: number;
  totalDistanceSavedMeters?: number;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  sourceStatsAt?: string;
  notes?: string;
  solverStatus?: string;
  objectiveValue?: number | null;
  infeasibleReason?: string | null;
  constraintEvidence?: string | null;
  executionStatus?: string;
  executionTransferId?: string | null;
  transfersCreated?: number;
}

export interface ReserveLocation {
  locationCode: string;
  finalLocationCode?: string;
  palletPositions: number;
  zoneHint?: string;
}

export interface PlacementLine {
  locationCode: string;
  palletCount: number;
  quantityAllocated: number;
  rackId?: string | null;
  levelNumber?: number | null;
}

export interface SlottingPlanLine {
  id: string;
  materialId: string;
  materialCode: string;
  materialType: string;
  currentPrimaryLocation: string | null;
  recommendedPrimaryLocation: string | null;
  finalPrimaryLocation: string | null;
  activePickPalletPositions: number;
  requiredReservePalletPositions: number;
  maxStockPalletPositions: number;
  reserveLocations: ReserveLocation[];
  placementLines?: PlacementLine[];
  distanceSavedMeters?: number;
  zoneUpgrade?: string;
  moveReason?: string;
  gainScore?: number;
  relocationApplied?: boolean;
  relocationFlag?: boolean;
  locked?: boolean;
  managerOverride?: boolean;
  status: string;
}

export interface SlottingReadiness {
  ready: boolean;
  materialsReadyPct: number;
  materialsReadyCount: number;
  materialsTotalCount: number;
  locationsReadyPct: number;
  locationsReadyCount: number;
  locationsTotalCount: number;
  blockers: string[];
}

export const slottingPlansApi = {
  listPlans: (warehouseId: string): Promise<SlottingPlanSummary[]> =>
    apiClient.get<SlottingPlanSummary[]>(`/v1/slotting/plans?warehouseId=${warehouseId}`),

  getActivePlan: (warehouseId: string): Promise<SlottingPlanSummary> =>
    apiClient.get<SlottingPlanSummary>(`/v1/slotting/plans/active?warehouseId=${warehouseId}`),

  getLines: (planId: string): Promise<SlottingPlanLine[]> =>
    apiClient.get<SlottingPlanLine[]>(`/v1/slotting/plans/${planId}/lines`),

  createPlan: (body: {
    warehouseId: string;
    validMonths?: number;
    relocationBudgetPct?: number;
    useMilpAClass?: boolean;
    createdBy?: string;
    notes?: string;
  }): Promise<SlottingPlanSummary> =>
    apiClient.post<SlottingPlanSummary>('/v1/slotting/plans', body),

  reoptimize: (planId: string, body: { expectedVersion: number; lockedLineIds?: string[] }): Promise<SlottingPlanSummary> =>
    apiClient.post<SlottingPlanSummary>(`/v1/slotting/plans/${planId}/reoptimize`, body),

  approve: (
    planId: string,
    body: { approvedBy: string }
  ): Promise<SlottingPlanSummary> =>
    apiClient.post<SlottingPlanSummary>(`/v1/slotting/plans/${planId}/approve`, body),

  schedule: (planId: string, scheduledFor: string): Promise<SlottingPlanSummary> =>
    apiClient.post<SlottingPlanSummary>(`/v1/slotting/plans/${planId}/schedule`, { scheduledFor }),

  updateLine: (
    planId: string,
    lineId: string,
    body: { expectedVersion?: number; finalPrimaryLocationCode?: string; overrideReason?: string; locked?: boolean }
  ): Promise<SlottingPlanLine> =>
    apiClient.patch<SlottingPlanLine>(`/v1/slotting/plans/${planId}/lines/${lineId}`, body),

  refreshIssueStats: (warehouseId: string): Promise<{ warehouseId: string; refreshedAt: string }> =>
    apiClient.post(`/v1/slotting/issue-stats/refresh?warehouseId=${warehouseId}`, {}),

  getReadiness: (warehouseId: string): Promise<SlottingReadiness> =>
    apiClient.get<SlottingReadiness>(`/v1/slotting/readiness?warehouseId=${warehouseId}`),
};
