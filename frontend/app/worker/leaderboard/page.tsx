"use client";

import { useState, useEffect } from "react";
import { useWorker } from "@/contexts/WorkerContext";
import { analyticsApi, LeaderboardEntry } from "@/lib/api/analytics";
import { Leaderboard } from "@/components/Leaderboard";

// Mock data - will be replaced with API calls
const mockLeaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    workerId: "w-2",
    workerName: "Jane Doe",
    role: "Picker",
    score: 95,
    picksPerHour: 52.8,
    tasksCompleted: 145,
    errorRate: 0.2,
    badge: "Top Performer",
    trend: "up",
  },
  {
    rank: 2,
    workerId: "w-1",
    workerName: "John Smith",
    role: "Picker",
    score: 88,
    picksPerHour: 45.2,
    tasksCompleted: 120,
    errorRate: 0.5,
    badge: "Speed Demon",
    trend: "stable",
  },
  {
    rank: 3,
    workerId: "w-4",
    workerName: "Sarah Williams",
    role: "Picker",
    score: 82,
    picksPerHour: 42.1,
    tasksCompleted: 115,
    errorRate: 0.8,
    trend: "up",
  },
  {
    rank: 4,
    workerId: "w-3",
    workerName: "Mike Johnson",
    role: "Picker",
    score: 72,
    picksPerHour: 38.5,
    tasksCompleted: 98,
    errorRate: 1.8,
    trend: "down",
  },
];

const mockAchievements = [
  { id: "ach-1", name: "Speed Demon", description: "Achieved 50+ PPH", icon: "⚡", earned: true },
  { id: "ach-2", name: "Perfect Week", description: "Zero errors for a week", icon: "⭐", earned: true },
  { id: "ach-3", name: "Century Club", description: "100+ tasks completed", icon: "🏆", earned: true },
  { id: "ach-4", name: "Early Bird", description: "Complete 10 tasks before 10 AM", icon: "🌅", earned: false },
  { id: "ach-5", name: "Night Owl", description: "Complete 10 tasks after 8 PM", icon: "🦉", earned: false },
];

export default function LeaderboardPage() {
  const { worker } = useWorker();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(mockLeaderboard);
  const [selectedPeriod, setSelectedPeriod] = useState<"weekly" | "monthly">("weekly");
  const [myRank, setMyRank] = useState<number | null>(null);

  // Load data (will use API when backend is ready)
  useEffect(() => {
    // TODO: Replace with actual API calls
    // analyticsApi.getWorkerLeaderboard(selectedPeriod).then(setLeaderboard);
    if (worker) {
      const rank = leaderboard.findIndex((entry) => entry.workerId === worker.id);
      setMyRank(rank >= 0 ? rank + 1 : null);
    }
  }, [selectedPeriod, worker]);

  const myEntry = worker ? leaderboard.find((entry) => entry.workerId === worker.id) : null;

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
                <p className="text-3xl font-bold mt-2">
                  #{myEntry.rank}
                  {myEntry.rank <= 3 && (
                    <span className="ml-2 text-4xl">
                      {myEntry.rank === 1 ? "🥇" : myEntry.rank === 2 ? "🥈" : "🥉"}
                    </span>
                  )}
                </p>
                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>PPH:</span>
                    <span className="font-bold">{myEntry.picksPerHour.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tasks:</span>
                    <span className="font-bold">{myEntry.tasksCompleted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Error Rate:</span>
                    <span className="font-bold">{myEntry.errorRate.toFixed(1)}%</span>
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {mockAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`
                  border rounded-lg p-4 text-center
                  ${achievement.earned ? "border-primary bg-primary/10" : "border-base-300 opacity-50"}
                `}
              >
                <div className="text-4xl mb-2">{achievement.icon}</div>
                <h3 className="font-bold">{achievement.name}</h3>
                <p className="text-xs text-base-content/60 mt-1">{achievement.description}</p>
                {achievement.earned && (
                  <span className="badge badge-success badge-sm mt-2">Earned</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

