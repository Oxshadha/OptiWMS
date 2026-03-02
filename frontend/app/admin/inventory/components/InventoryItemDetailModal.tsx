"use client";

import { useMemo } from "react";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip } from "@/components/StatusChip";
import { getMaterialTypeChip } from "@/lib/ui/material-type-chip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { InventoryDisplayItem, formatDecimal, inventoryStatusTone } from "../types";

function parseOptionalNumber(value?: string) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildInventorySnapshot(item: InventoryDisplayItem) {
  const points = [
    { label: "On Hand", quantity: item.qty, color: "#CF0F47" },
    { label: "Available", quantity: item.availableQty ?? item.qty, color: "#0EA5E9" },
    { label: "Reserved", quantity: item.reservedQty ?? 0, color: "#F59E0B" },
  ];

  const optionalMetrics = [
    { label: "Reorder", quantity: parseOptionalNumber(item.reorderPoint), color: "#F97316" },
    { label: "Buffer", quantity: parseOptionalNumber(item.bufferStock), color: "#8B5CF6" },
    { label: "Min", quantity: parseOptionalNumber(item.minStock), color: "#EAB308" },
    { label: "Max", quantity: parseOptionalNumber(item.maxStock), color: "#22C55E" },
  ];

  optionalMetrics.forEach((metric) => {
    if (metric.quantity != null) {
      points.push(metric as { label: string; quantity: number; color: string });
    }
  });

  return points;
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
  const snapshotData = useMemo(() => buildInventorySnapshot(item), [item]);
  const quantities = snapshotData.map((d) => d.quantity);
  const minQty = Math.min(...quantities);
  const maxQty = Math.max(...quantities);
  const avgQty = Math.round(
    quantities.reduce((sum, quantity) => sum + quantity, 0) / quantities.length
  );
  const currentAvailable = item.availableQty ?? item.qty;
  const reservedQty = item.reservedQty ?? 0;
  const trend =
    currentAvailable > item.qty
      ? "up"
      : currentAvailable < item.qty
      ? "down"
      : "stable";
  const change = currentAvailable - item.qty;

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
              <h3 className="text-lg font-semibold text-base-content">Inventory Position Snapshot</h3>
              <p className="text-sm text-base-content/60 mt-1">
                Live values from the current inventory record and planning thresholds
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Current</div>
              <div className="text-lg font-bold text-base-content">{item.qty}</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Available</div>
              <div className="text-lg font-bold text-info">{currentAvailable}</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Reserved</div>
              <div className="text-lg font-bold text-warning">{reservedQty}</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Average Metric</div>
              <div className="text-lg font-bold text-base-content">{avgQty}</div>
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshotData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    labelFormatter={(label) => `${label}`}
                    formatter={(value: number) => [`${value} units`, "Quantity"]}
                  />
                  <Bar
                    dataKey="quantity"
                    radius={[6, 6, 0, 0]}
                    fill="#CF0F47"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-base-content/60">Trend:</span>
            {trend === "up" && (
              <>
                <span className="material-symbols-outlined text-success text-sm">trending_up</span>
                <span className="text-success font-medium">Increasing</span>
              </>
            )}
            {trend === "down" && (
              <>
                <span className="material-symbols-outlined text-error text-sm">trending_down</span>
                <span className="text-error font-medium">Decreasing</span>
              </>
            )}
            {trend === "stable" && (
              <>
                <span className="material-symbols-outlined text-base-content/60 text-sm">remove</span>
                <span className="text-base-content/60 font-medium">Stable</span>
              </>
            )}
            <span className="text-base-content/60 ml-4">
              Change: {change > 0 ? "+" : ""}
              {change} units
            </span>
            <span className="text-base-content/60 ml-4">
              Range: {minQty} to {maxQty} units
            </span>
            {item.lastMovementDate && (
              <span className="text-base-content/60 ml-4">
                Last movement: {item.lastMovementDate}
                {typeof item.daysSinceLastMovement === "number"
                  ? ` (${item.daysSinceLastMovement} day${item.daysSinceLastMovement === 1 ? "" : "s"} ago)`
                  : ""}
              </span>
            )}
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
