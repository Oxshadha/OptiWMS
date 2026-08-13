"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";
import { slottingPlansApi, type SlottingPlanSummary, type SlottingReadiness } from "@/lib/api/slotting-plans";
import { DemandShiftInsights } from "./DemandShiftInsights";

type HubStripProps = {
  warehouseId?: string;
  compact?: boolean;
};

export function IntelligentEngineHubStrip({ warehouseId: warehouseIdProp, compact = false }: HubStripProps) {
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<SlottingPlanSummary | null>(null);
  const [readiness, setReadiness] = useState<SlottingReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState(warehouseIdProp ?? "");

  useEffect(() => {
    void warehousesApi.getAll().then(setWarehouses).catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    if (warehouseIdProp) {
      setWarehouseId(warehouseIdProp);
    } else if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouseIdProp, warehouses, warehouseId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        if (!warehouseId) {
          setActivePlan(null);
          setReadiness(null);
          return;
        }

        const [readinessResult, planResult] = await Promise.all([
          slottingPlansApi.getReadiness(warehouseId).catch(() => null),
          slottingPlansApi.getActivePlan(warehouseId).catch(() => null),
        ]);

        if (cancelled) return;
        setReadiness(readinessResult);
        setActivePlan(planResult);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load engine status");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  return (
    <div className={clsx("space-y-4", compact ? "" : "mb-8")}>
      {error && <div className="alert alert-warning text-sm">{error}</div>}

      {!loading && readiness && !readiness.ready && (
        <div className="alert alert-error">
          <span className="material-symbols-outlined">block</span>
          <div>
            <p className="font-semibold">Slotting master data incomplete</p>
            <p className="text-sm">
              Materials {readiness.materialsReadyCount}/{readiness.materialsTotalCount} ({readiness.materialsReadyPct}%)
              · Locations {readiness.locationsReadyCount}/{readiness.locationsTotalCount} ({readiness.locationsReadyPct}%)
            </p>
            {readiness.blockers[0] && <p className="text-xs mt-1">{readiness.blockers[0]}</p>}
            <Link href="/admin/materials" className="link link-hover text-xs mt-1 inline-block">
              Fix in Product Catalog →
            </Link>
          </div>
        </div>
      )}

      {warehouses.length > 1 && !warehouseIdProp && (
        <div className="form-control max-w-xs">
          <label className="label py-0"><span className="label-text text-xs">Warehouse</span></label>
          <select
            className="select select-bordered select-sm"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      {!compact && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-base-100 border border-base-300 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">Master Data</p>
          <p className="text-2xl font-bold mt-1">
            {loading ? "…" : readiness?.ready ? "Ready" : "Blocked"}
          </p>
          <p className="text-xs text-base-content/60 mt-1">
            {readiness
              ? `${readiness.materialsReadyPct}% SKUs dimensioned · ${readiness.locationsReadyPct}% bins capped`
              : "Select a warehouse"}
          </p>
        </div>

        <div className="bg-base-100 border border-base-300 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">Slotting Planner</p>
          <p className="text-2xl font-bold mt-1">
            {loading ? "…" : activePlan?.status ?? "None active"}
          </p>
          <p className="text-xs text-base-content/60 mt-1">
            {activePlan
              ? `${activePlan.planCode} · until ${activePlan.validTo}${
                  activePlan.executionStatus && activePlan.executionStatus !== "NONE"
                    ? ` · ${activePlan.executionStatus}`
                    : ""
                }`
              : "No approved location plan for warehouse"}
          </p>
        </div>

        <div className="bg-base-100 border border-base-300 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">Workspaces</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link href="/admin/forecasts" className="btn btn-sm btn-outline">Forecasts</Link>
            <Link href="/admin/inventory-intelligence" className="btn btn-sm btn-outline">Inventory Intelligence</Link>
            <Link
              href="/admin/slotting-plans"
              className={clsx("btn btn-sm", readiness?.ready ? "btn-primary" : "btn-disabled")}
            >
              Slotting Planner
            </Link>
          </div>
        </div>
      </div>}

      <div className="bg-base-100 border border-base-300 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">Demand Shift Insights</h2>
          <Link href="/admin/slotting-plans" className="link link-hover text-xs">
            Full view →
          </Link>
        </div>
        <DemandShiftInsights warehouseId={warehouseId || undefined} compact limit={6} />
      </div>
    </div>
  );
}

export function statusBadgeClass(status: string) {
  return clsx(
    "badge badge-sm font-semibold",
    status === "ACTIVE" && "badge-success",
    status === "DRAFT" && "badge-warning",
    status === "OPTIMIZING" && "badge-info",
    status === "APPROVED" && "badge-primary",
    status === "SUPERSEDED" && "badge-ghost"
  );
}
