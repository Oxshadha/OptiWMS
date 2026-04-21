"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import {
  analyticsApi,
  WorkerProductivityMetrics,
  LeaderboardEntry,
} from "@/lib/api/analytics";
import { SummaryCards } from "@/components/SummaryCards";
import { Leaderboard } from "@/components/Leaderboard";
import { ProductivityChart } from "@/components/ProductivityChart";
import { Pagination } from "@/components/Pagination";
import { StatusChip } from "@/components/StatusChip";

export default function LaborProductivityPage() {
  const { hasPermission } = useAdmin();
  const canView = hasPermission(ADMIN_ROUTES.LABOR_PRODUCTIVITY, "view");

  const [selectedPeriod, setSelectedPeriod] = useState<"weekly" | "monthly">(
    "monthly",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const productivityQuery = useQuery({
    queryKey: ["admin-labor-productivity", selectedPeriod],
    queryFn: async () => {
      const [productivityData, leaderboardData] = await Promise.all([
        analyticsApi.getWorkerProductivity(
          undefined,
          undefined,
          undefined,
          selectedPeriod,
        ),
        analyticsApi.getWorkerLeaderboard(selectedPeriod),
      ]);

      return {
        productivityMetrics: productivityData,
        leaderboard: leaderboardData,
      };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 10 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPeriod]);

  // Extract data with defaults
  const productivityMetrics: WorkerProductivityMetrics[] =
    productivityQuery.data?.productivityMetrics || [];
  const leaderboard: LeaderboardEntry[] =
    productivityQuery.data?.leaderboard || [];
  const error =
    productivityQuery.error instanceof Error
      ? productivityQuery.error.message
      : productivityQuery.error
        ? "Failed to load labor productivity data"
        : null;

  // Compute summary - must be before any conditional returns
  const summary = useMemo(
    () => ({
      averagePPH:
        productivityMetrics.length > 0
          ? productivityMetrics.reduce(
              (sum, m) => sum + (m.picksPerHour ?? 0),
              0,
            ) / productivityMetrics.length
          : 0,
      averageDwellTime:
        productivityMetrics.length > 0
          ? productivityMetrics.reduce(
              (sum, m) => sum + (m.averageDwellTime ?? 0),
              0,
            ) / productivityMetrics.length
          : 0,
      averageErrorRate:
        productivityMetrics.length > 0
          ? productivityMetrics.reduce(
              (sum, m) => sum + (m.errorRate ?? 0),
              0,
            ) / productivityMetrics.length
          : 0,
      totalTasksCompleted: productivityMetrics.reduce(
        (sum, m) => sum + (m.tasksCompleted ?? 0),
        0,
      ),
      topPerformer: leaderboard.length > 0 ? leaderboard[0].workerName : "N/A",
    }),
    [leaderboard, productivityMetrics],
  );

  const pagedMetrics = productivityMetrics.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const totalPages = Math.max(
    Math.ceil(productivityMetrics.length / itemsPerPage),
    1,
  );

  // Early returns after all hooks
  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg text-base-content/60">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  if (productivityQuery.isPending && !productivityQuery.data) {
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
        <button
          className="btn btn-sm"
          onClick={() => void productivityQuery.refetch()}
        >
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
  const pagedMetrics = productivityMetrics.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.max(Math.ceil(productivityMetrics.length / itemsPerPage), 1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Labor Productivity
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Track worker performance, productivity metrics, and identify
            improvement opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="select select-bordered select-sm"
            value={selectedPeriod}
            onChange={(e) =>
              setSelectedPeriod(e.target.value as "weekly" | "monthly")
            }
            disabled={productivityQuery.isFetching && !productivityQuery.data}
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
          <div className="overflow-x-auto overflow-y-auto max-h-[32rem] mt-4">
            <table className="table table-zebra">
              <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
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
                {pagedMetrics.map((metric) => (
                  <tr key={metric.workerId}>
                    <td className="font-semibold">{metric.workerName}</td>
                    <td>
                      <span className="font-bold text-primary">
                        {(metric.picksPerHour ?? 0).toFixed(1)}
                      </span>
                    </td>
                    <td>{metric.tasksCompleted ?? 0}</td>
                    <td>{(metric.totalPicks ?? 0).toLocaleString()}</td>
                    <td>{(metric.averageDwellTime ?? 0).toFixed(1)} min</td>
                    <td>
                      <StatusChip
                        label={`${(metric.errorRate ?? 0).toFixed(2)}%`}
                        tone={
                          (metric.errorRate ?? 0) < 1
                            ? "success"
                            : (metric.errorRate ?? 0) < 3
                              ? "warning"
                              : "danger"
                        }
                        showDot
                      />
                    </td>
                    <td>
                      <StatusChip
                        label={`${(metric.onTimeCompletionRate ?? 0).toFixed(1)}%`}
                        tone="success"
                      />
                    </td>
                  </tr>
                ))}
                {pagedMetrics.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-8 text-base-content/60"
                    >
                      No productivity data found for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={productivityMetrics.length}
            showItemsPerPage
            onItemsPerPageChange={(next) => {
              setItemsPerPage(next);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
