"use client";

import { useState, useEffect } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { analyticsApi, WorkerProductivityMetrics, LeaderboardEntry } from "@/lib/api/analytics";
import { SummaryCards } from "@/components/SummaryCards";
import { Leaderboard } from "@/components/Leaderboard";
import { ProductivityChart } from "@/components/ProductivityChart";

// Mock data - will be replaced with API calls
const mockProductivityMetrics: WorkerProductivityMetrics[] = [
  {
    workerId: "w-1",
    workerName: "John Smith",
    period: "2025-12",
    picksPerHour: 45.2,
    averageDwellTime: 8.5,
    errorRate: 0.5,
    tasksCompleted: 120,
    totalPicks: 5424,
    totalHours: 120,
    onTimeCompletionRate: 98.5,
  },
  {
    workerId: "w-2",
    workerName: "Jane Doe",
    period: "2025-12",
    picksPerHour: 52.8,
    averageDwellTime: 6.2,
    errorRate: 0.2,
    tasksCompleted: 145,
    totalPicks: 7656,
    totalHours: 145,
    onTimeCompletionRate: 99.2,
  },
  {
    workerId: "w-3",
    workerName: "Mike Johnson",
    period: "2025-12",
    picksPerHour: 38.5,
    averageDwellTime: 12.3,
    errorRate: 1.8,
    tasksCompleted: 98,
    totalPicks: 3773,
    totalHours: 98,
    onTimeCompletionRate: 95.0,
  },
];

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

export default function LaborProductivityPage() {
  const { hasPermission, role } = useAdmin();
  const canView = hasPermission(ADMIN_ROUTES.LABOR_PRODUCTIVITY, "view");

  const [productivityMetrics, setProductivityMetrics] = useState<WorkerProductivityMetrics[]>(mockProductivityMetrics);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(mockLeaderboard);
  const [selectedPeriod, setSelectedPeriod] = useState<"weekly" | "monthly">("weekly");
  const [selectedMetric, setSelectedMetric] = useState<"picksPerHour" | "errorRate" | "dwellTime">("picksPerHour");

  // Load data (will use API when backend is ready)
  useEffect(() => {
    // TODO: Replace with actual API calls
    // analyticsApi.getWorkerProductivity().then(setProductivityMetrics);
    // analyticsApi.getWorkerLeaderboard(selectedPeriod).then(setLeaderboard);
  }, [selectedPeriod]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg text-base-content/60">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const summary = {
    averagePPH: productivityMetrics.length > 0
      ? productivityMetrics.reduce((sum, m) => sum + m.picksPerHour, 0) / productivityMetrics.length
      : 0,
    averageDwellTime: productivityMetrics.length > 0
      ? productivityMetrics.reduce((sum, m) => sum + m.averageDwellTime, 0) / productivityMetrics.length
      : 0,
    averageErrorRate: productivityMetrics.length > 0
      ? productivityMetrics.reduce((sum, m) => sum + m.errorRate, 0) / productivityMetrics.length
      : 0,
    totalTasksCompleted: productivityMetrics.reduce((sum, m) => sum + m.tasksCompleted, 0),
    topPerformer: leaderboard.length > 0 ? leaderboard[0].workerName : "N/A",
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Labor Productivity</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Track worker performance, productivity metrics, and identify improvement opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="select select-bordered select-sm"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as "weekly" | "monthly")}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards
        cards={[
          {
            title: "Average PPH",
            value: summary.averagePPH.toFixed(1),
            icon: "trending_up",
            trend: null,
          },
          {
            title: "Avg Dwell Time",
            value: `${summary.averageDwellTime.toFixed(1)} min`,
            icon: "schedule",
            trend: null,
          },
          {
            title: "Avg Error Rate",
            value: `${summary.averageErrorRate.toFixed(2)}%`,
            icon: "error_outline",
            trend: null,
          },
          {
            title: "Total Tasks",
            value: summary.totalTasksCompleted.toString(),
            icon: "task",
            trend: null,
          },
          {
            title: "Top Performer",
            value: summary.topPerformer,
            icon: "emoji_events",
            trend: null,
          },
        ]}
      />

      {/* Leaderboard */}
      <Leaderboard entries={leaderboard} showBadges={true} maxEntries={10} />

      {/* Productivity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ProductivityChart
          metrics={productivityMetrics}
          metricType="picksPerHour"
          title="Picks Per Hour (PPH)"
        />
        <ProductivityChart
          metrics={productivityMetrics}
          metricType="errorRate"
          title="Error Rate (%)"
        />
        <ProductivityChart
          metrics={productivityMetrics}
          metricType="dwellTime"
          title="Average Dwell Time (min)"
        />
      </div>

      {/* Detailed Metrics Table */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-xl">Detailed Worker Metrics</h2>
          <div className="overflow-x-auto mt-4">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>PPH</th>
                  <th>Tasks Completed</th>
                  <th>Total Picks</th>
                  <th>Dwell Time</th>
                  <th>Error Rate</th>
                  <th>On-Time Rate</th>
                </tr>
              </thead>
              <tbody>
                {productivityMetrics.map((metric) => (
                  <tr key={metric.workerId}>
                    <td className="font-semibold">{metric.workerName}</td>
                    <td>
                      <span className="font-bold text-primary">{metric.picksPerHour.toFixed(1)}</span>
                    </td>
                    <td>{metric.tasksCompleted}</td>
                    <td>{metric.totalPicks.toLocaleString()}</td>
                    <td>{metric.averageDwellTime.toFixed(1)} min</td>
                    <td>
                      <span
                        className={`badge ${
                          metric.errorRate < 1
                            ? "badge-success"
                            : metric.errorRate < 3
                            ? "badge-warning"
                            : "badge-error"
                        }`}
                      >
                        {metric.errorRate.toFixed(2)}%
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success badge-sm">
                        {metric.onTimeCompletionRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

