"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useAdmin } from "@/contexts/AdminContext";
import { forecastSpaceApi, type PolicyRecommendationLine, type PolicyRecommendationRun } from "@/lib/api/forecast-space";
import { intelligenceApi, type ActionCenterSummary, type ActionItem, type DecisionEvent } from "@/lib/api/intelligence";
import { slottingPlansApi, type SlottingPlanLine } from "@/lib/api/slotting-plans";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";

type Tab = "review" | "approved" | "history";
type DecisionOperation = "approve" | "defer" | "reject" | "schedule" | "create";
type ChangeFilter = "all" | "replenishment" | "increase" | "reduce" | "space";

export default function InventoryIntelligencePage() {
  const { admin } = useAdmin();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [summary, setSummary] = useState<ActionCenterSummary | null>(null);
  const [policy, setPolicy] = useState<PolicyRecommendationRun | null>(null);
  const [policyLines, setPolicyLines] = useState<PolicyRecommendationLine[]>([]);
  const [decisions, setDecisions] = useState<DecisionEvent[]>([]);
  const [slottingLines, setSlottingLines] = useState<SlottingPlanLine[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("review");
  const [selectedLine, setSelectedLine] = useState<PolicyRecommendationLine | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [decision, setDecision] = useState<{ item: ActionItem; operation: DecisionOperation } | null>(null);
  const [reason, setReason] = useState("");
  const [deferUntil, setDeferUntil] = useState(defaultDeferValue());
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>("all");
  const [abcFilter, setAbcFilter] = useState("all");
  const [fmsFilter, setFmsFilter] = useState("all");
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    warehousesApi.getAll().then((rows) => {
      if (cancelled) return;
      const authorized = admin?.warehouseId ? rows.filter((row) => row.id === admin.warehouseId) : rows;
      setWarehouses(authorized);
      setWarehouseId(admin?.warehouseId && authorized.some((row) => row.id === admin.warehouseId)
        ? admin.warehouseId : authorized[0]?.id || "");
    }).catch((cause) => !cancelled && setError(message(cause)));
    return () => { cancelled = true; };
  }, [admin?.warehouseId]);

  const refresh = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    setError(null);
    try {
      const [workspace, runs, audit] = await Promise.all([
        intelligenceApi.getWorkspace(warehouseId),
        forecastSpaceApi.listPolicyRuns(warehouseId),
        intelligenceApi.getDecisions(warehouseId),
      ]);
      const policyAction = workspace.actionItems.find((item) => item.type === "APPROVE_POLICY");
      const activePolicy = policyAction?.sourceId
        ? runs.find((run) => run.id === policyAction.sourceId) ?? null
        : null;
      const lines = activePolicy ? await forecastSpaceApi.getPolicyRunLines(activePolicy.id) : [];
      setSummary(workspace);
      setPolicy(activePolicy);
      setPolicyLines(lines.filter((line) => line.meaningfulChange));
      setDecisions(audit);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const rankedLines = useMemo(() => [...policyLines].sort((a, b) =>
    Number((b.proposedOrderQty ?? 0) > 0) - Number((a.proposedOrderQty ?? 0) > 0)
    || Math.abs(b.palletPositionsDelta ?? 0) - Math.abs(a.palletPositionsDelta ?? 0)
    || (b.stockoutRiskScore ?? 0) - (a.stockoutRiskScore ?? 0)), [policyLines]);
  const filteredLines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rankedLines.filter((line) => {
      if (query && !`${line.materialName} ${line.materialCode}`.toLowerCase().includes(query)) return false;
      if (abcFilter !== "all" && line.abcClass !== abcFilter) return false;
      if (fmsFilter !== "all" && line.fmsClass !== fmsFilter) return false;
      if (changeFilter === "replenishment" && !(line.proposedOrderQty && line.proposedOrderQty > 0)) return false;
      if (changeFilter === "increase" && !policyIncreases(line)) return false;
      if (changeFilter === "reduce" && !policyReduces(line)) return false;
      if (changeFilter === "space" && Math.abs(line.palletPositionsDelta ?? 0) < 1) return false;
      return true;
    });
  }, [abcFilter, changeFilter, fmsFilter, rankedLines, search]);
  const totalPages = Math.max(1, Math.ceil(filteredLines.length / pageSize));
  const displayedLines = filteredLines.slice((page - 1) * pageSize, page * pageSize);
  const positionsReleased = rankedLines.reduce((total, line) => total + Math.max(0, -(line.palletPositionsDelta ?? 0)), 0);
  const positionsRequired = rankedLines.reduce((total, line) => total + Math.max(0, line.palletPositionsDelta ?? 0), 0);

  useEffect(() => { setPage(1); }, [search, changeFilter, abcFilter, fmsFilter, pageSize, policy?.id]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const actor = admin?.email || admin?.name || "manager";
  const selectedWarehouse = warehouses.find((row) => row.id === warehouseId);
  const activeDecisions = decisions.filter((row) => ["APPROVED", "SCHEDULED"].includes(row.action));
  const locationAction = summary?.actionItems.find((item) => item.type.includes("SLOTTING"));

  async function execute(item: ActionItem, operation: DecisionOperation, decisionReason?: string, scheduledFor?: string) {
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
          await slottingPlansApi.createPlan({ warehouseId, validMonths: 6, relocationBudgetPct: 15, useMilpAClass: true, createdBy: actor });
        }
      } else {
        if (!item.sourceId) throw new Error("This recommendation has no persisted ID.");
        const body = { type: item.type, warehouseId, actor, reason: decisionReason, scheduledFor };
        if (operation === "approve") await intelligenceApi.approve(item.sourceId, body);
        if (operation === "defer") await intelligenceApi.defer(item.sourceId, body);
        if (operation === "reject") await intelligenceApi.reject(item.sourceId, body);
        if (operation === "schedule") await intelligenceApi.schedule(item.sourceId, body);
      }
      setNotice(operation === "create" ? "Planning calculation started successfully." : `Decision recorded: ${operation}.`);
      setDecision(null);
      setSelectedAction(null);
      setSelectedLine(null);
      setReason("");
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(null);
    }
  }

  async function reviewAction(item: ActionItem) {
    if (item.type.startsWith("CREATE_")) {
      await execute(item, "create");
      return;
    }
    setSelectedAction(item);
    if (item.type.includes("SLOTTING") && item.sourceId) {
      try { setSlottingLines(await slottingPlansApi.getLines(item.sourceId)); }
      catch (cause) { setError(message(cause)); }
    } else {
      setSlottingLines([]);
    }
  }

  async function recalculatePolicies() {
    const item: ActionItem = { type: "CREATE_POLICY", title: "Recalculate inventory policies", description: "", priority: "LOW", href: "", canApprove: true, affectedCount: 0 };
    await execute(item, "create");
  }

  function requestDecision(item: ActionItem, operation: DecisionOperation) {
    setReason("");
    setDeferUntil(defaultDeferValue());
    setDecision({ item, operation });
  }

  return (
    <main className="p-4 md:p-6 xl:p-8 space-y-6 max-w-[1680px] mx-auto">
      <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" /> Inventory decisions
          </div>
          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">Inventory policy and storage actions</h1>
          <p className="mt-2 max-w-3xl text-sm text-base-content/65">
            Review only meaningful replenishment and six-month slotting changes. Unchanged products stay out of the queue.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="form-control w-72 max-w-full">
            <span className="label-text text-xs mb-1 font-semibold">Warehouse</span>
            <select className="select select-bordered select-sm rounded-full" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
          <button className="btn btn-sm btn-circle btn-ghost" title="Refresh workspace" aria-label="Refresh workspace" onClick={() => void refresh()} disabled={!warehouseId || loading}>
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
          <button className="btn btn-sm btn-outline rounded-full" onClick={() => void recalculatePolicies()} disabled={!warehouseId || !!busy}>
            <span className="material-symbols-outlined text-base">calculate</span> Recalculate policies
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error text-sm"><span className="material-symbols-outlined">error</span><span>{error}</span></div>}
      {notice && <div className="alert alert-success text-sm"><span className="material-symbols-outlined">check_circle</span><span>{notice}</span></div>}

      <section className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <Metric icon="assignment_late" label="Changes to review" value={loading ? "…" : quantity(summary?.inventoryChanges)} detail={summary?.inventoryChanges ? "unchanged products excluded" : "no policy changes waiting"} alert={!!summary?.inventoryChanges} />
        <Metric icon="shopping_cart" label="Draft replenishments" value={quantity(summary?.suggestedPurchases)} detail={summary?.suggestedPurchases ? "procurement release remains separate" : "none currently required"} />
        <Metric icon="inventory" label="Future positions released" value={quantity(positionsReleased)} detail="after excess stock is consumed" />
        <Metric icon="add_box" label="Future positions required" value={quantity(positionsRequired)} detail="policy capacity, not occupied space" alert={positionsRequired > 0} />
        <Metric icon="forklift" label="Location moves" value={quantity(summary?.totalMovesProposed)} detail={summary?.totalMovesProposed ? "constrained ABC/FMS plan" : "no executable plan waiting"} />
      </section>

      <nav className="tabs tabs-boxed bg-base-100 w-fit shadow-sm" aria-label="Inventory decision queues">
        <button className={clsx("tab", activeTab === "review" && "tab-active")} onClick={() => setActiveTab("review")}>Needs review</button>
        <button className={clsx("tab", activeTab === "approved" && "tab-active")} onClick={() => setActiveTab("approved")}>Approved & scheduled</button>
        <button className={clsx("tab", activeTab === "history" && "tab-active")} onClick={() => setActiveTab("history")}>Decision history</button>
      </nav>

      {activeTab === "review" && <>
        <section className="rounded-2xl bg-base-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-base-200">
            <h2 className="font-bold text-lg">Manager work queue</h2>
            <p className="text-xs text-base-content/60">{selectedWarehouse?.name || "Authorized warehouse"} · highest operational risk first</p>
          </div>
          <div className="divide-y divide-base-200">
            {!loading && !(summary?.actionItems.length) && <EmptyState icon="task_alt" title="No decision is waiting" text="The next forecast or slotting refresh will add only material changes to this queue." />}
            {(summary?.actionItems ?? []).map((item) => <ActionRow key={`${item.type}-${item.sourceId ?? "new"}`} item={item} busy={busy} onReview={reviewAction} />)}
          </div>
        </section>

        <section className="rounded-2xl bg-base-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-base-200 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
            <div>
              <h2 className="font-bold text-lg">Inventory changes requiring review</h2>
              <p className="text-xs text-base-content/60">Select a product to inspect the calculation, order constraints and storage impact.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="input input-bordered input-sm flex items-center gap-2 min-w-56"><span className="material-symbols-outlined text-base text-base-content/45">search</span><input className="grow" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or SKU" /></label>
              <select className="select select-bordered select-sm" value={changeFilter} onChange={(event) => setChangeFilter(event.target.value as ChangeFilter)} aria-label="Change type">
                <option value="all">All changes</option><option value="replenishment">Needs replenishment</option><option value="increase">Policy increases</option><option value="reduce">Policy reductions</option><option value="space">Pallet capacity changes</option>
              </select>
              <select className="select select-bordered select-sm" value={abcFilter} onChange={(event) => setAbcFilter(event.target.value)} aria-label="ABC class"><option value="all">All ABC</option><option value="A">A value</option><option value="B">B value</option><option value="C">C value</option></select>
              <select className="select select-bordered select-sm" value={fmsFilter} onChange={(event) => setFmsFilter(event.target.value)} aria-label="FMS class"><option value="all">All FMS</option><option value="F">Fast</option><option value="M">Medium</option><option value="S">Slow</option></select>
            </div>
          </div>
          <div className="overflow-auto max-h-[68vh]">
            <table className="table min-w-[980px]">
              <thead className="sticky top-0 z-10 bg-base-100 shadow-sm"><tr><th>Product</th><th>Recommended action</th><th>Why now</th><th>Policy change</th><th>Future capacity</th><th>Required by</th><th /></tr></thead>
              <tbody>
                {displayedLines.map((line) => <PolicyRow key={line.id} line={line} onOpen={setSelectedLine} />)}
                {!loading && filteredLines.length === 0 && <tr><td colSpan={7}><EmptyState icon="inventory_2" title="No matching inventory change" text="Change the filters or recalculate the policy plan." /></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-base-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
            <span className="text-base-content/60">{filteredLines.length ? `${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, filteredLines.length)} of ${filteredLines.length}` : "0 results"}</span>
            <div className="flex items-center gap-2"><select className="select select-bordered select-sm" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Rows per page"><option value={15}>15 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option></select><button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="tabular-nums">{page} / {totalPages}</span><button className="btn btn-sm btn-outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
          </div>
        </section>

        <section className="rounded-2xl bg-base-100 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary">warehouse</span><h2 className="font-bold text-lg">ABC/FMS storage placement</h2></div>
            <p className="text-sm text-base-content/65 mt-1 max-w-3xl">The location plan assigns fast movers to accessible compatible bins and protects capacity for the approved six-month policy.</p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs"><span className="badge badge-ghost">ABC value</span><span className="badge badge-ghost">FMS movement</span><span className="badge badge-ghost">weight and volume</span><span className="badge badge-ghost">hazard and temperature</span><span className="badge badge-ghost">move limit</span></div>
          </div>
          {locationAction ? <button className="btn btn-sm btn-primary rounded-full shrink-0" disabled={!!busy} onClick={() => void reviewAction(locationAction)}>{locationAction.type.startsWith("CREATE_") ? "Generate location plan" : "Review location plan"}</button> : <span className="badge badge-outline p-3 h-auto text-center">Approve the policy plan before location optimization</span>}
        </section>
      </>}

      {activeTab === "approved" && <DecisionList rows={activeDecisions} emptyTitle="No approved work yet" />}
      {activeTab === "history" && <DecisionList rows={decisions} emptyTitle="No decision history yet" />}

      {selectedLine && <PolicyDetail line={selectedLine} onClose={() => setSelectedLine(null)} />}
      {selectedAction && <ActionDetail item={selectedAction} policyLines={rankedLines} slottingLines={slottingLines} busy={busy}
        onClose={() => setSelectedAction(null)} onDecision={requestDecision} />}
      {decision && <DecisionDialog decision={decision} reason={reason} setReason={setReason} deferUntil={deferUntil}
        setDeferUntil={setDeferUntil} busy={busy} onClose={() => setDecision(null)}
        onConfirm={() => void execute(decision.item, decision.operation, reason || undefined,
          decision.operation === "defer" ? new Date(deferUntil).toISOString() : undefined)} />}
    </main>
  );
}

