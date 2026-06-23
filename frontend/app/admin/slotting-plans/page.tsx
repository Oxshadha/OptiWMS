"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useAdmin } from "@/contexts/AdminContext";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";
import {
  slottingPlansApi,
  type SlottingPlanLine,
  type SlottingPlanSummary,
  type SlottingReadiness,
} from "@/lib/api/slotting-plans";
import { statusBadgeClass } from "../replenishment/components/IntelligentEngineHubStrip";

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

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
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
      await slottingPlansApi.approve(selectedPlan.id, {
        approvedBy: admin?.email ?? "manager",
      });
      setInfo("Plan approved and applied");
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

      <div className="card bg-base-100 border border-base-300 p-4 flex flex-wrap gap-4 items-end">
        <div className="form-control">
          <label className="label"><span className="label-text">Warehouse</span></label>
          <select
            className="select select-bordered"
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
          <label className="label"><span className="label-text">Relocation budget %</span></label>
          <input
            type="number"
            className="input input-bordered w-24"
            value={relocationBudgetPct}
            onChange={(e) => setRelocationBudgetPct(Number(e.target.value))}
          />
        </div>
        <label className="label cursor-pointer gap-2">
          <input type="checkbox" className="checkbox" checked={useMilp} onChange={(e) => setUseMilp(e.target.checked)} />
          <span className="label-text">MILP for A-class</span>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card bg-base-100 border border-base-300 p-4 lg:col-span-2">
          <h2 className="font-semibold mb-3">
            {selectedPlan ? `Lines — ${selectedPlan.planCode}` : "Select a plan"}
          </h2>
          <div className="overflow-x-auto max-h-[420px]">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Current</th>
                  <th>Recommended</th>
                  <th>Move?</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="font-mono text-xs">{line.materialCode}</td>
                    <td className="font-mono text-xs">{line.currentPrimaryLocation ?? "—"}</td>
                    <td className="font-mono text-xs text-primary">{line.finalPrimaryLocation ?? line.recommendedPrimaryLocation ?? "—"}</td>
                    <td>{line.relocationFlag ? "Yes" : "—"}</td>
                    <td className="text-xs max-w-[200px] truncate">{line.moveReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
