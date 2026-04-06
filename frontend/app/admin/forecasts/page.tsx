"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  aiForecastApi,
  type ForecastMetric,
  type ForecastPoint,
  type InferenceAuditResponse,
  type InferenceAlertsResponse,
  type InventoryRecommendation,
} from "@/lib/api/ai-forecast";
import { warehousesApi } from "@/lib/api/warehouses";
import { useAdmin } from "@/contexts/AdminContext";
import {
  Bar,
  BarChart,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { logger } from "@/lib/utils/logger";

const DEFAULT_DATASET = process.env.NEXT_PUBLIC_FORECAST_DEPLOYED_DATASET || "";
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_FORECAST_DEPLOYED_MODEL || "";
const EVAL_SPLIT = "test";
const RUN_MODE: "snapshot" = "snapshot";
const CHART_COLORS = {
  lower: "#94a3b8",
  expected: "#0ea5e9",
  upper: "#f59e0b",
  actual: "#334155",
  reorderSuggested: "#0284c7",
  reorderGap: "#f59e0b",
  fallbackRate: "#ef4444",
  primaryUsage: "#0ea5e9",
  fallbackUsage: "#f59e0b",
  failedUsage: "#ef4444",
};

type Filters = {
  dataset: string;
  model: string;
  horizon?: number;
  sku?: string;
  split: string;
  warehouseId?: string;
};

type ForecastRunUiStatus = {
  phase: "idle" | "triggering" | "waiting_publish" | "published" | "timeout" | "failed";
  runId?: number;
  message: string;
  updatedAt: string;
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
    dataset: DEFAULT_DATASET,
    model: DEFAULT_MODEL,
    split: EVAL_SPLIT,
    warehouseId: "",
  });
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<ForecastPoint[]>([]);
  const [metrics, setMetrics] = useState<ForecastMetric[]>([]);
  const [recommendations, setRecommendations] = useState<InventoryRecommendation[]>([]);
  const [inferenceAlerts, setInferenceAlerts] = useState<InferenceAlertsResponse | null>(null);
  const [inferenceAudit, setInferenceAudit] = useState<InferenceAuditResponse | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [showModelPerformance, setShowModelPerformance] = useState(false);
  const [warehouseMasterOptions, setWarehouseMasterOptions] = useState<Array<{ id: string; value: string; label: string }>>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [skuSearchInput, setSkuSearchInput] = useState("");
  const [skuSearchOpen, setSkuSearchOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventorySort, setInventorySort] = useState<"risk_desc" | "sku_asc" | "sku_desc" | "suggested_desc">("risk_desc");
  const [runStatus, setRunStatus] = useState<ForecastRunUiStatus>({
    phase: "idle",
    message: "No run triggered in this session.",
    updatedAt: new Date().toISOString(),
  });
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

  const pickLatestBinding = (rows: ForecastPoint[]) => {
    if (!rows.length) {
      return null;
    }
    const latest = [...rows].sort((a, b) => b.run_id - a.run_id)[0];
    if (!latest?.dataset || !latest?.model) {
      return null;
    }
    return { dataset: String(latest.dataset), model: String(latest.model) };
  };

  const resolveBinding = async () => {
    const configuredDataset = filters.dataset?.trim();
    const configuredModel = filters.model?.trim();
    if (configuredDataset && configuredModel) {
      const configuredRows = await aiForecastApi.getForecasts({
        dataset: configuredDataset,
        model: configuredModel,
        warehouseId: effectiveWarehouseId,
      });
      if ((configuredRows.items ?? []).length > 0) {
        return { dataset: configuredDataset, model: configuredModel };
      }
    }

    const discovered = await aiForecastApi.getForecasts({ warehouseId: effectiveWarehouseId });
    const discoveredBinding = pickLatestBinding(discovered.items ?? []);
    if (discoveredBinding) {
      return discoveredBinding;
    }

    if (configuredDataset && configuredModel) {
      return { dataset: configuredDataset, model: configuredModel };
    }
    return null;
  };

  const loadData = async (options?: { preserveOnEmpty?: boolean; keepInfo?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      if (!options?.keepInfo) {
        setInfoMessage(null);
      }
      const binding = await resolveBinding();
      if (!binding) {
        setForecasts([]);
        setMetrics([]);
        setRecommendations([]);
        setInferenceAlerts(null);
        setInferenceAudit(null);
        setInfoMessage("No published forecast rows found yet. Run forecast after model/data mapping is ready.");
        return { hasRows: false, latestRunId: undefined };
      }

      if (filters.dataset !== binding.dataset || filters.model !== binding.model) {
        setFilters((prev) => ({ ...prev, dataset: binding.dataset, model: binding.model }));
      }

      const [forecastRes, metricRes, recoRes] = await Promise.all([
        aiForecastApi.getForecasts({
          dataset: binding.dataset,
          model: binding.model,
          sku: filters.sku,
          warehouseId: effectiveWarehouseId,
        }),
        aiForecastApi.getForecastMetrics({
          dataset: binding.dataset,
          model: binding.model,
          split: EVAL_SPLIT,
          warehouseId: effectiveWarehouseId,
        }),
        aiForecastApi.getInventoryRecommendations({
          dataset: binding.dataset,
          model: binding.model,
          sku: filters.sku,
          warehouseId: effectiveWarehouseId,
        }),
      ]);
      const [inferenceAlertsResult, inferenceAuditResult] = await Promise.allSettled([
        aiForecastApi.getInferenceAlerts({
          limit: 200,
          dataset: binding.dataset,
          modelName: binding.model,
        }),
        aiForecastApi.getInferenceAudit({
          limit: 200,
          dataset: binding.dataset,
          modelName: binding.model,
        }),
      ]);
      const nextForecasts = forecastRes.items ?? [];
      const nextMetrics = metricRes.items ?? [];
      const nextRecommendations = recoRes.items ?? [];

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
      if (inferenceAlertsResult.status === "fulfilled") {
        setInferenceAlerts(inferenceAlertsResult.value ?? null);
      } else {
        logger.warn("[ForecastsPage] Inference alerts endpoint unavailable:", inferenceAlertsResult.reason);
        setInferenceAlerts(null);
      }
      if (inferenceAuditResult.status === "fulfilled") {
        setInferenceAudit(inferenceAuditResult.value ?? null);
      } else {
        logger.warn("[ForecastsPage] Inference audit endpoint unavailable:", inferenceAuditResult.reason);
        setInferenceAudit(null);
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
    const binding = await resolveBinding();
    const resolvedDataset = binding?.dataset ?? DEFAULT_DATASET;
    const resolvedModel = binding?.model ?? DEFAULT_MODEL;
    if (!resolvedDataset || !resolvedModel) {
      setError("No runtime dataset/model binding found. Publish at least one valid run first.");
      return;
    }

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
      setRunStatus({
        phase: "triggering",
        message: "Submitting run request...",
        updatedAt: new Date().toISOString(),
      });
      const triggerResult = await aiForecastApi.triggerForecastRun({
        dataset: resolvedDataset,
        modelName: resolvedModel,
        mode: RUN_MODE,
        warehouseId: effectiveWarehouseId,
        criticalOverride,
      });
      const runId = Number(triggerResult?.run_id ?? 0);
      if (Number.isFinite(runId) && runId > 0) {
        setRunStatus({
          phase: "waiting_publish",
          runId,
          message: `Run ${runId} accepted (${RUN_MODE}). Waiting for published rows...`,
          updatedAt: new Date().toISOString(),
        });
        const published = await waitForPublishedRows(runId);
        if (published) {
          setInfoMessage(`Run ${runId} published. Showing latest data.`);
          setRunStatus({
            phase: "published",
            runId,
            message: `Run ${runId} published successfully via ${RUN_MODE} mode.`,
            updatedAt: new Date().toISOString(),
          });
        } else {
          setInfoMessage("Run started, but publish is still in progress. Showing latest available data.");
          setRunStatus({
            phase: "timeout",
            runId,
            message: `Run ${runId} still publishing after wait window. Data may appear shortly.`,
            updatedAt: new Date().toISOString(),
          });
        }
        await loadData({ preserveOnEmpty: !published, keepInfo: true });
      } else {
        setInfoMessage("Run started. Refreshing latest data...");
        setRunStatus({
          phase: "waiting_publish",
          message: "Run accepted, but run_id was not returned by API.",
          updatedAt: new Date().toISOString(),
        });
        await loadData({ preserveOnEmpty: true, keepInfo: true });
      }
    } catch (triggerError) {
      logger.error("[ForecastsPage] Failed to trigger forecast run:", triggerError);
      setError(triggerError instanceof Error ? triggerError.message : "Failed to trigger forecast run");
      setInfoMessage(null);
      setRunStatus({
        phase: "failed",
        message: triggerError instanceof Error ? triggerError.message : "Failed to trigger forecast run",
        updatedAt: new Date().toISOString(),
      });
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
  const visibleForecasts = useMemo(
    () => (filters.horizon ? latestForecasts.filter((f) => f.horizon === filters.horizon) : latestForecasts),
    [latestForecasts, filters.horizon]
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
    const rows = latestForecasts.filter((row) => row.sku === selectedSku);

    if (!rows.length) {
      return [];
    }

    const grouped = new Map<number, { horizon: number; p10: number[]; p50: number[]; p90: number[]; actual: number[] }>();
    for (const row of rows) {
      const h = Number(row.horizon ?? 0);
      if (!Number.isFinite(h) || h <= 0) {
        continue;
      }
      const cur = grouped.get(h) ?? { horizon: h, p10: [], p50: [], p90: [], actual: [] };
      cur.p10.push(Number(row.p10));
      cur.p50.push(Number(row.p50));
      cur.p90.push(Number(row.p90));
      if (typeof row.y_true === "number" && Number.isFinite(row.y_true)) {
        cur.actual.push(Number(row.y_true));
      }
      grouped.set(h, cur);
    }

    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    let out = Array.from(grouped.values())
      .sort((a, b) => a.horizon - b.horizon)
      .map((g) => ({
        month: `H+${g.horizon}`,
        horizon: g.horizon,
        p10: Math.round(mean(g.p10)),
        p50: Math.round(mean(g.p50)),
        p90: Math.round(mean(g.p90)),
        actual: g.actual.length ? Math.round(mean(g.actual)) : null,
      }));

    if (filters.horizon && Number.isFinite(filters.horizon) && filters.horizon > 0) {
      out = out.filter((r) => r.horizon <= filters.horizon!);
    }
    return out;
  }, [filters.horizon, latestForecasts, selectedSku]);

  const filteredMetrics = useMemo(() => {
    const byHorizon = new Map<number, ForecastMetric>();
    for (const row of metrics) {
      if (filters.horizon && row.horizon !== filters.horizon) {
        continue;
      }
      const existing = byHorizon.get(row.horizon);
      if (!existing || row.run_id > existing.run_id) {
        byHorizon.set(row.horizon, row);
      }
    }
    return Array.from(byHorizon.values()).sort((a, b) => a.horizon - b.horizon);
  }, [metrics, filters.horizon]);

  const avgWape = useMemo(() => {
    const values = filteredMetrics
      .map((m) => m.WAPE)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) {
      return null;
    }
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [filteredMetrics]);

  const avgRmse = useMemo(() => {
    const values = filteredMetrics
      .map((m) => m.RMSE)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) {
      return null;
    }
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [filteredMetrics]);

  const avgActualDemand = useMemo(() => {
    const actualValues = visibleForecasts
      .map((row) => row.y_true)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (actualValues.length) {
      return actualValues.reduce((s, v) => s + v, 0) / actualValues.length;
    }
    const proxyValues = visibleForecasts
      .map((row) => row.p50)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!proxyValues.length) {
      return null;
    }
    return proxyValues.reduce((s, v) => s + v, 0) / proxyValues.length;
  }, [visibleForecasts]);

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

  const topReorderItems = useMemo(() => {
    const bySku = new Map<string, InventoryRecommendation>();
    for (const row of recommendations) {
      const existing = bySku.get(row.sku);
      if (!existing || row.suggested_order_qty > existing.suggested_order_qty) {
        bySku.set(row.sku, row);
      }
    }
    return Array.from(bySku.values())
      .sort((a, b) => b.suggested_order_qty - a.suggested_order_qty)
      .slice(0, 8);
  }, [recommendations]);

  const metricsByHorizon = useMemo(() => filteredMetrics, [filteredMetrics]);

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

  const inferenceMix = useMemo(() => {
    const items = inferenceAudit?.items ?? [];
    let totalSeries = 0;
    let totalFallback = 0;
    let totalErrors = 0;
    for (const item of items) {
      const s = Number(item.series_count ?? 0);
      const f = Number(item.fallback_count ?? 0);
      const e = Number(item.errors_count ?? 0);
      totalSeries += Number.isFinite(s) ? s : 0;
      totalFallback += Number.isFinite(f) ? f : 0;
      totalErrors += Number.isFinite(e) ? e : 0;
    }
    const primary = Math.max(totalSeries - totalFallback - totalErrors, 0);
    const denom = totalSeries || 1;
    return {
      totalSeries,
      totalFallback,
      totalErrors,
      primary,
      fallbackRatePct: Number(((totalFallback / denom) * 100).toFixed(2)),
      errorRatePct: Number(((totalErrors / denom) * 100).toFixed(2)),
      primaryRatePct: Number(((primary / denom) * 100).toFixed(2)),
      donut: [
        { name: "Primary Model", value: primary, color: CHART_COLORS.primaryUsage },
        { name: "Fallback Model", value: totalFallback, color: CHART_COLORS.fallbackUsage },
        { name: "Failed", value: totalErrors, color: CHART_COLORS.failedUsage },
      ],
    };
  }, [inferenceAudit]);

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
  }, [inventorySearch, inventorySort, recommendations, filters.horizon, filters.sku, effectiveWarehouseId]);

  const totalInventoryPages = useMemo(
    () => Math.max(1, Math.ceil(sortedRecommendations.length / inventoryPageSize)),
    [sortedRecommendations.length]
  );

  const pagedRecommendations = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize;
    return sortedRecommendations.slice(start, start + inventoryPageSize);
  }, [sortedRecommendations, inventoryPage]);

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

  const runStatusBadgeClass = useMemo(() => {
    if (runStatus.phase === "failed") return "badge-error";
    if (runStatus.phase === "timeout") return "badge-warning";
    if (runStatus.phase === "published") return "badge-success";
    if (runStatus.phase === "triggering" || runStatus.phase === "waiting_publish") return "badge-info";
    return "badge-ghost";
  }, [runStatus.phase]);

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

      {error && <div className="text-sm text-error">{error}</div>}
      {infoMessage && <div className="text-sm text-info">{infoMessage}</div>}

      {isAdmin && (
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Run Status</div>
              <div className="text-xs text-base-content/70">
                Mode: <span className="font-medium">{RUN_MODE}</span>
                {runStatus.runId ? <> • Run ID: <span className="font-medium">{runStatus.runId}</span></> : null}
              </div>
            </div>
            <span className={`badge ${runStatusBadgeClass}`}>{runStatus.phase.toUpperCase()}</span>
          </div>
          <div className="mt-2 text-sm">{runStatus.message}</div>
          <div className="mt-1 text-xs text-base-content/60">Updated: {new Date(runStatus.updatedAt).toLocaleString()}</div>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 p-4">
        {showModelPerformance ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="form-control">
              <span className="label-text text-xs">Deployed Model</span>
              <input className="input input-bordered input-sm" value={filters.model || "N/A"} disabled />
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
            <label className="form-control">
              <span className="label-text text-xs">Evaluation Split</span>
              <input className="input input-bordered input-sm" value={EVAL_SPLIT} disabled />
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
            Decision view is operational: set horizon and review forecast and reorder output.
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button className="btn btn-sm btn-secondary" onClick={() => void loadData()} disabled={loading}>
            Apply Filters
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              setFilters({ dataset: DEFAULT_DATASET, model: DEFAULT_MODEL, split: EVAL_SPLIT, horizon: undefined, sku: "", warehouseId: "" })
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
                      <Line type="monotone" dataKey="p10" stroke={CHART_COLORS.lower} name="Lower Forecast" strokeWidth={2} />
                      <Line type="monotone" dataKey="p50" stroke={CHART_COLORS.expected} name="Expected Forecast" strokeWidth={2} />
                      <Line type="monotone" dataKey="p90" stroke={CHART_COLORS.upper} name="Upper Forecast" strokeWidth={2} />
                      <Line type="monotone" dataKey="actual" stroke={CHART_COLORS.actual} name="Actual History" strokeWidth={2} />
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
                      <Bar dataKey="suggested" name="Suggested Order Qty" fill={CHART_COLORS.reorderSuggested} radius={[0, 6, 6, 0]} />
                      <Bar dataKey="gap" name="Gap To Reorder Point" fill={CHART_COLORS.reorderGap} radius={[0, 6, 6, 0]} />
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
              <div className="text-xs text-base-content/60">Avg WAPE ({EVAL_SPLIT})</div>
              <div className="text-2xl font-semibold">{avgWape !== null ? avgWape.toFixed(3) : "N/A"}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">Avg RMSE ({EVAL_SPLIT})</div>
              <div className="text-2xl font-semibold">{avgRmse !== null ? avgRmse.toFixed(3) : "N/A"}</div>
            </div>
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="text-xs text-base-content/60">RMSE vs Avg Demand</div>
              <div className="text-2xl font-semibold">
                {normalizedRmse !== null ? `${normalizedRmse.toFixed(1)}%` : "N/A"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card bg-base-100 border border-base-300 p-4 xl:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Model Quality Snapshot</h2>
                <div className="text-sm text-base-content/60">{filters.model || "N/A"}</div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">Avg WAPE</div>
                  <div className="text-2xl font-semibold">{avgWape !== null ? avgWape.toFixed(3) : "N/A"}</div>
                </div>
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">Avg MASE</div>
                  <div className="text-2xl font-semibold">
                    {(() => {
                      const vals = metricsByHorizon
                        .map((m) => m.MASE_mean)
                        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
                      if (!vals.length) return "N/A";
                      return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3);
                    })()}
                  </div>
                </div>
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">Avg RMSE</div>
                  <div className="text-2xl font-semibold">{avgRmse !== null ? avgRmse.toFixed(0) : "N/A"}</div>
                </div>
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">RMSE / Avg Demand</div>
                  <div className="text-2xl font-semibold">{normalizedRmse !== null ? `${normalizedRmse.toFixed(1)}%` : "N/A"}</div>
                </div>
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">Fallback Rate</div>
                  <div className="text-2xl font-semibold">{inferenceMix.fallbackRatePct}%</div>
                </div>
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">Error Rate</div>
                  <div className="text-2xl font-semibold">{inferenceMix.errorRatePct}%</div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Inference Path Mix</h2>
                <div className="text-sm text-base-content/60">Primary vs fallback vs failed</div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">Primary Rate</div>
                  <div className="text-xl font-semibold">{inferenceMix.primaryRatePct}%</div>
                </div>
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">Fallback Rate</div>
                  <div className="text-xl font-semibold">{inferenceMix.fallbackRatePct}%</div>
                </div>
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">Series Evaluated</div>
                  <div className="text-xl font-semibold">{inferenceMix.totalSeries.toLocaleString()}</div>
                </div>
                <div className="rounded border border-base-300 p-3">
                  <div className="text-xs text-base-content/60">Error Rate</div>
                  <div className="text-xl font-semibold">{inferenceMix.errorRatePct}%</div>
                </div>
              </div>
              <div className="h-64">
                {inferenceMix.totalSeries > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inferenceMix.donut}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={86}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                      >
                        {inferenceMix.donut.map((slice, idx) => (
                          <Cell key={`slice-${idx}`} fill={slice.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/60">
                    No inference audit data yet
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