function ActionRow({ item, busy, onReview }: { item: ActionItem; busy: string | null; onReview: (item: ActionItem) => Promise<void> }) {
  const creates = item.type.startsWith("CREATE_");
  return <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={clsx("badge badge-sm", item.priority === "HIGH" ? "badge-error" : item.priority === "MEDIUM" ? "badge-warning" : "badge-ghost")}>{item.priority}</span>
        <h3 className="font-semibold">{item.title}</h3>
        {item.sourceStatus && <span className="badge badge-ghost badge-sm">{businessStatus(item.sourceStatus)}</span>}
      </div>
      <p className="mt-1 text-sm text-base-content/65">{item.description}</p>
      {item.blockedReason && <p className="mt-2 text-xs text-warning flex items-center gap-1"><span className="material-symbols-outlined text-sm">warning</span>{item.blockedReason}</p>}
    </div>
    <button className={clsx("btn btn-sm rounded-full", creates ? "btn-primary" : "btn-outline")} disabled={!!busy} onClick={() => void onReview(item)}>
      {busy === `${item.type}-create` ? <span className="loading loading-spinner loading-xs" /> : creates ? "Generate" : "Review"}
    </button>
  </div>;
}

function PolicyRow({ line, onOpen }: { line: PolicyRecommendationLine; onOpen: (line: PolicyRecommendationLine) => void }) {
  const primaryReason = primaryBusinessReason(line);
  const policyText = policyDelta(line);
  return <tr className="hover cursor-pointer" onClick={() => onOpen(line)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen(line)}>
    <td><div className="font-semibold max-w-56">{line.materialName}</div><div className="font-mono text-xs text-base-content/50">{line.materialCode} · {storageClassLabel(line)}</div></td>
    <td><div className="font-semibold text-primary">{line.actionSummary}</div><div className="text-xs text-base-content/55">{line.proposedOrderQty ? `Expected receipt ${dateLabel(line.expectedReceiptDate)}` : "No purchase required"}</div></td>
    <td><span className="badge badge-ghost badge-sm">{primaryReason}</span></td>
    <td className="text-sm">{policyText}</td>
    <td><span className={clsx("font-semibold", line.palletPositionsDelta > 0 ? "text-warning" : line.palletPositionsDelta < 0 ? "text-success" : "")}>{capacityImpactLabel(line.palletPositionsDelta)}</span></td>
    <td className="text-sm">{dateLabel(line.orderByDate)}</td>
    <td><button className="btn btn-xs btn-ghost" onClick={(event) => { event.stopPropagation(); onOpen(line); }}>View <span className="material-symbols-outlined text-sm">chevron_right</span></button></td>
  </tr>;
}

