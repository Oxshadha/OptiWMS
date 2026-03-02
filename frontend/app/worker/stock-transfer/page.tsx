"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorker } from "@/contexts/WorkerContext";
import { useOffline } from "@/hooks/useOffline";
import { operationsApi, StockTransferLine } from "@/lib/api/operations";
import { materialsApi } from "@/lib/api/materials";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

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

  const selectedLine = useMemo(
    () => lines.find((line) => line.id === selectedLineId),
    [lines, selectedLineId]
  );

  const loadData = async () => {
    if (!workerId) return;
    try {
      setLoading(true);
      const [lineData, materialData] = await Promise.all([
        operationsApi.getExecutableStockTransferLines(workerId, warehouseId),
        materialsApi.getAll(),
      ]);
      setLines(lineData);
      const map: MaterialMap = {};
      materialData.forEach((m) => {
        map[m.id] = { code: m.materialCode || m.id, name: m.description || "Material" };
      });
      setMaterials(map);
    } catch (error) {
      logger.error("Failed to load stock transfer lines:", error);
      showToast.error("Failed to load stock transfer tasks");
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

  const handleExecute = async () => {
    if (!workerId || !selectedLine) return;
    if (!isOnline) {
      showToast.error("Stock transfer execution requires an online connection");
      return;
    }
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
      await operationsApi.executeStockTransferLine(selectedLine.id, {
        workerId,
        sourceScanLocation,
        destScanLocation,
        quantity,
        notes,
      });
      showToast.success("Stock transfer move confirmed");
      setNotes("");
      await loadData();
      setSelectedLineId("");
    } catch (error) {
      logger.error("Failed to execute stock transfer line:", error);
      showToast.error(error instanceof Error ? error.message : "Failed to confirm transfer");
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = async () => {
    if (!workerId || !selectedLine) return;
    if (!isOnline) {
      showToast.error("Stock transfer updates require an online connection");
      return;
    }
    if (!notes.trim()) {
      showToast.error("Add skip reason in notes");
      return;
    }
    try {
      setProcessing(true);
      await operationsApi.skipStockTransferLine(selectedLine.id, workerId, notes.trim());
      showToast.success("Line marked as blocked");
      setNotes("");
      await loadData();
      setSelectedLineId("");
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
            Stock transfer execution is online-only right now. Reconnect before confirming or skipping a line.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    onClick={() => setSelectedLineId(line.id)}
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

        <div className="card bg-base-100 border border-base-300">
          <div className="card-body space-y-3">
            <h2 className="card-title text-lg">Execute Transfer Line</h2>
            {!selectedLine && <p className="text-sm text-base-content/60">Select a line from the left panel.</p>}
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
                    type="number"
                    min={1}
                    max={Math.max(
                      (selectedLine.requestedQuantity || 0) - (selectedLine.movedQuantity || 0),
                      1
                    )}
                    className="input input-bordered"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value || "1", 10))}
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
                    disabled={processing || !isOnline}
                  >
                    Confirm Move
                  </button>
                  <button
                    className={`btn btn-warning btn-outline ${processing ? "loading" : ""}`}
                    onClick={handleSkip}
                    disabled={processing || !isOnline}
                  >
                    Block/Skip
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
