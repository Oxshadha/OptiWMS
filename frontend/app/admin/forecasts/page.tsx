"use client";

import { useEffect, useMemo, useState } from "react";
import {
  aiForecastApi,
  type ForecastMetric,
  type ForecastPoint,
  type InventoryRecommendation,
} from "@/lib/api/ai-forecast";
import { useAdmin } from "@/contexts/AdminContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { logger } from "@/lib/utils/logger";

const DATASET_OPTIONS = ["A", "B", "C"];
const MODEL_OPTIONS = ["CATBOOST", "XGBOOST", "SARIMA", "ARIMA", "ETS", "NBEATS", "TFT"];

type Filters = {
  dataset: string;
  model: string;
  horizon?: number;
  sku?: string;
  split: string;
  warehouseId?: string;
};

function downloadCsv<T extends object>(filename: string, rows: T[]) {
  if (!rows.length) {
    return;
  }
  const headers = Object.keys(rows[0]) as Array<keyof T>;
  const esc = (value: unknown) => {
    const raw = value === null || value === undefined ? "" : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
  };
  const body = rows.map((row) => headers.map((h) => esc(row[h])).join(",")).join("\n");
  const csv = `${headers.join(",")}\n${body}`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ForecastsPage() {
  const { role, admin } = useAdmin();
  const isAdmin = role === "admin";

  const [filters, setFilters] = useState<Filters>({
    dataset: "B",
    model: "CATBOOST",
    split: "test",
    warehouseId: "",
  });
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<ForecastPoint[]>([]);
  const [metrics, setMetrics] = useState<ForecastMetric[]>([]);
  const [recommendations, setRecommendations] = useState<InventoryRecommendation[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [showModelPerformance, setShowModelPerformance] = useState(false);

  const effectiveWarehouseId = isAdmin
    ? filters.warehouseId || undefined
    : admin?.warehouseId || undefined;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [forecastRes, metricRes, recoRes] = await Promise.all([
        aiForecastApi.getForecasts({
          dataset: filters.dataset,
          model: filters.model,
          horizon: filters.horizon,
          sku: filters.sku,
          warehouseId: effectiveWarehouseId,
        }),
        aiForecastApi.getForecastMetrics({
          dataset: filters.dataset,
          model: filters.model,
          horizon: filters.horizon,
          split: filters.split,
          warehouseId: effectiveWarehouseId,
        }),
        aiForecastApi.getInventoryRecommendations({
          dataset: filters.dataset,
          model: filters.model,
          sku: filters.sku,
          warehouseId: effectiveWarehouseId,
        }),
      ]);
      setForecasts(forecastRes.items ?? []);
      setMetrics(metricRes.items ?? []);
      setRecommendations(recoRes.items ?? []);
      setLastLoadedAt(new Date().toISOString());
    } catch (loadError) {
      logger.error("[ForecastsPage] Failed to load forecast data:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load forecast data");
    } finally {
      setLoading(false);
    }
  };

  const triggerRun = async () => {
    try {
      setTriggering(true);
      setError(null);
      await aiForecastApi.triggerForecastRun({
        dataset: filters.dataset,
        modelName: filters.model,
        warehouseId: effectiveWarehouseId,
      });
      await loadData();
    } catch (triggerError) {
      logger.error("[ForecastsPage] Failed to trigger forecast run:", triggerError);
      setError(triggerError instanceof Error ? triggerError.message : "Failed to trigger forecast run");
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const latestRunId = useMemo(() => {
    if (!forecasts.length) {
      return undefined;
    }
    return Math.max(...forecasts.map((f) => f.run_id));
  }, [forecasts]);

  const latestForecasts = useMemo(
    () => forecasts.filter((f) => !latestRunId || f.run_id === latestRunId),
    [forecasts, latestRunId]
  );

  const horizonChartData = useMemo(() => {
    const grouped = new Map<number, { horizon: number; p50Sum: number; p90Sum: number; count: number }>();
    for (const row of latestForecasts) {
      const item = grouped.get(row.horizon) ?? { horizon: row.horizon, p50Sum: 0, p90Sum: 0, count: 0 };
      item.p50Sum += row.p50;
      item.p90Sum += row.p90;
      item.count += 1;
      grouped.set(row.horizon, item);
    }
    return Array.from(grouped.values())
      .sort((a, b) => a.horizon - b.horizon)
      .map((item) => ({
        horizon: `M+${item.horizon}`,
        p50: Math.round(item.p50Sum / item.count),
        p90: Math.round(item.p90Sum / item.count),
      }));
  }, [latestForecasts]);

  const monthlyTrendData = useMemo(() => {
    const grouped = new Map<string, { month: string; p50Sum: number; p10Sum: number; p90Sum: number; count: number }>();
    for (const row of latestForecasts) {
      const monthKey = String(row.month);
      const item = grouped.get(monthKey) ?? { month: monthKey, p50Sum: 0, p10Sum: 0, p90Sum: 0, count: 0 };
      item.p50Sum += row.p50;
      item.p10Sum += row.p10;
      item.p90Sum += row.p90;
      item.count += 1;
      grouped.set(monthKey, item);
    }
    return Array.from(grouped.values())
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((item) => ({
        month: item.month,
        p10: Math.round(item.p10Sum / item.count),
        p50: Math.round(item.p50Sum / item.count),
        p90: Math.round(item.p90Sum / item.count),
      }));
  }, [latestForecasts]);

  const avgWape = useMemo(() => {
    const values = metrics
      .map((m) => m.WAPE)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) {
      return null;
    }
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [metrics]);

  const avgRmse = useMemo(() => {
    const values = metrics
      .map((m) => m.RMSE)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) {
      return null;
    }
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [metrics]);

  const avgActualDemand = useMemo(() => {
    const values = latestForecasts
      .map((row) => row.y_true)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) {
      return null;
    }
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [latestForecasts]);

  const normalizedRmse = useMemo(() => {
    if (avgRmse === null || avgActualDemand === null || avgActualDemand === 0) {
      return null;
    }
    return (avgRmse / avgActualDemand) * 100;
  }, [avgActualDemand, avgRmse]);

  const reorderNowCount = useMemo(
    () =>
      recommendations.filter(
        (row) =>
          row.on_hand_inventory !== null &&
          row.on_hand_inventory !== undefined &&
          row.on_hand_inventory < row.reorder_point
      ).length,
    [recommendations]
  );

  const overstockCount = useMemo(
    () =>
      recommendations.filter(
        (row) =>
          row.on_hand_inventory !== null &&
          row.on_hand_inventory !== undefined &&
          row.on_hand_inventory > row.target_max
      ).length,
    [recommendations]
  );

  const coveredSkuCount = useMemo(
    () =>
      recommendations.filter(
        (row) =>
          row.on_hand_inventory !== null &&
          row.on_hand_inventory !== undefined &&
          row.on_hand_inventory >= row.target_max
      ).length,
    [recommendations]
  );

  const totalSuggestedQty = useMemo(
    () => recommendations.reduce((sum, row) => sum + row.suggested_order_qty, 0),
    [recommendations]
  );

  const topReorderItems = useMemo(
    () =>
      [...recommendations]
        .sort((a, b) => b.suggested_order_qty - a.suggested_order_qty)
        .slice(0, 8),
    [recommendations]
  );

  const metricsByHorizon = useMemo(
    () => [...metrics].sort((a, b) => a.horizon - b.horizon),
    [metrics]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Demand Forecasting</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Multi-horizon forecast, model metrics, and inventory recommendations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="join mr-2">
              <button
                className={`btn btn-sm join-item ${!showModelPerformance ? "btn-secondary" : "btn-outline"}`}
                onClick={() => setShowModelPerformance(false)}
              >
                Decision View
              </button>
              <button
                className={`btn btn-sm join-item ${showModelPerformance ? "btn-secondary" : "btn-outline"}`}
                onClick={() => setShowModelPerformance(true)}
              >
                Model Performance
              </button>
            </div>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => void loadData()} disabled={loading}>
            {loading ? "Loading..." : "Reload"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => void triggerRun()} disabled={triggering}>
            {triggering ? "Triggering..." : "Trigger Run"}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <span>{error}</span>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <label className="form-control">
            <span className="label-text text-xs">Dataset</span>
            <select
              className="select select-bordered select-sm"
              value={filters.dataset}
              onChange={(e) => setFilters((prev) => ({ ...prev, dataset: e.target.value }))}
            >
              {DATASET_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Model</span>
            <select
              className="select select-bordered select-sm"
              value={filters.model}
              onChange={(e) => setFilters((prev) => ({ ...prev, model: e.target.value }))}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Horizon</span>
            <select
              className="select select-bordered select-sm"
              value={filters.horizon ?? ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  horizon: e.target.value ? Number.parseInt(e.target.value, 10) : undefined,
                }))
              }
            >
              <option value="">All</option>
              {Array.from({ length: 12 }).map((_, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {idx + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text text-xs">SKU</span>
            <input
              className="input input-bordered input-sm"
              placeholder="Optional"
              value={filters.sku ?? ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, sku: e.target.value || undefined }))}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Split</span>
            <select
              className="select select-bordered select-sm"
              value={filters.split}
              onChange={(e) => setFilters((prev) => ({ ...prev, split: e.target.value }))}
            >
              <option value="test">test</option>
              <option value="cv">cv</option>
              <option value="train">train</option>
            </select>
          </label>
          {isAdmin ? (
            <label className="form-control">
              <span className="label-text text-xs">Warehouse ID</span>
              <input
                className="input input-bordered input-sm"
                placeholder="All warehouses"
                value={filters.warehouseId ?? ""}
                onChange={(e) => setFilters((prev) => ({ ...prev, warehouseId: e.target.value }))}
              />
            </label>
          ) : (
            <label className="form-control">
              <span className="label-text text-xs">Warehouse Scope</span>
              <input className="input input-bordered input-sm" value={admin?.warehouseId ?? "N/A"} disabled />
            </label>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className="btn btn-sm btn-secondary" onClick={() => void loadData()} disabled={loading}>
            Apply Filters
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              setFilters({ dataset: "B", model: "CATBOOST", split: "test", horizon: undefined, sku: "", warehouseId: "" })
            }
          >
            Reset
          </button>
          <span className="text-xs text-base-content/60 ml-auto">
            {lastLoadedAt ? `Last update: ${new Date(lastLoadedAt).toLocaleString()}` : "No data loaded yet"}
          </span>
        </div>
      </div>

      {(!isAdmin || !showModelPerformance) ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Latest Run</div>
              <div className="text-2xl font-semibold">{latestRunId ?? "N/A"}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Reorder Now</div>
              <div className="text-2xl font-semibold">{reorderNowCount}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Overstock Risk</div>
              <div className="text-2xl font-semibold">{overstockCount}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Covered Above Target</div>
              <div className="text-2xl font-semibold">{coveredSkuCount}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Total Suggested Qty</div>
              <div className="text-2xl font-semibold">{Math.round(totalSuggestedQty).toLocaleString()}</div>
            </div>
          </div>

          <div className="alert alert-info">
            <span className="material-symbols-outlined">info</span>
            <div className="text-sm">
              This view is decision-centric. Focus on SKUs below reorder point, suggested order quantity, and cases where
              on-hand inventory is already above target max.
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Latest Run</div>
              <div className="text-2xl font-semibold">{latestRunId ?? "N/A"}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Forecast Rows</div>
              <div className="text-2xl font-semibold">{forecasts.length}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Avg WAPE ({filters.split})</div>
              <div className="text-2xl font-semibold">{avgWape !== null ? avgWape.toFixed(3) : "N/A"}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Avg RMSE ({filters.split})</div>
              <div className="text-2xl font-semibold">{avgRmse !== null ? avgRmse.toFixed(3) : "N/A"}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">RMSE vs Avg Demand</div>
              <div className="text-2xl font-semibold">
                {normalizedRmse !== null ? `${normalizedRmse.toFixed(1)}%` : "N/A"}
              </div>
            </div>
          </div>

          <div className="alert alert-info">
            <span className="material-symbols-outlined">info</span>
            <div className="text-sm">
              P10 = low case, P50 = expected case, P90 = high case. RMSE is measured in demand units, so it can look
              large on high-volume SKUs. For the current filter, average demand is{" "}
              <span className="font-semibold">
                {avgActualDemand !== null ? Math.round(avgActualDemand).toLocaleString() : "N/A"}
              </span>{" "}
              and RMSE is{" "}
              <span className="font-semibold">{avgRmse !== null ? Math.round(avgRmse).toLocaleString() : "N/A"}</span>.
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Multi-Horizon Forecast</h2>
            <button className="btn btn-xs btn-outline" onClick={() => downloadCsv("forecasts.csv", latestForecasts)}>
              Export CSV
            </button>
          </div>
          <div className="h-80">
            {horizonChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={horizonChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="horizon" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="p50" stroke="#0ea5e9" name="P50" strokeWidth={2} />
                  <Line type="monotone" dataKey="p90" stroke="#ef4444" name="P90" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-base-content/60">
                No horizon data for selected filters
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Monthly Forecast Trend</h2>
            <button className="btn btn-xs btn-outline" onClick={() => downloadCsv("forecast_metrics.csv", metrics)}>
              Export Metrics CSV
            </button>
          </div>
          <div className="h-80">
            {monthlyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="p10" stroke="#94a3b8" name="P10" strokeWidth={2} />
                  <Line type="monotone" dataKey="p50" stroke="#22c55e" name="P50" strokeWidth={2} />
                  <Line type="monotone" dataKey="p90" stroke="#f97316" name="P90" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-base-content/60">
                No monthly forecast trend for selected filters
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdmin && showModelPerformance && (
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Model Evaluators By Horizon</h2>
            <button className="btn btn-xs btn-outline" onClick={() => downloadCsv("model_metrics.csv", metricsByHorizon)}>
              Export Metrics CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Horizon</th>
                  <th className="text-right">WAPE</th>
                  <th className="text-right">RMSE</th>
                  <th className="text-right">MASE</th>
                  <th className="text-right">Bias</th>
                </tr>
              </thead>
              <tbody>
                {metricsByHorizon.length > 0 ? (
                  metricsByHorizon.map((row) => (
                    <tr key={`${row.run_id}-${row.horizon}`}>
                      <td>{row.horizon}</td>
                      <td className="text-right">{row.WAPE !== undefined ? row.WAPE.toFixed(3) : "-"}</td>
                      <td className="text-right">{row.RMSE !== undefined ? row.RMSE.toFixed(0) : "-"}</td>
                      <td className="text-right">{row.MASE_mean !== undefined ? row.MASE_mean.toFixed(3) : "-"}</td>
                      <td className="text-right">{row.Bias !== undefined ? row.Bias.toFixed(0) : "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-sm text-base-content/60 py-6">
                      No model metrics available for selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Top Reorder Priorities</h2>
          <div className="text-sm text-base-content/60">Highest suggested order quantity first</div>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Category</th>
                <th className="text-right">On Hand</th>
                <th className="text-right">Reorder Point</th>
                <th className="text-right">Target Max</th>
                <th className="text-right">Suggested Order Qty</th>
              </tr>
            </thead>
            <tbody>
              {topReorderItems.length > 0 ? (
                topReorderItems.map((row) => (
                  <tr key={`top-${row.run_id}-${row.sku}`}>
                    <td>{row.sku}</td>
                    <td>{row.category ?? "-"}</td>
                    <td className="text-right">
                      {row.on_hand_inventory !== null && row.on_hand_inventory !== undefined
                        ? Math.round(row.on_hand_inventory)
                        : "-"}
                    </td>
                    <td className="text-right">{Math.round(row.reorder_point)}</td>
                    <td className="text-right">{Math.round(row.target_max)}</td>
                    <td className="text-right font-semibold">{Math.round(row.suggested_order_qty)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center text-sm text-base-content/60 py-6">
                    No reorder priorities available for selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Inventory Recommendations</h2>
          <button
            className="btn btn-xs btn-outline"
            onClick={() => downloadCsv("inventory_recommendations.csv", recommendations)}
          >
            Export CSV
          </button>
        </div>
        <div className="alert alert-info mb-3">
          <span className="material-symbols-outlined">info</span>
          <div className="text-sm">
            Suggested order quantity is calculated against current on-hand inventory. If on-hand is already above target
            max, the suggested order becomes 0.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Category</th>
                <th className="text-right">Safety Stock</th>
                <th className="text-right">Reorder Point</th>
                <th className="text-right">Target Max</th>
                <th className="text-right">On Hand</th>
                <th className="text-right">Suggested Order Qty</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.length > 0 ? (
                recommendations.slice(0, 300).map((row) => (
                  <tr key={`${row.run_id}-${row.sku}`}>
                    <td>{row.sku}</td>
                    <td>{row.category ?? "-"}</td>
                    <td className="text-right">{Math.round(row.safety_stock)}</td>
                    <td className="text-right">{Math.round(row.reorder_point)}</td>
                    <td className="text-right">{Math.round(row.target_max)}</td>
                    <td className="text-right">{row.on_hand_inventory !== null && row.on_hand_inventory !== undefined ? Math.round(row.on_hand_inventory) : "-"}</td>
                    <td className="text-right font-semibold">{Math.round(row.suggested_order_qty)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center text-sm text-base-content/60 py-6">
                    No recommendations available for selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