function PolicyDetail({ line, onClose }: { line: PolicyRecommendationLine; onClose: () => void }) {
  return <Drawer title={line.materialName} subtitle={`${line.materialCode} · ${storageClassLabel(line)}`} onClose={onClose}>
    <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
      <p className="text-xs uppercase tracking-wider text-base-content/55 font-semibold">Recommended action</p>
      <p className="mt-1 text-xl font-bold">{line.actionSummary}</p>
      <p className="mt-2 text-sm text-base-content/70">{plainExplanation(line)}</p>
    </div>
    <SectionTitle>Stock and demand</SectionTitle>
    <div className="grid grid-cols-2 gap-3">
      <Fact label="Usable stock now" value={`${quantity(line.currentAvailableStock)} units`} />
      <Fact label="Expected six-month demand" value={`${quantity(line.forecastP50)} units`} />
      <Fact label="Current cover" value={`${decimal(line.daysCoverBefore)} days`} />
      <Fact label="Cover after receipt" value={`${decimal(line.daysCoverAfter)} days`} />
      <Fact label="Occupied pallet positions now" value={`${quantity(line.currentPalletRequirement)} positions`} />
      <Fact label="Recommended policy capacity" value={`${quantity(line.targetPalletPositions)} positions`} />
      <Fact label="Supplier lead time" value={`${quantity(line.leadTimeDays)} days`} />
      <Fact label="MOQ and order multiple" value={`${quantity(line.moq)} / ${quantity(line.orderMultiple)} units`} />
      <Fact label="Expiry-safe maximum" value={line.expiryLimitedMaxStock ? `${quantity(line.expiryLimitedMaxStock)} units` : "No expiry cap"} />
      <Fact label="Storage classification" value={storageClassLabel(line)} />
    </div>
    <SectionTitle>Policy before and after</SectionTitle>
    <div className="rounded-xl border border-base-200 divide-y divide-base-200">
      <Comparison label="Minimum stock" before={line.currentMinStock} after={line.proposedMinStock} suffix="units" />
      <Comparison label="Reorder trigger" before={line.currentReorderPoint} after={line.proposedReorderPoint} suffix="units" />
      <Comparison label="Target maximum" before={line.currentMaxStock} after={line.proposedMaxStock} suffix="units" />
      <Comparison label="Policy pallet capacity" before={(line.targetPalletPositions ?? 0) - (line.palletPositionsDelta ?? 0)} after={line.targetPalletPositions} suffix="positions" />
    </div>
    <p className="text-xs text-base-content/55">The reorder trigger includes expected demand during supplier lead time plus safety stock. Policy capacity is a future target and does not release an occupied bin until stock is consumed or moved.</p>
    {!!line.proposedOrderQty && <>
      <SectionTitle>Draft replenishment</SectionTitle>
      <div className="rounded-xl border border-base-200 divide-y divide-base-200">
        <FactRow label="Net requirement before rounding" value={`${quantity(line.netOrderBeforeRounding)} units`} />
        <FactRow label="MOQ / order multiple" value={`${quantity(line.moq)} / ${quantity(line.orderMultiple)}`} />
        <FactRow label="Suggested draft quantity" value={`${quantity(line.proposedOrderQty)} units`} strong />
        <FactRow label="Order by" value={dateLabel(line.orderByDate)} />
        <FactRow label="Expected receipt" value={dateLabel(line.expectedReceiptDate)} />
      </div>
    </>}
    <SectionTitle>Decision factors</SectionTitle>
    <div className="flex flex-wrap gap-2">{line.reasonCodes?.map((reason) => <span key={reason} className="badge badge-outline">{reasonLabel(reason)}</span>)}</div>
  </Drawer>;
}

