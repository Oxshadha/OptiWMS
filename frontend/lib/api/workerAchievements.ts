import { apiClient } from './client';

export interface WorkerAchievement {
  id: string;
  workerId: string;
  achievementType: string; // speed_demon, perfect_week, century_club, early_bird, night_owl, etc.
  earnedAt: string;
  metadata?: string; // JSON string
}

export interface CreateWorkerAchievementRequest {
  achievementType: string;
  metadata?: string; // JSON string
}

export const workerAchievementsApi = {
  getByWorkerId: async (workerId: string, achievementType?: string): Promise<WorkerAchievement[]> => {
    const params = new URLSearchParams();
    if (achievementType) params.append('achievementType', achievementType);
    const query = params.toString();
    return apiClient.get<WorkerAchievement[]>(`/workers/${workerId}/achievements${query ? `?${query}` : ''}`);
  },

  create: async (workerId: string, request: CreateWorkerAchievementRequest): Promise<WorkerAchievement> => {
    return apiClient.post<WorkerAchievement>(`/workers/${workerId}/achievements`, request);
  },
};

