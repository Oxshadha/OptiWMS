"use client";

import { useState, useEffect } from "react";
import { useWorker } from "@/contexts/WorkerContext";
import { analyticsApi, LeaderboardEntry } from "@/lib/api/analytics";
import { Leaderboard } from "@/components/Leaderboard";
import { workerAchievementsApi, WorkerAchievement } from "@/lib/api/workerAchievements";

// Achievement type configuration
const achievementConfig: Record<string, { name: string; description: string; icon: string }> = {
  speed_demon: { name: "Speed Demon", description: "Achieved 50+ PPH", icon: "bolt" },
  perfect_week: { name: "Perfect Week", description: "Zero errors for a week", icon: "star" },
  century_club: { name: "Century Club", description: "100+ tasks completed", icon: "emoji_events" },
  early_bird: { name: "Early Bird", description: "Complete 10 tasks before 10 AM", icon: "wb_twilight" },
  night_owl: { name: "Night Owl", description: "Complete 10 tasks after 8 PM", icon: "nightlight" },
};

export default function LeaderboardPage() {
  const { worker } = useWorker();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<"weekly" | "monthly">("weekly");
  const [myRank, setMyRank] = useState<number | null>(null);
  const [achievements, setAchievements] = useState<WorkerAchievement[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState(true);

  // Load data from API
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLoading(true);
        const data = await analyticsApi.getWorkerLeaderboard(selectedPeriod);
        setLeaderboard(data);
        if (worker) {
          const rank = data.findIndex((entry) => entry.workerId === worker.id);
          setMyRank(rank >= 0 ? rank + 1 : null);
        }
      } catch (error) {
        console.error("Error loading leaderboard:", error);
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    };
    loadLeaderboard();
  }, [selectedPeriod, worker]);

  // Load achievements from API
  useEffect(() => {
    const loadAchievements = async () => {
      if (!worker?.id) {
        setLoadingAchievements(false);
        return;
      }
      try {
        setLoadingAchievements(true);
        const data = await workerAchievementsApi.getByWorkerId(worker.id);
        setAchievements(data);
      } catch (error) {
        console.error("Error loading achievements:", error);
        setAchievements([]);
      } finally {
        setLoadingAchievements(false);
      }
    };
    loadAchievements();
  }, [worker?.id]);

  const myEntry = worker ? leaderboard.find((entry) => entry.workerId === worker.id) : null;

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Leaderboard</h1>
          <p className="text-sm text-base-content/60 mt-1">See how you rank against your colleagues</p>
        </div>
        <select
          className="select select-bordered select-sm"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value as "weekly" | "monthly")}
        >
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
        </select>
      </div>

      {/* My Ranking Card */}
      {myEntry && (
        <div className="card bg-primary text-primary-content shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="card-title">Your Ranking</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-3xl font-bold">#{myEntry.rank}</span>
                  {myEntry.rank <= 3 && (
                    <span className="material-symbols-outlined text-4xl text-warning">
                      {myEntry.rank === 1 ? "looks_one" : myEntry.rank === 2 ? "looks_two" : "looks_3"}
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>PPH:</span>
                    <span className="font-bold">{(myEntry.picksPerHour ?? 0).toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tasks:</span>
                    <span className="font-bold">{myEntry.tasksCompleted ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Error Rate:</span>
                    <span className="font-bold">{(myEntry.errorRate ?? 0).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              {myEntry.badge && (
                <div className="text-right">
                  <div className="badge badge-warning badge-lg">{myEntry.badge}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <Leaderboard entries={leaderboard} showBadges={true} maxEntries={20} />

      {/* Achievements */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-xl">Achievements</h2>
          {loadingAchievements ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {Object.entries(achievementConfig).map(([type, config]) => {
                const earned = achievements.some(a => a.achievementType === type);
                return (
                  <div
                    key={type}
                    className={`
                      border rounded-lg p-4 text-center
                      ${earned ? "border-primary bg-primary/10" : "border-base-300 opacity-50"}
                    `}
                  >
                    <div className="mb-2">
                      <span className={`material-symbols-outlined text-5xl ${earned ? "text-primary" : "text-base-content/30"}`}>
                        {config.icon}
                      </span>
                    </div>
                    <h3 className="font-bold">{config.name}</h3>
                    <p className="text-xs text-base-content/60 mt-1">{config.description}</p>
                    {earned && (
                      <span className="badge badge-success badge-sm mt-2">Earned</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