function ActionDetail({ item, policyLines, slottingLines, busy, onClose, onDecision }: {
  item: ActionItem; policyLines: PolicyRecommendationLine[]; slottingLines: SlottingPlanLine[]; busy: string | null;
  onClose: () => void; onDecision: (item: ActionItem, operation: DecisionOperation) => void;
}) {
  const moved = slottingLines.filter((line) => line.relocationFlag || line.relocationApplied || (line.currentPrimaryLocation !== line.recommendedPrimaryLocation));
  const scheduling = item.type === "SCHEDULE_SLOTTING_PLAN";
  return <Drawer title={item.title} subtitle={item.description} onClose={onClose}>
    {item.blockedReason && <div className="alert alert-warning text-sm"><span className="material-symbols-outlined">warning</span><span>{item.blockedReason}</span></div>}
    {item.type === "APPROVE_POLICY" && <>
      <SectionTitle>Approval scope</SectionTitle>
      <p className="text-sm text-base-content/70">Approval applies the reviewed min/max policy changes and creates draft purchase suggestions for qualifying products. Procurement release remains a separate step.</p>
      <div className="mt-3 space-y-2">{policyLines.slice(0, 8).map((line) => <div key={line.id} className="flex justify-between gap-3 rounded-lg bg-base-200/55 p-3 text-sm"><span className="font-medium">{line.materialName}</span><span className="text-right text-base-content/65">{line.actionSummary}</span></div>)}</div>
      {policyLines.length > 8 && <p className="text-xs text-base-content/50 mt-2">Plus {policyLines.length - 8} additional reviewed changes.</p>}
    </>}
    {item.type.includes("SLOTTING") && <>
      <SectionTitle>Proposed physical changes</SectionTitle>
      <div className="space-y-2">{moved.slice(0, 12).map((line) => <div key={line.id} className="rounded-lg border border-base-200 p-3"><div className="flex justify-between gap-3"><span className="font-semibold">{line.materialCode}</span><span className="badge badge-ghost badge-sm">{line.zoneUpgrade || "location optimization"}</span></div><p className="text-sm mt-1">{line.currentPrimaryLocation || "Unassigned"} <span className="text-primary">→</span> {line.recommendedPrimaryLocation || "No destination"}</p><p className="text-xs text-base-content/55 mt-1">{line.moveReason || "Demand, accessibility and compatible-capacity improvement."}</p></div>)}</div>
      {!moved.length && <p className="text-sm text-base-content/60">No physical relocation line is available for this plan.</p>}
    </>}
    <div className="sticky bottom-0 bg-base-100 border-t border-base-200 pt-4 mt-6 flex flex-wrap justify-end gap-2">
      <button className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => onDecision(item, "defer")}>Defer</button>
      <button className="btn btn-sm btn-ghost text-error" disabled={!!busy} onClick={() => onDecision(item, "reject")}>Reject</button>
      <button className="btn btn-sm btn-primary rounded-full" disabled={!!busy || !item.canApprove} onClick={() => onDecision(item, scheduling ? "schedule" : "approve")}>
        {scheduling ? "Schedule off-peak" : item.type === "APPROVE_POLICY" ? `Approve ${item.affectedCount} changes` : "Approve plan"}
      </button>
    </div>
  </Drawer>;
}

