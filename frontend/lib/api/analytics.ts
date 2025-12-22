import { apiClient } from './client';

// Worker Productivity Metrics
export interface WorkerProductivityMetrics {
  workerId: string;
  workerName: string;
  period: string;
  picksPerHour: number;
  averageDwellTime: number; // minutes
  errorRate: number; // percentage
  tasksCompleted: number;
  totalPicks: number;
  totalHours: number;
  onTimeCompletionRate: number; // percentage
}

export interface DwellTimeAnalysis {
  workerId: string;
  workerName: string;
  averageDwellTime: number; // minutes
  maxDwellTime: number;
  minDwellTime: number;
  dwellTimeDistribution: Array<{
    timeRange: string;
    count: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  workerId: string;
  workerName: string;
  role: string;
  score: number;
  picksPerHour: number;
  tasksCompleted: number;
  errorRate: number;
  badge?: string;
  trend: 'up' | 'down' | 'stable';
}

// Location Velocity
export interface LocationVelocity {
  locationId: string;
  locationCode: string;
  rackId: string;
  warehouseId: string;
  pickCount: number;
  putawayCount: number;
  totalMovements: number;
  velocityPercentage: number; // 0-100
  last7Days: number;
  last30Days: number;
}

export const analyticsApi = {
  // Worker Productivity
  getWorkerProductivity: async (
    workerId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<WorkerProductivityMetrics[]> => {
    const params = new URLSearchParams();
    if (workerId) params.append('workerId', workerId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<WorkerProductivityMetrics[]>(`/analytics/worker-productivity${query}`);
  },

  getWorkerLeaderboard: async (
    period: 'weekly' | 'monthly' = 'weekly'
  ): Promise<LeaderboardEntry[]> => {
    return apiClient.get<LeaderboardEntry[]>(`/analytics/worker-leaderboard?period=${period}`);
  },

  getDwellTimeAnalysis: async (workerId?: string): Promise<DwellTimeAnalysis[]> => {
    const params = workerId ? `?workerId=${workerId}` : '';
    return apiClient.get<DwellTimeAnalysis[]>(`/analytics/dwell-time${params}`);
  },

  // Location Velocity
  getLocationVelocity: async (
    warehouseId: string,
    startDate?: string,
    endDate?: string
  ): Promise<LocationVelocity[]> => {
    const params = new URLSearchParams();
    params.append('warehouseId', warehouseId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return apiClient.get<LocationVelocity[]>(`/analytics/location-velocity?${params.toString()}`);
  },
};

