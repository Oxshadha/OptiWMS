"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  aiForecastApi,
  type ForecastMetric,
  type ForecastPoint,
  type DemandHistoryPoint,
  type ForecastBacktestPoint,
  type InventoryRecommendation,
  type RawMaterialRequirement,
  type ForecastSkuItem,
} from "@/lib/api/ai-forecast";
import { warehousesApi } from "@/lib/api/warehouses";
import { useAdmin } from "@/contexts/AdminContext";
import {
  Bar,
  BarChart,
  LineChart,
  Line,
  AreaChart,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ComposedChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Brush,
} from "recharts";
import { logger } from "@/lib/utils/logger";
import { buildInventoryPlan } from "@/lib/forecast-planning";

const DEFAULT_DATASET = process.env.NEXT_PUBLIC_FORECAST_DEPLOYED_DATASET || "PROJECT_OPS_RM_PM";
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_FORECAST_DEPLOYED_MODEL || "PROJECT_OPS_EXTRA_TREES_CAUSAL";
// Promoted V8 evidence contract: the locked, untouched holdout is published as "test".
const EVAL_SPLIT = "test";
const RUN_MODE: "online" = "online";

// ── Design Color Palette ──────────────────────────────────────────
// ── Design Color Palette (Modern Minimalist) ─────────────────────
const C = {
  bg: "transparent",
  panel: "transparent",
  border: "#E5E7EB",
  accent: "#CF0F47", // Primary Crimson
  accent2: "#00E5A0", // Vibrant Emerald
  accent3: "#0052FF", // Electric Blue
  accent4: "#F59E0B", // Vibrant Amber
  muted: "#9CA3AF",
  text: "#374151",
  textDim: "#6B7280",
  danger: "#FF4D6D", // Vibrant Rose
  warn: "#F59E0B",
  ok: "#10B981",
};

const EMPTY_FORECAST: Array<{
  label: string;
  actual: number | null;
  forecast: number | null;
  upper: number | null;
  lower: number | null;
  ciRange: number[] | null;
  trend: number | null;
}> = [];

const ModernBrushHandle = (props: any) => {
  const { x, y, height } = props;
  const handleWidth = 14;
  const handleHeight = 24;
  const top = (height - handleHeight) / 2;
  
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect 
        x={-handleWidth / 2} 
        y={top} 
        width={handleWidth} 
        height={handleHeight} 
        fill="#ffffff" 
        stroke={C.textDim} 
        strokeWidth={1} 
        rx={4} 
        className="cursor-ew-resize drop-shadow-sm hover:fill-base-200"
      />
      <line x1={-2} y1={top + 7} x2={-2} y2={top + handleHeight - 7} stroke={C.textDim} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={2} y1={top + 7} x2={2} y2={top + handleHeight - 7} stroke={C.textDim} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
};

// ── KPI Card Component ──────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string | number;
  sub: string;
  color: string;
  delta?: number;
  icon: string;
}

function KpiCard({ title, value, sub, color, delta, icon }: KpiCardProps) {
  const up = delta !== undefined ? delta >= 0 : false;
  return (
    <div className="card bg-base-100 shadow-sm border-none rounded-2xl p-5 relative overflow-hidden hover:-translate-y-1 transition-transform duration-300 h-full min-w-0">
      <div className="absolute top-0 left-0 w-full h-1" style={{ background: color }} />
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">{title}</span>
        <span className="material-symbols-outlined text-base-content/70 text-lg" style={{ color }}>{icon}</span>
      </div>
      <span className="text-3xl font-bold text-base-content leading-none mb-1">{value}</span>
      <div className="flex items-center gap-1 text-xs text-base-content/60 mt-1">
        {delta !== undefined && (
          <span className={up ? "text-success font-semibold" : "text-error font-semibold"}>
            {up ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
        <span>{sub}</span>
      </div>
    </div>
  );
}

function InventoryPlanTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-lg p-3 shadow-lg text-xs min-w-64">
      <p className="text-primary font-bold mb-2">{label}</p>
      <div className="space-y-1 text-base-content/75">
        <p className="flex justify-between gap-5"><span>Beginning stock</span><strong className="text-base-content tabular-nums">{Number(row.beginning).toLocaleString()}</strong></p>
        <p className="flex justify-between gap-5"><span>Forecast demand (P50)</span><strong className="text-base-content tabular-nums">−{Number(row.demandP50).toLocaleString()}</strong></p>
        <p className="flex justify-between gap-5"><span>Simulated policy receipt</span><strong className="text-base-content tabular-nums">{row.receipt ? `+${Number(row.receipt).toLocaleString()}` : "None"}</strong></p>
        <div className="border-t border-base-300 my-1.5" />
        <p className="flex justify-between gap-5"><span>Projected ending (P50)</span><strong className="text-blue-700 tabular-nums">{Number(row.endingP50).toLocaleString()}</strong></p>
        <p className="flex justify-between gap-5"><span>Upper-demand ending (P90)</span><strong className="text-error tabular-nums">{Number(row.endingP90).toLocaleString()}</strong></p>
      </div>
      {row.receipt > 0 && <p className="mt-2 pt-2 border-t border-base-300 text-[10px] leading-4 text-base-content/55">Policy simulation only—not a confirmed purchase order.</p>}
    </div>
  );
}

// ── Custom Tooltip ──────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-200 border border-base-300 rounded-lg p-3 shadow-lg text-xs max-w-xs">
      <p className="text-primary font-bold mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="my-0.5 flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}:</span>
          <strong className="text-base-content">
            {typeof p.value === "number" 
              ? p.value.toLocaleString() 
              : Array.isArray(p.value)
                ? p.value.map((v: any) => (typeof v === "number" ? v.toLocaleString() : v)).join(" – ")
                : String(p.value)}
          </strong>
        </p>
      ))}
    </div>
  );
}

// ── Section Header ──────────────────────────────────────────────
function SectionHeader({ title, sub, color = C.accent }: { title: string; sub?: string; color?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-bold text-base-content uppercase tracking-wide">{title}</span>
      </div>
      {sub && <p className="text-xs text-base-content/60 ml-3 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Badge Component ─────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span 
      className="px-3 py-1 text-xs font-bold rounded-full border-none"
      style={{ 
        background: color + "15", 
        color: color
      }}
    >
      {label}
    </span>
  );
}

// ── CSV Download Helpers ─────────────────────────────────────────
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

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const formatMonthLabel = (dateStr: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString("default", { month: "short", year: "2-digit" });
  }
  if (dateStr.startsWith("H+")) {
    return `Month +${dateStr.substring(2)}`;
  }
  return dateStr;
};

const compareMonthLabels = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.startsWith("H+") && b.startsWith("H+")) {
    const numA = parseInt(a.substring(2), 10);
    const numB = parseInt(b.substring(2), 10);
    return numA - numB;
  }
  if (a.startsWith("H+")) return 1;
  if (b.startsWith("H+")) return -1;
  
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
    return dateA.getTime() - dateB.getTime();
  }
  return a.localeCompare(b);
};

const getMonthIndex = (monthStr: string): number => {
  if (!monthStr) return 0;
  const d = new Date(monthStr);
  if (!isNaN(d.getTime())) {
    return d.getMonth();
  }
  if (monthStr.startsWith("H+")) {
    const horizon = parseInt(monthStr.substring(2), 10);
    const curMonth = new Date().getMonth();
    return (curMonth + horizon) % 12;
  }
  return 0;
};

const displayModelName = (model?: string) => {
  const normalized = (model || "").toUpperCase();
  if (normalized === "EXTRA_TREES_RESPONSIVE") return "Extra Trees Responsive";
  if (normalized === "EXTRA_TREES_DAMPED_TREND") return "Extra Trees with Damped Trend";
  if (normalized === "EXTRA_TREES") return "Extra Trees";
  if (normalized === "PROJECT_OPS_EXTRA_TREES_CAUSAL") return "Extra Trees demand forecast";
  if (normalized === "V7_RM_PM_DIRECT" || normalized.includes("LIGHTGBM")) return "Warehouse Demand Model";
  return model || "Forecast model";
};

const setupErrorMessage = (code: string) => ({
  MISSING_DATABASE_POPULATION: "Forecast database population is missing. Run scripts/dev-bootstrap.sh.",
  INCOMPLETE_FORECAST_POPULATION: "Canonical forecast population is incomplete; reload the project-operational dataset.",
  STALE_OR_UNAPPROVED_PUBLISH: "The forecast publish is stale or not decision eligible.",
  MISSING_MODEL_REGISTRATION: "The promoted model is not registered in this database.",
  MODEL_NOT_PROMOTED: "The canonical model exists but is not promoted.",
  MISSING_DATASET_LOAD_AUDIT: "Dataset load verification is missing.",
  MODEL_DATASET_CHECKSUM_MISMATCH: "Model and dataset checksums disagree; do not use this publish for decisions.",
}[code] ?? `Forecast setup error: ${code}.`);