function DecisionDialog({ decision, reason, setReason, deferUntil, setDeferUntil, busy, onClose, onConfirm }: {
  decision: { item: ActionItem; operation: DecisionOperation }; reason: string; setReason: (value: string) => void;
  deferUntil: string; setDeferUntil: (value: string) => void; busy: string | null; onClose: () => void; onConfirm: () => void;
}) {
  const needsReason = decision.operation === "defer" || decision.operation === "reject";
  const valid = !needsReason || (!!reason.trim() && (decision.operation !== "defer" || !!deferUntil));
  return <div className="fixed inset-0 z-[70] bg-black/35 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div className="bg-base-100 rounded-2xl shadow-xl w-full max-w-lg p-6">
      <h2 className="text-xl font-bold capitalize">{decision.operation} recommendation</h2>
      <p className="text-sm text-base-content/65 mt-2">{decision.item.title}</p>
      {decision.operation === "approve" && <p className="mt-4 text-sm">This approves the reviewed recommendation. Purchase suggestions remain drafts and relocation work remains unscheduled until its next controlled step.</p>}
      {decision.operation === "schedule" && <p className="mt-4 text-sm">The approved relocation plan will be scheduled for the warehouse off-peak window and released as scan-confirmed worker tasks.</p>}
      {decision.operation === "defer" && <label className="form-control mt-4"><span className="label-text font-semibold mb-1">Return to review queue</span><input className="input input-bordered" type="datetime-local" value={deferUntil} onChange={(event) => setDeferUntil(event.target.value)} /></label>}
      {needsReason && <label className="form-control mt-4"><span className="label-text font-semibold mb-1">Reason</span><textarea className="textarea textarea-bordered min-h-28" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={decision.operation === "reject" ? "Why should this recommendation not be used?" : "Why is this decision being deferred?"} /></label>}
      <div className="mt-6 flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className={clsx("btn", decision.operation === "reject" ? "btn-error" : "btn-primary")} disabled={!valid || !!busy} onClick={onConfirm}>{busy ? <span className="loading loading-spinner loading-xs" /> : "Confirm"}</button></div>
    </div>
  </div>;
}

