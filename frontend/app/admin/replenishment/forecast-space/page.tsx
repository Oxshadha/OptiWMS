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
  ROLLED_BACK: "badge-ghost",
  DRAFT: "badge-info",
};

type PolicyFilter = "all" | "review" | "safe" | "increase" | "reduce" | "gap";

export default function ForecastSpacePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [horizonMonths, setHorizonMonths] = useState(6);
  const [materialType, setMaterialType] = useState<MaterialScope>("raw_material");
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
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [policyFilter, setPolicyFilter] = useState<PolicyFilter>("all");
  const [policyPage, setPolicyPage] = useState(1);
  const [spacePage, setSpacePage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function loadWarehouses() {
      try {
        const result = await warehousesApi.getAll();
        if (cancelled) return;
        const scoped = result.filter((warehouse) => warehouse.name.toLowerCase().includes("colombo"));
        const visible = scoped.length ? scoped : result;
        setWarehouses(visible);
        if (!warehouseId && visible[0]) setWarehouseId(visible[0].id);
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

  const safePolicyCount = useMemo(
    () => policyLines.filter((line) => line.confidenceScore >= 90 && line.recommendationStatus !== "DATA_INSUFFICIENT").length,
    [policyLines]
  );

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

  async function rollbackPolicyRun() {
    const runId = selectedPolicyRun?.id;
    if (!runId) return;
    try {
      setBusyAction("rollback-policy");
      setError(null);
      await forecastSpaceApi.rollbackPolicyRun(runId, { rolledBackBy: "warehouse-manager-ui" });
      await refresh();
      setSelectedPolicyRunId(runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rollback stock rules");
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
            Colombo Main RM stock and space planning using the 12-month operational forecast, supplier rules, expiry, capacity, and location compatibility.
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
              <option value="packaging_material" disabled>Packaging materials</option>
              <option value="product" disabled>Finished goods</option>
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
        <MetricCard label="Stock rule change" value={fmt(selectedPolicyRun?.totalStockDelta)} detail={`${policySummary.reduceCount} reduce · ${policySummary.increaseCount} increase`} />
        <MetricCard label="Pallet position change" value={fmt(selectedPolicyRun?.totalPalletPositionsDelta)} detail={selectedPolicyRun ? `${selectedPolicyRun.highRiskCount} high-risk · ${selectedPolicyRun.dataInsufficientCount} data gaps` : "No run generated"} />
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
              <h2 className="font-semibold">RM Stock Rule Recommendation</h2>
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
                {busyAction === "policy" ? "Generating..." : "Generate stock rules"}
              </button>
              <button className="btn btn-sm btn-success" onClick={() => setApprovalOpen(true)} disabled={!selectedPolicyRun || selectedPolicyRun.status === "APPROVED" || busyAction !== null}>
                {busyAction === "approve-policy" ? <span className="loading loading-spinner loading-xs" /> : <span className="material-symbols-outlined text-base">done_all</span>}
                Approve stock rules
              </button>
              <button className="btn btn-sm btn-outline" onClick={rollbackPolicyRun} disabled={!selectedPolicyRun || selectedPolicyRun.status !== "APPROVED" || busyAction !== null}>
                {busyAction === "rollback-policy" ? <span className="loading loading-spinner loading-xs" /> : <span className="material-symbols-outlined text-base">undo</span>}
                Rollback
              </button>
            </div>
          </div>
          <PolicyLinesTable
            lines={policyLines}
            filter={policyFilter}
            onFilterChange={(next) => {
              setPolicyFilter(next);
              setPolicyPage(1);
            }}
            page={policyPage}
            onPageChange={setPolicyPage}
          />
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
            <RiskRow label="High confidence" value={safePolicyCount} />
            <RiskRow label="Forecast coverage" value={readiness?.forecastCoveragePct ?? 0} suffix="%" />
            <RiskRow label="Pallet spec coverage" value={readiness?.palletSpecCoveragePct ?? 0} suffix="%" />
          </div>
        </div>
      </section>

      <section className="bg-base-100 border border-base-300 rounded-lg">
        <div className="p-4 border-b border-base-300 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-semibold">Space Optimization Run</h2>
            <p className="text-xs text-base-content/60">{selectedSpaceRun ? `${engineLabel(selectedSpaceRun.algorithm)} · ${selectedSpaceRun.status} · ${dateText(selectedSpaceRun.createdAt)} · move cap ${selectedSpaceRun.relocationCapPct ?? (horizonMonths >= 6 ? 30 : 15)}%` : "Create after a policy run to map released and needed pallet positions."}</p>
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
              {busyAction === "space" ? "Optimizing..." : "Run OR-Tools optimizer"}
            </button>
            <button className="btn btn-sm btn-success" onClick={approveSpaceRun} disabled={!selectedSpaceRun || selectedSpaceRun.status === "APPROVED" || busyAction !== null}>
              {busyAction === "approve-space" ? <span className="loading loading-spinner loading-xs" /> : <span className="material-symbols-outlined text-base">playlist_add_check</span>}
              Create Slotting Draft
            </button>
          </div>
        </div>
        <SpaceLinesTable lines={spaceLines} page={spacePage} onPageChange={setSpacePage} />
      </section>
      {approvalOpen && selectedPolicyRun && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">Approve RM stock rules?</h3>
            <p className="text-sm text-base-content/70 mt-2">
              This updates min stock, max stock, reorder point, buffer stock, order quantity, and pallet requirement for the selected run. A rollback snapshot will be kept.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <MetricCard label="Reduce stock" value={String(policySummary.reduceCount)} detail="SKUs freeing buffer" />
              <MetricCard label="Increase stock" value={String(policySummary.increaseCount)} detail="SKUs needing cover" />
              <MetricCard label="Review lines" value={String(policySummary.reviewCount)} detail="Check before next step" tone={policySummary.reviewCount > 0 ? "warning" : "success"} />
              <MetricCard label="High confidence" value={String(safePolicyCount)} detail="90% or above" tone="success" />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setApprovalOpen(false)}>Cancel</button>
              <button
                className="btn btn-success"
                onClick={async () => {
                  setApprovalOpen(false);
                  await approvePolicyRun();
                }}
              >
                Approve stock rules
              </button>
            </div>
          </div>
        </div>
      )}
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

function PolicyLinesTable({
  lines,
  filter,
  onFilterChange,
  page,
  onPageChange,
}: {
  lines: PolicyRecommendationLine[];
  filter: PolicyFilter;
  onFilterChange: (filter: PolicyFilter) => void;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 25;
  const filtered = lines.filter((line) => {
    if (filter === "review") return ["HIGH_RISK_REVIEW", "INFEASIBLE"].includes(line.recommendationStatus);
    if (filter === "safe") return line.confidenceScore >= 90 && !["DATA_INSUFFICIENT", "INFEASIBLE"].includes(line.recommendationStatus);
    if (filter === "increase") return (line.stockDelta ?? 0) > 0;
    if (filter === "reduce") return (line.stockDelta ?? 0) < 0;
    if (filter === "gap") return line.recommendationStatus === "DATA_INSUFFICIENT";
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <div>
      <div className="p-3 border-b border-base-300 flex flex-wrap items-center justify-between gap-2">
        <div className="join">
          {([
            ["all", "All"],
            ["review", "Needs review"],
            ["safe", "High confidence"],
            ["increase", "Increase"],
            ["reduce", "Reduce"],
            ["gap", "Data gaps"],
          ] as [PolicyFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              className={clsx("btn btn-xs join-item", filter === value ? "btn-primary" : "btn-outline")}
              onClick={() => onFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-xs text-base-content/60">
          Showing {visible.length} of {filtered.length} line(s)
        </div>
      </div>
      <div className="overflow-x-auto max-h-[620px]">
      <table className="table table-sm">
        <thead className="sticky top-0 z-10 bg-base-100 shadow-sm">
          <tr>
            <th>Material</th>
            <th className="text-right">Current</th>
            <th className="text-right">Recommended max</th>
            <th className="text-right">ROP</th>
            <th className="text-right">Order qty</th>
            <th className="text-right">Minimum order</th>
            <th className="text-right">Multiple</th>
            <th className="text-right">Units/pallet</th>
            <th className="text-right">Lead time</th>
            <th className="text-right">Stock change</th>
            <th className="text-right">Pallet change</th>
            <th className="text-right">Confidence</th>
            <th>Risk</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr><td colSpan={14} className="text-center text-base-content/50 py-8">No stock-rule lines loaded.</td></tr>
          )}
          {visible.map((line) => (
            <tr key={line.id}>
              <td>
                <div className="font-semibold">{line.materialCode}</div>
                <div className="text-xs text-base-content/50">{line.materialType ?? "material"}</div>
              </td>
              <td className="text-right">{fmt(line.currentStock)}</td>
              <td className="text-right">{fmt(line.proposedMaxStock)}</td>
              <td className="text-right">{fmt(line.proposedReorderPoint)}</td>
              <td className="text-right">{fmt(line.proposedOrderQty)}</td>
              <td className="text-right">{fmt(line.moq)}</td>
              <td className="text-right">{fmt(line.orderMultiple)}</td>
              <td className="text-right">{fmt(line.unitsPerHandlingUnit)}</td>
              <td className="text-right">{line.leadTimeDays ?? "-"}</td>
              <td className={clsx("text-right font-semibold", (line.stockDelta ?? 0) < 0 ? "text-success" : (line.stockDelta ?? 0) > 0 ? "text-warning" : "")}>{fmt(line.stockDelta)}</td>
              <td className="text-right">{fmt(line.palletPositionsDelta)}</td>
              <td className="text-right"><ConfidenceBadge value={line.confidenceScore} /></td>
              <td><StatusBadge status={line.recommendationStatus} /></td>
              <td className="min-w-80 max-w-xl text-xs text-base-content/70">
                <div>{line.rationale ?? "-"}</div>
                <details className="mt-1">
                  <summary className="cursor-pointer link link-primary">Formula inputs</summary>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    <span>Expected demand: {fmt(line.forecastP50)}</span>
                    <span>High-demand case: {fmt(line.forecastP90)}</span>
                    <span>Low-demand case: {fmt(line.forecastP10)}</span>
                    <span>Expiry-safe max: {fmt(line.expiryLimitedMaxStock)}</span>
                    <span>Before max: {fmt(line.currentMaxStock)}</span>
                    <span>Before ROP: {fmt(line.currentReorderPoint)}</span>
                  </div>
                </details>
              </td>
            </tr>
          ))}
          {lines.length > 0 && visible.length === 0 && (
            <tr><td colSpan={14} className="text-center text-base-content/50 py-8">No lines match this filter.</td></tr>
          )}
        </tbody>
      </table>
      </div>
      <div className="p-3 border-t border-base-300 flex items-center justify-end gap-2">
        <button className="btn btn-xs btn-outline" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>Previous</button>
        <span className="text-xs text-base-content/60">Page {currentPage} / {pageCount}</span>
        <button className="btn btn-xs btn-outline" disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)}>Next</button>
      </div>
    </div>
  );
}

function SpaceLinesTable({ lines, page, onPageChange }: { lines: SpaceOptimizationLine[]; page: number; onPageChange: (page: number) => void }) {
  const pageSize = 30;
  const pageCount = Math.max(1, Math.ceil(lines.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = lines.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <div>
    <div className="overflow-x-auto max-h-[520px]">
      <table className="table table-sm">
        <thead className="sticky top-0 z-10 bg-base-100 shadow-sm">
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
          {visible.map((line) => (
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
    <div className="p-3 border-t border-base-300 flex items-center justify-end gap-2">
      <button className="btn btn-xs btn-outline" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>Previous</button>
      <span className="text-xs text-base-content/60">Page {currentPage} / {pageCount}</span>
      <button className="btn btn-xs btn-outline" disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)}>Next</button>
    </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={clsx("badge badge-sm font-semibold whitespace-nowrap", statusTone[status] ?? "badge-ghost")}>{status.replaceAll("_", " ")}</span>;
}

function ConfidenceBadge({ value }: { value: number }) {
  const tone = value >= 90 ? "badge-success" : value >= 75 ? "badge-warning" : value >= 60 ? "badge-info" : "badge-error";
  const label = value >= 90 ? "High" : value >= 75 ? "Review" : value >= 60 ? "Caution" : "Gap";
  return <span className={clsx("badge badge-sm whitespace-nowrap", tone)}>{label} {fmt(value)}%</span>;
}

function engineLabel(algorithm?: string | null) {
  if (algorithm === "ORTOOLS_MILP_V1") return "OR-Tools MILP optimized";
  if (algorithm === "JAVA_FEASIBLE_FALLBACK_V1") return "Fallback rule plan";
  if (!algorithm || algorithm === "PENDING_OPTIMIZER") return "Optimizer pending";
  return algorithm.replaceAll("_", " ");
}

function fmt(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 }).format(value);
}

function dateText(value?: string | null) {
  if (!value) return "not dated";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
