"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";
import { intelligenceApi, type ActionCenterSummary, type ActionItem } from "@/lib/api/intelligence";
import { IntelligentEngineHubStrip } from "./components/IntelligentEngineHubStrip";

export default function ReplenishmentPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [summary, setSummary] = useState<ActionCenterSummary | null>(null);
  const [loading, setLoading] = useState(true);
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
    let cancelled = false;
    async function loadSummary() {
      try {
        setLoading(true);
        setError(null);
        const result = await intelligenceApi.getActionCenter(warehouseId);
        if (!cancelled) setSummary(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load action center");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === warehouseId),
    [warehouses, warehouseId]
  );

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 mb-3 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-primary">
              Control Center
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-base-content tracking-tight pb-1">Intelligent Engine Action Center</h1>
          <p className="text-sm text-base-content/60 mt-2 max-w-4xl font-medium">
            Manager decisions for replenishment policy, released pallet space, location planning, and solver-backed restructures.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="form-control w-72">
            <span className="label-text text-xs mb-1 font-medium">Warehouse</span>
            <select className="select select-bordered select-sm rounded-full" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-sm btn-outline rounded-full"
            onClick={() => warehouseId && intelligenceApi.getActionCenter(warehouseId).then(setSummary).catch((e) => setError(e instanceof Error ? e.message : "Failed to refresh"))}
            disabled={!warehouseId || loading}
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Policy decisions" value={loading ? "..." : String(summary?.pendingPolicyRuns ?? 0)} detail={`Latest: ${summary?.latestPolicyStatus ?? "NONE"}`} tone={(summary?.pendingPolicyRuns ?? 0) > 0 ? "warning" : "success"} />
        <MetricCard label="Space decisions" value={loading ? "..." : String(summary?.pendingSpaceRuns ?? 0)} detail={`Saved ${fmt(summary?.totalSpaceSavedPalletPositions)} pallets · needed ${fmt(summary?.totalSpaceNeededPalletPositions)}`} tone={(summary?.pendingSpaceRuns ?? 0) > 0 ? "warning" : "success"} />
        <MetricCard label="Location plans" value={loading ? "..." : String(summary?.draftSlottingPlans ?? 0)} detail={`${summary?.totalMovesProposed ?? 0} proposed moves`} tone={(summary?.draftSlottingPlans ?? 0) > 0 ? "warning" : "success"} />
        <MetricCard label="Pallet delta" value={fmt(summary?.totalPalletDelta)} detail={`Stock delta ${fmt(summary?.totalStockDelta)}`} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-base-100 shadow-sm border-none rounded-2xl">
          <div className="p-6 border-b border-base-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Manager Action Queue</h2>
              <p className="text-xs text-base-content/60">
                {selectedWarehouse ? selectedWarehouse.name : "Selected warehouse"} · exception-first decisions with explainable rationale.
              </p>
            </div>
            <Link href="/admin/replenishment/forecast-space" className="btn btn-sm btn-primary rounded-full">Open Planner</Link>
          </div>
          <div className="divide-y divide-base-200">
            {summary?.actionItems.length === 0 && (
              <div className="p-6 text-sm text-base-content/60">No immediate manager action is pending for this warehouse.</div>
            )}
            {(summary?.actionItems ?? []).map((item) => (
              <ActionRow key={`${item.type}-${item.href}`} item={item} />
            ))}
          </div>
        </div>

        <div className="bg-base-100 shadow-sm border-none rounded-2xl">
          <div className="p-6 border-b border-base-200">
            <h2 className="font-semibold">Solver Routing</h2>
            <p className="text-xs text-base-content/60">What runs where, and why.</p>
          </div>
          <div className="p-6 space-y-4 text-sm">
            <GuidanceRow label="Inbound orders" text={summary?.solverGuidance.inboundOrderMode ?? "Fast capacity feasibility checks only."} />
            <GuidanceRow label="Policy + space" text={summary?.solverGuidance.policySpaceMode ?? "Auditable deterministic rules."} />
            <GuidanceRow label="Slotting plans" text={summary?.solverGuidance.slottingPlanMode ?? "Heuristic with optional MILP for restructures."} />
            <GuidanceRow label="Solver lab" text={summary?.solverGuidance.advancedSolverMode ?? "Admin-only GA experimentation."} />
          </div>
        </div>
      </section>

      <IntelligentEngineHubStrip warehouseId={warehouseId || undefined} compact />
    </div>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  return (
    <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={clsx("badge badge-sm", item.priority === "HIGH" ? "badge-error" : item.priority === "MEDIUM" ? "badge-warning" : "badge-ghost")}>{item.priority}</span>
          <h3 className="font-semibold">{item.title}</h3>
        </div>
        <p className="text-sm text-base-content/65 mt-1">{item.description}</p>
      </div>
      <Link href={item.href} className="btn btn-sm btn-outline shrink-0 rounded-full">Review</Link>
    </div>
  );
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "success" | "warning" }) {
  return (
    <div className={clsx("bg-base-100 shadow-sm rounded-2xl p-6 border-l-4 hover:-translate-y-1 transition-transform duration-300", tone === "success" ? "border-l-success" : tone === "warning" ? "border-l-warning" : "border-l-transparent")}>
      <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-xs text-base-content/60 mt-1">{detail}</p>
    </div>
  );
}

function GuidanceRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">{label}</p>
      <p className="mt-1 text-base-content/80">{text}</p>
    </div>
  );
}

function fmt(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 }).format(value);
}