function DecisionList({ rows, emptyTitle }: { rows: DecisionEvent[]; emptyTitle: string }) {
  return <section className="rounded-2xl bg-base-100 shadow-sm overflow-hidden">
    <div className="p-5 border-b border-base-200"><h2 className="font-bold text-lg">Decision audit</h2><p className="text-xs text-base-content/60">Who decided, when, and why.</p></div>
    {!rows.length ? <EmptyState icon="history" title={emptyTitle} text="Manager decisions will appear here without replacing earlier evidence." /> : <div className="divide-y divide-base-200">{rows.map((row) => <div key={row.id} className="p-5 flex flex-col md:flex-row md:items-start md:justify-between gap-3"><div><div className="flex items-center gap-2"><span className={clsx("badge badge-sm", row.action === "REJECTED" ? "badge-error" : row.action === "DEFERRED" ? "badge-warning" : "badge-success")}>{row.action}</span><span className="font-semibold">{decisionTypeLabel(row.recommendationType)}</span></div><p className="text-sm text-base-content/65 mt-2">{row.reason || "No additional manager note."}</p>{row.deferredUntil && <p className="text-xs text-base-content/55 mt-1">Returns {dateTimeLabel(row.deferredUntil)}</p>}</div><div className="text-xs text-base-content/55 md:text-right"><p>{row.actor}</p><p>{dateTimeLabel(row.createdAt)}</p><p>{businessStatus(row.previousStatus)} → {businessStatus(row.newStatus)}</p></div></div>)}</div>}
  </section>;
}

