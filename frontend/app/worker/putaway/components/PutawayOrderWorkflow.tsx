"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { PutawayItem } from "@/lib/api/orderItems";
import { ItemDetailsDisplay } from "./ItemDetailsDisplay";

type SelectedOrder = { id: string; orderNumber: string };

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
  skippedReasonsByItem,
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
  skippedReasonsByItem: Map<string, string>;
}) {
  const [showSkipInput, setShowSkipInput] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const currentItem = putawayItems[currentItemIndex];
  const completedCount = Array.from(putawayProgress.values()).filter((done) => done).length;
  const isItemDone = currentItem ? putawayProgress.get(currentItem.itemId) || false : false;
  const isItemSkipped = currentItem ? skippedReasonsByItem.has(currentItem.itemId) : false;

  if (!currentItem) {
    return null;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="flex items-center justify-between mb-2">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Orders
          </button>
          <div className="badge badge-primary badge-lg">{selectedOrder.orderNumber}</div>
        </div>
        <div className="mt-4">
          <div className="text-sm text-base-content/60 mb-1">Putaway Progress</div>
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
            Item {currentItemIndex + 1} of {putawayItems.length}
          </div>
          <div className="font-bold text-lg mb-4">Put Away Item</div>

          <ItemDetailsDisplay
            materialId={currentItem.materialId}
            materialCode={currentItem.materialCode}
            materialName={currentItem.materialName}
            warehouseId={warehouseId}
            existingLocations={currentItem.existingLocations}
          />

          <div className="space-y-3 mb-4">
            <div className="p-3 bg-base-200 rounded-lg">
              <div className="text-sm text-base-content/60">Quantity to Put Away</div>
              <div className="font-semibold">{currentItem.receivedQuantity} units</div>
              <div className="text-xs text-base-content/60">Remaining: {remainingQuantity} units</div>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Putaway Quantity (this location)</span>
              </label>
              <input
                type="number"
                min={1}
                max={Math.max(remainingQuantity, 1)}
                className="input input-bordered"
                value={allocationQuantity}
                onChange={(e) => onAllocationQuantityChange(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="label">
              <span className="label-text font-medium">Select Target Location</span>
              {currentItem.suggestedLocation && (
                <span className="label-text-alt text-primary">Suggested: {currentItem.suggestedLocation}</span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                className={`input input-bordered flex-1 ${locationError ? "input-error" : ""}`}
                placeholder={
                  currentItem.suggestedLocation ||
                  "Scan or enter location (e.g., C-02-05-3-B or ST-WH-001-01-001-1-A)"
                }
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
                Validating location...
              </div>
            )}
            {locationError && <div className="mt-1 text-xs text-error">{locationError}</div>}
            {!locationError && !validatingLocation && scannedLocation && (
              <div className="mt-1 text-xs text-success">✓ Location validated and active</div>
            )}
            {currentItem.suggestedLocation && (
              <button
                className="btn btn-ghost btn-sm mt-2"
                onClick={() => void onUseSuggestedLocation(currentItem.suggestedLocation!)}
              >
                Use Suggested: {currentItem.suggestedLocation}
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
                className="btn btn-outline w-full"
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
                Skipped previously: {skippedReasonsByItem.get(currentItem.itemId)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm font-medium mb-2">Items in Order</div>
        <div className="space-y-2">
          {putawayItems.map((item, idx) => {
            const isDone = putawayProgress.get(item.itemId) || false;
            const skipReason = skippedReasonsByItem.get(item.itemId);
            const isSkipped = !!skipReason && !isDone;
            const isCurrent = idx === currentItemIndex && !isDone;
            return (
              <button
                key={item.itemId}
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
                  <div>
                    <div className="font-semibold">Item {idx + 1}</div>
                    <div className="text-xs text-base-content/60">Quantity: {item.receivedQuantity}</div>
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

      {showLocationPicker && (
        <LocationPicker onClose={onCloseLocationPicker} onLocationSelect={onLocationSelect} warehouseId={warehouseId} />
      )}
    </div>
  );
}
