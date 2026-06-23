"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useAdmin } from "@/contexts/AdminContext";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";
import { locationsApi, type Location } from "@/lib/api/locations";
import {
  slottingPlansApi,
  type SlottingPlanLine,
  type SlottingPlanSummary,
  type SlottingReadiness,
} from "@/lib/api/slotting-plans";
import { statusBadgeClass } from "../replenishment/components/IntelligentEngineHubStrip";
import { DemandShiftInsights } from "../replenishment/components/DemandShiftInsights";
import {
  buildLocationIndex,
  buildWarehouseLayoutUrl,
  resolveLocationPresentation,
} from "@/lib/utils/location-identity";

function moveBadge(line: SlottingPlanLine) {
  if (line.relocationApplied) {
    return <span className="badge badge-success badge-sm">Applied</span>;
  }
  if (line.relocationFlag) {
    return <span className="badge badge-warning badge-sm">Proposed</span>;
  }
  return <span className="text-base-content/40">—</span>;
}

function reasonBadge(reason?: string) {
  if (!reason?.trim()) return <span className="text-base-content/40">—</span>;
  const lower = reason.toLowerCase();
  const tone = lower.includes("zone")
    ? "badge-info"
    : lower.includes("distance") || lower.includes("pick")
      ? "badge-primary"
      : lower.includes("capacity") || lower.includes("volume")
        ? "badge-secondary"
        : "badge-ghost";
  return (
    <span className={clsx("badge badge-sm max-w-[220px] truncate", tone)} title={reason}>
      {reason}
    </span>
  );
}

function LocationCell({
  code,
  locationIndex,
  warehouseId,
}: {
  code: string | null | undefined;
  locationIndex: Map<string, Location>;
  warehouseId: string;
}) {
  const presentation = resolveLocationPresentation(code, locationIndex);
  if (!presentation) return <span className="text-base-content/40">—</span>;
  return (
    <div className="space-y-1">
      <div className="font-mono text-xs font-semibold">{presentation.rackId}</div>
      <div className="text-xs text-base-content/70">
        {presentation.binLabel}
        <span className="text-base-content/40 mx-1">·</span>
        <span className="font-mono">{presentation.locationCode}</span>
      </div>
      <Link
        href={buildWarehouseLayoutUrl(warehouseId, presentation.rackId)}
        className="link link-primary text-xs"
      >
        View in layout
      </Link>
    </div>
  );
}

