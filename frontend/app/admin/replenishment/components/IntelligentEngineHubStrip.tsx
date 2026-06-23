"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { slottingPlansApi, type SlottingPlanSummary, type SlottingReadiness } from "@/lib/api/slotting-plans";

type HubStripProps = {
  warehouseId?: string;
};

export function IntelligentEngineHubStrip({ warehouseId }: HubStripProps) {
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<SlottingPlanSummary | null>(null);
  const [readiness, setReadiness] = useState<SlottingReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-4 mb-8">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">Quarterly Slotting</p>
          <p className="text-2xl font-bold mt-1">
            {loading ? "…" : activePlan?.status ?? "None active"}
          </p>
          <p className="text-xs text-base-content/60 mt-1">
            {activePlan ? `${activePlan.planCode} · until ${activePlan.validTo}` : "No approved plan for warehouse"}
          </p>
        </div>

        <div className="bg-base-100 border border-base-300 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">Workspaces</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link href="/admin/forecasts" className="btn btn-sm btn-outline">Forecasts</Link>
            <Link
              href="/admin/slotting-plans"
              className={clsx("btn btn-sm", readiness?.ready ? "btn-primary" : "btn-disabled")}
            >
              Quarterly Slotting
            </Link>
            <Link href="/admin/ai-slotting" className="btn btn-sm btn-ghost">Storage Optimiser</Link>
          </div>
        </div>
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
