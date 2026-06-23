import { apiClient } from './client';

export interface DemandInsight {
  materialId: string;
  materialCode: string;
  trend: 'RISING' | 'STABLE' | 'FALLING';
  forecastP50: number;
  forecastP90: number;
  currentBins: number;
  recommendedBins: number;
  stockoutRisk: number;
  reclaimableBins: number;
  confidencePct: number;
  rationale: string;
}

export interface RackPendingMoves {
  rackId: string;
  pendingMoveCount: number;
}

export interface PlanVsActual {
  materialCode: string;
  plannedLocation: string;
  actualLocation: string;
}

export interface WarehouseIntelligenceSnapshot {
  warehouseId: string;
  activePlanCode: string | null;
  executionStatus: string;
  openTransferLines: number;
  planMismatchCount: number;
  pendingMovesByRack: RackPendingMoves[];
  planVsActual: PlanVsActual[];
  demandInsights: DemandInsight[];
}

export const slottingIntelligenceApi = {
  getSnapshot: (warehouseId: string): Promise<WarehouseIntelligenceSnapshot> =>
    apiClient.get<WarehouseIntelligenceSnapshot>(
      `/v1/slotting/intelligence/snapshot?warehouseId=${warehouseId}`
    ),

  getDemandInsights: (warehouseId: string): Promise<DemandInsight[]> =>
    apiClient.get<DemandInsight[]>(
      `/v1/slotting/intelligence/demand-insights?warehouseId=${warehouseId}`
    ),
};
