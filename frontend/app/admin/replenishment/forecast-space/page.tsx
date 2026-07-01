"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { forecastSpaceApi, type ForecastSpaceReadiness, type PolicyRecommendationLine, type PolicyRecommendationRun, type SpaceOptimizationLine, type SpaceOptimizationRun } from "@/lib/api/forecast-space";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";

type MaterialScope = "raw_material" | "packaging_material" | "product" | "";

const statusTone: Record<string, string> = {
  SAFE_TO_APPLY: "badge-success",
  APPLY_WITH_APPROVAL: "badge-warning",
  HIGH_RISK_REVIEW: "badge-error",
  INFEASIBLE: "badge-error",
  DATA_INSUFFICIENT: "badge-ghost",
  PENDING_APPROVAL: "badge-warning",
  APPROVED: "badge-success",
  DRAFT: "badge-info",
};

export default function ForecastSpacePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [horizonMonths, setHorizonMonths] = useState(3);
  const [materialType, setMaterialType] = useState<MaterialScope>("");
  const [readiness, setReadiness] = useState<ForecastSpaceReadiness | null>(null);
  const [policyRuns, setPolicyRuns] = useState<PolicyRecommendationRun[]>([]);
  const [policyLines, setPolicyLines] = useState<PolicyRecommendationLine[]>([]);
  const [spaceRuns, setSpaceRuns] = useState<SpaceOptimizationRun[]>([]);
  const [spaceLines, setSpaceLines] = useState<SpaceOptimizationLine[]>([]);
  const [selectedPolicyRunId, setSelectedPolicyRunId] = useState("");
  const [selectedSpaceRunId, setSelectedSpaceRunId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadWarehouses() {
      try {
        const result = await warehousesApi.getAll();
        if (cancelled) return;
        setWarehouses(result);
        if (!warehouseId && result[0]) setWarehouseId(result[0].id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load warehouses");
      }
    }
    void loadWarehouses();
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, horizonMonths, materialType]);

  useEffect(() => {
    if (!selectedPolicyRunId) {
      setPolicyLines([]);
      return;
    }
    let cancelled = false;
    forecastSpaceApi.getPolicyRunLines(selectedPolicyRunId)
      .then((lines) => {
        if (!cancelled) setPolicyLines(lines);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load policy lines");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPolicyRunId]);

  useEffect(() => {
    if (!selectedSpaceRunId) {
      setSpaceLines([]);
      return;
    }
    let cancelled = false;
    forecastSpaceApi.getSpaceRunLines(selectedSpaceRunId)
      .then((lines) => {
        if (!cancelled) setSpaceLines(lines);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load space lines");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSpaceRunId]);

  const selectedPolicyRun = useMemo(
    () => policyRuns.find((run) => run.id === selectedPolicyRunId) ?? policyRuns[0] ?? null,
    [policyRuns, selectedPolicyRunId]
  );
  const selectedSpaceRun = useMemo(
    () => spaceRuns.find((run) => run.id === selectedSpaceRunId) ?? spaceRuns[0] ?? null,
    [spaceRuns, selectedSpaceRunId]
  );

  const policySummary = useMemo(() => {
    const reduceCount = policyLines.filter((line) => (line.stockDelta ?? 0) < 0).length;
    const increaseCount = policyLines.filter((line) => (line.stockDelta ?? 0) > 0).length;
    const reviewCount = policyLines.filter((line) => ["HIGH_RISK_REVIEW", "INFEASIBLE", "DATA_INSUFFICIENT"].includes(line.recommendationStatus)).length;
    return { reduceCount, increaseCount, reviewCount };
  }, [policyLines]);

  async function refresh() {
    if (!warehouseId) return;
    try {
      setLoading(true);
      setError(null);
      const scope = materialType || undefined;
      const [readinessResult, policyResult, spaceResult] = await Promise.all([
        forecastSpaceApi.getReadiness(warehouseId, { horizonMonths, materialType: scope }),
        forecastSpaceApi.listPolicyRuns(warehouseId),
        forecastSpaceApi.listSpaceRuns(warehouseId),
      ]);
      setReadiness(readinessResult);
      setPolicyRuns(policyResult);
      setSpaceRuns(spaceResult);
      const policyRunId = selectedPolicyRunId && policyResult.some((run) => run.id === selectedPolicyRunId)
        ? selectedPolicyRunId
        : policyResult[0]?.id ?? "";
      const spaceRunId = selectedSpaceRunId && spaceResult.some((run) => run.id === selectedSpaceRunId)
        ? selectedSpaceRunId
        : spaceResult[0]?.id ?? "";
      setSelectedPolicyRunId(policyRunId);
      setSelectedSpaceRunId(spaceRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load forecast-space workspace");
    } finally {
      setLoading(false);
    }
  }

  async function createPolicyRun() {
    if (!warehouseId) return;
    try {
      setBusyAction("policy");
      setError(null);
      const run = await forecastSpaceApi.createPolicyRun({
        warehouseId,
        horizonMonths,
        materialType: materialType || undefined,
        forecastModelName: "forecast-space-core",
        createdBy: "warehouse-intelligence-ui",
        notes: "Forecast-driven min/max/ROP recommendation run",
      });
      setSelectedPolicyRunId(run.id);
      await refresh();
      setSelectedPolicyRunId(run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create policy run");
    } finally {
      setBusyAction(null);
    }
  }

  async function createSpaceRun() {
    const policyRunId = selectedPolicyRun?.id;
    if (!policyRunId) return;
    try {
      setBusyAction("space");
      setError(null);
      const run = await forecastSpaceApi.createSpaceRun({
        policyRunId,
        createdBy: "warehouse-intelligence-ui",
        notes: "Space optimization based on selected inventory policy run",
      });
      setSelectedSpaceRunId(run.id);
      await refresh();
      setSelectedSpaceRunId(run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create space run");
    } finally {
      setBusyAction(null);
    }
  }

  async function approvePolicyRun() {
    const runId = selectedPolicyRun?.id;
    if (!runId) return;
    try {
      setBusyAction("approve-policy");
      setError(null);
      await forecastSpaceApi.approvePolicyRun(runId, { approvedBy: "warehouse-manager-ui" });
      await refresh();
      setSelectedPolicyRunId(runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve policy run");
    } finally {
      setBusyAction(null);
    }
  }

  async function approveSpaceRun() {
    const runId = selectedSpaceRun?.id;
    if (!runId) return;
    try {
      setBusyAction("approve-space");
      setError(null);
      await forecastSpaceApi.approveSpaceRun(runId, { approvedBy: "warehouse-manager-ui" });
      await refresh();
      setSelectedSpaceRunId(runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve space run");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Inventory Policy & Space Planner</h1>
          <p className="text-sm text-base-content/60 mt-2 max-w-4xl">
            Inventory policy recommendations and storage impact review under forecast, MOQ, lead-time, expiry, capacity, and compatibility constraints.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="form-control w-56">
            <span className="label-text text-xs mb-1">Warehouse</span>
            <select className="select select-bordered select-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>
          <label className="form-control w-40">
            <span className="label-text text-xs mb-1">Horizon</span>
            <select className="select select-bordered select-sm" value={horizonMonths} onChange={(e) => setHorizonMonths(Number(e.target.value))}>
              <option value={1}>1 month</option>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
          </label>
          <label className="form-control w-52">
            <span className="label-text text-xs mb-1">Material scope</span>
            <select className="select select-bordered select-sm" value={materialType} onChange={(e) => setMaterialType(e.target.value as MaterialScope)}>
              <option value="">All materials</option>
              <option value="raw_material">Raw materials</option>
              <option value="packaging_material">Packaging materials</option>
              <option value="product">Finished goods</option>
            </select>
          </label>
          <button className="btn btn-sm btn-outline" onClick={refresh} disabled={loading || !warehouseId}>
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}
      {busyAction === "policy" && (
        <div className="alert alert-info text-sm">
          <span className="loading loading-spinner loading-sm" />
          <span>Generating inventory policy run. Calculating forecast demand, MOQ, reorder point, and pallet-position impact.</span>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Readiness" value={loading ? "..." : readiness?.ready ? "Ready" : "Review"} detail={readiness ? `${readiness.forecastCoveragePct}% forecast · ${readiness.inventoryCoveragePct}% inventory` : "No warehouse selected"} tone={readiness?.ready ? "success" : "warning"} />
        <MetricCard label="Policy stock delta" value={fmt(selectedPolicyRun?.totalStockDelta)} detail={`${policySummary.reduceCount} reduce · ${policySummary.increaseCount} increase`} />
        <MetricCard label="Pallet position delta" value={fmt(selectedPolicyRun?.totalPalletPositionsDelta)} detail={selectedPolicyRun ? `${selectedPolicyRun.highRiskCount} high-risk · ${selectedPolicyRun.dataInsufficientCount} data gaps` : "No run generated"} />
        <MetricCard label="Space impact" value={fmt(selectedSpaceRun?.totalSpaceSavedPalletPositions)} detail={selectedSpaceRun ? `${fmt(selectedSpaceRun.totalSpaceNeededPalletPositions)} needed · ${selectedSpaceRun.infeasibleCount} infeasible` : "No space run generated"} />
      </section>

      {readiness && !readiness.ready && (
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">priority_high</span>
          <div>
            <p className="font-semibold">Data gate: policy recommendations are blocked until required planning inputs are available.</p>
            <p className="text-sm">
              Forecast coverage {readiness.forecastCoveragePct}% · pallet specs {readiness.palletSpecCoveragePct}% · missing MOQ {readiness.missingMoqCount} · missing lead time {readiness.missingLeadTimeCount}
            </p>
            {readiness.forecastCoveragePct === 0 && (
              <p className="text-xs mt-1">
                No forecast rows were found for the selected scope. Switch material scope or publish the latest forecast run before creating policy recommendations.
              </p>
            )}
            {readiness.blockers[0] && <p className="text-xs mt-1">{readiness.blockers[0]}</p>}
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-base-100 border border-base-300 rounded-lg">
          <div className="p-4 border-b border-base-300 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="font-semibold">Inventory Policy Run</h2>
              <p className="text-xs text-base-content/60">{selectedPolicyRun ? `${selectedPolicyRun.status} · ${dateText(selectedPolicyRun.createdAt)}` : "Generate a run to calculate min, max, reorder point, and order quantity."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="select select-bordered select-sm min-w-64" value={selectedPolicyRunId} onChange={(e) => setSelectedPolicyRunId(e.target.value)} disabled={!policyRuns.length}>
                {policyRuns.length === 0 && <option value="">No policy runs</option>}
                {policyRuns.map((run) => (
                  <option key={run.id} value={run.id}>{dateText(run.createdAt)} · {run.status} · {run.horizonMonths}m</option>
                ))}
              </select>
              <button className="btn btn-sm btn-primary" onClick={createPolicyRun} disabled={!warehouseId || busyAction !== null}>
                {busyAction === "policy" ? <span className="loading loading-spinner loading-xs" /> : <span className="material-symbols-outlined text-base">calculate</span>}
                {busyAction === "policy" ? "Generating..." : "Generate Policy"}
              </button>
              <button className="btn btn-sm btn-success" onClick={approvePolicyRun} disabled={!selectedPolicyRun || selectedPolicyRun.status === "APPROVED" || busyAction !== null}>
                {busyAction === "approve-policy" ? <span className="loading loading-spinner loading-xs" /> : <span className="material-symbols-outlined text-base">done_all</span>}
                Apply Min/Max
              </button>
            </div>
          </div>
          <PolicyLinesTable lines={policyLines} />
        </div>

        <div className="bg-base-100 border border-base-300 rounded-lg">
          <div className="p-4 border-b border-base-300">
            <h2 className="font-semibold">Policy Risk Mix</h2>
            <p className="text-xs text-base-content/60">Approval should focus on exceptions, not averages.</p>
          </div>
          <div className="p-4 space-y-3">
            <RiskRow label="Need buffer reduction" value={policySummary.reduceCount} />
            <RiskRow label="Need stock increase" value={policySummary.increaseCount} />
            <RiskRow label="Require review" value={policySummary.reviewCount} danger />
            <RiskRow label="Forecast coverage" value={readiness?.forecastCoveragePct ?? 0} suffix="%" />
            <RiskRow label="Pallet spec coverage" value={readiness?.palletSpecCoveragePct ?? 0} suffix="%" />
          </div>
        </div>
      </section>

      <section className="bg-base-100 border border-base-300 rounded-lg">
        <div className="p-4 border-b border-base-300 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-semibold">Space Optimization Run</h2>
            <p className="text-xs text-base-content/60">{selectedSpaceRun ? `${selectedSpaceRun.algorithm} · ${selectedSpaceRun.status} · ${dateText(selectedSpaceRun.createdAt)}` : "Create after a policy run to map released and needed pallet positions."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="select select-bordered select-sm min-w-64" value={selectedSpaceRunId} onChange={(e) => setSelectedSpaceRunId(e.target.value)} disabled={!spaceRuns.length}>
              {spaceRuns.length === 0 && <option value="">No space runs</option>}
              {spaceRuns.map((run) => (
                <option key={run.id} value={run.id}>{dateText(run.createdAt)} · {run.status} · saved {fmt(run.totalSpaceSavedPalletPositions)}</option>
              ))}
            </select>
            <button className="btn btn-sm btn-secondary" onClick={createSpaceRun} disabled={!selectedPolicyRun || busyAction !== null}>
              {busyAction === "space" ? <span className="loading loading-spinner loading-xs" /> : <span className="material-symbols-outlined text-base">warehouse</span>}
              {busyAction === "space" ? "Optimizing..." : "Optimize Space"}
            </button>
            <button className="btn btn-sm btn-success" onClick={approveSpaceRun} disabled={!selectedSpaceRun || selectedSpaceRun.status === "APPROVED" || busyAction !== null}>
              {busyAction === "approve-space" ? <span className="loading loading-spinner loading-xs" /> : <span className="material-symbols-outlined text-base">playlist_add_check</span>}
              Create Slotting Draft
            </button>
          </div>
        </div>
        <SpaceLinesTable lines={spaceLines} />
      </section>
    </div>
  );
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "success" | "warning" }) {
  return (
    <div className={clsx("bg-base-100 border rounded-lg p-4", tone === "success" ? "border-success/40" : tone === "warning" ? "border-warning/50" : "border-base-300")}>
      <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs text-base-content/60 mt-1">{detail}</p>
    </div>
  );
}

function RiskRow({ label, value, suffix = "", danger = false }: { label: string; value: number; suffix?: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-base-content/70">{label}</span>
      <span className={clsx("font-semibold", danger && value > 0 && "text-error")}>{value}{suffix}</span>
    </div>
  );
}

function PolicyLinesTable({ lines }: { lines: PolicyRecommendationLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Material</th>
            <th className="text-right">Current</th>
            <th className="text-right">Proposed max</th>
            <th className="text-right">ROP</th>
            <th className="text-right">Order qty</th>
            <th className="text-right">Stock delta</th>
            <th className="text-right">Pallet delta</th>
            <th>Risk</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr><td colSpan={9} className="text-center text-base-content/50 py-8">No policy lines loaded.</td></tr>
          )}
          {lines.slice(0, 25).map((line) => (
            <tr key={line.id}>
              <td>
                <div className="font-semibold">{line.materialCode}</div>
                <div className="text-xs text-base-content/50">{line.materialType ?? "material"}</div>
              </td>
              <td className="text-right">{fmt(line.currentStock)}</td>
              <td className="text-right">{fmt(line.proposedMaxStock)}</td>
              <td className="text-right">{fmt(line.proposedReorderPoint)}</td>
              <td className="text-right">{fmt(line.proposedOrderQty)}</td>
              <td className={clsx("text-right font-semibold", (line.stockDelta ?? 0) < 0 ? "text-success" : (line.stockDelta ?? 0) > 0 ? "text-warning" : "")}>{fmt(line.stockDelta)}</td>
              <td className="text-right">{fmt(line.palletPositionsDelta)}</td>
              <td><StatusBadge status={line.recommendationStatus} /></td>
              <td className="min-w-72 max-w-xl text-xs text-base-content/70">{line.rationale ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpaceLinesTable({ lines }: { lines: SpaceOptimizationLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Material</th>
            <th>Current pick</th>
            <th>Recommended pick</th>
            <th className="text-right">Saved pallets</th>
            <th className="text-right">Needed pallets</th>
            <th className="text-right">Distance saved</th>
            <th>Compatible</th>
            <th>Status</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr><td colSpan={9} className="text-center text-base-content/50 py-8">No space lines loaded.</td></tr>
          )}
          {lines.slice(0, 30).map((line) => (
            <tr key={line.id}>
              <td>
                <div className="font-semibold">{line.materialCode}</div>
                <div className="text-xs text-base-content/50">{line.materialType ?? "material"}</div>
              </td>
              <td>{line.currentPrimaryLocationCode ?? "-"}</td>
              <td>{line.recommendedPrimaryLocationCode ?? "-"}</td>
              <td className="text-right text-success font-semibold">{fmt(line.spaceSavedPalletPositions)}</td>
              <td className="text-right text-warning font-semibold">{fmt(line.spaceNeededPalletPositions)}</td>
              <td className="text-right">{fmt(line.distanceSavedMeters)} m</td>
              <td>{line.compatible ? <span className="badge badge-success badge-sm">Yes</span> : <span className="badge badge-error badge-sm">No</span>}</td>
              <td><StatusBadge status={line.recommendationStatus} /></td>
              <td className="min-w-72 max-w-xl text-xs text-base-content/70">{line.rationale ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={clsx("badge badge-sm font-semibold whitespace-nowrap", statusTone[status] ?? "badge-ghost")}>{status.replaceAll("_", " ")}</span>;
}

function fmt(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 }).format(value);
}

function dateText(value?: string | null) {
  if (!value) return "not dated";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