export default function SlottingPlansPage() {
  const { admin } = useAdmin();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [plans, setPlans] = useState<SlottingPlanSummary[]>([]);
  const [readiness, setReadiness] = useState<SlottingReadiness | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [lines, setLines] = useState<SlottingPlanLine[]>([]);
  const [useMilp, setUseMilp] = useState(true);
  const [relocationBudgetPct, setRelocationBudgetPct] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [onlyMoved, setOnlyMoved] = useState(false);
  const [warehouseLocations, setWarehouseLocations] = useState<Location[]>([]);

  const locationIndex = useMemo(
    () => buildLocationIndex(warehouseLocations),
    [warehouseLocations]
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  const lineSummary = useMemo(() => {
    const total = lines.length;
    const movesProposed = lines.filter((line) => line.relocationFlag).length;
    const movesApplied = lines.filter((line) => line.relocationApplied).length;
    const distanceSaved = lines.reduce(
      (sum, line) => sum + (line.relocationApplied ? line.distanceSavedMeters ?? 0 : 0),
      0
    );
    const moveLimit = Math.floor(total * (relocationBudgetPct / 100));
    return { total, movesProposed, movesApplied, distanceSaved, moveLimit };
  }, [lines, relocationBudgetPct]);

  const visibleLines = useMemo(
    () => (onlyMoved ? lines.filter((line) => line.relocationFlag) : lines),
    [lines, onlyMoved]
  );

  useEffect(() => {
    void warehousesApi.getAll().then((wh) => {
      setWarehouses(wh);
      if (wh.length && !warehouseId) setWarehouseId(wh[0].id);
    });
  }, [warehouseId]);

  const loadPlans = async (whId: string) => {
    const [list, ready] = await Promise.all([
      slottingPlansApi.listPlans(whId),
      slottingPlansApi.getReadiness(whId),
    ]);
    setPlans(list);
    setReadiness(ready);
    if (list.length && !selectedPlanId) setSelectedPlanId(list[0].id);
  };

  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadPlans(warehouseId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load plans");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId) {
      setWarehouseLocations([]);
      return;
    }
    let cancelled = false;
    void locationsApi
      .getStorageLocationsByWarehouse(warehouseId)
      .then((locs) => {
        if (!cancelled) setWarehouseLocations(locs);
      })
      .catch(() => {
        if (!cancelled) setWarehouseLocations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  useEffect(() => {
    if (!selectedPlanId) {
      setLines([]);
      return;
    }
    void slottingPlansApi.getLines(selectedPlanId).then(setLines).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load plan lines")
    );
  }, [selectedPlanId]);

  const handleCreatePlan = async () => {
    if (!warehouseId || !readiness?.ready) return;
    try {
      setLoading(true);
      setError(null);
      const plan = await slottingPlansApi.createPlan({
        warehouseId,
        validMonths: 6,
        relocationBudgetPct,
        useMilpAClass: useMilp,
        createdBy: admin?.email ?? "manager",
      });
      setInfo(`Created plan ${plan.planCode}`);
      await loadPlans(warehouseId);
      setSelectedPlanId(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create plan");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPlan) return;
    try {
      setLoading(true);
      const plan = await slottingPlansApi.approve(selectedPlan.id, {
        approvedBy: admin?.email ?? "manager",
      });
      if (plan.transfersCreated && plan.transfersCreated > 0) {
        setInfo(
          `Plan approved. ${plan.transfersCreated} stock transfer job(s) created (${plan.executionStatus ?? "PENDING_MOVES"}). Forklift tasks are queued — inventory updates when moves complete.`
        );
      } else {
        setInfo("Plan approved — target default locations updated. No physical relocations required.");
      }
      await loadPlans(warehouseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Quarterly Slotting Plans</h1>
          <p className="text-sm text-base-content/60 mt-2">
            Within-aisle heuristic + optional A-class MILP. Requires catalog dimensions and rack capacity caps.
          </p>
        </div>
        <Link href="/admin/replenishment" className="btn btn-ghost btn-sm">
          ← Engine Hub
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {info && <div className="alert alert-success">{info}</div>}

      {readiness && !readiness.ready && (
        <div className="alert alert-error">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <p className="font-semibold">Master data gate — slotting blocked</p>
            <p className="text-sm">
              Materials {readiness.materialsReadyCount}/{readiness.materialsTotalCount} ·
              Locations {readiness.locationsReadyCount}/{readiness.locationsTotalCount}
            </p>
            {readiness.blockers.slice(0, 3).map((b) => (
              <p key={b} className="text-xs">{b}</p>
            ))}
            <Link href="/admin/materials" className="link text-xs">Import dimensions in Product Catalog</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">Materials in plan</p>
          <p className="text-2xl font-bold mt-1">{lineSummary.total || "—"}</p>
          <p className="text-xs text-base-content/60 mt-1">SKUs evaluated in the selected plan</p>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">Moves proposed</p>
          <p className="text-2xl font-bold mt-1">{lineSummary.movesProposed}</p>
          <p className="text-xs text-base-content/60 mt-1">Items the optimizer wants to relocate</p>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">Move limit</p>
          <p className="text-2xl font-bold mt-1">{lineSummary.moveLimit}</p>
          <p className="text-xs text-base-content/60 mt-1">
            {relocationBudgetPct}% budget caps how many SKUs may move in one cycle
          </p>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">Distance saved</p>
          <p className="text-2xl font-bold mt-1">{lineSummary.distanceSaved.toFixed(0)} m</p>
          <p className="text-xs text-base-content/60 mt-1">Estimated from applied relocations</p>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 p-4">
        <h2 className="font-semibold mb-2">Demand Shift Insights</h2>
        <p className="text-xs text-base-content/60 mb-4">
          Forward-looking space targets from 6-month forecast P50/P90, MOQ, ROP, and lead-time guardrails.
        </p>
        <DemandShiftInsights warehouseId={warehouseId || undefined} />
      </div>

      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(220px,260px)_minmax(140px,180px)_minmax(220px,320px)_1fr] gap-4 items-end">
            <div className="form-control">
              <label className="label"><span className="label-text">Warehouse</span></label>
              <select
                className="select select-bordered min-w-56"
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  setSelectedPlanId(null);
                }}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Move limit (%)</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="input input-bordered w-28"
                value={relocationBudgetPct}
                onChange={(e) => setRelocationBudgetPct(Number(e.target.value))}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Manager impact</span></label>
              <div className="rounded-lg border border-base-300 bg-base-200 px-3 py-[0.7rem] text-sm">
                Up to <strong>{lineSummary.moveLimit}</strong> of <strong>{lineSummary.total || 0}</strong> SKUs may move
              </div>
            </div>
            <div className="flex flex-wrap justify-start xl:justify-end items-end gap-3">
              <label className="label cursor-pointer gap-2 justify-start mb-0">
                <input type="checkbox" className="checkbox" checked={useMilp} onChange={(e) => setUseMilp(e.target.checked)} />
                <span className="label-text whitespace-nowrap">Use MILP for A-class SKUs</span>
              </label>
              <button
                className="btn btn-primary"
                disabled={loading || !readiness?.ready}
                onClick={() => void handleCreatePlan()}
              >
                Generate plan
              </button>
              {selectedPlan && selectedPlan.status === "DRAFT" && (
                <button className="btn btn-success" disabled={loading} onClick={() => void handleApprove()}>
                  Approve plan
                </button>
              )}
              {selectedPlan?.executionTransferId && (
                <Link
                  href="/admin/stock-transfers"
                  className="btn btn-outline btn-sm"
                >
                  View transfer jobs
                </Link>
              )}
            </div>
          </div>
          <div className="text-xs text-base-content/60">
            Limits disruption by capping how many SKUs this plan may relocate in one cycle.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="card bg-base-100 border border-base-300 p-4 lg:col-span-1 max-h-[480px] overflow-y-auto">
          <h2 className="font-semibold mb-3">Plan history</h2>
          {plans.length === 0 ? (
            <p className="text-sm text-base-content/50">No plans yet</p>
          ) : (
            <ul className="space-y-2">
              {plans.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={clsx(
                      "w-full text-left p-3 rounded-lg border",
                      selectedPlanId === p.id ? "border-primary bg-primary/5" : "border-base-300"
                    )}
                    onClick={() => setSelectedPlanId(p.id)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-sm">{p.planCode}</span>
                      <span className={statusBadgeClass(p.status)}>{p.status}</span>
                    </div>
                    <p className="text-xs text-base-content/60 mt-1">
                      {p.validFrom} → {p.validTo}
                      {p.executionStatus && p.executionStatus !== "NONE" && (
                        <> · {p.executionStatus}</>
                      )}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card bg-base-100 border border-base-300 p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold">
              {selectedPlan ? `Lines — ${selectedPlan.planCode}` : "Select a plan"}
            </h2>
            {selectedPlan && (
              <label className="label cursor-pointer gap-2 py-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={onlyMoved}
                  onChange={(e) => setOnlyMoved(e.target.checked)}
                />
                <span className="label-text text-sm">Only moved items</span>
              </label>
            )}
          </div>
          {selectedPlan ? (
            <div className="overflow-x-auto max-h-[520px]">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Current rack / bin</th>
                    <th>Recommended rack / bin</th>
                    <th>Move</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLines.map((line) => {
                    const placements = line.placementLines?.length
                      ? line.placementLines
                      : line.reserveLocations.map((r) => ({
                          locationCode: r.finalLocationCode ?? r.locationCode,
                          palletCount: r.palletPositions,
                          quantityAllocated: 0,
                          rackId: null as string | null,
                          levelNumber: null as number | null,
                        }));
                    const clusterRacks = [
                      ...new Set(
                        placements
                          .map((p) => {
                            const pres = resolveLocationPresentation(p.locationCode, locationIndex);
                            return pres?.rackId;
                          })
                          .filter(Boolean)
                      ),
                    ];
                    return (
                      <>
                        <tr key={line.id} className={line.relocationFlag ? "bg-warning/5" : undefined}>
                          <td className="font-mono text-xs">{line.materialCode}</td>
                          <td>
                            <LocationCell
                              code={line.currentPrimaryLocation}
                              locationIndex={locationIndex}
                              warehouseId={warehouseId}
                            />
                          </td>
                          <td>
                            <LocationCell
                              code={line.finalPrimaryLocation ?? line.recommendedPrimaryLocation}
                              locationIndex={locationIndex}
                              warehouseId={warehouseId}
                            />
                          </td>
                          <td>{moveBadge(line)}</td>
                          <td>{reasonBadge(line.moveReason)}</td>
                        </tr>
                        {placements.length > 0 && (
                          <tr key={`${line.id}-placements`} className="bg-base-200/40">
                            <td colSpan={5} className="py-2">
                              <div className="text-xs text-base-content/70 mb-1">
                                <strong>{placements.length}</strong> reserve bin
                                {placements.length === 1 ? "" : "s"}
                                {clusterRacks.length > 0 && (
                                  <span>
                                    {" "}
                                    across racks{" "}
                                    <span className="font-mono">{clusterRacks.join(", ")}</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {placements.map((p) => {
                                  const pres = resolveLocationPresentation(p.locationCode, locationIndex);
                                  return (
                                    <Link
                                      key={`${line.id}-${p.locationCode}`}
                                      href={buildWarehouseLayoutUrl(
                                        warehouseId,
                                        pres?.rackId ?? p.rackId ?? undefined
                                      )}
                                      className="badge badge-outline badge-sm font-mono hover:badge-primary"
                                    >
                                      {p.locationCode} · {p.palletCount} pallet
                                      {p.palletCount === 1 ? "" : "s"}
                                    </Link>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {visibleLines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-sm text-base-content/50 py-6">
                        {onlyMoved ? "No proposed moves in this plan." : "No lines in this plan."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-base-300 p-8 text-sm text-base-content/60">
              Pick a plan from history or generate a new one to review recommended moves.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