function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[60] bg-black/35 flex items-center justify-center p-3 md:p-6" role="dialog" aria-modal="true" onMouseDown={onClose}>
    <section className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-base-100 shadow-2xl overflow-hidden flex flex-col" onMouseDown={(event) => event.stopPropagation()}>
      <div className="shrink-0 bg-base-100 border-b border-base-200 p-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{title}</h2>{subtitle && <p className="text-sm text-base-content/60 mt-1">{subtitle}</p>}</div><button className="btn btn-sm btn-circle btn-ghost" onClick={onClose} aria-label="Close"><span className="material-symbols-outlined">close</span></button></div>
      <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
    </section>
  </div>;
}

function Metric({ icon, label, value, detail, alert }: { icon: string; label: string; value: string; detail: string; alert?: boolean }) {
  return <div className={clsx("rounded-2xl bg-base-100 p-5 shadow-sm border-l-4", alert ? "border-warning" : "border-transparent")}><div className="flex justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-base-content/50 font-semibold">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><span className="material-symbols-outlined text-primary/70">{icon}</span></div><p className="text-xs text-base-content/55 mt-1">{detail}</p></div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-base-200/55 p-3"><p className="text-xs text-base-content/50">{label}</p><p className="font-semibold mt-1">{value}</p></div>; }
function FactRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className="flex justify-between gap-4 p-3 text-sm"><span className="text-base-content/60">{label}</span><span className={clsx("text-right", strong && "font-bold text-primary")}>{value}</span></div>; }
function Comparison({ label, before, after, suffix }: { label: string; before?: number | null; after?: number | null; suffix: string }) { return <div className="grid grid-cols-[1fr_auto] gap-4 p-3 text-sm"><span className="text-base-content/60">{label}</span><span><span className="text-base-content/45">{quantity(before)}</span> <span className="text-primary mx-1">→</span> <b>{quantity(after)}</b> <span className="text-xs text-base-content/45">{suffix}</span></span></div>; }
function SectionTitle({ children }: { children: React.ReactNode }) { return <h3 className="font-bold pt-2">{children}</h3>; }
function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) { return <div className="p-8 text-center"><span className="material-symbols-outlined text-4xl text-base-content/25">{icon}</span><h3 className="font-semibold mt-2">{title}</h3><p className="text-sm text-base-content/55 mt-1">{text}</p></div>; }

function plainExplanation(line: PolicyRecommendationLine) {
  const parts: string[] = [];
  if (line.reasonCodes?.includes("BELOW_REORDER_TRIGGER")) parts.push(`Usable stock is at or below the recommended reorder trigger of ${quantity(line.proposedReorderPoint)} units.`);
  else parts.push(`Stock is projected to reach its reorder trigger around ${dateLabel(line.projectedTriggerDate)}.`);
  if (line.proposedOrderQty) parts.push(`The net requirement is ${quantity(line.netOrderBeforeRounding)} units and supplier constraints produce a draft quantity of ${quantity(line.proposedOrderQty)} units.`);
  if (line.reasonCodes?.includes("LONG_LEAD_TIME")) parts.push(`The ${line.leadTimeDays}-day supplier lead time increases the protection required.`);
  if (line.palletPositionsDelta) parts.push(`The resulting policy changes storage demand by ${signed(line.palletPositionsDelta)} pallet positions.`);
  return parts.join(" ");
}

function reasonLabel(code?: string) {
  const labels: Record<string, string> = { BELOW_REORDER_TRIGGER: "Below reorder trigger", REORDER_TRIGGER_INCREASE: "Earlier reorder protection", REORDER_TRIGGER_REDUCTION: "Later reorder trigger", MINIMUM_INCREASE: "Higher minimum stock", MINIMUM_REDUCTION: "Lower minimum stock", MAXIMUM_INCREASE: "Higher target stock", MAXIMUM_REDUCTION: "Lower excess buffer", LONG_LEAD_TIME: "Long supplier lead time", MOQ_APPLIED: "MOQ applied", ORDER_MULTIPLE_ROUNDING: "Pack multiple rounding", SPACE_INCREASE: "More pallet space", SPACE_RELEASE: "Releases pallet space", HIGH_SERVICE_RISK: "Service protection", EXPIRY_CAP: "Expiry-limited" };
  return code ? labels[code] || code.replaceAll("_", " ").toLowerCase() : "Policy adjustment";
}

