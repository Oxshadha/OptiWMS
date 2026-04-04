"use client";

import { useEffect, useMemo, useState } from "react";
import {
  aiForecastApi,
  type ForecastMetric,
  type ForecastPoint,
  type InferenceAlertsResponse,
  type InferenceAuditSummary,
  type InventoryRecommendation,
} from "@/lib/api/ai-forecast";
import { useAdmin } from "@/contexts/AdminContext";
import {
  Bar,
  BarChart,
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
  const [modelComparisonMetrics, setModelComparisonMetrics] = useState<ForecastMetric[]>([]);
  const [inferenceSummary, setInferenceSummary] = useState<InferenceAuditSummary | null>(null);
  const [inferenceAlerts, setInferenceAlerts] = useState<InferenceAlertsResponse | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [showModelPerformance, setShowModelPerformance] = useState(false);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const inventoryPageSize = 25;

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
      const [inferenceAuditResult, inferenceAlertsResult] = await Promise.allSettled([
        aiForecastApi.getInferenceAudit({
          limit: 200,
          dataset: filters.dataset,
          modelName: filters.model,
        }),
        aiForecastApi.getInferenceAlerts({
          limit: 200,
          dataset: filters.dataset,
          modelName: filters.model,
        }),
      ]);
      const comparisonMetrics = isAdmin
        ? await aiForecastApi.getForecastMetrics({
            dataset: filters.dataset,
            split: filters.split,
            warehouseId: effectiveWarehouseId,
          })
        : null;
      setForecasts(forecastRes.items ?? []);
      setMetrics(metricRes.items ?? []);
      setRecommendations(recoRes.items ?? []);
      setModelComparisonMetrics(comparisonMetrics?.items ?? []);
      if (inferenceAuditResult.status === "fulfilled") {
        setInferenceSummary(inferenceAuditResult.value?.summary ?? null);
      } else {
        logger.warn("[ForecastsPage] Inference audit endpoint unavailable:", inferenceAuditResult.reason);
        setInferenceSummary(null);
      }
      if (inferenceAlertsResult.status === "fulfilled") {
        setInferenceAlerts(inferenceAlertsResult.value ?? null);
      } else {
        logger.warn("[ForecastsPage] Inference alerts endpoint unavailable:", inferenceAlertsResult.reason);
        setInferenceAlerts(null);
      }
      setLastLoadedAt(new Date().toISOString());
    } catch (loadError) {
      logger.error("[ForecastsPage] Failed to load forecast data:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load forecast data");
    } finally {
      setLoading(false);
    }
  };

  const triggerRun = async () => {
    const currentInferenceStatus = String(inferenceAlerts?.status ?? "ok").toLowerCase();
    let criticalOverride = false;
    if (currentInferenceStatus === "critical") {
      const proceed = window.confirm(
        "Inference health is CRITICAL (high fallback/error/latency). Do you still want to trigger a new run?"
      );
      if (!proceed) {
        return;
      }
      criticalOverride = true;
    }

    try {
      setTriggering(true);
      setError(null);
      await aiForecastApi.triggerForecastRun({
        dataset: filters.dataset,
        modelName: filters.model,
        warehouseId: effectiveWarehouseId,
        criticalOverride,
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

  const skuOptions = useMemo(() => {
    const fromRecommendations = recommendations.map((row) => row.sku);
    const fromForecasts = latestForecasts.map((row) => row.sku);
    return Array.from(new Set([...fromRecommendations, ...fromForecasts])).sort((a, b) => a.localeCompare(b));
  }, [latestForecasts, recommendations]);

  useEffect(() => {
    if (!skuOptions.length) {
      setSelectedSku("");
      return;
    }
    if (!selectedSku || !skuOptions.includes(selectedSku)) {
      setSelectedSku(filters.sku && skuOptions.includes(filters.sku) ? filters.sku : skuOptions[0]);
    }
  }, [filters.sku, selectedSku, skuOptions]);

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

  const selectedSkuForecasts = useMemo(
    () =>
      latestForecasts
        .filter((row) => row.sku === selectedSku)
        .sort((a, b) => String(a.month).localeCompare(String(b.month)))
        .map((row) => ({
          month: row.month,
          p10: Math.round(row.p10),
          p50: Math.round(row.p50),
          p90: Math.round(row.p90),
          actual: row.y_true !== null && row.y_true !== undefined ? Math.round(row.y_true) : null,
        })),
    [latestForecasts, selectedSku]
  );

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

  const selectedSkuRecommendation = useMemo(
    () => recommendations.find((row) => row.sku === selectedSku) ?? null,
    [recommendations, selectedSku]
  );

  const inventoryPositionData = useMemo(() => {
    if (!selectedSkuRecommendation) {
      return [];
    }
    return [
      { label: "On Hand", value: Math.round(selectedSkuRecommendation.on_hand_inventory ?? 0), fill: "#2563eb" },
      { label: "Reorder Point", value: Math.round(selectedSkuRecommendation.reorder_point), fill: "#f59e0b" },
      { label: "Target Max", value: Math.round(selectedSkuRecommendation.target_max), fill: "#16a34a" },
    ];
  }, [selectedSkuRecommendation]);

  const topReorderChartData = useMemo(
    () =>
      topReorderItems
        .filter((row) => row.suggested_order_qty > 0)
        .slice(0, 6)
        .map((row) => ({
          sku: row.sku,
          suggested: Math.round(row.suggested_order_qty),
          gap: Math.max(Math.round(row.reorder_point - (row.on_hand_inventory ?? 0)), 0),
        })),
    [topReorderItems]
  );

  const modelComparisonData = useMemo(() => {
    const grouped = new Map<string, { model: string; wape: number[]; rmse: number[]; mase: number[] }>();
    for (const row of modelComparisonMetrics) {
      const bucket = grouped.get(row.model) ?? { model: row.model, wape: [], rmse: [], mase: [] };
      if (typeof row.WAPE === "number" && Number.isFinite(row.WAPE)) bucket.wape.push(row.WAPE);
      if (typeof row.RMSE === "number" && Number.isFinite(row.RMSE)) bucket.rmse.push(row.RMSE);
      if (typeof row.MASE_mean === "number" && Number.isFinite(row.MASE_mean)) bucket.mase.push(row.MASE_mean);
      grouped.set(row.model, bucket);
    }
    return Array.from(grouped.values())
      .map((row) => ({
        model: row.model,
        wape: row.wape.length ? Number((row.wape.reduce((sum, v) => sum + v, 0) / row.wape.length).toFixed(3)) : 0,
        rmse: row.rmse.length ? Math.round(row.rmse.reduce((sum, v) => sum + v, 0) / row.rmse.length) : 0,
        mase: row.mase.length ? Number((row.mase.reduce((sum, v) => sum + v, 0) / row.mase.length).toFixed(3)) : 0,
      }))
      .sort((a, b) => a.wape - b.wape);
  }, [modelComparisonMetrics]);

  const horizonMetricChartData = useMemo(
    () =>
      metricsByHorizon.map((row) => ({
        horizon: `H${row.horizon}`,
        wape: row.WAPE !== undefined ? Number(row.WAPE.toFixed(3)) : null,
        rmse: row.RMSE !== undefined ? Math.round(row.RMSE) : null,
        mase: row.MASE_mean !== undefined ? Number(row.MASE_mean.toFixed(3)) : null,
      })),
    [metricsByHorizon]
  );

  const filteredRecommendations = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) {
      return recommendations;
    }
    return recommendations.filter((row) => {
      const sku = String(row.sku ?? "").toLowerCase();
      const category = String(row.category ?? "").toLowerCase();
      return sku.includes(q) || category.includes(q);
    });
  }, [inventorySearch, recommendations]);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventorySearch, recommendations, filters.dataset, filters.model, filters.horizon, filters.sku, filters.split, effectiveWarehouseId]);

  const totalInventoryPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRecommendations.length / inventoryPageSize)),
    [filteredRecommendations.length]
  );

  const pagedRecommendations = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize;
    return filteredRecommendations.slice(start, start + inventoryPageSize);
  }, [filteredRecommendations, inventoryPage]);

  const inferenceStatusBadgeClass = useMemo(() => {
    const status = String(inferenceAlerts?.status ?? "").toLowerCase();
    if (status === "critical") return "badge-error";
    if (status === "warn") return "badge-warning";
    return "badge-success";
  }, [inferenceAlerts?.status]);

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

      {inferenceAlerts && String(inferenceAlerts.status).toLowerCase() !== "ok" && (
        <div
          className={`alert ${
            String(inferenceAlerts.status).toLowerCase() === "critical" ? "alert-error" : "alert-warning"
          }`}
        >
          <span className="material-symbols-outlined">report</span>
          <div>
            <div className="font-medium">
              Inference status: {String(inferenceAlerts.status).toUpperCase()}.
            </div>
            <div className="text-sm">
              Forecast service is degrading (fallback/error/latency). Review inference health before operational
              decisions.
            </div>
          </div>
        </div>
      )}

      {(inferenceSummary || inferenceAlerts) && (
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold">Online Inference Health</h2>
            <span className={`badge ${inferenceStatusBadgeClass}`}>
              {String(inferenceAlerts?.status ?? "ok").toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="rounded border border-base-300 p-3">
              <div className="text-xs text-base-content/60">Window Rows</div>
              <div className="text-xl font-semibold">{inferenceSummary?.count ?? 0}</div>
            </div>
            <div className="rounded border border-base-300 p-3">
              <div className="text-xs text-base-content/60">Fallback Rate</div>
              <div className="text-xl font-semibold">
                {inferenceSummary ? `${(inferenceSummary.fallback_rate * 100).toFixed(2)}%` : "N/A"}
              </div>
            </div>
            <div className="rounded border border-base-300 p-3">
              <div className="text-xs text-base-content/60">Error Rate</div>
              <div className="text-xl font-semibold">
                {inferenceSummary ? `${(inferenceSummary.error_rate * 100).toFixed(2)}%` : "N/A"}
              </div>
            </div>
            <div className="rounded border border-base-300 p-3">
              <div className="text-xs text-base-content/60">Avg Latency</div>
              <div className="text-xl font-semibold">
                {inferenceSummary ? `${Math.round(inferenceSummary.latency_avg_ms)} ms` : "N/A"}
              </div>
            </div>
            <div className="rounded border border-base-300 p-3">
              <div className="text-xs text-base-content/60">P95 Latency</div>
              <div className="text-xl font-semibold">
                {inferenceSummary ? `${Math.round(inferenceSummary.latency_p95_ms)} ms` : "N/A"}
              </div>
            </div>
          </div>
          {inferenceAlerts?.rules_triggered?.length ? (
            <div className="mt-3 text-sm">
              <span className="font-medium">Triggered Rules:</span>{" "}
              {inferenceAlerts.rules_triggered.map((r) => `${r.rule} (${r.severity})`).join(", ")}
            </div>
          ) : (
            <div className="mt-3 text-sm text-base-content/70">No alert rules triggered in the selected window.</div>
          )}
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

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card bg-base-100 border border-base-300 p-4 xl:col-span-2">
              <div className="flex items-center justify-between mb-3 gap-3">
                <h2 className="text-lg font-semibold">Product Forecast Detail</h2>
                <select
                  className="select select-bordered select-sm max-w-xs"
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                >
                  {skuOptions.map((sku) => (
                    <option key={sku} value={sku}>
                      {sku}
                    </option>
                  ))}
                </select>
              </div>
              <div className="h-80">
                {selectedSkuForecasts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedSkuForecasts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="p10" stroke="#94a3b8" name="Low Case (P10)" strokeWidth={2} />
                      <Line type="monotone" dataKey="p50" stroke="#22c55e" name="Expected (P50)" strokeWidth={2} />
                      <Line type="monotone" dataKey="p90" stroke="#f97316" name="High Case (P90)" strokeWidth={2} />
                      <Line type="monotone" dataKey="actual" stroke="#1d4ed8" name="Actual" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/60">
                    No product forecast available for the selected SKU
                  </div>
                )}
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Inventory Position</h2>
                <span className="badge badge-outline">{selectedSku || "No SKU"}</span>
              </div>
              <div className="h-64">
                {inventoryPositionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventoryPositionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/60">
                    No inventory position available
                  </div>
                )}
              </div>
              {selectedSkuRecommendation && (
                <div className="mt-3 text-sm text-base-content/70 space-y-1">
                  <div>Category: <span className="font-medium">{selectedSkuRecommendation.category ?? "-"}</span></div>
                  <div>
                    Suggested Order:
                    <span className="font-medium"> {Math.round(selectedSkuRecommendation.suggested_order_qty).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Top Reorder Priorities</h2>
              <div className="text-sm text-base-content/60">Highest suggested order quantity first</div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="h-80">
                {topReorderChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topReorderChartData} layout="vertical" margin={{ left: 16, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="sku" width={72} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="suggested" name="Suggested Order Qty" fill="#dc2626" radius={[0, 6, 6, 0]} />
                      <Bar dataKey="gap" name="Gap To Reorder Point" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/60">
                    No reorder priorities available
                  </div>
                )}
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Model Comparison</h2>
                <div className="text-sm text-base-content/60">Dataset {filters.dataset}, split {filters.split}</div>
              </div>
              <div className="h-80">
                {modelComparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="model" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="wape" name="Avg WAPE" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="mase" name="Avg MASE" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/60">
                    No model comparison data available
                  </div>
                )}
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Current Model Diagnostics</h2>
                <div className="text-sm text-base-content/60">{filters.model}</div>
              </div>
              <div className="h-80">
                {horizonMetricChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={horizonMetricChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="horizon" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="wape" stroke="#2563eb" name="WAPE" strokeWidth={2} />
                      <Line type="monotone" dataKey="mase" stroke="#7c3aed" name="MASE" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/60">
                    No horizon diagnostics available
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

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

      {!showModelPerformance && (
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Inventory Recommendations</h2>
          <div className="flex items-center gap-2">
            <input
              className="input input-bordered input-xs w-56"
              placeholder="Search SKU or category"
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
            />
            <button
              className="btn btn-xs btn-outline"
              onClick={() => downloadCsv("inventory_recommendations.csv", filteredRecommendations)}
            >
              Export CSV
            </button>
          </div>
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
              {pagedRecommendations.length > 0 ? (
                pagedRecommendations.map((row) => (
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
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-base-content/60">
            Showing {pagedRecommendations.length} of {filteredRecommendations.length} rows
          </div>
          <div className="join">
            <button
              className="btn btn-xs join-item"
              disabled={inventoryPage <= 1}
              onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button className="btn btn-xs join-item" disabled>
              Page {inventoryPage} / {totalInventoryPages}
            </button>
            <button
              className="btn btn-xs join-item"
              disabled={inventoryPage >= totalInventoryPages}
              onClick={() => setInventoryPage((p) => Math.min(totalInventoryPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
