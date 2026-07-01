import { apiClient } from './client';

export interface ActionItem {
  type: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  href: string;
  createdAt?: string | null;
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
  pendingSpaceRuns: number;
  draftSlottingPlans: number;
  latestPolicyStatus: string;
  latestSpaceStatus: string;
  latestSlottingStatus: string;
  totalStockDelta: number;
  totalPalletDelta: number;
  totalSpaceSavedPalletPositions: number;
  totalSpaceNeededPalletPositions: number;
  totalMovesProposed: number;
  actionItems: ActionItem[];
  solverGuidance: SolverGuidance;
}

export const intelligenceApi = {
  getActionCenter: (warehouseId: string): Promise<ActionCenterSummary> =>
    apiClient.get<ActionCenterSummary>(`/v1/intelligence/action-center?warehouseId=${warehouseId}`),
};
