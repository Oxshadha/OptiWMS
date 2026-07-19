import { apiClient } from './client';

export type RecommendationStatus =
  | 'SAFE_TO_APPLY'
  | 'APPLY_WITH_APPROVAL'
  | 'HIGH_RISK_REVIEW'
  | 'INFEASIBLE'
  | 'DATA_INSUFFICIENT'
  | 'REJECTED'
  | 'APPROVED';

export interface PolicyRecommendationRun {
  id: string;
  warehouseId: string;
  horizonMonths: number;
  status: string;
  forecastModelName?: string | null;
  forecastRunId?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
  totalStockDelta: number;
  totalPalletPositionsDelta: number;
  estimatedHoldingCostDelta: number;
  highRiskCount: number;
  dataInsufficientCount: number;
  createdAt?: string | null;
}

export interface PolicyRecommendationLine {
  id: string;
  runId: string;
  materialId: string;
  materialCode: string;
  materialType?: string | null;
  currentStock: number;
  currentAvailableStock: number;
  currentMinStock?: number | null;
  currentMaxStock?: number | null;
  currentReorderPoint?: number | null;
  currentBufferStock?: number | null;
  currentOrderQty?: number | null;
  currentPalletRequirement?: number | null;
  forecastP10?: number | null;
  forecastP50?: number | null;
  forecastP90?: number | null;
  leadTimeDays?: number | null;
  leadTimeStdDays?: number | null;
  moq?: number | null;
  orderMultiple?: number | null;
  unitsPerHandlingUnit?: number | null;
  unitCost?: number | null;
  expiryLimitedMaxStock?: number | null;
  proposedMinStock?: number | null;
  proposedMaxStock?: number | null;
  proposedReorderPoint?: number | null;
  proposedTargetStock?: number | null;
  proposedOrderQty?: number | null;
  stockDelta: number;
  palletPositionsDelta: number;
  holdingCostDelta: number;
  stockoutRiskScore: number;
  expiryRiskScore: number;
  confidenceScore: number;
  recommendationStatus: RecommendationStatus;
  rationale?: string | null;
  constraintSnapshot?: string | null;
  approvalSnapshot?: string | null;
  managerOverride?: boolean;
  overrideReason?: string | null;
}

export interface SpaceOptimizationRun {
  id: string;
  warehouseId: string;
  policyRunId?: string | null;
  horizonMonths: number;
  status: string;
  algorithm: string;
  optimizerMetadata?: string | null;
  relocationCapPct?: number | null;
  relocationCapSkus?: number | null;
  objectiveValue?: number | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
  totalSpaceSavedPalletPositions: number;
  totalSpaceNeededPalletPositions: number;
  totalDistanceSavedMeters: number;
  infeasibleCount: number;
  highRiskCount: number;
  createdAt?: string | null;
}

export interface SpaceOptimizationLine {
  id: string;
  runId: string;
  materialId: string;
  sourcePolicyLineId?: string | null;
  materialCode: string;
  materialType?: string | null;
  currentPrimaryLocationCode?: string | null;
  recommendedPrimaryLocationCode?: string | null;
  recommendedReserveLocations?: string | null;
  releasedLocationCodes?: string | null;
  requiredActivePickPalletPositions: number;
  requiredReservePalletPositions: number;
  compatible: boolean;
  distanceSavedMeters: number;
  spaceSavedPalletPositions: number;
  spaceNeededPalletPositions: number;
  moveCostScore: number;
  recommendationStatus: RecommendationStatus;
  rationale?: string | null;
  constraintSnapshot?: string | null;
  managerOverride?: boolean;
  overrideReason?: string | null;
}

export interface ScenarioResult {
  id: string;
  policyLineId?: string | null;
  spaceLineId?: string | null;
  scenarioName: string;
  passed: boolean;
  riskScore: number;
  stockoutDaysEstimate: number;
  expiryExcessUnits: number;
  spaceShortfallPalletPositions: number;
  explanation?: string | null;
}

export interface PolicySimulationEvidence {
  id: string;
  policyRunId: string;
  materialId: string;
  serviceLevelTarget: number;
  simulatedFillRate: number;
  currentExpectedCost: number;
  proposedExpectedCost: number;
  expectedCostDelta: number;
  stockoutDaysCurrent: number;
  stockoutDaysProposed: number;
  capacityFeasible: boolean;
  simulationMethod: string;
  sourceLineage: string;
  createdAt?: string | null;
}

