"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorker } from "@/contexts/WorkerContext";
import { useOffline } from "@/hooks/useOffline";
import { operationsApi, StockTransferLine } from "@/lib/api/operations";
import { materialsApi } from "@/lib/api/materials";
import { addToSyncQueue } from "@/lib/indexeddb";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { WorkerRouteGuide } from "@/components/WorkerRouteGuide";
import {
  QUANTITY_INPUT_PROPS,
  parseQuantityInput,
  quantityInputValue,
} from "@/lib/utils/quantity-input";

type MaterialMap = Record<string, { code: string; name: string }>;

export default function StockTransferPage() {
  const { worker } = useWorker();
  const { isOnline } = useOffline();
  const workerId = worker?.id;
  const warehouseId = worker?.warehouseId;

  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<StockTransferLine[]>([]);
  const [materials, setMaterials] = useState<MaterialMap>({});
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [sourceScanLocation, setSourceScanLocation] = useState("");
  const [destScanLocation, setDestScanLocation] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  // A line must be claimed before it is walked. Selecting alone left it available to everyone, so
  // two drivers could set off for the same pallet and neither route was reserved against the other.
  const [claiming, setClaiming] = useState(false);
  const [step, setStep] = useState<"list" | "brief" | "move">("list");
  // Stops the driver has finished. Passing these to the route guide is what releases the edge
  // reservations behind them; a completed move that never reports would keep its aisle booked and
  // push other forklifts onto longer detours.
  const [completedStops, setCompletedStops] = useState<string[]>([]);

  // Stable identity: the route guide keys its effect on this array, so it must not be rebuilt
  // on every render or the request is cancelled and restarted indefinitely.
  const routeStops = useMemo(
    () => (selectedLineId
      ? [
          lines.find((line) => line.id === selectedLineId)?.sourceLocationCode,
          lines.find((line) => line.id === selectedLineId)?.destLocationCode,
        ].filter((code): code is string => !!code)
      : []),
    [lines, selectedLineId]
  );

  const selectedLine = useMemo(
    () => lines.find((line) => line.id === selectedLineId),
    [lines, selectedLineId]
  );

  const loadData = async () => {
    if (!workerId) return;
    setLoading(true);

    // The transfer lines are the work; the material catalogue only supplies display names.
    // These were loaded with Promise.all, so a failure on the catalogue -- which a worker role is
    // not always permitted to read -- rejected the pair and left the driver looking at
    // "Open Transfer Lines (0)" while real work sat waiting. The work is loaded on its own now.
    try {
      setLines(await operationsApi.getExecutableStockTransferLines(workerId, warehouseId));
    } catch (error) {
      logger.error("Failed to load stock transfer lines:", error);
      showToast.error("Failed to load stock transfer tasks");
      setLoading(false);
      return;
    }

    try {
      const materialData = await materialsApi.getAll();
      const map: MaterialMap = {};
      materialData.forEach((m) => {
        map[m.id] = { code: m.materialCode || m.id, name: m.description || "Material" };
      });
      setMaterials(map);
    } catch (error) {
      // Names are cosmetic: the line still shows its material code, source and destination.
      logger.warn("Material names unavailable; showing codes only.", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workerId, warehouseId]);

  useEffect(() => {
    if (selectedLine) {
      setSourceScanLocation(selectedLine.sourceLocationCode || "");
      setDestScanLocation(selectedLine.destLocationCode || "");
      const remaining = Math.max(
        (selectedLine.requestedQuantity || 0) - (selectedLine.movedQuantity || 0),
        1
      );
      setQuantity(remaining);
    }
  }, [selectedLineId]);

  /** Claims the line for this worker, which is also what opens a reserved route for it. */
  const handleClaim = async () => {
    if (!workerId || !selectedLine) return;
    setClaiming(true);
    try {
      await operationsApi.assignStockTransferLine(selectedLine.id, workerId, workerId);
      showToast.success("Move assigned to you. Follow the route to the source bin.");
      await loadData();
      setStep("move");
    } catch (error) {
      logger.error("Failed to claim transfer line:", error);
      showToast.error("Could not assign this move. It may already be taken.");
    } finally {
      setClaiming(false);
    }
  };

  const handleExecute = async () => {
    if (!workerId || !selectedLine) return;
    if (!sourceScanLocation || !destScanLocation) {
      showToast.error("Scan source and destination locations");
      return;
    }
    if (quantity <= 0) {
      showToast.error("Quantity must be greater than 0");
      return;
    }

    try {
      setProcessing(true);
      if (!isOnline) {
        await addToSyncQueue({
          type: "operation",
          action: "create",
          data: {
            type: "stock_transfer_execute",
            lineId: selectedLine.id,
            payload: {
              workerId,
              sourceScanLocation,
              destScanLocation,
              quantity,
              notes,
            },
          },
        });
        setLines((currentLines) =>
          currentLines.map((line) =>
            line.id === selectedLine.id
              ? {
                  ...line,
                  movedQuantity: Math.min(
                    (line.movedQuantity || 0) + quantity,
                    line.requestedQuantity || quantity
                  ),
                  status:
                    (line.movedQuantity || 0) + quantity >= (line.requestedQuantity || 0)
                      ? "completed"
                      : "in_progress",
                  notes: notes || line.notes,
                }
              : line
          )
        );
        showToast.success("Stock transfer move queued for sync");
        setNotes("");
        setSelectedLineId("");
        return;
      }
      const finishedStops = [selectedLine.sourceLocationCode, selectedLine.destLocationCode]
        .filter((code): code is string => !!code);
      await operationsApi.executeStockTransferLine(selectedLine.id, {
        workerId,
        sourceScanLocation,
        destScanLocation,
        quantity,
        notes,
      });
      showToast.success("Stock transfer move confirmed");
      // Release this move's edge reservations before leaving the screen, so the corridor frees up
      // for the next driver instead of staying booked until the lease expires.
      setCompletedStops(finishedStops);
      setNotes("");
      await loadData();
      setSelectedLineId("");
      setStep("list");
      setCompletedStops([]);
    } catch (error) {
      logger.error("Failed to execute stock transfer line:", error);
      showToast.error(error instanceof Error ? error.message : "Failed to confirm transfer");
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = async () => {
    if (!workerId || !selectedLine) return;
    if (!notes.trim()) {
      showToast.error("Add skip reason in notes");
      return;
    }
    try {
      setProcessing(true);
      if (!isOnline) {
        await addToSyncQueue({
          type: "operation",
          action: "create",
          data: {
            type: "stock_transfer_skip",
            lineId: selectedLine.id,
            payload: {
              workerId,
              reason: notes.trim(),
            },
          },
        });
        setLines((currentLines) =>
          currentLines.map((line) =>
            line.id === selectedLine.id
              ? {
                  ...line,
                  status: "blocked",
                  notes: notes.trim(),
                }
              : line
          )
        );
        showToast.success("Stock transfer block queued for sync");
        setNotes("");
        setSelectedLineId("");
        return;
      }
      await operationsApi.skipStockTransferLine(selectedLine.id, workerId, notes.trim());
      showToast.success("Line marked as blocked");
      setNotes("");
      await loadData();
      setSelectedLineId("");
      setStep("list");
    } catch (error) {
      logger.error("Failed to skip stock transfer line:", error);
      showToast.error(error instanceof Error ? error.message : "Failed to skip line");
    } finally {
      setProcessing(false);
    }
  };

  if (!workerId) {
    return <div className="p-6">Worker not loaded.</div>;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stock Transfer Tasks</h1>
        <p className="text-base-content/70 text-sm">
          Select any pending line, scan locations, and confirm moved quantity.
        </p>
      </div>

      {!isOnline && (
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">wifi_off</span>
          <span>
            You are offline. Moves and blocked lines will be queued locally and synced automatically when the connection returns.
          </span>
        </div>
      )}

      {step === "list" && <div className="grid grid-cols-1 gap-4">
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title text-lg">Open Transfer Lines ({lines.length})</h2>
            <div className="max-h-[420px] overflow-auto space-y-2">
              {lines.map((line) => {
                const material = materials[line.materialId];
                const remaining =
                  (line.requestedQuantity || 0) - (line.movedQuantity || 0);
                const active = selectedLineId === line.id;
                return (
                  <button
                    key={line.id}
                    className={`text-left border rounded-lg p-3 w-full transition ${
                      active ? "border-primary bg-primary/5" : "border-base-300 hover:border-primary/40"
                    }`}
                    onClick={() => { setSelectedLineId(line.id); setStep("brief"); }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        {material?.code || line.materialId}
                      </div>
                      <div className="badge badge-outline">{line.status}</div>
                    </div>
                    <div className="text-sm text-base-content/70">{material?.name || "Material"}</div>
                    <div className="text-xs mt-1 text-base-content/70">
                      {line.sourceLocationCode} → {line.destLocationCode}
                    </div>
                    <div className="text-xs mt-1">
                      Moved {line.movedQuantity}/{line.requestedQuantity} | Remaining {remaining}
                    </div>
                  </button>
                );
              })}
              {lines.length === 0 && (
                <div className="text-base-content/60 text-sm">No open transfer lines assigned/available.</div>
              )}
            </div>
          </div>
        </div>
      </div>}

      {step === "brief" && selectedLine && (
        /* One screen, one decision: this is the move, do you want it? Mirrors the putaway flow so a
           driver meets the same shape of question in both. */
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body space-y-4">
            <button className="btn btn-ghost btn-sm w-fit" onClick={() => { setStep("list"); setSelectedLineId(""); }}>
              <span className="material-symbols-outlined">arrow_back</span> Back to list
            </button>

            <div className="rounded-lg bg-primary/10 border border-primary/30 p-4">
              <div className="text-xs uppercase tracking-wide text-base-content/60">Move this pallet</div>
              <div className="font-mono font-bold text-2xl leading-tight my-1">
                {selectedLine.sourceLocationCode}
              </div>
              <div className="text-sm text-base-content/70">to</div>
              <div className="font-mono font-bold text-2xl leading-tight my-1">
                {selectedLine.destLocationCode}
              </div>
              <div className="text-lg font-semibold mt-2">
                {(selectedLine.requestedQuantity || 0) - (selectedLine.movedQuantity || 0)} units
                {materials[selectedLine.materialId]?.code ? ` · ${materials[selectedLine.materialId].code}` : ""}
              </div>
              {materials[selectedLine.materialId]?.name && (
                <div className="text-sm text-base-content/70">{materials[selectedLine.materialId].name}</div>
              )}
            </div>

            {selectedLine.assignedWorkerId === workerId ? (
              <button className="btn btn-primary btn-lg w-full" onClick={() => setStep("move")}>
                <span className="material-symbols-outlined">route</span> Continue — show my route
              </button>
            ) : (
              <>
                <p className="text-sm text-base-content/70">
                  Starting assigns this move to you and reserves your route, so another forklift is
                  not sent down the same aisle at the same time.
                </p>
                <button className="btn btn-primary btn-lg w-full" onClick={() => void handleClaim()} disabled={claiming}>
                  {claiming ? "Assigning…" : "Start this move"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === "move" && <div className="card bg-base-100 border border-base-300">
          <div className="card-body space-y-3">
            <button className="btn btn-ghost btn-sm w-fit" onClick={() => setStep("brief")}>
              <span className="material-symbols-outlined">arrow_back</span> Back
            </button>
            <h2 className="card-title text-lg">Execute Transfer Line</h2>
            {!selectedLine && <p className="text-sm text-base-content/60">Select a line from the left panel.</p>}
            {selectedLine && selectedLine.assignedWorkerId === workerId && (
              /* Source first, then destination: pick the pallet up, then drop it. The routing
                 service reserves each edge for a time window, so a second worker planning now is
                 routed around this path rather than into it. */
              <WorkerRouteGuide
                warehouseId={warehouseId}
                /* The line's own stock_transfer task, not the line id: routing validates this
                   against the tasks table, and sending the line id was rejected as "Task not
                   found". Undefined until the line is released and its task exists. */
                taskId={selectedLine.taskId}
                targetLocationCode={selectedLine.sourceLocationCode}
                targetLocationCodes={routeStops}
                completedLocationCodes={completedStops}
                operationType="transfer"
              />
            )}

            {selectedLine && (
              <>
                <label className="form-control">
                  <span className="label-text">Source Scan Location</span>
                  <input
                    className="input input-bordered"
                    value={sourceScanLocation}
                    onChange={(e) => setSourceScanLocation(e.target.value)}
                    placeholder={selectedLine.sourceLocationCode}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">Destination Scan Location</span>
                  <input
                    className="input input-bordered"
                    value={destScanLocation}
                    onChange={(e) => setDestScanLocation(e.target.value)}
                    placeholder={selectedLine.destLocationCode}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">Quantity to Move</span>
                  <input
                    {...QUANTITY_INPUT_PROPS}
                    className="input input-bordered"
                    value={quantityInputValue(quantity)}
                    onChange={(e) =>
                      setQuantity(
                        Math.min(
                          Math.max(
                            (selectedLine.requestedQuantity || 0) -
                              (selectedLine.movedQuantity || 0),
                            1
                          ),
                          parseQuantityInput(e.target.value)
                        )
                      )
                    }
                    placeholder="0"
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">Notes / Skip Reason</span>
                  <textarea
                    className="textarea textarea-bordered"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional for execute, required for skip"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    className={`btn btn-primary flex-1 ${processing ? "loading" : ""}`}
                    onClick={handleExecute}
                    disabled={processing}
                  >
                    Confirm Move
                  </button>
                  <button
                    className={`btn btn-warning btn-outline ${processing ? "loading" : ""}`}
                    onClick={handleSkip}
                    disabled={processing}
                  >
                    Block/Skip
                  </button>
                </div>
              </>
            )}
          </div>
        </div>}
    </div>
  );
}
