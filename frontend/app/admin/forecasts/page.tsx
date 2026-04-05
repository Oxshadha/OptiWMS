"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  aiForecastApi,
  type ForecastMetric,
  type ForecastPoint,
  type InferenceAlertsResponse,
  type InferenceAuditSummary,
  type InventoryRecommendation,
} from "@/lib/api/ai-forecast";
import { warehousesApi } from "@/lib/api/warehouses";
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
const MODEL_OPTIONS = ["CATBOOST", "XGBOOST", "LIGHTGBM", "RANDOM_FOREST", "SARIMA", "ARIMA", "ETS", "NBEATS", "TFT"];

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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<ForecastPoint[]>([]);
  const [metrics, setMetrics] = useState<ForecastMetric[]>([]);
  const [recommendations, setRecommendations] = useState<InventoryRecommendation[]>([]);
  const [modelComparisonMetrics, setModelComparisonMetrics] = useState<ForecastMetric[]>([]);
  const [inferenceSummary, setInferenceSummary] = useState<InferenceAuditSummary | null>(null);
  const [inferenceAlerts, setInferenceAlerts] = useState<InferenceAlertsResponse | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [showModelPerformance, setShowModelPerformance] = useState(false);
  const [warehouseMasterOptions, setWarehouseMasterOptions] = useState<Array<{ id: string; value: string; label: string }>>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [skuSearchInput, setSkuSearchInput] = useState("");
  const [skuSearchOpen, setSkuSearchOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventorySort, setInventorySort] = useState<"risk_desc" | "sku_asc" | "sku_desc" | "suggested_desc">("risk_desc");
  const inventoryPageSize = 25;

  const managerWarehouseScope = useMemo(() => {
    if (!admin) {
      return undefined;
    }
    if (admin.warehouseName) {
      return admin.warehouseName;
    }
    if (!admin.warehouseId) {
      return undefined;
    }
    const matched = warehouseMasterOptions.find((w) => w.id === admin.warehouseId);
    return matched?.value ?? admin.warehouseId;
  }, [admin, warehouseMasterOptions]);

  const effectiveWarehouseId = isAdmin
    ? filters.warehouseId || undefined
    : managerWarehouseScope;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const loadData = async (options?: { preserveOnEmpty?: boolean; keepInfo?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      if (!options?.keepInfo) {
        setInfoMessage(null);
      }
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
      const nextForecasts = forecastRes.items ?? [];
      const nextMetrics = metricRes.items ?? [];
      const nextRecommendations = recoRes.items ?? [];
      const nextModelComparisonMetrics = comparisonMetrics?.items ?? [];

      const gotNoRows = nextForecasts.length === 0 && nextMetrics.length === 0 && nextRecommendations.length === 0;
      const hadPreviousRows = forecasts.length > 0 || metrics.length > 0 || recommendations.length > 0;
      if (options?.preserveOnEmpty && gotNoRows && hadPreviousRows) {
        setInfoMessage("Trigger started, but no new rows are available yet. Showing previous data.");
        setLoading(false);
        return { hasRows: false, latestRunId };
      }

      setForecasts(nextForecasts);
      setMetrics(nextMetrics);
      setRecommendations(nextRecommendations);
      setModelComparisonMetrics(nextModelComparisonMetrics);
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
      return {
        hasRows: !gotNoRows,
        latestRunId: nextForecasts.length ? Math.max(...nextForecasts.map((f) => f.run_id)) : undefined,
      };
    } catch (loadError) {
      logger.error("[ForecastsPage] Failed to load forecast data:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load forecast data");
      return { hasRows: false, latestRunId: undefined as number | undefined };
    } finally {
      setLoading(false);
    }
  };

  const waitForPublishedRows = async (runId: number) => {
    const attempts = 18;
    const delayMs = 1500;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const runRows = await aiForecastApi.getForecasts({
          runId,
          dataset: filters.dataset,
          warehouseId: effectiveWarehouseId,
        });
        if ((runRows.items ?? []).length > 0) {
          return true;
        }
      } catch (pollError) {
        logger.warn("[ForecastsPage] Polling run rows failed:", pollError);
      }
      await sleep(delayMs);
    }
    return false;
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
      setInfoMessage("Forecast run accepted. Waiting for published rows...");
      const triggerResult = await aiForecastApi.triggerForecastRun({
        dataset: filters.dataset,
        modelName: filters.model,
        warehouseId: effectiveWarehouseId,
        criticalOverride,
      });
      const runId = Number(triggerResult?.run_id ?? 0);
      if (Number.isFinite(runId) && runId > 0) {
        const published = await waitForPublishedRows(runId);
        if (published) {
          setInfoMessage(`Run ${runId} published. Showing latest data.`);
        } else {
          setInfoMessage("Run started, but publish is still in progress. Showing latest available data.");
        }
      } else {
        setInfoMessage("Run started. Refreshing latest data...");
      }
      await loadData({ preserveOnEmpty: true, keepInfo: true });
    } catch (triggerError) {
      logger.error("[ForecastsPage] Failed to trigger forecast run:", triggerError);
      setError(triggerError instanceof Error ? triggerError.message : "Failed to trigger forecast run");
      setInfoMessage(null);
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const warehouses = await warehousesApi.getAll();
        const options = (warehouses ?? [])
          .map((w) => ({
            id: String(w.id),
            value: (w.name && String(w.name).trim()) || String(w.id),
            label: w.name ? `${w.name}${w.code ? ` (${w.code})` : ""}` : String(w.id),
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setWarehouseMasterOptions(options);
      } catch (warehouseError) {
        logger.warn("[ForecastsPage] Failed to load warehouses:", warehouseError);
        setWarehouseMasterOptions([]);
      }
    };
    void loadWarehouses();
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

  const warehouseOptionsFromData = useMemo(() => {
    const values = new Set<string>();
    forecasts.forEach((r) => r.warehouse_id && values.add(String(r.warehouse_id)));
    recommendations.forEach((r) => r.warehouse_id && values.add(String(r.warehouse_id)));
    metrics.forEach((r) => r.warehouse_id && values.add(String(r.warehouse_id)));
    if (admin?.warehouseId) {
      values.add(String(admin.warehouseId));
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [admin?.warehouseId, forecasts, metrics, recommendations]);

  const warehouseOptions = useMemo(() => {
    if (warehouseMasterOptions.length > 0) {
      return warehouseMasterOptions;
    }
    return warehouseOptionsFromData.map((wid) => ({ value: wid, label: wid }));
  }, [warehouseMasterOptions, warehouseOptionsFromData]);

  useEffect(() => {
    if (!skuOptions.length) {
      setSelectedSku("");
      return;
    }
    if (!selectedSku || !skuOptions.includes(selectedSku)) {
      setSelectedSku(filters.sku && skuOptions.includes(filters.sku) ? filters.sku : skuOptions[0]);
    }
  }, [filters.sku, selectedSku, skuOptions]);

  useEffect(() => {
    if (!selectedSku) {
      return;
    }
    setSkuSearchInput(selectedSku);
  }, [selectedSku]);

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

  const deferredSkuQuery = useDeferredValue(skuSearchInput);
  const skuSearchResults = useMemo(() => {
    const q = deferredSkuQuery.trim().toLowerCase();
    if (!q) {
      return skuOptions.slice(0, 12);
    }
    const exact = skuOptions.filter((sku) => sku.toLowerCase() === q);
    const starts = skuOptions.filter((sku) => sku.toLowerCase().startsWith(q) && sku.toLowerCase() !== q);
    const contains = skuOptions.filter(
      (sku) => sku.toLowerCase().includes(q) && !sku.toLowerCase().startsWith(q) && sku.toLowerCase() !== q
    );
    return [...exact, ...starts, ...contains].slice(0, 12);
  }, [deferredSkuQuery, skuOptions]);

  const selectedSkuForecasts = useMemo(() => {
    const rows = latestForecasts
      .filter((row) => row.sku === selectedSku)
      .sort((a, b) => String(a.month).localeCompare(String(b.month)));

    if (!rows.length) {
      return [];
    }

    let visibleRows = rows;
    if (filters.horizon && Number.isFinite(filters.horizon) && filters.horizon > 0) {
      const uniqueMonths = Array.from(new Set(rows.map((r) => String(r.month)))).sort((a, b) => a.localeCompare(b));
      const visibleMonths = new Set(uniqueMonths.slice(-Math.min(filters.horizon, uniqueMonths.length)));
      visibleRows = rows.filter((r) => visibleMonths.has(String(r.month)));
    }

    return visibleRows.map((row) => ({
      month: row.month,
      p10: Math.round(row.p10),
      p50: Math.round(row.p50),
      p90: Math.round(row.p90),
      actual: row.y_true !== null && row.y_true !== undefined ? Math.round(row.y_true) : null,
    }));
  }, [filters.horizon, latestForecasts, selectedSku]);

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

  const availableModelsForSelectedDataset = useMemo(() => {
    const present = new Set(
      modelComparisonMetrics
        .map((m) => String(m.model ?? "").toUpperCase())
        .filter((m) => m.length > 0)
    );
    if (present.size === 0) {
      return MODEL_OPTIONS;
    }
    return MODEL_OPTIONS.filter((m) => present.has(m.toUpperCase()));
  }, [modelComparisonMetrics]);

  useEffect(() => {
    if (!showModelPerformance || !isAdmin) {
      return;
    }
    if (!availableModelsForSelectedDataset.length) {
      return;
    }
    if (!availableModelsForSelectedDataset.includes(filters.model)) {
      setFilters((prev) => ({ ...prev, model: availableModelsForSelectedDataset[0] }));
    }
  }, [availableModelsForSelectedDataset, filters.model, isAdmin, showModelPerformance]);

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

  const sortedRecommendations = useMemo(() => {
    const rows = [...filteredRecommendations];
    if (inventorySort === "sku_asc") {
      return rows.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
    }
    if (inventorySort === "sku_desc") {
      return rows.sort((a, b) => String(b.sku).localeCompare(String(a.sku)));
    }
    if (inventorySort === "suggested_desc") {
      return rows.sort((a, b) => b.suggested_order_qty - a.suggested_order_qty);
    }
    return rows.sort((a, b) => {
      const onHandA = a.on_hand_inventory ?? 0;
      const onHandB = b.on_hand_inventory ?? 0;
      const shortageA = Math.max(a.reorder_point - onHandA, 0);
      const shortageB = Math.max(b.reorder_point - onHandB, 0);
      if (shortageB !== shortageA) {
        return shortageB - shortageA;
      }
      if (b.suggested_order_qty !== a.suggested_order_qty) {
        return b.suggested_order_qty - a.suggested_order_qty;
      }
      const coverA = a.reorder_point > 0 ? onHandA / a.reorder_point : Number.POSITIVE_INFINITY;
      const coverB = b.reorder_point > 0 ? onHandB / b.reorder_point : Number.POSITIVE_INFINITY;
      if (coverA !== coverB) {
        return coverA - coverB;
      }
      return String(a.sku).localeCompare(String(b.sku));
    });
  }, [filteredRecommendations, inventorySort]);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventorySearch, inventorySort, recommendations, filters.dataset, filters.model, filters.horizon, filters.sku, filters.split, effectiveWarehouseId]);

  const totalInventoryPages = useMemo(
    () => Math.max(1, Math.ceil(sortedRecommendations.length / inventoryPageSize)),
    [sortedRecommendations.length]
  );

  const pagedRecommendations = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize;
    return sortedRecommendations.slice(start, start + inventoryPageSize);
  }, [sortedRecommendations, inventoryPage]);

  const inferenceErrorRate = useMemo(() => {
    if (!inferenceSummary) {
      return 0;
    }
    if (typeof inferenceSummary.error_rate === "number" && Number.isFinite(inferenceSummary.error_rate)) {
      return inferenceSummary.error_rate;
    }
    const totalErrors = Number(inferenceSummary.total_errors ?? 0);
    const count = Number(inferenceSummary.count ?? 0);
    return count > 0 ? totalErrors / count : 0;
  }, [inferenceSummary]);

  const inventoryInsight = useMemo(() => {
    if (!selectedSkuRecommendation) {
      return null;
    }
    const onHand = selectedSkuRecommendation.on_hand_inventory ?? 0;
    const reorder = selectedSkuRecommendation.reorder_point;
    const target = selectedSkuRecommendation.target_max;
    const gapToReorder = onHand - reorder;
    const gapToTarget = onHand - target;
    let status: "critical" | "reorder" | "healthy" | "overstock" = "healthy";
    if (onHand < reorder) status = "critical";
    else if (onHand < reorder * 1.1) status = "reorder";
    else if (onHand > target) status = "overstock";
    return { onHand, reorder, target, gapToReorder, gapToTarget, status };
  }, [selectedSkuRecommendation]);

  const inferenceStatusBadgeClass = useMemo(() => {
    const status = String(inferenceAlerts?.status ?? "").toLowerCase();
    if (status === "critical") return "badge-error";
    if (status === "warn") return "badge-warning";
    return "badge-success";
  }, [inferenceAlerts?.status]);

  const isDecisionView = !showModelPerformance;

  const applySkuSearch = () => {
    const q = skuSearchInput.trim().toLowerCase();
    if (!q) {
      return;
    }
    const exact = skuOptions.find((sku) => sku.toLowerCase() === q);
    if (exact) {
      setSelectedSku(exact);
      return;
    }
    const partial = skuOptions.find((sku) => sku.toLowerCase().includes(q));
    if (partial) {
      setSelectedSku(partial);
    }
  };

  const onSkuSearchInputChange = (value: string) => {
    setSkuSearchInput(value);
    setSkuSearchOpen(true);
    const q = value.trim().toLowerCase();
    if (!q) {
      return;
    }
    const exact = skuOptions.find((sku) => sku.toLowerCase() === q);
    if (exact) {
      setSelectedSku(exact);
      return;
    }
    const starts = skuOptions.find((sku) => sku.toLowerCase().startsWith(q));
    if (starts) {
      setSelectedSku(starts);
    }
  };

  const selectSkuFromSearch = (sku: string) => {
    setSelectedSku(sku);
    setSkuSearchInput(sku);
    setSkuSearchOpen(false);
  };

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
          <button className="btn btn-outline btn-sm" onClick={() => void loadData()} disabled={loading}>
            {loading ? "Loading..." : "Reload"}
          </button>
          {isAdmin && (
            <button className="btn btn-outline btn-sm" onClick={() => void triggerRun()} disabled={triggering}>
              {triggering ? "Triggering..." : "Run Forecast"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <span>{error}</span>
        </div>
      )}

      {infoMessage && (
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <span>{infoMessage}</span>
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

      {isAdmin && showModelPerformance && (inferenceSummary || inferenceAlerts) && (
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold">Admin Inference Operations</h2>
            <span className={`badge ${inferenceStatusBadgeClass}`}>
              {String(inferenceAlerts?.status ?? "ok").toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
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
                {inferenceSummary ? `${(inferenceErrorRate * 100).toFixed(2)}%` : "N/A"}
              </div>
            </div>
            <div className="rounded border border-base-300 p-3">
              <div className="text-xs text-base-content/60">Fallback Calls</div>
              <div className="text-xl font-semibold">
                {inferenceSummary ? Math.round((inferenceSummary.count ?? 0) * (inferenceSummary.fallback_rate ?? 0)) : "N/A"}
              </div>
            </div>
            <div className="rounded border border-base-300 p-3">
              <div className="text-xs text-base-content/60">Total Errors</div>
              <div className="text-xl font-semibold">
                {inferenceSummary ? Number(inferenceSummary.total_errors ?? 0) : "N/A"}
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
              {inferenceAlerts.rules_triggered.map((r) => `${r.rule} (${r.status ?? r.severity ?? "info"})`).join(", ")}
            </div>
          ) : (
            <div className="mt-3 text-sm text-base-content/70">No alert rules triggered in the selected window.</div>
          )}
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 p-4">
        {showModelPerformance ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
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
                {MODEL_OPTIONS.map((m) => {
                  const enabled = availableModelsForSelectedDataset.includes(m);
                  return (
                    <option key={m} value={m} disabled={!enabled}>
                      {enabled ? m : `${m} (no data)`}
                    </option>
                  );
                })}
              </select>
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
              <span className="label-text text-xs">Warehouse ID</span>
              {isAdmin ? (
                <select
                  className="select select-bordered select-sm"
                  value={filters.warehouseId ?? ""}
                  onChange={(e) => setFilters((prev) => ({ ...prev, warehouseId: e.target.value }))}
                >
                  <option value="">All warehouses</option>
                  {warehouseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input input-bordered input-sm" value={admin?.warehouseName ?? admin?.warehouseId ?? "N/A"} disabled />
              )}
            </label>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? "lg:grid-cols-2" : ""} gap-3`}>
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
              <span className="label-text text-xs">Warehouse ID</span>
              {isAdmin ? (
                <select
                  className="select select-bordered select-sm"
                  value={filters.warehouseId ?? ""}
                  onChange={(e) => setFilters((prev) => ({ ...prev, warehouseId: e.target.value }))}
                >
                  <option value="">All warehouses</option>
                  {warehouseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input input-bordered input-sm" value={admin?.warehouseName ?? admin?.warehouseId ?? "N/A"} disabled />
              )}
            </label>
          </div>
        )}
        {!showModelPerformance && (
          <div className="mt-2 text-xs text-base-content/60">
            Dataset and model selection is available in Model Performance view.
          </div>
        )}
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

      {isDecisionView ? (
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

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card bg-base-100 border border-base-300 p-4 xl:col-span-2">
              <div className="flex items-center justify-between mb-3 gap-3">
                <h2 className="text-lg font-semibold">Product Forecast Detail</h2>
                <div className="relative flex items-center gap-2">
                  <input
                    className="input input-bordered input-sm w-56"
                    placeholder="Enter SKU (e.g. FG001)"
                    value={skuSearchInput}
                    onChange={(e) => onSkuSearchInputChange(e.target.value)}
                    onFocus={() => setSkuSearchOpen(true)}
                    onBlur={() => setTimeout(() => setSkuSearchOpen(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        applySkuSearch();
                      }
                    }}
                  />
                  {skuSearchOpen && skuSearchResults.length > 0 && (
                    <div className="absolute left-0 top-10 z-20 max-h-64 w-56 overflow-auto rounded-md border border-base-300 bg-base-100 shadow-lg">
                      {skuSearchResults.map((sku) => (
                        <button
                          key={sku}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-base-200"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSkuFromSearch(sku);
                          }}
                        >
                          {sku}
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="btn btn-sm btn-outline" onClick={applySkuSearch}>
                    Select
                  </button>
                </div>
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
                      <Line type="monotone" dataKey="p10" stroke="#94a3b8" name="Lower Forecast" strokeWidth={2} />
                      <Line type="monotone" dataKey="p50" stroke="#22c55e" name="Expected Forecast" strokeWidth={2} />
                      <Line type="monotone" dataKey="p90" stroke="#f97316" name="Upper Forecast" strokeWidth={2} />
                      <Line type="monotone" dataKey="actual" stroke="#1d4ed8" name="Actual History" strokeWidth={2} />
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
              {inventoryInsight ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-base-content/70">Category</span>
                    <span className="font-medium">{selectedSkuRecommendation?.category ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base-content/70">Health Status</span>
                    <span className={`badge ${
                      inventoryInsight.status === "critical" ? "badge-error" :
                      inventoryInsight.status === "reorder" ? "badge-warning" :
                      inventoryInsight.status === "overstock" ? "badge-info" : "badge-success"
                    }`}>
                      {inventoryInsight.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded border border-base-300 p-2 text-center">
                      <div className="text-xs text-base-content/60">On Hand</div>
                      <div className="font-semibold">{Math.round(inventoryInsight.onHand).toLocaleString()}</div>
                    </div>
                    <div className="rounded border border-base-300 p-2 text-center">
                      <div className="text-xs text-base-content/60">Reorder</div>
                      <div className="font-semibold">{Math.round(inventoryInsight.reorder).toLocaleString()}</div>
                    </div>
                    <div className="rounded border border-base-300 p-2 text-center">
                      <div className="text-xs text-base-content/60">Target Max</div>
                      <div className="font-semibold">{Math.round(inventoryInsight.target).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="rounded border border-base-300 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-base-content/70">Gap to Reorder</span>
                      <span className={`font-semibold ${inventoryInsight.gapToReorder < 0 ? "text-error" : "text-success"}`}>
                        {Math.round(inventoryInsight.gapToReorder).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-base-content/70">Gap to Target</span>
                      <span className={`font-semibold ${inventoryInsight.gapToTarget > 0 ? "text-warning" : "text-success"}`}>
                        {Math.round(inventoryInsight.gapToTarget).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base-content/70">Suggested Order</span>
                    <span className="font-semibold">
                      {Math.round(selectedSkuRecommendation?.suggested_order_qty ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-sm text-base-content/60">
                  No inventory position available
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

      {showModelPerformance && (
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
            <select
              className="select select-bordered select-xs"
              value={inventorySort}
              onChange={(e) => setInventorySort(e.target.value as "risk_desc" | "sku_asc" | "sku_desc" | "suggested_desc")}
            >
              <option value="risk_desc">Sort: Stock Risk</option>
              <option value="suggested_desc">Sort: Suggested Qty</option>
              <option value="sku_asc">Sort: SKU A-Z</option>
              <option value="sku_desc">Sort: SKU Z-A</option>
            </select>
            <input
              className="input input-bordered input-xs w-56"
              placeholder="Search SKU or category"
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
            />
            <button
              className="btn btn-xs btn-outline"
              onClick={() => downloadCsv("inventory_recommendations.csv", sortedRecommendations)}
            >
              Export CSV
            </button>
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
            Showing {pagedRecommendations.length} of {sortedRecommendations.length} rows
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