export interface ForecastSpaceReadiness {
  warehouseId: string;
  horizonMonths: number;
  materialType?: string | null;
  materialsTotalCount: number;
  forecastedMaterialsCount: number;
  forecastCoveragePct: number;
  inventoryMaterialsCount: number;
  inventoryCoveragePct: number;
  missingPalletSpecsCount: number;
  palletSpecCoveragePct: number;
  missingMoqCount: number;
  missingLeadTimeCount: number;
  unapprovedForecastMaterialsCount: number;
  ready: boolean;
  blockers: string[];
}

export const forecastSpaceApi = {
  getReadiness: (
    warehouseId: string,
    params: { horizonMonths?: number; materialType?: string } = {}
  ): Promise<ForecastSpaceReadiness> => {
    const query = new URLSearchParams({ warehouseId });
    if (params.horizonMonths) query.set('horizonMonths', String(params.horizonMonths));
    if (params.materialType) query.set('materialType', params.materialType);
    return apiClient.get<ForecastSpaceReadiness>(`/v1/forecast-space/readiness?${query.toString()}`);
  },

  createPolicyRun: (body: {
    warehouseId: string;
    horizonMonths?: number;
    materialType?: string;
    forecastModelName?: string;
    forecastRunId?: string;
    createdBy?: string;
    notes?: string;
  }): Promise<PolicyRecommendationRun> =>
    apiClient.post<PolicyRecommendationRun>('/v1/forecast-space/policy-runs', body),

  listPolicyRuns: (warehouseId: string): Promise<PolicyRecommendationRun[]> =>
    apiClient.get<PolicyRecommendationRun[]>(`/v1/forecast-space/policy-runs?warehouseId=${warehouseId}`),

  getPolicyRun: (runId: string): Promise<PolicyRecommendationRun> =>
    apiClient.get<PolicyRecommendationRun>(`/v1/forecast-space/policy-runs/${runId}`),

  getPolicyRunLines: (runId: string): Promise<PolicyRecommendationLine[]> =>
    apiClient.get<PolicyRecommendationLine[]>(`/v1/forecast-space/policy-runs/${runId}/lines`),

  getPolicySimulationEvidence: (runId: string): Promise<PolicySimulationEvidence[]> =>
    apiClient.get<PolicySimulationEvidence[]>(`/v1/forecast-space/policy-runs/${runId}/simulation-evidence`),

  approvePolicyRun: (runId: string, body: { approvedBy: string }): Promise<PolicyRecommendationRun> =>
    apiClient.post<PolicyRecommendationRun>(`/v1/forecast-space/policy-runs/${runId}/approve`, body),

  rollbackPolicyRun: (runId: string, body: { rolledBackBy: string }): Promise<PolicyRecommendationRun> =>
    apiClient.post<PolicyRecommendationRun>(`/v1/forecast-space/policy-runs/${runId}/rollback`, body),

  getPolicyLineScenarios: (lineId: string): Promise<ScenarioResult[]> =>
    apiClient.get<ScenarioResult[]>(`/v1/forecast-space/policy-lines/${lineId}/scenarios`),

  createSpaceRun: (body: {
    policyRunId: string;
    createdBy?: string;
    notes?: string;
  }): Promise<SpaceOptimizationRun> =>
    apiClient.post<SpaceOptimizationRun>('/v1/forecast-space/space-runs', body),

  listSpaceRuns: (warehouseId: string): Promise<SpaceOptimizationRun[]> =>
    apiClient.get<SpaceOptimizationRun[]>(`/v1/forecast-space/space-runs?warehouseId=${warehouseId}`),

  getSpaceRun: (runId: string): Promise<SpaceOptimizationRun> =>
    apiClient.get<SpaceOptimizationRun>(`/v1/forecast-space/space-runs/${runId}`),

  getSpaceRunLines: (runId: string): Promise<SpaceOptimizationLine[]> =>
    apiClient.get<SpaceOptimizationLine[]>(`/v1/forecast-space/space-runs/${runId}/lines`),

  approveSpaceRun: (runId: string, body: { approvedBy: string }): Promise<SpaceOptimizationRun> =>
    apiClient.post<SpaceOptimizationRun>(`/v1/forecast-space/space-runs/${runId}/approve`, body),

  getSpaceLineScenarios: (lineId: string): Promise<ScenarioResult[]> =>
    apiClient.get<ScenarioResult[]>(`/v1/forecast-space/space-lines/${lineId}/scenarios`),
};