export default function ForecastsPage() {
  const { role, admin } = useAdmin();
  const isAdmin = role === "admin";

  const [filters, setFilters] = useState<{
    dataset: string;
    model: string;
    split: string;
    horizon?: number;
    sku?: string;
    warehouseId: string;
  }>({
    dataset: DEFAULT_DATASET,
    model: DEFAULT_MODEL,
    split: EVAL_SPLIT,
    horizon: undefined,
    sku: "",
    warehouseId: "",
  });
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [runProgress, setRunProgress] = useState<number | null>(null);
  const [forecasts, setForecasts] = useState<ForecastPoint[]>([]);
  const [demandHistory, setDemandHistory] = useState<DemandHistoryPoint[]>([]);
  const [backtests, setBacktests] = useState<ForecastBacktestPoint[]>([]);
  const [metrics, setMetrics] = useState<ForecastMetric[]>([]);
  const [recommendations, setRecommendations] = useState<InventoryRecommendation[]>([]);
  const [rawMaterialReqs, setRawMaterialReqs] = useState<RawMaterialRequirement[]>([]);
  const [forecastSkuCatalog, setForecastSkuCatalog] = useState<ForecastSkuItem[]>([]);
  const [releaseStatus, setReleaseStatus] = useState<string>("UNREGISTERED");
  const [canonicalReadiness, setCanonicalReadiness] = useState<import("@/lib/api/ai-forecast").CanonicalForecastReadiness | null>(null);
  const [warehouseMasterOptions, setWarehouseMasterOptions] = useState<Array<{ id: string; value: string; label: string }>>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [skuTypeFilter, setSkuTypeFilter] = useState<"all" | "raw_material" | "packaging_material" | "product">("all");
  const [skuSearchInput, setSkuSearchInput] = useState("");
  const [skuSearchOpen, setSkuSearchOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventorySort, setInventorySort] = useState<"risk_desc" | "sku_asc" | "sku_desc" | "suggested_desc">("risk_desc");
  const [showCI, setShowCI] = useState(false);
  const [runStatus, setRunStatus] = useState<{
    phase: string;
    jobId?: string;
    runId?: string;
    message: string;
    updatedAt: string;
  }>({
    phase: "idle",
    message: "No run triggered in this session.",
    updatedAt: new Date().toISOString(),
  });
  const [tab, setTab] = useState("overview");

  const inventoryPageSize = 25;

  const tabs = [
    { id: "overview", label: "Overview", icon: "analytics" },
    { id: "forecast", label: "Forecast", icon: "online_prediction" },
    { id: "sku", label: "SKU Analysis", icon: "inventory_2" },
    { id: "inventory", label: "Inventory", icon: "warehouse" },
    { id: "model", label: "Model Performance", icon: "fact_check" },
  ];

  const abcColor: Record<string, string> = { A: C.ok, B: C.accent4, C: C.muted };

  const managerWarehouseScope = useMemo(() => {
    if (!admin) {
      return undefined;
    }
    return admin.warehouseId || undefined;
  }, [admin]);

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

  const resolveBinding = async (): Promise<{ dataset: string; model: string }> => {
    const readiness = await aiForecastApi.getCanonicalReadiness(effectiveWarehouseId);
    setCanonicalReadiness(readiness);
    if (!readiness.ready) {
      throw new Error(readiness.errors.map(setupErrorMessage).join(" "));
    }
    return { dataset: readiness.dataset, model: readiness.modelName.toUpperCase() };
  };

  const loadData = async (options?: { preserveOnEmpty?: boolean; keepInfo?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      if (!options?.keepInfo) {
        setInfoMessage(null);
        setRunProgress(null);
      }
      const binding = await resolveBinding();
      if (!binding) {
        setForecasts([]);
        setMetrics([]);
        setRecommendations([]);
        setRawMaterialReqs([]);
        setReleaseStatus("UNREGISTERED");
        setInfoMessage("No published forecast rows found yet. Run forecast after model/data mapping is ready.");
        return { hasRows: false, latestRunId: undefined };
      }

      if (filters.dataset !== binding.dataset || filters.model !== binding.model) {
        setFilters((prev) => ({ ...prev, dataset: binding.dataset, model: binding.model }));
      }

      const forecastRes = await aiForecastApi.getForecasts({
        dataset: binding.dataset,
        model: binding.model,
        sku: filters.sku,
        warehouseId: effectiveWarehouseId,
      });
      setReleaseStatus(forecastRes.release_status ?? "UNREGISTERED");

      const [metricResult, recoResult, rmResult, historyResult, backtestResult] = await Promise.allSettled([
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
        aiForecastApi.getRawMaterialRequirements({
          dataset: binding.dataset,
          model: binding.model,
          rmSku: filters.sku,
          warehouseId: effectiveWarehouseId,
        }),
        aiForecastApi.getDemandHistory({
          sku: filters.sku,
          warehouseId: effectiveWarehouseId,
          size: 200,
        }),
        aiForecastApi.getForecastBacktests({
          sku: filters.sku,
          model: binding.model,
          warehouseId: effectiveWarehouseId,
          size: 200,
        }),
      ]);

      let nextSkuCatalog: ForecastSkuItem[] = [];
      try {
        const skuResult = await aiForecastApi.getForecastSkus({
          model: binding.model,
          warehouseId: effectiveWarehouseId,
        });
        nextSkuCatalog = skuResult.items ?? [];
        setForecastSkuCatalog(nextSkuCatalog);
      } catch (skuError) {
        logger.warn("[ForecastsPage] Forecast SKU catalog unavailable:", skuError);
      }

      let nextForecasts = forecastRes.items ?? [];
      let nextMetrics = metricResult.status === "fulfilled" ? metricResult.value.items ?? [] : [];
      let nextRecommendations = recoResult.status === "fulfilled" ? recoResult.value.items ?? [] : [];
      let nextRmReqs = rmResult.status === "fulfilled" ? rmResult.value.items ?? [] : [];
      let nextHistory = historyResult.status === "fulfilled" ? historyResult.value.items ?? [] : [];
      let nextBacktests = backtestResult.status === "fulfilled" ? backtestResult.value.items ?? [] : [];

      // Load one complete 12-month item series during the same transaction as
      // the dashboard data. This prevents the first paged aggregate response
      // from racing and overwriting the selected item's full horizon.
      const focusedSku = filters.sku || selectedSku || nextSkuCatalog
        .map((item) => item.sku)
        .sort((a, b) => a.localeCompare(b))[0];
      if (focusedSku) {
        const [focusedForecast, focusedHistory, focusedBacktest] = await Promise.allSettled([
          aiForecastApi.getForecasts({
            dataset: binding.dataset,
            model: binding.model,
            sku: focusedSku,
            warehouseId: effectiveWarehouseId,
            size: 24,
          }),
          aiForecastApi.getDemandHistory({ sku: focusedSku, warehouseId: effectiveWarehouseId, size: 100 }),
          aiForecastApi.getForecastBacktests({
            sku: focusedSku,
            model: binding.model,
            warehouseId: effectiveWarehouseId,
            size: 200,
          }),
        ]);
        if (focusedForecast.status === "fulfilled") {
          nextForecasts = [
            ...nextForecasts.filter((row) => row.sku !== focusedSku),
            ...(focusedForecast.value.items ?? []),
          ];
        }
        if (focusedHistory.status === "fulfilled") {
          nextHistory = [
            ...nextHistory.filter((row) => row.sku !== focusedSku),
            ...(focusedHistory.value.items ?? []),
          ];
        }
        if (focusedBacktest.status === "fulfilled") {
          nextBacktests = [
            ...nextBacktests.filter((row) => row.sku !== focusedSku),
            ...(focusedBacktest.value.items ?? []),
          ];
        }
      }

      if (metricResult.status === "rejected") {
        logger.warn("[ForecastsPage] Metrics endpoint unavailable; continuing with forecast rows:", metricResult.reason);
      }
      if (recoResult.status === "rejected") {
        logger.warn("[ForecastsPage] Inventory recommendation endpoint unavailable; continuing with forecast rows:", recoResult.reason);
      }
      if (rmResult.status === "rejected") {
        logger.warn("[ForecastsPage] Raw-material requirement endpoint unavailable; continuing with direct RM/PM forecasts:", rmResult.reason);
      }

      const candidateRunIds = [
        ...nextForecasts.map((r) => Number(r.run_id)),
        ...nextMetrics.map((r) => Number(r.run_id)),
        ...nextRecommendations.map((r) => Number(r.run_id)),
        ...nextRmReqs.map((r) => Number(r.run_id)),
      ].filter((v) => Number.isFinite(v) && v > 0);
      const canonicalRunId = candidateRunIds.length ? Math.max(...candidateRunIds) : undefined;

      if (canonicalRunId) {
        const needsRunNormalization =
          nextForecasts.some((r) => Number(r.run_id) !== canonicalRunId) ||
          nextMetrics.some((r) => Number(r.run_id) !== canonicalRunId) ||
          nextRecommendations.some((r) => Number(r.run_id) !== canonicalRunId) ||
          nextRmReqs.some((r) => Number(r.run_id) !== canonicalRunId);
        if (needsRunNormalization) {
          const forecastRunRes = await aiForecastApi.getForecasts({
            dataset: binding.dataset,
            model: binding.model,
            sku: filters.sku,
            warehouseId: effectiveWarehouseId,
            runId: canonicalRunId,
          });
          const [metricRunResult, recoRunResult, rmRunResult] = await Promise.allSettled([
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
              runId: canonicalRunId,
            }),
            aiForecastApi.getRawMaterialRequirements({
              dataset: binding.dataset,
              model: binding.model,
              rmSku: filters.sku,
              warehouseId: effectiveWarehouseId,
              runId: canonicalRunId,
            }),
          ]);
          nextForecasts = forecastRunRes.items ?? [];
          nextMetrics = metricRunResult.status === "fulfilled" ? metricRunResult.value.items ?? [] : nextMetrics;
          nextRecommendations = recoRunResult.status === "fulfilled" ? recoRunResult.value.items ?? [] : nextRecommendations;
          nextRmReqs = rmRunResult.status === "fulfilled" ? rmRunResult.value.items ?? [] : nextRmReqs;
        }
      }

      const gotNoRows = nextForecasts.length === 0 && nextMetrics.length === 0 && nextRecommendations.length === 0;
      const hadPreviousRows = forecasts.length > 0 || metrics.length > 0 || recommendations.length > 0;
      if (options?.preserveOnEmpty && gotNoRows && hadPreviousRows) {
        setInfoMessage("Trigger started, but no new rows are available yet. Showing previous data.");
        setLoading(false);
        return { hasRows: false, latestRunId: canonicalRunId };
      }

      setForecasts(nextForecasts);
      setMetrics(nextMetrics);
      setRecommendations(nextRecommendations);
      setRawMaterialReqs(nextRmReqs);
      setDemandHistory(nextHistory);
      setBacktests(nextBacktests);
      return {
        hasRows: !gotNoRows,
        latestRunId: canonicalRunId ?? (nextForecasts.length ? Math.max(...nextForecasts.map((f) => f.run_id)) : undefined),
      };
    } catch (loadError) {
      logger.error("[ForecastsPage] Failed to load forecast data:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load forecast data");
      return { hasRows: false, latestRunId: undefined as number | undefined };
    } finally {
      setLoading(false);
    }
  };

  const waitForPublishedRows = async (jobId: string) => {
    const attempts = 60;
    const delayMs = 1500;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const job = await aiForecastApi.getForecastJob(jobId);
        
        if (job) {
          if (job.status === "succeeded") {
            setRunProgress(100);
            return true;
          }
          if (job.status === "failed") {
            logger.error("[ForecastsPage] Publish job failed:", job.message);
            setError(`Publish job failed: ${job.message}`);
            setRunProgress(null);
            return false;
          }
          
          // The Python inference call is synchronous, so Spring can only report
          // its last durable stage. Interpolate the UI value and label it as an
          // estimate instead of exposing poll attempts as if they were stages.
          const reportedProgress = job.progress ?? 10;
          const estimatedProgress = Math.min(
            95,
            Math.max(reportedProgress, 10 + Math.floor(((i + 1) / attempts) * 85))
          );
          setRunProgress(estimatedProgress);

          const progressMsg = job.message
            ? `${job.message} Estimated progress: ${estimatedProgress}%.`
            : `Forecast pipeline is running. Estimated progress: ${estimatedProgress}%.`;
            
          setRunStatus(prev => ({
            ...prev,
            message: progressMsg
          }));
          setInfoMessage(progressMsg);
        } else {
          // Fallback if no job found yet
          const progressMsg = "Forecast job accepted. Waiting for the pipeline to start...";
          setInfoMessage(progressMsg);
        }
      } catch (pollError) {
        logger.warn("[ForecastsPage] Polling run jobs failed:", pollError);
      }
      await sleep(delayMs);
    }
    setRunProgress(null);
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

    const criticalOverride = false;

    try {
      setTriggering(true);
      setError(null);
      setRunProgress(0);
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
      const jobId = String(triggerResult?.jobId ?? "");
      const runId = String(triggerResult?.runId ?? "");
      if (jobId) {
        setRunStatus({
          phase: "waiting_publish",
          jobId,
          runId,
          message: `Job ${jobId} accepted (${RUN_MODE}). Waiting for published rows...`,
          updatedAt: new Date().toISOString(),
        });
        const published = await waitForPublishedRows(jobId);
        if (published) {
          setInfoMessage(`Run ${runId} published successfully. Loading latest data...`);
          setRunProgress(100);
          setRunStatus({
            phase: "published",
            jobId,
            runId,
            message: `Run ${runId} published successfully via ${RUN_MODE} mode.`,
            updatedAt: new Date().toISOString(),
          });
        } else {
          setInfoMessage("Run started, but publish is still in progress. Showing latest available data.");
          setRunProgress(null);
          setRunStatus({
            phase: "timeout",
            jobId,
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
      setTimeout(() => {
        setRunProgress(null);
        setInfoMessage(null);
      }, 5000);
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
            value: String(w.id),
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

  const skuCategoryByCode = useMemo(() => {
    const categories = new Map<string, string>();
    forecastSkuCatalog.forEach((row) => categories.set(row.sku, String(row.material_type || "").toLowerCase()));
    recommendations.forEach((row) => categories.set(row.sku, String(row.category || "").toLowerCase()));
    latestForecasts.forEach((row) => categories.set(row.sku, String(row.category || "").toLowerCase()));
    return categories;
  }, [forecastSkuCatalog, latestForecasts, recommendations]);

  const skuOptions = useMemo(() => {
    return Array.from(skuCategoryByCode.keys())
      .filter((sku) => skuTypeFilter === "all" || skuCategoryByCode.get(sku) === skuTypeFilter)
      .sort((a, b) => a.localeCompare(b));
  }, [skuCategoryByCode, skuTypeFilter]);

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

  useEffect(() => {
    if (loading || !selectedSku || !filters.model) {
      return;
    }
    let cancelled = false;
    const loadSelectedSkuSeries = async () => {
      const [forecastResult, historyResult, backtestResult] = await Promise.allSettled([
        aiForecastApi.getForecasts({
          dataset: filters.dataset,
          model: filters.model,
          sku: selectedSku,
          warehouseId: effectiveWarehouseId,
          size: 24,
        }),
        aiForecastApi.getDemandHistory({ sku: selectedSku, warehouseId: effectiveWarehouseId, size: 100 }),
        aiForecastApi.getForecastBacktests({
          sku: selectedSku,
          model: filters.model,
          warehouseId: effectiveWarehouseId,
          size: 200,
        }),
      ]);
      if (cancelled) return;
      if (forecastResult.status === "fulfilled") {
        const selectedRows = forecastResult.value.items ?? [];
        setForecasts((current) => [...current.filter((row) => row.sku !== selectedSku), ...selectedRows]);
      }
      if (historyResult.status === "fulfilled") {
        const selectedRows = historyResult.value.items ?? [];
        setDemandHistory((current) => [...current.filter((row) => row.sku !== selectedSku), ...selectedRows]);
      }
      if (backtestResult.status === "fulfilled") {
        const selectedRows = backtestResult.value.items ?? [];
        setBacktests((current) => [...current.filter((row) => row.sku !== selectedSku), ...selectedRows]);
      }
      if (forecastResult.status === "rejected") {
        logger.warn("[ForecastsPage] Selected SKU forecast series failed:", forecastResult.reason);
      }
    };
    void loadSelectedSkuSeries();
    return () => {
      cancelled = true;
    };
  }, [effectiveWarehouseId, filters.dataset, filters.model, loading, selectedSku]);

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

  const aggregateMetric = useMemo(
    () => filteredMetrics.find((metric) => metric.horizon === 0) ?? null,
    [filteredMetrics]
  );

  const avgWape = useMemo(() => {
    if (typeof aggregateMetric?.WAPE === "number" && Number.isFinite(aggregateMetric.WAPE)) {
      return aggregateMetric.WAPE;
    }
    const values = filteredMetrics
      .filter((m) => m.horizon > 0)
      .map((m) => m.WAPE)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) {
      return null;
    }
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [aggregateMetric, filteredMetrics]);

  const avgRmse = useMemo(() => {
    if (typeof aggregateMetric?.RMSE === "number" && Number.isFinite(aggregateMetric.RMSE)) {
      return aggregateMetric.RMSE;
    }
    const values = filteredMetrics
      .filter((m) => m.horizon > 0)
      .map((m) => m.RMSE)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) {
      return null;
    }
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [aggregateMetric, filteredMetrics]);

  const avgBias = useMemo(() => {
    if (typeof aggregateMetric?.Bias === "number" && Number.isFinite(aggregateMetric.Bias)) {
      return aggregateMetric.Bias;
    }
    const values = filteredMetrics
      .filter((m) => m.horizon > 0)
      .map((m) => m.Bias)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [aggregateMetric, filteredMetrics]);

  const avgMase = useMemo(() => {
    const values = filteredMetrics
      .map((m) => m.MASE_mean)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [filteredMetrics]);

  const avgCoverage = useMemo(() => {
    if (
      typeof aggregateMetric?.empirical_interval_coverage === "number" &&
      Number.isFinite(aggregateMetric.empirical_interval_coverage)
    ) {
      return aggregateMetric.empirical_interval_coverage * 100;
    }
    const rows = backtests.filter(
      (f) =>
        f.horizon > 0 &&
        f.y_true !== null &&
        f.y_true !== undefined &&
        f.p10 !== null &&
        f.p10 !== undefined &&
        f.p90 !== null &&
        f.p90 !== undefined &&
        f.p10 !== 0 &&
        f.p90 !== 0
    );
    if (!rows.length) return null;
    const inside = rows.filter((f) => Number(f.y_true) >= Number(f.p10) && Number(f.y_true) <= Number(f.p90)).length;
    return (inside / rows.length) * 100;
  }, [aggregateMetric, backtests]);

  const avgActualDemand = useMemo(() => {
    const actualValues = latestForecasts
      .map((row) => row.y_true)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (actualValues.length) {
      return actualValues.reduce((s, v) => s + v, 0) / actualValues.length;
    }
    const proxyValues = latestForecasts
      .map((row) => row.p50)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!proxyValues.length) {
      return null;
    }
    return proxyValues.reduce((s, v) => s + v, 0) / proxyValues.length;
  }, [latestForecasts]);

  const normalizedRmse = useMemo(() => {
    if (avgRmse === null || avgActualDemand === null || avgActualDemand === 0) {
      return null;
    }
    return (avgRmse / avgActualDemand) * 100;
  }, [avgActualDemand, avgRmse]);

  const reorderNowCount = useMemo(() => {
    return recommendations.filter(
      (row) =>
        row.on_hand_inventory !== null &&
        row.on_hand_inventory !== undefined &&
        row.on_hand_inventory < row.reorder_point
    ).length;
  }, [recommendations]);

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
      .slice(0, 10);
  }, [recommendations]);

  const selectedSkuRecommendation = useMemo(
    () => recommendations.find((row) => row.sku === selectedSku) ?? null,
    [recommendations, selectedSku]
  );

  const selectedSkuCatalogItem = useMemo(
    () => forecastSkuCatalog.find((row) => row.sku === selectedSku) ?? null,
    [forecastSkuCatalog, selectedSku]
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
      return rows.sort((a, b) => String(b.sku).localeCompare(String(b.sku)));
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

  const runStatusBadgeClass = useMemo(() => {
    if (runStatus.phase === "failed") return "badge-error";
    if (runStatus.phase === "timeout") return "badge-warning";
    if (runStatus.phase === "published") return "badge-success";
    if (runStatus.phase === "triggering" || runStatus.phase === "waiting_publish") return "badge-info";
    return "badge-ghost";
  }, [runStatus.phase]);

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

  // ── LIVE DATA PROCESSORS ──────────────────────────────────────────

  // 1. Overview & Forecasts Live Grouping
  const aggregatedForecastData = useMemo(() => {
    let futureRows = selectedSku
      ? latestForecasts.filter(f => f.sku === selectedSku)
      : latestForecasts;

    const maxHorizon = filters.horizon || 12;
    futureRows = futureRows.filter(f => f.horizon <= maxHorizon);
    const historicalRows = (selectedSku
      ? backtests.filter((row) => row.sku === selectedSku)
      : backtests
    )
      .sort((a, b) => compareMonthLabels(a.month, b.month))
      .slice(-12);

    if (!futureRows.length && !historicalRows.length) return [];

    const dateGroups: Record<string, {
      date: string;
      actualSum: number | null;
      actualCount: number;
      forecastSum: number;
      lowerSum: number;
      upperSum: number;
      count: number;
    }> = {};
    
    historicalRows.forEach((row) => {
      const dateStr = row.month;
      if (!dateStr) return;
      dateGroups[dateStr] = {
        date: dateStr,
        actualSum: Number(row.y_true),
        actualCount: 1,
        forecastSum: Number(row.p50),
        lowerSum: Number(row.p10 ?? row.p50),
        upperSum: Number(row.p90 ?? row.p50),
        count: 1,
      };
    });

    futureRows.forEach(f => {
      const dateStr = f.month;
      if (!dateStr) return;
      
      if (!dateGroups[dateStr]) {
        dateGroups[dateStr] = {
          date: dateStr,
          actualSum: null,
          actualCount: 0,
          forecastSum: 0,
          lowerSum: 0,
          upperSum: 0,
          count: 0
        };
      }
      const g = dateGroups[dateStr];
      g.forecastSum += Number(f.p50);
      g.lowerSum += Number(f.p10);
      g.upperSum += Number(f.p90);
      g.count++;
    });
    
    return Object.values(dateGroups)
      .sort((a, b) => compareMonthLabels(a.date, b.date))
      .map(g => ({
        label: formatMonthLabel(g.date),
        actual: g.actualCount > 0 ? Math.round(g.actualSum || 0) : null,
        forecast: Math.round(g.forecastSum),
        upper: Math.round(g.upperSum),
        lower: Math.round(g.lowerSum),
        ciRange: [Math.round(g.lowerSum), Math.round(g.upperSum)],
        trend: null
      }));
  }, [backtests, latestForecasts, selectedSku, filters.horizon]);

  // 2. Seasonality Live Calculation
  const liveSeasonality = useMemo(() => {
    const filtered = selectedSku
      ? demandHistory.filter(f => f.sku === selectedSku)
      : demandHistory;
      
    if (!filtered.length) return [];

    const monthlyActuals: Record<number, number[]> = {};
    filtered.forEach(f => {
      if (!f.month) return;
      const m = getMonthIndex(f.month);
      if (!monthlyActuals[m]) monthlyActuals[m] = [];
      monthlyActuals[m].push(Number(f.actual_demand));
    });
    
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const list = monthNames.map((name, i) => {
      const vals = monthlyActuals[i] || [];
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { month: name, avg };
    });
    
    const nonZeroAvgs = list.map(l => l.avg).filter(v => v > 0);
    
    // If we have no actual historical data at all, return empty to trigger fallback
    if (nonZeroAvgs.length === 0) return [];
    
    const overallAvg = nonZeroAvgs.reduce((a, b) => a + b, 0) / nonZeroAvgs.length;
    
    return list.map(l => ({
      month: l.month,
      index: Number((l.avg / overallAvg).toFixed(2)),
      sales: Math.round(l.avg)
    }));
  }, [demandHistory, selectedSku]);

  // 3. Lead-time-aware inventory and replenishment plan.
  const inventoryPlan = useMemo(() => {
    const filtered = selectedSku
      ? latestForecasts.filter((row) => row.sku === selectedSku)
      : [];
    const futureMonths = filtered
      .filter((row) => (row.y_true === null || row.y_true === undefined) && row.month)
      .reduce((acc, row) => {
        const period = row.month.slice(0, 10);
        if (!acc[period]) {
          acc[period] = { period, label: formatMonthLabel(period), p10: 0, p50: 0, p90: 0 };
        }
        acc[period].p10 += Number(row.p10 ?? row.p50 ?? 0);
        acc[period].p50 += Number(row.p50 ?? 0);
        acc[period].p90 += Number(row.p90 ?? row.p50 ?? 0);
        return acc;
      }, {} as Record<string, { period: string; label: string; p10: number; p50: number; p90: number }>);

    let buckets = Object.values(futureMonths).sort((a, b) => a.period.localeCompare(b.period));
    const rec = recommendations.find((row) => row.sku === selectedSku);
    const rmRec = rawMaterialReqs.find((row) => row.rm_sku === selectedSku);
    if (!buckets.length && rmRec) {
      const monthlyP50 = Math.max(0, rmRec.gross_requirement_qty / 12);
      const now = new Date();
      buckets = Array.from({ length: 12 }, (_, index) => {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + index + 1, 1));
        const period = date.toISOString().slice(0, 10);
        return {
          period,
          label: formatMonthLabel(period),
          p10: monthlyP50 * 0.85,
          p50: monthlyP50,
          p90: monthlyP50 * 1.15,
        };
      });
    }
    if (!buckets.length || (!rec && !rmRec)) {
      return buildInventoryPlan([], {
        onHand: 0,
        safetyStock: 0,
        reorderPoint: 0,
        targetMax: 0,
        leadTimeDays: 30,
        moq: 0,
        orderMultiple: 1,
      });
    }

    const observedLeadTime = demandHistory.find((row) => row.sku === selectedSku)?.lead_time_days;
    return buildInventoryPlan(buckets, {
      onHand: rec?.on_hand_inventory ?? rmRec?.on_hand_inventory ?? 0,
      safetyStock: rec?.safety_stock ?? rmRec?.safety_stock ?? 0,
      reorderPoint: rec?.reorder_point ?? rmRec?.reorder_point ?? 0,
      targetMax: rec?.target_max ?? ((rmRec?.reorder_point ?? 0) + (rmRec?.suggested_procure_qty ?? 0)),
      leadTimeDays: rec?.lead_time_days ?? observedLeadTime ?? 30,
      moq: rec?.moq ?? 0,
      orderMultiple: rec?.order_multiple ?? 1,
      recommendedOrderQty: rec?.suggested_order_qty ?? rmRec?.suggested_procure_qty ?? 0,
    });
  }, [latestForecasts, recommendations, rawMaterialReqs, demandHistory, selectedSku]);

  // 4. SKU Details and Classification
  const liveSkuDetails = useMemo(() => {
    if (!recommendations.length) return [];
    return recommendations.map(rec => {
      const sid = rec.sku;
      const actuals = demandHistory.filter(f => f.sku === sid).map(f => Number(f.actual_demand));
      const observedVelocity = actuals.length ? actuals.reduce((a, b) => a + b, 0) / actuals.length : 0;
      const velocity = Number(rec.average_monthly_demand ?? observedVelocity);
      const abc = rec.abc_class || "-";
      const fms = rec.fms_class || "-";
      const hist = backtests.filter(f => f.sku === sid);
      const sumAbsErr = hist.reduce((s, f) => s + Number(f.absolute_error), 0);
      const sumActual = hist.reduce((s, f) => s + Number(f.y_true), 0);
      const mape = typeof rec.sku_wape === "number"
        ? rec.sku_wape * 100
        : sumActual > 0 ? (sumAbsErr / sumActual) * 100 : 0;
      
      const onHand = rec.on_hand_inventory ?? 0;
      const coverDays = velocity > 0 ? Math.round((onHand / (velocity / 30))) : 20;
      
      return {
        sku: sid,
        description: rec.description || sid,
        category: rec.category || "Unknown",
        velocity: Math.round(velocity),
        stockDays: coverDays,
        mape: Number(mape.toFixed(1)),
        abc,
        fms,
        reorderPoint: rec.reorder_point,
        safetyStock: rec.safety_stock,
        targetMax: rec.target_max,
        onHand,
        suggested: rec.suggested_order_qty
      };
    });
  }, [recommendations, demandHistory, backtests]);

  // 5. Model QA Residuals
  const liveResiduals = useMemo(() => {
    const hist = selectedSku ? backtests.filter(f => f.sku === selectedSku) : backtests;
    if (!hist.length) return [];
    
    const sortedHist = [...hist].sort((a, b) => compareMonthLabels(a.month, b.month));
    return sortedHist.map(f => {
      const label = formatMonthLabel(f.month);
      const residual = Number(f.residual);
      return {
        label,
        residual: Math.round(residual),
        absError: Math.round(Math.abs(residual))
      };
    }).slice(-18);
  }, [backtests, selectedSku]);

  // ── FINAL DATA RESOLUTION (live API only — no synthetic fallbacks) ──────
  const finalForecastData = aggregatedForecastData.length > 0 ? aggregatedForecastData : EMPTY_FORECAST;
  const finalSkuData = [...liveSkuDetails].sort((a, b) => b.velocity - a.velocity);
  const velocityThreshold = finalSkuData.length
    ? finalSkuData[Math.floor(finalSkuData.length / 2)].velocity
    : 0;
  const forecastAttentionData = finalSkuData.map((row) => {
    const highImpact = row.velocity >= velocityThreshold;
    const highError = row.mape > 10;
    return {
      ...row,
      attention: highImpact && highError
        ? "Priority review"
        : highImpact
          ? "Protect service"
          : highError
            ? "Review policy"
            : "Monitor",
      attentionColor: highImpact && highError
        ? C.danger
        : highImpact
          ? C.accent3
          : highError
            ? C.warn
            : C.muted,
    };
  });
  const finalSeasonality = liveSeasonality;
  const finalResiduals = liveResiduals;
  const finalInventory = inventoryPlan.rows;
  const inventoryChartData = finalInventory.map((row) => ({
    ...row,
    receiptEvent: row.receipt > 0 ? row.endingP50 : null,
  }));
  const hasLiveForecastData = aggregatedForecastData.length > 0;
  const hasBacktestActuals = useMemo(
    () => backtests.length > 0,
    [backtests]
  );
  const forecastHorizonMonths = filters.horizon ?? 12;
  const forecastedUnitsForHorizon = useMemo(() => {
    const rows = latestForecasts.filter(
      (f) =>
        (!selectedSku || f.sku === selectedSku) &&
        f.horizon <= forecastHorizonMonths &&
        (f.y_true === null || f.y_true === undefined)
    );
    if (!rows.length) return null;
    return Math.round(rows.reduce((s, f) => s + Number(f.p50 || 0), 0));
  }, [latestForecasts, selectedSku, forecastHorizonMonths]);
  const minimumProjectedCoverDays = inventoryPlan.minimumDaysOfSupply;
  const projectedFillRatePct = finalInventory.length
    ? Number((inventoryPlan.projectedFillRate * 100).toFixed(1))
    : null;
  const projectedRiskFillRatePct = finalInventory.length
    ? Number((inventoryPlan.projectedRiskFillRate * 100).toFixed(1))
    : null;
  const totalOnHandUnits = useMemo(() => {
    const vals = recommendations
      .map((r) => r.on_hand_inventory)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0));
  }, [recommendations]);
  const finalExog = useMemo(() => {
    if (!hasLiveForecastData) return [];
    return finalForecastData.map((d, i) => ({
      label: d.label,
      promo: 0,
      holiday: 0,
      weatherImpact: null as number | null,
      priceIndex: null as number | null,
    }));
  }, [finalForecastData, hasLiveForecastData]);

  const processedForecastData = useMemo(() => {
    if (!finalForecastData || !finalForecastData.length) return [];
    const firstFutureIdx = finalForecastData.findIndex(d => d.actual === null);
    return finalForecastData.map((d, i) => {
      let forecastHistory: number | null = null;
      let forecastFuture: number | null = null;
      
      if (firstFutureIdx === -1) {
        forecastHistory = d.forecast;
      } else {
        if (i < firstFutureIdx) {
          forecastHistory = d.forecast;
        } else if (i === firstFutureIdx) {
          forecastHistory = d.forecast;
          forecastFuture = d.forecast;
        } else {
          forecastFuture = d.forecast;
        }
      }
      return {
        ...d,
        forecastHistory,
        forecastFuture
      };
    });
  }, [finalForecastData]);

  const transitionLabel = useMemo(() => {
    if (!finalForecastData || !finalForecastData.length) return undefined;
    const firstFuture = finalForecastData.find(d => d.actual === null);
    return firstFuture?.label;
  }, [finalForecastData]);

  const wapeVal = avgWape !== null ? Number((avgWape * 100).toFixed(1)) : null;
  const rmseVal = avgRmse !== null ? Math.round(avgRmse) : null;
  const biasVal = avgBias !== null ? Number((avgBias * 100).toFixed(1)) : null;
  const maseVal = avgMase !== null ? Number(avgMase.toFixed(2)) : null;
  const nrmseVal = avgMase !== null ? Math.round(avgMase) : (normalizedRmse !== null ? Math.round(normalizedRmse) : null);
  const coverageVal = avgCoverage !== null ? Number(avgCoverage.toFixed(1)) : null;
  const fmtMetric = (v: number | null, suffix = "") => (v === null ? "—" : `${v}${suffix}`);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 mb-3 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-primary">
              Demand & Replenishment Planning
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-base-content tracking-tight pb-1">Inventory Demand Planning</h1>
          <p className="text-sm text-base-content/60 mt-2 font-medium">
            Forecast demand, live WMS stock, replenishment risk, and model evidence in one decision view.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <span className="badge badge-ghost badge-sm font-mono">
            {(canonicalReadiness?.buildCommit || process.env.NEXT_PUBLIC_BUILD_COMMIT || "local").slice(0, 10)} · {canonicalReadiness?.datasetVersion || "PROJECT_OPS_RM_PM"}
          </span>
          <div className="text-right mr-2">
            <span className="text-success text-xs font-bold flex items-center gap-1.5 justify-end">
              <span className="w-2 h-2 rounded-full bg-success" /> OPERATIONAL PLAN
            </span>
            <p className="text-[10px] text-base-content/50 mt-0.5">{releaseStatus.replaceAll("_", " ")}</p>
          </div>
          <div className="badge badge-success badge-lg py-3 px-4 font-semibold text-xs rounded-full">
            WAPE: {fmtMetric(wapeVal, "%")}
          </div>
        </div>
      </div>

      {canonicalReadiness && !canonicalReadiness.ready && (
        <div className="alert alert-error text-sm">
          <span className="material-symbols-outlined">database_off</span>
          <span>{canonicalReadiness.errors.map(setupErrorMessage).join(" ")}</span>
        </div>
      )}

      {!hasLiveForecastData && !loading && (
        <div className="alert alert-warning text-sm">
          <span className="material-symbols-outlined">info</span>
          <span>
            No published forecast series yet. Run the forecast engine (admin) or wait for the next publish job.
            Charts show empty until live <code>forecast_results</code> are available.
          </span>
        </div>
      )}

      {/* Engine Control Panel Accordion */}
      <div className="collapse collapse-arrow bg-base-100 shadow-sm border-none rounded-2xl">
        <input type="checkbox" defaultChecked={false} /> 
        <div className="collapse-title text-sm font-bold flex items-center gap-2 text-base-content/85">
          <span className="material-symbols-outlined text-primary text-base">settings_applications</span>
          Forecast run details
        </div>
        <div className="collapse-content space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mt-1">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Horizon Range</span>
              <select
                className="select select-bordered select-sm w-full"
                value={filters.horizon ?? ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    horizon: e.target.value ? Number.parseInt(e.target.value, 10) : undefined,
                  }))
                }
              >
                <option value="">All Horizons</option>
                {Array.from({ length: 12 }).map((_, idx) => {
                  const m = idx + 1;
                  const label = m === 1 ? "1 Month" : m === 12 ? "1 Year" : `${m} Months`;
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Target Warehouse</span>
              <input 
                className="input input-bordered input-sm bg-base-200 cursor-not-allowed font-medium" 
                value="Colombo Main Warehouse" 
                disabled 
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Active Forecast</span>
              <input className="input input-bordered input-sm" value={displayModelName(filters.model)} disabled />
            </label>
            <div className="flex items-center gap-4 mt-4 lg:mt-0">
              
              <button className="btn btn-outline btn-primary btn-sm" onClick={() => void loadData()} disabled={loading}>
                {loading ? "Reloading..." : "Reload Data"}
              </button>
              {isAdmin && (
                <button className="btn btn-secondary btn-sm shadow-md" onClick={() => void triggerRun()} disabled={triggering}>
                  <span className="material-symbols-outlined text-[16px] mr-1">bolt</span>
                  {triggering ? "Recalculating..." : "Recalculate Forecast Now"}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="text-xs text-error font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs">error</span>
              <span>Error: {error}</span>
            </div>
          )}
          {infoMessage && (
            <div className="text-xs font-medium flex items-center gap-3 bg-base-200/50 p-2.5 rounded-lg border border-base-300">
              <div className="flex items-center gap-1.5 text-info">
                <span className="material-symbols-outlined text-xs">info</span>
                <span>{infoMessage}</span>
              </div>
              {runProgress !== null && (
                <div className="flex-1 flex items-center gap-2 max-w-sm">
                  <progress 
                    className="progress progress-info w-full" 
                    value={runProgress} 
                    max="100"
                  ></progress>
                  <span className="text-[10px] text-base-content/70 font-bold tabular-nums">
                    {Math.round(runProgress)}%
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Global SKU Selector & Search Bar */}
      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-base-content/70">Planning item:</span>
          <div className="badge badge-outline badge-md font-mono text-primary px-3 py-2 font-bold bg-base-200">
            {selectedSku || "All SKUs Combined"}
          </div>
          {selectedSkuCatalogItem?.description && (
            <span className="text-sm font-semibold text-base-content/80">
              {selectedSkuCatalogItem.description}
            </span>
          )}
          <div className="join" aria-label="Material type filter">
            {([
              ["all", "All forecasted items"],
              ["raw_material", "Raw materials"],
              ["packaging_material", "Packaging"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`join-item btn btn-xs ${skuTypeFilter === value ? "btn-primary" : "btn-outline"}`}
                onClick={() => setSkuTypeFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 w-full md:w-auto">
          <input
            className="input input-bordered input-sm w-full md:w-64"
            placeholder="Search SKU (for example RM-0001)"
            value={skuSearchInput}
            onChange={(e) => onSkuSearchInputChange(e.target.value)}
            onFocus={() => setSkuSearchOpen(true)}
            onBlur={() => setTimeout(() => setSkuSearchOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applySkuSearch();
              }
            }}
          />
          {skuSearchOpen && skuSearchResults.length > 0 && (
            <div className="absolute left-0 top-9 z-20 max-h-64 w-full md:w-64 overflow-auto rounded-md border border-base-300 bg-base-100 shadow-lg">
              {skuSearchResults.map((sku) => (
                <button
                  key={sku}
                  type="button"
                  className="w-full px-3 py-2 text-left text-xs font-mono hover:bg-base-200 border-b border-base-300/50"
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
          <button className="btn btn-sm btn-primary text-white font-semibold" onClick={applySkuSearch}>
            Select SKU
          </button>
          {selectedSku && (
            <button 
              className="btn btn-sm btn-ghost text-xs" 
              onClick={() => {
                setSelectedSku("");
                setSkuSearchInput("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-base-100 border border-base-300 p-1.5 rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-semibold rounded-lg transition-all duration-200 px-3 py-1.5 flex items-center justify-center gap-1.5 text-[13px] ${
                tab === t.id ? "bg-primary text-primary-content shadow-sm" : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
              }`}
            >
              <span className="material-symbols-outlined text-sm">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div 
          className="flex items-center gap-2 px-3 py-1.5 bg-base-200/50 rounded-lg border border-base-300/40 select-none mr-1.5 cursor-pointer hover:bg-base-200 transition-colors"
          onClick={() => setShowCI(!showCI)}
        >
          <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${showCI ? 'bg-primary' : 'bg-gray-400'}`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${showCI ? 'translate-x-4' : 'translate-x-1'}`} />
          </div>
          <span className="text-[11px] font-semibold text-base-content/85 leading-none mt-0.5">
            Show 90% Confidence Intervals
          </span>
        </div>
      </div>

      {/* ── TAB CONTENT: OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard title="Forecast Accuracy" value={wapeVal !== null ? `${(100 - wapeVal).toFixed(1)}%` : "—"} sub={wapeVal !== null ? `WAPE = ${wapeVal}%` : "No metrics yet"} color={C.ok} icon="track_changes" />
            <KpiCard title="Forecasted Units" value={forecastedUnitsForHorizon !== null ? forecastedUnitsForHorizon.toLocaleString() : "—"} sub={`Sum P50 horizons 1–${forecastHorizonMonths}`} color={C.accent} icon="package_2" />
            <KpiCard title="Proposed Releases" value={inventoryPlan.releaseCount} sub={`Simulated with ${selectedSkuRecommendation?.lead_time_days ?? demandHistory.find((row) => row.sku === selectedSku)?.lead_time_days ?? 30}-day lead time`} color={C.danger} icon="shopping_cart_checkout" />
            <KpiCard title="Minimum Cover" value={minimumProjectedCoverDays !== null ? `${minimumProjectedCoverDays}d` : "—"} sub={inventoryPlan.firstRiskPeriod ? `First action: ${inventoryPlan.firstRiskPeriod}` : "No projected exception"} color={C.accent3} icon="calendar_month" />
            <KpiCard title="P90 Demand Fill" value={projectedRiskFillRatePct !== null ? `${projectedRiskFillRatePct}%` : "—"} sub="Stress case across the plan horizon" color={C.warn} icon="verified" />
          </div>

          {/* Large Historical Demand & Forecast Chart */}
          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <SectionHeader title="Historical Demand vs Forecast — 24-Month View" sub={hasBacktestActuals ? "Historical backtest followed by the promoted 12-month forecast" : "Published forecast only — historical comparison is unavailable"} />
            <div className="h-80 w-full mt-3">
              {processedForecastData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-base-content/60">No forecast points for this SKU / filter.</div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={processedForecastData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--fallback-bc, #e2e8f0)" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 10 }} />
                  <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  {transitionLabel && null}
                  {showCI && (
                    <>
                      <Line type="monotone" dataKey="upper" stroke={C.accent} strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Upper interval bound" />
                      <Line type="monotone" dataKey="lower" stroke={C.accent} strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Lower interval bound" />
                    </>
                  )}
                  <Line type="monotone" dataKey="actual" stroke="#000000" strokeWidth={2.5} dot={false} name="Historical demand" connectNulls />
                  <Line type="monotone" dataKey="forecastHistory" stroke={C.accent3} strokeWidth={2} dot={false} strokeDasharray="5 5" name="Held-out backtest" connectNulls />
                  <Line type="monotone" dataKey="forecastFuture" stroke={C.accent} strokeWidth={2.5} dot={false} name="Published demand forecast" connectNulls />
                  <Brush startIndex={Math.max(0, processedForecastData.length - 13)} dataKey="label" height={28} stroke={C.textDim} fill={C.border + "10"} tickFormatter={() => ""} travellerWidth={14} traveller={ModernBrushHandle} />
                </ComposedChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Side-by-side Seasonality & Inventory Flow */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seasonality Chart */}
            <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
              <SectionHeader title="Seasonality Index" sub="Values >1.0 denote peak seasonal months" color={C.accent2} />
              <div className="h-56 w-full mt-3">
                {finalSeasonality.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/60 px-4 text-center">
                    Needs monthly actuals (y_true) per calendar month. Online publishes use H+1 labels only.
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={finalSeasonality}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="month" tick={{ fill: "currentColor", fontSize: 10 }} />
                    <YAxis domain={[0.4, 1.6]} tick={{ fill: "currentColor", fontSize: 10 }} />
                    <Tooltip content={<ChartTip />} />
                    <ReferenceLine y={1.0} stroke={C.accent4} strokeDasharray="4 3" />
                    <Bar dataKey="index" name="Seasonal Index" radius={[4, 4, 0, 0]}>
                      {finalSeasonality.map((s, i) => (
                        <Cell key={i} fill={s.index >= 1 ? C.accent2 : C.muted} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Lead-time inventory plan */}
            <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
              <SectionHeader title="Projected Stock Under Current Policy" sub="Month-end stock after forecast demand; diamonds mark simulated replenishment receipts—not confirmed purchase orders" color={C.accent3} />
              <div className="h-56 w-full mt-3">
                {finalInventory.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/60">No item plan is available.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={inventoryChartData.slice(-12)}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 10 }} />
                      <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                      <Tooltip content={<InventoryPlanTooltip />} />
                      <ReferenceLine y={finalInventory[0]?.safetyStock ?? 0} stroke={C.warn} strokeDasharray="4 3" />
                      <Area type="monotone" dataKey="endingP50" stroke={C.accent3} fill={C.accent3} fillOpacity={0.08} strokeWidth={2.5} dot={{ r: 2 }} name="Projected ending (P50)" />
                      <Line type="monotone" dataKey="endingP90" stroke={C.danger} strokeWidth={1.8} strokeDasharray="5 4" dot={false} name="Upper-demand ending (P90)" />
                      <Scatter dataKey="receiptEvent" fill={C.accent2} name="Simulated receipt" shape="diamond" />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: FORECAST ── */}
      {tab === "forecast" && (
        <div className="space-y-6">
          {/* Detailed Forecast View */}
          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <SectionHeader title={`${forecastHorizonMonths}-Month Forward Forecast with Confidence Intervals`} sub="Multi-horizon predictions with expected demand and optional uncertainty bounds" />
            <div className="h-72 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={processedForecastData.slice(-forecastHorizonMonths)}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 10 }} />
                  <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {showCI && (
                    <>
                      <Line type="monotone" dataKey="upper" stroke={C.accent} strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Upper 90% CI" legendType="none" />
                      <Line type="monotone" dataKey="lower" stroke={C.accent} strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Lower 90% CI" legendType="none" />
                    </>
                  )}
                  <Line type="monotone" dataKey="forecastHistory" stroke={C.accent3} strokeWidth={2.5} strokeDasharray="5 5" name="Past Forecast (Backtest)" connectNulls />
                  <Line type="monotone" dataKey="forecastFuture" stroke={C.accent} strokeWidth={3} dot={{ r: 4, fill: C.accent }} name="Future Forecast" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
              <SectionHeader title="Seasonality Radar" sub="Relative seasonal intensity across calendar year" color={C.accent3} />
              <div className="h-56 w-full mt-3 flex justify-center items-center">
                {finalSeasonality.length === 0 ? (
                  <div className="text-sm text-base-content/60 px-4 text-center">
                    Needs at least 12 months of demand history for the selected SKU.
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={finalSeasonality}>
                    <PolarGrid stroke="currentColor" opacity={0.1} />
                    <PolarAngleAxis dataKey="month" tick={{ fill: "currentColor", fontSize: 9 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fill: "currentColor", fontSize: 8 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Radar name="Seasonality Multiplier" dataKey="index" stroke={C.accent} fill={C.accent} fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Forecast Points Table */}
          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <SectionHeader title={`${forecastHorizonMonths}-Month Forecast Details Table`} sub="Monthly forecasts with confidence intervals" color={C.accent} />
              <button 
                className="btn btn-xs btn-outline btn-primary" 
                onClick={() => downloadCsv("forecast_points.csv", finalForecastData.slice(-forecastHorizonMonths))}
              >
                Export Forecast CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr className="border-b border-base-300">
                    <th>Horizon Month</th>
                    <th className="text-right">Expected Demand (p50)</th>
                    <th className="text-right">Lower 90% Bound</th>
                    <th className="text-right">Upper 90% Bound</th>
                    <th className="text-right">Confidence Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {finalForecastData.slice(-forecastHorizonMonths).map((row, i) => (
                    <tr key={i} className="hover">
                      <td className="font-semibold font-mono text-primary text-xs">{row.label}</td>
                      <td className="text-right font-bold">{(row.forecast ?? 0).toLocaleString()}</td>
                      <td className="text-right text-base-content/75">{(row.lower ?? 0).toLocaleString()}</td>
                      <td className="text-right text-base-content/75">{(row.upper ?? 0).toLocaleString()}</td>
                      <td className="text-right text-warning font-semibold">±{Math.round(((row.upper ?? 0) - (row.lower ?? 0)) / 2).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: SKU ANALYSIS ── */}
      {tab === "sku" && (
        <div className="space-y-6">
          {/* Business impact / forecast reliability matrix */}
          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <SectionHeader title="Forecast Attention Matrix" sub="Right means higher monthly demand; up means higher forecast error. Color identifies the planner action, not the product category." color={C.accent2} />
            <div className="h-72 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ left: 10, right: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="velocity" name="Velocity" unit=" u" tick={{ fill: "currentColor", fontSize: 10 }} label={{ value: "Monthly Velocity (Average Demand)", position: "bottom", fill: "currentColor", fontSize: 10, offset: 0 }} />
                  <YAxis dataKey="mape" name="WAPE" unit="%" tick={{ fill: "currentColor", fontSize: 10 }} label={{ value: "Forecast Error (WAPE %)", angle: -90, position: "left", fill: "currentColor", fontSize: 10 }} />
                  <ReferenceLine y={10} stroke={C.warn} strokeDasharray="5 4" label={{ value: "10% review threshold", fill: "#111827", fontSize: 10, fontWeight: 700, position: "insideTopRight", dy: -6 }} />
                  <ReferenceLine x={velocityThreshold} stroke={C.textDim} strokeDasharray="5 4" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-base-200 border border-base-300 rounded-lg p-3 shadow-md text-xs">
                        <p className="text-primary font-bold mb-1 font-mono">{d.sku}</p>
                        <p className="my-0.5">Velocity: <strong>{d.velocity} u/mo</strong></p>
                        <p className="my-0.5">WAPE: <strong>{d.mape}%</strong></p>
                        <p className="my-0.5">Stock Cover: <strong>{d.stockDays} days</strong></p>
                        <div className="flex gap-1.5 mt-2">
                          <Badge label={d.attention} color={d.attentionColor} />
                          <Badge label={`ABC ${d.abc} / FMS ${d.fms}`} color={C.textDim} />
                        </div>
                      </div>
                    );
                  }} />
                  <Scatter data={forecastAttentionData} name="SKUs">
                    {forecastAttentionData.map((s: any, i) => (
                      <Cell key={i} fill={s.attentionColor} fillOpacity={0.85} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Full SKU Classifications Table */}
          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <SectionHeader title="SKU Classifications & Reorder Matrix" sub="ABC = annual issued volume within subtype · FMS = issue-event frequency within subtype" color={C.accent3} />
              <div className="flex gap-2">
                <select
                  className="select select-bordered select-xs"
                  value={inventorySort}
                  onChange={(e) => setInventorySort(e.target.value as any)}
                >
                  <option value="risk_desc">Sort: Stockout Risk</option>
                  <option value="suggested_desc">Sort: Suggested PO Qty</option>
                  <option value="sku_asc">Sort: SKU A-Z</option>
                  <option value="sku_desc">Sort: SKU Z-A</option>
                </select>
                <input
                  className="input input-bordered input-xs w-48"
                  placeholder="Filter SKU / Category..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr className="border-b border-base-300">
                    <th>SKU ID</th>
                    <th>Category</th>
                    <th className="text-right">Velocity</th>
                    <th className="text-right">Stock Cover</th>
                    <th className="text-right">WAPE %</th>
                    <th className="text-right">Reorder Point</th>
                    <th className="text-right">Safety Stock</th>
                    <th>ABC</th>
                    <th>FMS</th>
                    <th>Inventory Status</th>
                  </tr>
                </thead>
                <tbody>
                  {finalSkuData.slice(0, 15).map((s: any, i) => {
                    const risk = s.stockDays < 15 ? "danger" : s.stockDays < 25 ? "warn" : "ok";
                    const rColor = { danger: C.danger, warn: C.warn, ok: C.ok }[risk];
                    const rLabel = { danger: "Stockout Risk", warn: "Monitor", ok: "Healthy" }[risk];
                    const rIcon = { danger: "warning", warn: "info", ok: "check_circle" }[risk];
                    return (
                      <tr key={i} className="hover">
                        <td className="font-semibold font-mono text-xs text-primary">{s.sku}</td>
                        <td className="text-xs text-base-content/70">{s.category}</td>
                        <td className="text-right font-semibold">{s.velocity.toLocaleString()}</td>
                        <td className="text-right font-bold" style={{ color: rColor }}>{s.stockDays}d</td>
                        <td className="text-right font-mono text-xs">{s.mape}%</td>
                        <td className="text-right">{s.reorderPoint.toLocaleString()}</td>
                        <td className="text-right">{s.safetyStock.toLocaleString()}</td>
                        <td><Badge label={s.abc} color={abcColor[s.abc] || C.muted} /></td>
                        <td><Badge label={s.fms} color={C.accent3} /></td>
                        <td>
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border"
                            style={{ 
                              background: rColor + "15", 
                              color: rColor, 
                              borderColor: rColor + "40"
                            }}
                          >
                            <span className="material-symbols-outlined text-[12px]">{rIcon}</span>
                            {rLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Velocity & Accuracy Horizontal Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
              <SectionHeader title="Top SKUs by Demand Velocity" color={C.accent} />
              <div className="h-56 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={finalSkuData.slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis type="number" tick={{ fill: "currentColor", fontSize: 10 }} />
                    <YAxis type="category" dataKey="sku" tick={{ fill: "currentColor", fontSize: 10 }} width={70} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="velocity" name="Velocity" radius={[0, 4, 4, 0]} fill={C.accent3} fillOpacity={0.78} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
              <SectionHeader title="Forecast Error (WAPE %) per SKU" sub="Highest-demand SKUs; the labelled 10% line marks the review threshold" color={C.accent2} />
              <div className="h-56 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={finalSkuData.slice(0, 6)} layout="vertical" margin={{ top: 18, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis type="number" tick={{ fill: "currentColor", fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="sku" tick={{ fill: "currentColor", fontSize: 10 }} width={70} />
                    <Tooltip content={<ChartTip />} />
                    <ReferenceLine x={10.0} stroke={C.warn} strokeDasharray="4 3" label={{ value: "10% review threshold", fill: "#111827", fontSize: 10, fontWeight: 700, position: "insideTopRight", dx: -4, dy: -7 }} />
                    <Bar dataKey="mape" name="WAPE %" radius={[0, 4, 4, 0]}>
                      {finalSkuData.slice(0, 6).map((s: any, i: number) => (
                        <Cell key={i} fill={s.mape > 15.0 ? C.danger : s.mape > 10.0 ? C.warn : C.ok} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: INVENTORY ── */}
      {tab === "inventory" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Selected On-hand" value={(selectedSkuRecommendation?.on_hand_inventory ?? 0).toLocaleString()} sub={`${selectedSku || "Item"} available before forecast demand`} color={C.accent} icon="package_2" />
            <KpiCard title="Proposed Releases" value={inventoryPlan.releaseCount} sub={`${inventoryPlan.totalPlannedReceipts.toLocaleString()} simulated receipt units within horizon`} color={C.danger} icon="shopping_cart_checkout" />
            <KpiCard title="Projected P50 Fill" value={projectedFillRatePct !== null ? `${projectedFillRatePct}%` : "—"} sub="Forecast demand fulfilled by the policy plan" color={C.ok} icon="check_circle" />
            <KpiCard title="Projected P90 Fill" value={projectedRiskFillRatePct !== null ? `${projectedRiskFillRatePct}%` : "—"} sub="Upper-demand stress case with the same receipts" color={C.accent4} icon="shield" />
          </div>

          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <SectionHeader title="Projected Stock & Replenishment Events" sub="Monthly stock after forecast consumption; receipt markers come from the current replenishment policy simulation" color={C.accent3} />
            <div className="h-72 w-full mt-3">
              {finalInventory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-base-content/60 text-center px-6">
                  Select a forecasted inventory item with assigned WMS stock to calculate its replenishment projection.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={inventoryChartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 10 }} />
                  <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                  <Tooltip content={<InventoryPlanTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={finalInventory[0]?.reorderPoint ?? 0} stroke={C.danger} strokeDasharray="6 3" label={{ value: "Reorder point", fill: C.text, fontSize: 10, fontWeight: 600, position: "insideTopRight" }} />
                  <ReferenceLine y={finalInventory[0]?.safetyStock ?? 0} stroke={C.warn} strokeDasharray="3 3" label={{ value: "Safety stock", fill: C.text, fontSize: 10, fontWeight: 600, position: "insideBottomRight" }} />
                  <Area type="monotone" dataKey="endingP50" stroke={C.accent3} fill={C.accent3} fillOpacity={0.08} strokeWidth={3} dot={{ r: 3 }} name="Projected ending (P50 demand)" />
                  <Line type="monotone" dataKey="endingP90" stroke={C.danger} strokeWidth={2} strokeDasharray="6 4" dot={false} name="Upper-demand ending (P90)" />
                  <Scatter dataKey="receiptEvent" fill={C.accent2} name="Simulated receipt event" shape="diamond" />
                  <Brush startIndex={Math.max(0, finalInventory.length - 13)} dataKey="label" height={28} stroke={C.textDim} fill={C.border + "10"} tickFormatter={() => ""} travellerWidth={14} traveller={ModernBrushHandle} />
                </ComposedChart>
              </ResponsiveContainer>
              )}
            </div>
            {finalInventory.length > 0 && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-blue-950"><strong>Blue:</strong> expected month-end stock after P50 forecast demand.</div>
                <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-rose-950"><strong>Red dashed:</strong> stock remaining under the P90 high-demand case.</div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-emerald-950"><strong>Green diamond:</strong> simulated policy receipt. No marker means no receipt is due—not zero stock.</div>
              </div>
            )}
          </div>

          {/* Stock Coverage Heatmap */}
          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <SectionHeader title="Forward Days of Supply" sub="Each value consumes the following forecast buckets until projected ending stock is exhausted; future receipts are shown separately" color={C.accent4} />
            {finalInventory.length === 0 ? (
              <div className="py-12 text-center text-sm text-base-content/60">
                Coverage is unavailable until both live assigned stock and a published demand forecast exist for the item.
              </div>
            ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
              {finalInventory.slice(0, 12).map((row, i) => {
                const cover = row.daysOfSupply;
                const urgency = row.status === "stockout" ? "danger" : row.status === "order" || row.status === "watch" ? "warn" : "ok";
                const colorHex = { danger: C.danger, warn: C.warn, ok: C.ok, neutral: C.muted }[urgency];
                return (
                  <div 
                    key={i} 
                    className="flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all hover:scale-[1.02]"
                    style={{ 
                      backgroundColor: colorHex + "12",
                      borderColor: colorHex + "35"
                    }}
                  >
                    <span className="text-[10px] text-base-content/60 font-semibold">{row.label}</span>
                    <span className="text-xl font-bold mt-1" style={{ color: colorHex }}>{`${cover}d`}</span>
                    <span className="text-[9px] text-base-content/50 mt-0.5 uppercase font-medium">{row.status === "stockout" ? "Shortage" : row.status === "order" ? "Order proposed" : row.status === "watch" ? "Safety risk" : "Covered"}</span>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <SectionHeader title="Monthly Inventory Ledger" sub="One auditable policy simulation drives the chart, proposed releases, service projection, and coverage" color={C.accent} />
              <button className="btn btn-xs btn-outline btn-primary" onClick={() => downloadCsv("inventory_plan.csv", finalInventory)}>
                Export plan CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="border-b border-base-300">
                    <th>Period</th>
                    <th className="text-right">Beginning</th>
                    <th className="text-right">Simulated receipt</th>
                    <th className="text-right">P50 demand</th>
                    <th className="text-right">P90 demand</th>
                    <th className="text-right">Ending P50</th>
                    <th className="text-right">Ending P90</th>
                    <th className="text-right">Proposed release</th>
                    <th>Simulated due period</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {finalInventory.map((row) => {
                    const statusColor = row.status === "stockout" ? C.danger : row.status === "healthy" ? C.ok : C.warn;
                    const statusLabel = row.status === "stockout" ? "Shortage" : row.status === "order" ? "Order proposed" : row.status === "watch" ? "Safety risk" : "Covered";
                    return (
                      <tr key={row.period} className="hover">
                        <td className="font-mono text-xs font-semibold">{row.label}</td>
                        <td className="text-right tabular-nums">{row.beginning.toLocaleString()}</td>
                        <td className="text-right tabular-nums text-success font-semibold">{row.receipt ? `+${row.receipt.toLocaleString()}` : "—"}</td>
                        <td className="text-right tabular-nums">{row.demandP50.toLocaleString()}</td>
                        <td className="text-right tabular-nums text-error">{row.demandP90.toLocaleString()}</td>
                        <td className="text-right tabular-nums font-semibold">{row.endingP50.toLocaleString()}</td>
                        <td className="text-right tabular-nums">{row.endingP90.toLocaleString()}</td>
                        <td className="text-right tabular-nums font-semibold text-primary">{row.orderReleaseQty ? row.orderReleaseQty.toLocaleString() : "—"}</td>
                        <td className="text-xs">{row.orderDueLabel ?? "—"}</td>
                        <td><Badge label={statusLabel} color={statusColor} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: MODEL PERFORMANCE ── */}
      {tab === "model" && (
        <div className="space-y-6">
          {/* KPI grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
            <KpiCard title="WAPE Error" value={fmtMetric(wapeVal, "%")} sub={wapeVal !== null ? "Held-out test evidence for the promoted model" : "No matching backtest evidence"} color={C.ok} icon="track_changes" />
            <KpiCard title="RMSE Error" value={fmtMetric(rmseVal)} sub={rmseVal !== null ? "Held-out scale-dependent error" : "No matching backtest evidence"} color={C.accent} icon="architecture" />
            <KpiCard title="Model Bias" value={fmtMetric(biasVal, "%")} sub={biasVal !== null ? "Held-out signed error" : "No matching backtest evidence"} color={C.warn} icon="balance" />
            <KpiCard title="90% Interval Coverage" value={fmtMetric(coverageVal, "%")} sub={hasBacktestActuals ? "Actuals inside calibrated 90% bounds" : "Needs y_true backtest rows"} color={C.accent3} icon="straighten" />
          </div>

          <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="material-symbols-outlined text-primary text-2xl mt-0.5">psychology</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base-content">{displayModelName(filters.model)}</h3>
                    <span className="badge badge-success badge-outline badge-sm font-semibold">PROMOTED</span>
                  </div>
                  <p className="text-xs text-base-content/60 mt-1">Active H1–H12 demand forecast for the current warehouse planning dataset.</p>
                </div>
              </div>
              <code className="text-[10px] sm:text-xs bg-base-200 border border-base-300 rounded-md px-2.5 py-1.5 text-base-content/65 break-all">{filters.model}</code>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <SectionHeader title="Where This Forecast Is Used" sub="The promoted rows are operational inputs; execution remains approval-controlled" color={C.accent3} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl border border-base-300 p-4">
                <div className="flex items-center justify-between gap-2"><strong className="text-sm">Inventory policy</strong><span className="badge badge-success badge-sm">Connected</span></div>
                <p className="text-xs text-base-content/60 mt-2 leading-5">P10/P50/P90 demand feeds lead-time safety stock, reorder point, min/max and the stochastic service/cost gate.</p>
              </div>
              <div className="rounded-xl border border-base-300 p-4">
                <div className="flex items-center justify-between gap-2"><strong className="text-sm">Draft purchasing</strong><span className="badge badge-warning badge-sm">Manager-gated</span></div>
                <p className="text-xs text-base-content/60 mt-2 leading-5">An approved policy run may create draft inbound purchase suggestions. The forecast never releases a purchase order automatically.</p>
              </div>
              <div className="rounded-xl border border-base-300 p-4">
                <div className="flex items-center justify-between gap-2"><strong className="text-sm">Space and slotting</strong><span className="badge badge-success badge-sm">Connected via policy</span></div>
                <p className="text-xs text-base-content/60 mt-2 leading-5">Forecast P50, stock delta and pallet demand flow into the constrained slotting optimizer after policy review.</p>
              </div>
            </div>
          </div>

          {/* Model residuals */}
          <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
            <SectionHeader title="Forecast Residuals Over Time (Actual vs Expected)" sub="Backtest residuals should be centered near zero; inspect tails, changing variance and autocorrelation rather than assuming Gaussian noise" color={C.accent2} />
            <div className="h-56 w-full mt-3">
              {finalResiduals.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-base-content/60 px-4 text-center">
                  Residuals need published rows with y_true (actual demand). Online runs store forecasts only.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={finalResiduals}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 10 }} />
                  <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <ReferenceLine y={0} stroke={C.accent4} strokeWidth={1.5} />
                  <Bar dataKey="residual" name="Residual Error" radius={[3, 3, 0, 0]}>
                    {finalResiduals.map((r, i) => (
                      <Cell key={i} fill={C.accent} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
              <SectionHeader title="Absolute Forecast Error Distribution" sub="Confidence interval widths and magnitude of absolute residuals" color={C.accent3} />
              <div className="h-56 w-full mt-3">
                {finalResiduals.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/60 px-4 text-center">
                    Error distribution needs backtest rows with actuals vs forecast.
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={finalResiduals}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 10 }} />
                    <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="absError" stroke={C.accent3} fill={C.accent3} fillOpacity={0.08} strokeWidth={2} name="Absolute Error" />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Model Target Scorecard */}
            <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
              <SectionHeader title="Model Accuracy Scorecard vs Thresholds" sub="Operational SLA targets set for production deployment" color={C.accent4} />
              <div className="space-y-4 mt-3">
                {[
                  { label: "Weighted Absolute Percentage Error (WAPE)", value: wapeVal, target: 15, targetText: "≤ 15%", unit: "%", good: wapeVal !== null && wapeVal <= 15 },
                  { label: "Normalized RMSE (NRMSE)", value: nrmseVal, target: 30, targetText: "≤ 30%", unit: "%", good: nrmseVal !== null && nrmseVal <= 30 },
                  { label: "Forecast Bias Limit", value: biasVal !== null ? Math.abs(biasVal) : null, target: 5.0, targetText: "≤ 5%", unit: "%", good: biasVal !== null && Math.abs(biasVal) <= 5.0 },
                  { label: "90% Interval Empirical Coverage", value: coverageVal, target: 90.0, targetText: "85–95%", unit: "%", good: coverageVal !== null && coverageVal >= 85.0 && coverageVal <= 95.0 },
                ].map((m, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-base-content/80 font-medium">{m.label}</span>
                      <span className={`font-bold flex items-center gap-1 ${m.good ? "text-success" : m.value === null ? "text-base-content/50" : "text-error"}`}>
                        {m.value === null ? "—" : `${m.value}${m.unit}`}
                        {m.value !== null && (
                          <span className="material-symbols-outlined text-[14px]">{m.good ? "check_circle" : "cancel"}</span>
                        )}
                        <span>{m.value === null ? "No data" : m.good ? "Threshold pass" : "Review required"}</span>
                      </span>
                    </div>
                    {m.value !== null && (
                    <div className="h-2 bg-base-300 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${m.good ? "bg-success" : "bg-error"}`}
                        style={{ width: `${Math.min((m.value / (m.target * 1.5)) * 100, 100)}%` }}
                      />
                    </div>
                    )}
                    <div className="text-[10px] text-base-content/40 mt-0.5">Acceptance target: {m.targetText}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center border-t border-base-300 pt-4 text-[10px] text-base-content/50">
        <span>OptiWMS Demand Planning Console v2.4</span>
        <span>Plan generated from the active forecast, inventory position, and replenishment policy</span>
      </div>
    </div>
  );
}
