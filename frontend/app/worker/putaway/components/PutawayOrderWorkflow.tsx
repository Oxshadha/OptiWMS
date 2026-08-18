"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { WorkerRouteGuide } from "@/components/WorkerRouteGuide";
import { PutawayItem } from "@/lib/api/orderItems";
import { ItemDetailsDisplay } from "./ItemDetailsDisplay";
import {
  QUANTITY_INPUT_PROPS,
  parseQuantityInput,
  quantityInputValue,
} from "@/lib/utils/quantity-input";

type SelectedOrder = { id: string; orderNumber: string };

/** Identity of a pallet move; mirrors the helper on the page. */
const rowKey = (item: PutawayItem): string => item.taskId ?? `line:${item.itemId}`;

export function PutawayOrderWorkflow({
  selectedOrder,
  putawayItems,
  currentItemIndex,
  putawayProgress,
  scannedLocation,
  locationError,
  validatingLocation,
  showLocationPicker,
  warehouseId,
  onBack,
  onLocationChange,
  onOpenLocationPicker,
  onCloseLocationPicker,
  onUseSuggestedLocation,
  onConfirmPutaway,
  onLocationSelect,
  onSelectItem,
  onSkipItem,
  allocationQuantity,
  remainingQuantity,
  onAllocationQuantityChange,
  skippedReasonsByRow,
  suggestedAlternatives,
  onUseAlternative,
}: {
  selectedOrder: SelectedOrder;
  putawayItems: PutawayItem[];
  currentItemIndex: number;
  putawayProgress: Map<string, boolean>;
  scannedLocation: string;
  locationError: string;
  validatingLocation: boolean;
  showLocationPicker: boolean;
  warehouseId?: string;
  onBack: () => void;
  onLocationChange: (value: string) => void;
  onOpenLocationPicker: () => void;
  onCloseLocationPicker: () => void;
  onUseSuggestedLocation: (location: string) => Promise<void>;
  onConfirmPutaway: () => Promise<void>;
  onLocationSelect: (locationCode: string) => Promise<void>;
  onSelectItem: (index: number) => void;
  onSkipItem: (reason: string) => Promise<void>;
  allocationQuantity: number;
  remainingQuantity: number;
  onAllocationQuantityChange: (quantity: number) => void;
  skippedReasonsByRow: Map<string, string>;
  suggestedAlternatives: Array<{ locationCode: string; allocatableQuantity: number; reason: string }>;
  onUseAlternative: (locationCode: string) => void;
}) {
  const [showSkipInput, setShowSkipInput] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const currentItem = putawayItems[currentItemIndex];
  const completedCount = Array.from(putawayProgress.values()).filter((done) => done).length;
  const isItemDone = currentItem ? putawayProgress.get(rowKey(currentItem)) || false : false;
  const isItemSkipped = currentItem ? skippedReasonsByRow.has(rowKey(currentItem)) : false;
  // Only worth drawing attention to when the driver has moved off the directed bin.
  const isOverridingPlan = Boolean(
    currentItem?.plannedLocation &&
      scannedLocation &&
      scannedLocation.trim().toUpperCase() !== currentItem.plannedLocation.toUpperCase()
  );

  if (!currentItem && completedCount === 0) {
    return null;
  }

  const completedLocationCodes = putawayItems
    .filter((item) => putawayProgress.get(rowKey(item)))
    .map((item) => item.plannedLocation)
    .filter(Boolean) as string[];

  const remainingLocationCodes = putawayItems
    .filter((item) => !putawayProgress.get(rowKey(item)))
    .map((item) => item.plannedLocation)
    .filter(Boolean) as string[];

  // If a specific location is scanned for the current pallet, use it as the immediate target
  const currentTargetCode = scannedLocation || currentItem?.plannedLocation;
  if (scannedLocation && currentItem && !putawayProgress.get(rowKey(currentItem))) {
    if (!remainingLocationCodes.includes(scannedLocation)) {
      remainingLocationCodes.unshift(scannedLocation);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        {/* Wraps to its own line rather than letting the order number overflow the
            fixed-height badge, which struck the text through on narrow phones. */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Orders
          </button>
          <div className="badge badge-primary badge-lg h-auto max-w-full whitespace-nowrap py-1 text-xs">
            {selectedOrder.orderNumber}
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm text-base-content/60 mb-1">Pallets Put Away</div>
          <div className="flex items-center gap-2">
            <progress className="progress progress-primary flex-1" value={completedCount} max={putawayItems.length} />
            <span className="text-sm font-semibold">
              {completedCount}/{putawayItems.length}
            </span>
          </div>
        </div>
      </div>

      {currentItem && !isItemDone && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <div className="text-sm text-base-content/60 mb-2">
            Move {currentItemIndex + 1} of {putawayItems.length}
          </div>
          {/* One task is one pallet, so name the pallet the driver is carrying. */}
          <div className="font-bold text-lg mb-1">
            Pallet {currentItem.handlingUnitSeq} of {currentItem.totalHandlingUnits}
          </div>
          <div className="text-xs text-base-content/60 mb-4">
            {currentItem.lineReceivedQuantity} units received on this line
          </div>

          {/* The one instruction that matters, sized to be read from a forklift seat: what to
              carry and where it goes. Everything the system already decided stays decided --
              quantity and destination are shown as facts, not as questions. */}
          <div className="rounded-lg bg-primary/10 border border-primary/30 p-4 mb-4">
            <div className="text-xs uppercase tracking-wide text-base-content/60">Take to</div>
            <div className="font-mono font-bold text-3xl leading-tight my-1">
              {currentItem.plannedLocation ?? "—"}
            </div>
            <div className="text-lg font-semibold">
              {remainingQuantity} units
              {currentItem.materialCode ? ` · ${currentItem.materialCode}` : ""}
            </div>
            {currentItem.materialName && (
              <div className="text-sm text-base-content/70">{currentItem.materialName}</div>
            )}
            {currentItem.completedQuantity > 0 && (
              <div className="text-xs text-base-content/60 mt-1">
                {currentItem.completedQuantity} of {currentItem.palletQuantity} already away
              </div>
            )}
          </div>

          {/* Everything below is the exception path, folded away so the normal move is
              two taps: confirm the bin, or scan a different one. */}
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-base-content/60 select-none">
              Item details &amp; quantity
            </summary>
            <div className="mt-3 space-y-3">
              <ItemDetailsDisplay
                materialId={currentItem.materialId}
                materialCode={currentItem.materialCode}
                materialName={currentItem.materialName}
                warehouseId={warehouseId}
                existingLocations={currentItem.existingLocations}
              />
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Putaway quantity (this pallet)</span>
                </label>
                <input
                  {...QUANTITY_INPUT_PROPS}
                  className="input input-bordered"
                  value={quantityInputValue(allocationQuantity)}
                  onChange={(e) =>
                    onAllocationQuantityChange(
                      // Never let a non-numeric entry reach the confirm button as NaN.
                      Math.min(
                        Math.max(remainingQuantity, 1),
                        Number.isFinite(parseQuantityInput(e.target.value))
                          ? parseQuantityInput(e.target.value)
                          : 0
                      )
                    )
                  }
                  placeholder="0"
                />
              </div>
            </div>
          </details>

          {/* The bin refused the pallet, so say where it will go instead. Previously the worker
              was left holding it with only an error message. */}
          {suggestedAlternatives.length > 0 && (
            <div className="alert alert-warning flex-col items-stretch gap-2 mb-4">
              <div className="text-sm font-medium">
                That bin cannot take this pallet. These can:
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedAlternatives.map((alternative) => (
                  <button
                    key={alternative.locationCode}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onUseAlternative(alternative.locationCode)}
                  >
                    <span className="font-mono">{alternative.locationCode}</span>
                    <span className="opacity-70">({alternative.allocatableQuantity})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pre-filled with the planned bin, so scanning is a correction rather than a chore.
              A driver who parks where they were told never touches this field. */}
          <div className="mb-4">
            <label className="label">
              <span className="label-text font-medium">Scan bin to confirm</span>
              {isOverridingPlan && (
                <span className="label-text-alt text-warning">Different from plan</span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                className={`input input-bordered flex-1 font-mono ${locationError ? "input-error" : ""}`}
                placeholder={currentItem.plannedLocation || "Scan or enter location"}
                value={scannedLocation}
                onChange={(e) => onLocationChange(e.target.value)}
                disabled={validatingLocation}
              />
              <button onClick={onOpenLocationPicker} className="btn btn-primary btn-square" title="Browse available locations">
                <span className="material-symbols-outlined">location_on</span>
              </button>
            </div>
            {validatingLocation && (
              <div className="mt-1 text-xs text-base-content/60 flex items-center gap-1">
                <span className="loading loading-spinner loading-xs"></span>
                Checking bin...
              </div>
            )}
            {locationError && <div className="mt-1 text-xs text-error">{locationError}</div>}
            {isOverridingPlan && !locationError && (
              <button
                className="btn btn-ghost btn-xs mt-2"
                onClick={() => void onUseSuggestedLocation(currentItem.plannedLocation!)}
              >
                Back to planned bin {currentItem.plannedLocation}
              </button>
            )}
          </div>

          <button
            onClick={() => void onConfirmPutaway()}
            className="btn btn-primary w-full btn-lg"
            disabled={!scannedLocation || !!locationError || allocationQuantity <= 0 || allocationQuantity > remainingQuantity}
          >
            <span className="material-symbols-outlined">check</span>
            Confirm Putaway
          </button>

          <div className="mt-3">
            {!showSkipInput ? (
              <button
                className="btn btn-ghost btn-sm w-full"
                onClick={() => setShowSkipInput(true)}
              >
                <span className="material-symbols-outlined">skip_next</span>
                Skip Item With Reason
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  placeholder="Reason for skipping this item (e.g., location blocked, damage, missing label)"
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="btn btn-warning flex-1"
                    onClick={() => void onSkipItem(skipReason).then(() => {
                      setSkipReason("");
                      setShowSkipInput(false);
                    })}
                    disabled={!skipReason.trim()}
                  >
                    Confirm Skip
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowSkipInput(false);
                      setSkipReason("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {isItemSkipped && (
            <div className="alert alert-warning mt-3">
              <span>
                Skipped previously: {skippedReasonsByRow.get(rowKey(currentItem))}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        {/* Every pallet and its own destination, so the whole plan is visible up front rather
            than one line-level bin standing in for several different ones. */}
        <div className="text-sm font-medium mb-2">Pallet Moves in Order</div>
        <div className="space-y-2">
          {putawayItems.map((item, idx) => {
            const key = rowKey(item);
            const isDone = putawayProgress.get(key) || false;
            const skipReason = skippedReasonsByRow.get(key);
            const isSkipped = !!skipReason && !isDone;
            const isCurrent = idx === currentItemIndex && !isDone;
            return (
              <button
                key={key}
                type="button"
                onClick={() => !isDone && onSelectItem(idx)}
                disabled={isDone}
                className={`p-3 rounded-lg border ${
                  isDone
                    ? "bg-success/10 border-success opacity-60 cursor-not-allowed pointer-events-none"
                    : isSkipped
                    ? "bg-warning/10 border-warning"
                    : isCurrent
                    ? "bg-primary/10 border-primary"
                    : "bg-base-200 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <div className="font-semibold">
                      {item.materialCode ? `${item.materialCode} — ` : ""}
                      Pallet {item.handlingUnitSeq} of {item.totalHandlingUnits}
                    </div>
                    <div className="text-xs text-base-content/60">
                      {item.palletQuantity} units
                      {item.plannedLocation ? ` → ${item.plannedLocation}` : " → location to be selected"}
                    </div>
                  </div>
                  {isDone ? (
                    <div className="flex items-center gap-2">
                      <span className="badge badge-success">Done</span>
                      <span className="badge badge-outline">Completed earlier</span>
                    </div>
                  ) : isSkipped ? (
                    <span className="badge badge-warning">Skipped</span>
                  ) : isCurrent ? (
                    <span className="badge badge-primary">Current</span>
                  ) : (
                    <span className="badge badge-ghost">Pending</span>
                  )}
                </div>
                {isSkipped && (
                  <div className="text-xs text-warning-content/80 mt-1 text-left">
                    Reason: {skipReason}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <WorkerRouteGuide
        warehouseId={warehouseId}
        orderId={selectedOrder.id}
        targetLocationCode={currentTargetCode}
        targetLocationCodes={remainingLocationCodes}
        completedLocationCodes={completedLocationCodes}
        operationType="putaway"
      />

      {showLocationPicker && (
        <LocationPicker onClose={onCloseLocationPicker} onLocationSelect={onLocationSelect} warehouseId={warehouseId} />
      )}
    </div>
  );
}
