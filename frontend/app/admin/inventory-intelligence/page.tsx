"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useAdmin } from "@/contexts/AdminContext";
import { forecastSpaceApi, type PolicyRecommendationLine, type PolicyRecommendationRun } from "@/lib/api/forecast-space";
import { intelligenceApi, type ActionCenterSummary, type ActionItem } from "@/lib/api/intelligence";
import { slottingPlansApi } from "@/lib/api/slotting-plans";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";

const buildCommit = process.env.NEXT_PUBLIC_BUILD_COMMIT || "local";
const datasetVersion = process.env.NEXT_PUBLIC_DATASET_VERSION || "PROJECT_OPS_RM_PM";

export default function InventoryIntelligencePage() {
  const { admin } = useAdmin();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [summary, setSummary] = useState<ActionCenterSummary | null>(null);
  const [latestPolicy, setLatestPolicy] = useState<PolicyRecommendationRun | null>(null);
  const [policyLines, setPolicyLines] = useState<PolicyRecommendationLine[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    warehousesApi.getAll().then((rows) => {
      if (cancelled) return;
      const authorizedRows = admin?.warehouseId
        ? rows.filter((row) => row.id === admin.warehouseId)
        : rows;
      setWarehouses(authorizedRows);
      const scoped = admin?.warehouseId && authorizedRows.some((row) => row.id === admin.warehouseId)
        ? admin.warehouseId
        : authorizedRows[0]?.id;
      if (scoped) setWarehouseId(scoped);
    }).catch((reason) => !cancelled && setError(message(reason)));
    return () => { cancelled = true; };
  }, [admin?.warehouseId]);

  const refresh = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    setError(null);
    try {
      const [workspace, runs] = await Promise.all([
        intelligenceApi.getWorkspace(warehouseId),
        forecastSpaceApi.listPolicyRuns(warehouseId),
      ]);
      const reviewable = new Set(["DRAFT", "PENDING_APPROVAL", "READY_FOR_REVIEW"]);
      const policy = runs.find((run) => reviewable.has(run.status)) ?? runs[0] ?? null;
      const lines = policy ? await forecastSpaceApi.getPolicyRunLines(policy.id) : [];
      setSummary(workspace);
      setLatestPolicy(policy);
      setPolicyLines(lines);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const rankedLines = useMemo(() => [...policyLines]
    .sort((a, b) => (b.stockoutRiskScore ?? 0) - (a.stockoutRiskScore ?? 0) || (b.proposedOrderQty ?? 0) - (a.proposedOrderQty ?? 0))
    .slice(0, 12), [policyLines]);

  const selectedWarehouse = warehouses.find((row) => row.id === warehouseId);
  const actor = admin?.email || admin?.name || "manager";

  async function act(item: ActionItem, operation: "approve" | "defer" | "reject" | "schedule" | "create") {
    const key = `${item.type}-${operation}`;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      if (operation === "create") {
        if (item.type === "CREATE_POLICY") {
          await forecastSpaceApi.createPolicyRun({ warehouseId, horizonMonths: 6, createdBy: actor });
        } else if (item.type === "CREATE_SPACE_RUN" && item.sourceId) {
          await forecastSpaceApi.createSpaceRun({ policyRunId: item.sourceId, createdBy: actor });
        } else if (item.type === "CREATE_SLOTTING_PLAN") {
          await slottingPlansApi.createPlan({ warehouseId, validMonths: 6, relocationBudgetPct: 30, useMilpAClass: true, createdBy: actor });
        }
      } else {
        if (!item.sourceId) throw new Error("This action has no persisted recommendation ID.");
        const body = { type: item.type, warehouseId, actor };
        if (operation === "approve") await intelligenceApi.approve(item.sourceId, body);
        if (operation === "defer") await intelligenceApi.defer(item.sourceId, body);
        if (operation === "reject") await intelligenceApi.reject(item.sourceId, body);
        if (operation === "schedule") await intelligenceApi.schedule(item.sourceId, body);
      }
      setNotice(`${item.title}: ${operation === "create" ? "generated" : operation} completed.`);
      await refresh();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="p-4 md:p-6 xl:p-8 space-y-6">
      <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" /> Inventory intelligence
          </div>
          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">Decisions that move into execution</h1>
          <p className="mt-2 max-w-4xl text-sm text-base-content/65">
            Forecast → inventory policy → draft purchase → pallet demand → constrained slotting → worker-confirmed outcome.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <span className="badge badge-ghost badge-sm font-mono">{buildCommit.slice(0, 10)} · {datasetVersion}</span>
          <label className="form-control w-72 max-w-full">
            <span className="label-text text-xs mb-1 font-semibold">Warehouse</span>
            <select className="select select-bordered select-sm rounded-full" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
          <button className="btn btn-sm btn-outline rounded-full" onClick={() => void refresh()} disabled={!warehouseId || loading}>
            <span className="material-symbols-outlined text-base">refresh</span> Refresh
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
      {notice && <div className="alert alert-success text-sm"><span>{notice}</span></div>}

      <section className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <Metric label="Policy reviews" value={loading ? "…" : String(summary?.pendingPolicyRuns ?? 0)} detail={summary?.latestPolicyStatus ?? "NONE"} alert={(summary?.pendingPolicyRuns ?? 0) > 0} />
        <Metric label="Stockout exposure" value={quantity(summary?.stockoutExposure)} detail="high-risk products" alert={(summary?.stockoutExposure ?? 0) > 0} />
        <Metric label="Excess inventory" value={money(summary?.excessInventoryValue)} detail="estimated holding-cost reduction" />
        <Metric label="Draft purchases" value={quantity(summary?.draftPurchaseSuggestions)} detail="procurement release required" />
        <Metric label="Released space" value={quantity(summary?.totalSpaceSavedPalletPositions)} detail="pallet positions" />
        <Metric label="Required space" value={quantity(summary?.totalSpaceNeededPalletPositions)} detail="pallet positions" alert={(summary?.totalSpaceNeededPalletPositions ?? 0) > 0} />
        <Metric label="Scheduled moves" value={quantity(summary?.scheduledMoves)} detail={summary?.latestSlottingStatus ?? "NONE"} />
        <Metric label="Travel reduction" value={`${quantity(summary?.confirmedTravelReductionMeters || summary?.estimatedTravelReductionMeters)} m`} detail={(summary?.confirmedTravelReductionMeters ?? 0) > 0 ? "worker-confirmed" : "estimated until completion"} />
      </section>

      <Lifecycle summary={summary} />

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,.7fr)] gap-4">
        <div className="rounded-2xl bg-base-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-base-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-lg">Ranked manager actions</h2>
              <p className="text-xs text-base-content/60">{selectedWarehouse?.name ?? "Authorized warehouse"} · highest operational risk first</p>
            </div>
            <Link className="btn btn-sm btn-ghost rounded-full" href="/admin/forecasts">View demand</Link>
          </div>
          <div className="divide-y divide-base-200">
            {!loading && !(summary?.actionItems.length) && <div className="p-6 text-sm text-base-content/60">No manager decision is waiting. Approved work remains visible in execution systems.</div>}
            {(summary?.actionItems ?? []).map((item) => (
              <ActionRow key={`${item.type}-${item.sourceId ?? "new"}`} item={item} busy={busy} onAct={act} />
            ))}
          </div>
        </div>

        <aside className="rounded-2xl bg-base-100 shadow-sm p-5 h-fit">
          <h2 className="font-bold text-lg">Approval boundaries</h2>
          <div className="mt-4 space-y-4 text-sm">
            <Boundary icon="shopping_cart" title="Purchasing" text="Approval creates draft purchase suggestions. Procurement still releases purchase documents." />
            <Boundary icon="warehouse" title="Relocations" text="Approval does not move stock. Work is scheduled off-peak and completed through worker scan tasks." />
            <Boundary icon="verified" title="Evidence" text="Only optimal or accepted feasible location plans can enter approval." />
          </div>
          <details className="collapse collapse-arrow bg-base-200/60 rounded-xl mt-5">
            <summary className="collapse-title text-sm font-semibold">Administrator: model and solver evidence</summary>
            <div className="collapse-content text-xs text-base-content/65 space-y-2">
              <p>{summary?.solverGuidance.policySpaceMode}</p>
              <p>{summary?.solverGuidance.slottingPlanMode}</p>
              <p>{summary?.solverGuidance.advancedSolverMode}</p>
            </div>
          </details>
        </aside>
      </section>

      <section className="rounded-2xl bg-base-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-base-200 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h2 className="font-bold text-lg">Policy and purchase evidence</h2>
            <p className="text-xs text-base-content/60">Current versus proposed policy, forecast uncertainty, MOQ/multiple effect, and storage impact.</p>
          </div>
          <span className="badge badge-outline">{latestPolicy ? `${latestPolicy.status} · ${latestPolicy.forecastModelName ?? "canonical model"}` : "No policy run"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm min-w-[1180px]">
            <thead><tr><th>Product</th><th>Current → proposed policy</th><th>Demand P50 / P90</th><th>MOQ / multiple</th><th>Draft order</th><th>Pallet impact</th><th>Service risk</th><th>Explanation</th></tr></thead>
            <tbody>
              {rankedLines.map((line) => (
                <tr key={line.id}>
                  <td><div className="font-semibold">{line.materialName || line.materialCode}</div><div className="font-mono text-xs text-base-content/55">{line.materialCode}</div></td>
                  <td className="whitespace-nowrap"><div>Min {quantity(line.currentMinStock)} → <b>{quantity(line.proposedMinStock)}</b></div><div className="text-xs text-base-content/55">ROP {quantity(line.currentReorderPoint)} → {quantity(line.proposedReorderPoint)}</div></td>
                  <td className="whitespace-nowrap">{quantity(line.forecastP50)} / {quantity(line.forecastP90)} <span className="text-xs text-base-content/50">units</span></td>
                  <td>{quantity(line.moq)} / {quantity(line.orderMultiple)}</td>
                  <td><b>{quantity(line.proposedOrderQty)}</b> units<div className="text-xs text-base-content/55">lead {line.leadTimeDays ?? "—"} days</div></td>
                  <td>{signed(line.palletPositionsDelta)} positions<div className="text-xs text-base-content/55">target {quantity(line.targetPalletPositions)}</div></td>
                  <td><span className={clsx("badge badge-sm", (line.stockoutRiskScore ?? 0) >= .7 ? "badge-error" : (line.stockoutRiskScore ?? 0) >= .35 ? "badge-warning" : "badge-success")}>{percent(line.stockoutRiskScore)}</span></td>
                  <td className="max-w-sm text-xs text-base-content/70">{line.rationale || "Deterministic policy calculation from canonical forecast and inventory constraints."}</td>
                </tr>
              ))}
              {!loading && rankedLines.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-base-content/55">Generate a policy run to see product-level evidence.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function ActionRow({ item, busy, onAct }: { item: ActionItem; busy: string | null; onAct: (item: ActionItem, operation: "approve" | "defer" | "reject" | "schedule" | "create") => Promise<void> }) {
  const creates = item.type.startsWith("CREATE_");
  const schedules = item.type === "SCHEDULE_SLOTTING_PLAN";
  const operation = creates ? "create" : schedules ? "schedule" : "approve";
  return <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <div className="min-w-0">
      <div className="flex items-center gap-2"><span className={clsx("badge badge-sm", item.priority === "HIGH" ? "badge-error" : item.priority === "MEDIUM" ? "badge-warning" : "badge-ghost")}>{item.priority}</span><h3 className="font-semibold">{item.title}</h3></div>
      <p className="mt-1 text-sm text-base-content/65">{item.description}</p>
    </div>
    <div className="flex flex-wrap gap-2 shrink-0">
      {!creates && item.sourceId && <><button className="btn btn-xs btn-ghost" disabled={!!busy} onClick={() => void onAct(item, "defer")}>Defer</button><button className="btn btn-xs btn-ghost text-error" disabled={!!busy} onClick={() => void onAct(item, "reject")}>Reject</button></>}
      <button className="btn btn-sm btn-primary rounded-full" disabled={!!busy} onClick={() => void onAct(item, operation)}>{busy === `${item.type}-${operation}` ? <span className="loading loading-spinner loading-xs" /> : schedules ? "Schedule off-peak" : creates ? "Generate" : "Approve"}</button>
    </div>
  </div>;
}

function Lifecycle({ summary }: { summary: ActionCenterSummary | null }) {
  const steps = [
    ["Forecast & policy", summary?.latestPolicyStatus ?? "NOT STARTED"],
    ["Space impact", summary?.latestSpaceStatus ?? "NOT STARTED"],
    ["Location plan", summary?.latestSlottingStatus ?? "NOT STARTED"],
    ["Worker execution", summary?.latestSlottingExecutionStatus ?? "NOT STARTED"],
  ];
  return <section className="rounded-2xl bg-base-100 shadow-sm p-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{steps.map(([label, status], index) => <div key={label} className="flex items-center gap-3 rounded-xl bg-base-200/55 p-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-content font-bold text-sm">{index + 1}</span><div><p className="text-xs text-base-content/55">{label}</p><p className="text-sm font-semibold">{status.replaceAll("_", " ")}</p></div></div>)}</div></section>;
}

function Metric({ label, value, detail, alert }: { label: string; value: string; detail: string; alert?: boolean }) {
  return <div className={clsx("rounded-2xl bg-base-100 p-4 shadow-sm border-t-4", alert ? "border-warning" : "border-transparent")}><p className="text-[11px] uppercase tracking-wider text-base-content/50 font-semibold">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="text-xs text-base-content/55">{detail}</p></div>;
}

function Boundary({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="flex gap-3"><span className="material-symbols-outlined text-primary">{icon}</span><div><p className="font-semibold">{title}</p><p className="text-xs text-base-content/60 mt-0.5">{text}</p></div></div>;
}

function quantity(value: number | null | undefined) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0); }
function signed(value: number | null | undefined) { const amount = value ?? 0; return `${amount > 0 ? "+" : ""}${quantity(amount)}`; }
function percent(value: number | null | undefined) { const normalized = (value ?? 0) <= 1 ? (value ?? 0) * 100 : value ?? 0; return `${normalized.toFixed(0)}%`; }
function money(value: number | null | undefined) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(value ?? 0); }
function message(reason: unknown) { return reason instanceof Error ? reason.message : "The request could not be completed."; }
