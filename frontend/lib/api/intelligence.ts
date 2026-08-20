import { apiClient } from './client';

export interface ActionItem {
  sourceId?: string | null;
  type: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  href: string;
  createdAt?: string | null;
  sourceStatus?: string | null;
  canApprove: boolean;
  blockedReason?: string | null;
  affectedCount: number;
  /** Set when the action was snoozed; it is still returned so the UI can explain the pause. */
  deferredUntil?: string | null;
}

export interface SolverGuidance {
  inboundOrderMode: string;
  policySpaceMode: string;
  slottingPlanMode: string;
  advancedSolverMode: string;
}

export interface ActionCenterSummary {
  warehouseId: string;
  pendingPolicyRuns: number;
  inventoryChanges: number;
  suggestedPurchases: number;
  pendingSpaceRuns: number;
  draftSlottingPlans: number;
  draftPurchaseSuggestions: number;
  stockoutExposure: number;
  excessInventoryValue: number;
  scheduledMoves: number;
  estimatedTravelReductionMeters: number;
  confirmedTravelReductionMeters: number;
  latestPolicyStatus: string;
  latestSpaceStatus: string;
  latestSlottingStatus: string;
  latestSlottingExecutionStatus: string;
  totalStockDelta: number;
  totalPalletDelta: number;
  totalSpaceSavedPalletPositions: number;
  totalSpaceNeededPalletPositions: number;
  totalMovesProposed: number;
  actionItems: ActionItem[];
  solverGuidance: SolverGuidance;
}

export const intelligenceApi = {
  getWorkspace: (warehouseId: string): Promise<ActionCenterSummary> =>
    apiClient.get<ActionCenterSummary>(`/v1/intelligence/workspace?warehouseId=${warehouseId}`),

  getActionCenter: (warehouseId: string): Promise<ActionCenterSummary> =>
    apiClient.get<ActionCenterSummary>(`/v1/intelligence/workspace?warehouseId=${warehouseId}`),

  getDecisions: (warehouseId: string): Promise<DecisionEvent[]> =>
    apiClient.get<DecisionEvent[]>(`/v1/intelligence/decisions?warehouseId=${warehouseId}`),

  approve: (id: string, body: DecisionRequest): Promise<DecisionResult> =>
    apiClient.post<DecisionResult>(`/v1/intelligence/recommendations/${id}/approve`, body),

  defer: (id: string, body: DecisionRequest): Promise<DecisionResult> =>
    apiClient.post<DecisionResult>(`/v1/intelligence/recommendations/${id}/defer`, body),

  reject: (id: string, body: DecisionRequest): Promise<DecisionResult> =>
    apiClient.post<DecisionResult>(`/v1/intelligence/recommendations/${id}/reject`, body),

  schedule: (id: string, body: DecisionRequest): Promise<DecisionResult> =>
    apiClient.post<DecisionResult>(`/v1/intelligence/recommendations/${id}/schedule`, body),
};

export interface DecisionRequest {
  type: string;
  warehouseId: string;
  actor?: string;
  reason?: string;
  scheduledFor?: string;
}

export interface DecisionResult {
  id: string;
  type: string;
  status: string;
  planningCycleId?: string | null;
  asOf: string;
}

export interface DecisionEvent {
  id: string;
  planningCycleId?: string | null;
  recommendationId: string;
  recommendationType: string;
  action: 'APPROVED' | 'DEFERRED' | 'REJECTED' | 'SCHEDULED' | string;
  actor: string;
  reason?: string | null;
  deferredUntil?: string | null;
  previousStatus?: string | null;
  newStatus: string;
  createdAt: string;
}