function policyDelta(line: PolicyRecommendationLine) {
  const maxChanged = Math.abs((line.proposedMaxStock ?? 0) - (line.currentMaxStock ?? 0)) >= Math.max(1, Math.abs(line.currentMaxStock ?? 0) * .02);
  const triggerChanged = Math.abs((line.proposedReorderPoint ?? 0) - (line.currentReorderPoint ?? 0)) >= Math.max(1, Math.abs(line.currentReorderPoint ?? 0) * .02);
  if (maxChanged) return `Max ${quantity(line.currentMaxStock)} → ${quantity(line.proposedMaxStock)}`;
  if (triggerChanged) return `Trigger ${quantity(line.currentReorderPoint)} → ${quantity(line.proposedReorderPoint)}`;
  return "Purchase timing only";
}

function primaryBusinessReason(line: PolicyRecommendationLine) {
  if ((line.proposedOrderQty ?? 0) > 0) return line.reasonCodes?.includes("BELOW_REORDER_TRIGGER") ? "Stock below trigger" : "Replenishment due";
  if ((line.palletPositionsDelta ?? 0) <= -1) return "Releases pallet space";
  if ((line.palletPositionsDelta ?? 0) >= 1) return "Needs pallet space";
  if ((line.proposedMaxStock ?? 0) < (line.currentMaxStock ?? 0)) return "Lower excess buffer";
  if ((line.proposedMaxStock ?? 0) > (line.currentMaxStock ?? 0)) {
    return (line.proposedReorderPoint ?? 0) <= (line.currentReorderPoint ?? 0) ? "Larger order cycle" : "Higher demand protection";
  }
  if ((line.proposedReorderPoint ?? 0) < (line.currentReorderPoint ?? 0)) return "Later reorder trigger";
  if ((line.proposedReorderPoint ?? 0) > (line.currentReorderPoint ?? 0)) return "Earlier reorder protection";
  return reasonLabel(line.reasonCodes?.[0]);
}

function policyIncreases(line: PolicyRecommendationLine) {
  return (line.proposedMaxStock ?? 0) > (line.currentMaxStock ?? 0)
    || (line.proposedReorderPoint ?? 0) > (line.currentReorderPoint ?? 0)
    || (line.proposedMinStock ?? 0) > (line.currentMinStock ?? 0)
    || (line.proposedOrderQty ?? 0) > 0;
}

function policyReduces(line: PolicyRecommendationLine) {
  return (line.proposedMaxStock ?? 0) < (line.currentMaxStock ?? 0)
    || (line.proposedReorderPoint ?? 0) < (line.currentReorderPoint ?? 0)
    || (line.proposedMinStock ?? 0) < (line.currentMinStock ?? 0);
}

function storageClassLabel(line: PolicyRecommendationLine) {
  const abc = line.abcClass === "A" ? "A value" : line.abcClass === "B" ? "B value" : line.abcClass === "C" ? "C value" : "Unclassified value";
  const fms = line.fmsClass === "F" ? "fast-moving" : line.fmsClass === "M" ? "medium-moving" : line.fmsClass === "S" ? "slow-moving" : "unclassified movement";
  return `${abc} · ${fms}`;
}

function decisionTypeLabel(type: string) { return type.replace("APPROVE_", "").replace("SCHEDULE_", "").replaceAll("_", " ").toLowerCase(); }
function businessStatus(status?: string | null) { return status ? status.replaceAll("_", " ").toLowerCase() : "not started"; }
function quantity(value: number | null | undefined) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0); }
function decimal(value: number | null | undefined) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value ?? 0); }
function signed(value: number | null | undefined) { const rounded = Math.round(value ?? 0); const amount = Object.is(rounded, -0) ? 0 : rounded; return `${amount > 0 ? "+" : ""}${quantity(amount)}`; }
function capacityImpactLabel(value: number | null | undefined) {
  const rounded = Math.round(value ?? 0);
  if (rounded > 0) return `${quantity(rounded)} more positions`;
  if (rounded < 0) return `${quantity(Math.abs(rounded))} fewer positions`;
  return "No whole-position change";
}
function dateLabel(value?: string | null) { return value ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "Not available"; }
function dateTimeLabel(value?: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not available"; }
function defaultDeferValue() { const date = new Date(Date.now() + 24 * 60 * 60 * 1000); date.setMinutes(0, 0, 0); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function message(cause: unknown) { return cause instanceof Error ? cause.message : "The request could not be completed."; }
