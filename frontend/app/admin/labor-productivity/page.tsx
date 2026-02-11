"use client";

import { useState, useEffect } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { analyticsApi, WorkerProductivityMetrics, LeaderboardEntry } from "@/lib/api/analytics";
import { SummaryCards } from "@/components/SummaryCards";
import { Leaderboard } from "@/components/Leaderboard";
import { ProductivityChart } from "@/components/ProductivityChart";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

export default function LaborProductivityPage() {
  const { hasPermission } = useAdmin();
  const canView = hasPermission(ADMIN_ROUTES.LABOR_PRODUCTIVITY, "view");

  const [productivityMetrics, setProductivityMetrics] = useState<WorkerProductivityMetrics[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<"weekly" | "monthly">("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [productivityData, leaderboardData] = await Promise.all([
        analyticsApi.getWorkerProductivity(undefined, undefined, undefined, selectedPeriod),
        analyticsApi.getWorkerLeaderboard(selectedPeriod),
      ]);
      setProductivityMetrics(productivityData);
      setLeaderboard(leaderboardData);
    } catch (err) {
      logger.error("Failed to load labor productivity data:", err);
      const message =
        err instanceof Error ? err.message : "Failed to load labor productivity data";
      setError(message);
      setProductivityMetrics([]);
      setLeaderboard([]);
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(interval);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error && productivityMetrics.length === 0 && leaderboard.length === 0) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading labor productivity data: {error}</span>
        <button className="btn btn-sm" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

  const summary = {
    averagePPH: productivityMetrics.length > 0
      ? productivityMetrics.reduce((sum, m) => sum + (m.picksPerHour ?? 0), 0) / productivityMetrics.length
      : 0,
    averageDwellTime: productivityMetrics.length > 0
      ? productivityMetrics.reduce((sum, m) => sum + (m.averageDwellTime ?? 0), 0) / productivityMetrics.length
      : 0,
    averageErrorRate: productivityMetrics.length > 0
      ? productivityMetrics.reduce((sum, m) => sum + (m.errorRate ?? 0), 0) / productivityMetrics.length
      : 0,
    totalTasksCompleted: productivityMetrics.reduce((sum, m) => sum + (m.tasksCompleted ?? 0), 0),
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
            label: "Average PPH",
            value: summary.averagePPH.toFixed(1),
            icon: "trending_up",
          },
          {
            label: "Avg Dwell Time",
            value: `${summary.averageDwellTime.toFixed(1)} min`,
            icon: "schedule",
          },
          {
            label: "Avg Error Rate",
            value: `${summary.averageErrorRate.toFixed(2)}%`,
            icon: "error_outline",
          },
          {
            label: "Total Tasks",
            value: summary.totalTasksCompleted.toString(),
            icon: "task",
          },
          {
            label: "Top Performer",
            value: summary.topPerformer,
            icon: "emoji_events",
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
                      <span className="font-bold text-primary">{(metric.picksPerHour ?? 0).toFixed(1)}</span>
                    </td>
                    <td>{metric.tasksCompleted ?? 0}</td>
                    <td>{(metric.totalPicks ?? 0).toLocaleString()}</td>
                    <td>{(metric.averageDwellTime ?? 0).toFixed(1)} min</td>
                    <td>
                      <span
                        className={`badge ${
                          (metric.errorRate ?? 0) < 1
                            ? "badge-success"
                            : (metric.errorRate ?? 0) < 3
                            ? "badge-warning"
                            : "badge-error"
                        }`}
                      >
                        {(metric.errorRate ?? 0).toFixed(2)}%
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success badge-sm">
                        {(metric.onTimeCompletionRate ?? 0).toFixed(1)}%
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
