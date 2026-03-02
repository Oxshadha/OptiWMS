"use client";

import { DetailModal } from "@/components/DetailModal";
import { StatusChip } from "@/components/StatusChip";
import { getMaterialTypeChip } from "@/lib/ui/material-type-chip";
import { InventoryDisplayItem, formatDecimal, inventoryStatusTone } from "../types";

function parseOptionalNumber(value?: string) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export function InventoryItemDetailModal({
  isOpen,
  onClose,
  item,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryDisplayItem;
  onEdit?: () => void;
}) {
  const currentAvailable = item.availableQty ?? item.qty;
  const reservedQty = item.reservedQty ?? 0;
  const reorderPoint = parseOptionalNumber(item.reorderPoint);
  const bufferStock = parseOptionalNumber(item.bufferStock);
  const minStock = parseOptionalNumber(item.minStock);
  const maxStock = parseOptionalNumber(item.maxStock);
  const moq = parseOptionalNumber(item.moq);
  const reservedShare = item.qty > 0 ? Math.round((reservedQty / item.qty) * 100) : 0;

  const targetLevel =
    reorderPoint != null && bufferStock != null
      ? reorderPoint + bufferStock
      : maxStock != null && minStock != null
      ? (maxStock + minStock) / 2
      : maxStock ?? reorderPoint ?? item.qty;

  const basisMax = Math.max(maxStock ?? targetLevel ?? item.qty, item.qty, currentAvailable, 1);
  const availableFillPercent = clampPercent((currentAvailable / basisMax) * 100);
  const reorderMarkerPercent =
    reorderPoint != null ? clampPercent((reorderPoint / basisMax) * 100) : null;
  const targetMarkerPercent =
    targetLevel != null ? clampPercent((targetLevel / basisMax) * 100) : null;

  const reorderDelta = reorderPoint != null ? currentAvailable - reorderPoint : null;
  const maxHeadroom = maxStock != null ? maxStock - item.qty : null;

  const health = (() => {
    if (reorderPoint != null && currentAvailable <= reorderPoint) {
      return {
        label: "Replenishment Needed",
        tone: "text-error",
        bg: "bg-error/10",
        border: "border-error/20",
        icon: "warning",
        detail: "Available stock is at or below the reorder point.",
      };
    }
    if (maxStock != null && item.qty >= maxStock) {
      return {
        label: "At Capacity",
        tone: "text-warning",
        bg: "bg-warning/10",
        border: "border-warning/20",
        icon: "inventory",
        detail: "Current stock is at or above the configured maximum.",
      };
    }
    if (reservedQty > 0 && currentAvailable <= reservedQty) {
      return {
        label: "Tight Availability",
        tone: "text-warning",
        bg: "bg-warning/10",
        border: "border-warning/20",
        icon: "schedule",
        detail: "Most stock is already committed to existing demand.",
      };
    }
    return {
      label: "Healthy Position",
      tone: "text-success",
      bg: "bg-success/10",
      border: "border-success/20",
      icon: "check_circle",
      detail: "Stock sits within expected operating thresholds.",
    };
  })();

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Inventory: ${item.sku}`} size="xl">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-base-content mb-4">Item Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-base-content/60">SKU</label>
              <p className="font-semibold">{item.sku}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Item Name</label>
              <p className="font-semibold">{item.name}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Type</label>
              <p>
                {(() => {
                  const typeChip = getMaterialTypeChip(item.itemType);
                  return <StatusChip label={typeChip.label} tone={typeChip.tone} className={typeChip.className} />;
                })()}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Current Quantity</label>
              <p className="font-semibold text-lg">{Math.ceil(item.qty)} units</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Location</label>
              <p className="font-semibold">{item.location}</p>
              {item.locations && item.locations.length > 1 && (
                <p className="text-xs text-base-content/60 mt-1">
                  Also in: {item.locations.slice(1).join(", ")}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-base-content/60">Status</label>
              <p>
                <StatusChip label={item.status} tone={inventoryStatusTone(item.status)} showDot />
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Nearest Expiry</label>
              <p className="font-semibold">{item.nearestExpiryDate || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Batch / Lot</label>
              <p className="font-semibold">
                {item.batches && item.batches.length > 0 ? item.batches.join(", ") : "N/A"}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-base-content mb-4">Planning & Reorder Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-base-content/60">Reorder Point (ROP)</label>
              <p className="font-semibold font-mono">
                {item.reorderPoint ? formatDecimal(parseFloat(item.reorderPoint)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Buffer Stock</label>
              <p className="font-semibold font-mono">
                {item.bufferStock ? formatDecimal(parseFloat(item.bufferStock)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Maximum Stock</label>
              <p className="font-semibold font-mono">
                {item.maxStock ? formatDecimal(parseFloat(item.maxStock)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Minimum Stock</label>
              <p className="font-semibold font-mono">
                {item.minStock ? formatDecimal(parseFloat(item.minStock)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Minimum Order Quantity (MOQ)</label>
              <p className="font-semibold font-mono">
                {item.moq ? formatDecimal(parseFloat(item.moq)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Lead Time</label>
              <p className="font-semibold">
                {item.leadTimeDays ? `${item.leadTimeDays} days` : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Stacking Quantity</label>
              <p className="font-semibold">
                {item.stackingQuantity ? item.stackingQuantity.toLocaleString() : "Not Set"}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-base-content">Inventory Health</h3>
              <p className="text-sm text-base-content/60 mt-1">
                A clear stock-position view built from live inventory and planning thresholds
              </p>
            </div>
          </div>

          <div className={`rounded-xl border p-4 mb-4 ${health.bg} ${health.border}`}>
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined ${health.tone}`}>{health.icon}</span>
              <div>
                <div className={`font-semibold ${health.tone}`}>{health.label}</div>
                <p className="text-sm text-base-content/70 mt-1">{health.detail}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">On Hand</div>
              <div className="text-lg font-bold text-base-content">{item.qty}</div>
              <div className="text-xs text-base-content/60 mt-1">Physical stock</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Available to Use</div>
              <div className="text-lg font-bold text-info">{currentAvailable}</div>
              <div className="text-xs text-base-content/60 mt-1">Free stock after allocations</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Reserved Share</div>
              <div className="text-lg font-bold text-warning">{reservedShare}%</div>
              <div className="text-xs text-base-content/60 mt-1">{reservedQty} units committed</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">
                {reorderDelta == null ? "Reorder Point" : "Reorder Gap"}
              </div>
              <div
                className={`text-lg font-bold ${
                  reorderDelta == null
                    ? "text-base-content"
                    : reorderDelta >= 0
                    ? "text-success"
                    : "text-error"
                }`}
              >
                {reorderDelta == null
                  ? reorderPoint != null
                    ? formatDecimal(reorderPoint)
                    : "Not Set"
                  : `${reorderDelta > 0 ? "+" : ""}${formatDecimal(reorderDelta)}`}
              </div>
              <div className="text-xs text-base-content/60 mt-1">
                {reorderPoint != null ? "Available minus reorder point" : "Set a reorder threshold"}
              </div>
            </div>
          </div>

          <div className="bg-base-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-semibold text-base-content">Stock Position Gauge</div>
                <div className="text-xs text-base-content/60">
                  Compare usable stock against reorder and target levels
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-base-content/60">Capacity Used</div>
                <div className="font-semibold text-base-content">
                  {Math.round((item.qty / basisMax) * 100)}%
                </div>
              </div>
            </div>

            <div className="relative pt-6">
              <div className="h-4 rounded-full bg-base-300 overflow-hidden">
                <div
                  className={`h-full ${
                    reorderPoint != null && currentAvailable <= reorderPoint
                      ? "bg-error"
                      : "bg-success"
                  }`}
                  style={{ width: `${availableFillPercent}%` }}
                />
              </div>

              {reorderMarkerPercent != null && (
                <div
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: `${reorderMarkerPercent}%` }}
                >
                  <div className="w-px h-6 bg-error" />
                  <div className="text-[11px] text-error font-medium mt-1 whitespace-nowrap">
                    Reorder {formatDecimal(reorderPoint!)}
                  </div>
                </div>
              )}

              {targetMarkerPercent != null && targetMarkerPercent !== reorderMarkerPercent && (
                <div
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: `${targetMarkerPercent}%` }}
                >
                  <div className="w-px h-6 bg-info" />
                  <div className="text-[11px] text-info font-medium mt-1 whitespace-nowrap">
                    Target {formatDecimal(targetLevel)}
                  </div>
                </div>
              )}

              <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-base-100 p-3 border border-base-300">
                  <div className="text-xs text-base-content/60">Current Free Stock</div>
                  <div className="font-semibold text-base-content mt-1">
                    {formatDecimal(currentAvailable)}
                  </div>
                </div>
                <div className="rounded-lg bg-base-100 p-3 border border-base-300">
                  <div className="text-xs text-base-content/60">Target Working Level</div>
                  <div className="font-semibold text-base-content mt-1">
                    {targetLevel != null ? formatDecimal(targetLevel) : "Not Set"}
                  </div>
                </div>
                <div className="rounded-lg bg-base-100 p-3 border border-base-300">
                  <div className="text-xs text-base-content/60">Headroom to Max</div>
                  <div
                    className={`font-semibold mt-1 ${
                      maxHeadroom != null && maxHeadroom < 0 ? "text-warning" : "text-base-content"
                    }`}
                  >
                    {maxHeadroom != null ? formatDecimal(maxHeadroom) : "Not Set"}
                  </div>
                </div>
                <div className="rounded-lg bg-base-100 p-3 border border-base-300">
                  <div className="text-xs text-base-content/60">Suggested Next Action</div>
                  <div className="font-semibold text-base-content mt-1">
                    {reorderPoint != null && currentAvailable <= reorderPoint
                      ? "Replenish"
                      : maxStock != null && item.qty >= maxStock
                      ? "Pause Inbound"
                      : reservedQty > 0
                      ? "Monitor Allocations"
                      : "No Action"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Reorder Point</div>
              <div className="text-base font-semibold text-base-content">
                {reorderPoint != null ? formatDecimal(reorderPoint) : "Not Set"}
              </div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Buffer Stock</div>
              <div className="text-base font-semibold text-base-content">
                {bufferStock != null ? formatDecimal(bufferStock) : "Not Set"}
              </div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Maximum Stock</div>
              <div className="text-base font-semibold text-base-content">
                {maxStock != null ? formatDecimal(maxStock) : "Not Set"}
              </div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">MOQ</div>
              <div className="text-base font-semibold text-base-content">
                {moq != null ? formatDecimal(moq) : "Not Set"}
              </div>
              <div className="text-xs text-base-content/60 mt-1">
                Suggested minimum replenishment lot
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-base-content/60">
            {item.lastMovementDate && (
              <span>
                Last movement: {item.lastMovementDate}
                {typeof item.daysSinceLastMovement === "number"
                  ? ` (${item.daysSinceLastMovement} day${item.daysSinceLastMovement === 1 ? "" : "s"} ago)`
                  : ""}
              </span>
            )}
            {minStock != null && (
              <span>
                Minimum stock: {formatDecimal(minStock)}
              </span>
            )}
            <span>
              Lead time: {item.leadTimeDays ? `${item.leadTimeDays} days` : "Not Set"}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onClose();
              if (onEdit) onEdit();
            }}
          >
            Edit Item
          </button>
        </div>
      </div>
    </DetailModal>
  );
}
