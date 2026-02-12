"use client";

import { Pick } from "../types";
import { isUUID } from "@/lib/utils/material-display";

export function CurrentPickCard({
  currentPick,
  upcomingPicks,
  pickedQty,
  scannedLocation,
  locationVerified,
  saveStatus,
  dbReady,
  onOpenLocationScanner,
  onScannedLocationChange,
  onPickedQtyChange,
  onConfirmPick,
}: {
  currentPick: Pick;
  upcomingPicks: Pick[];
  pickedQty: number;
  scannedLocation: string;
  locationVerified: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  dbReady: boolean;
  onOpenLocationScanner: () => void;
  onScannedLocationChange: (value: string) => void;
  onPickedQtyChange: (qty: number) => void;
  onConfirmPick: () => void;
}) {
  return (
    <div className="bg-primary/10 border-2 border-primary rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-primary font-medium">Current Pick</div>
        <div className="badge badge-primary">Active</div>
      </div>
      <div className="space-y-3">
        <div>
          <div className="text-sm text-base-content/60">Order</div>
          <div className="font-bold text-lg text-base-content">{currentPick.order}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-base-content/60">Bin Location</div>
            <div className="font-semibold text-base-content text-lg">{currentPick.location || "Not Assigned"}</div>
            {currentPick.location && (
              <button onClick={onOpenLocationScanner} className="btn btn-sm btn-outline btn-primary mt-2 w-full">
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Scan Location
              </button>
            )}
          </div>
          <div>
            <div className="text-xs text-base-content/60">Quantity</div>
            <div className="font-semibold text-base-content">{currentPick.qty}</div>
          </div>
        </div>

        {upcomingPicks.length > 0 && (
          <div className="bg-info/10 border border-info/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-info text-sm">route</span>
              <span className="text-xs font-medium text-info">Optimal Path</span>
            </div>
            <div className="text-xs text-base-content/70">
              Next locations: {upcomingPicks.slice(0, 3).map((p) => p.location || "TBD").join(" → ")}
              {upcomingPicks.length > 3 && ` (+${upcomingPicks.length - 3} more)`}
            </div>
            <div className="text-xs text-base-content/50 mt-1">
              {upcomingPicks.length > 0 ? "AI-optimized route available" : "Path calculated based on task order"}
            </div>
          </div>
        )}

        {currentPick.location && (
          <div className="form-control">
            <label className="label">
              <span className="label-text text-xs">Or Enter Bin Number Manually</span>
            </label>
            <input
              type="text"
              className="input input-bordered input-sm"
              placeholder="Enter bin location (e.g., B3, A-01-01-1-A)"
              value={scannedLocation}
              onChange={(e) => onScannedLocationChange(e.target.value)}
            />
          </div>
        )}
        <div>
          <div className="text-xs text-base-content/60">Item</div>
          <div className="font-semibold text-base-content">{currentPick.item}</div>
          {currentPick.sku && currentPick.sku !== "N/A" && !isUUID(currentPick.sku) && (
            <div className="text-xs text-base-content/60">
              <span className="font-mono font-semibold text-primary">SKU: {currentPick.sku}</span>
            </div>
          )}
        </div>

        <div className="bg-base-100 rounded-lg p-3">
          <div className="text-xs text-base-content/60 mb-2">Picked Quantity</div>
          <div className="flex items-center gap-3">
            <button onClick={() => onPickedQtyChange(Math.max(0, pickedQty - 1))} className="btn btn-circle btn-outline btn-sm">
              <span className="material-symbols-outlined">remove</span>
            </button>
            <input
              type="number"
              className="input input-bordered flex-1 text-center text-xl font-bold"
              value={pickedQty}
              onChange={(e) => onPickedQtyChange(Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
              max={currentPick.qty}
            />
            <button onClick={() => onPickedQtyChange(Math.min(currentPick.qty, pickedQty + 1))} className="btn btn-circle btn-outline btn-sm">
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>

        {currentPick.location && (
          <div className={`alert ${locationVerified ? "alert-success" : "alert-warning"} mb-3`}>
            {locationVerified ? (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                <span>Location verified: {currentPick.location}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">warning</span>
                <span>Please scan or verify bin location: {currentPick.location}</span>
              </>
            )}
          </div>
        )}

        <button
          onClick={onConfirmPick}
          className="btn btn-primary w-full"
          disabled={
            pickedQty === 0 ||
            pickedQty > currentPick.qty ||
            saveStatus === "saving" ||
            !dbReady ||
            (Boolean(currentPick.location) && !locationVerified && !scannedLocation)
          }
        >
          {saveStatus === "saving" ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Saving...
            </>
          ) : saveStatus === "saved" ? (
            <>
              <span className="material-symbols-outlined">check_circle</span>
              Saved!
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">check_circle</span>
              Confirm Pick
            </>
          )}
        </button>
        {saveStatus === "saved" && <div className="text-xs text-success text-center">✓ Saved to local storage</div>}
        {saveStatus === "error" && <div className="text-xs text-error text-center">✗ Error saving. Please try again.</div>}
      </div>
    </div>
  );
}
