"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip } from "@/components/StatusChip";
import { getMaterialTypeChip } from "@/lib/ui/material-type-chip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { InventoryDisplayItem, formatDecimal, inventoryStatusTone } from "../types";

function generateInventoryHistory(currentQty: number, days: number = 30) {
  const data = [];
  const today = new Date();
  let qty = currentQty;

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const variation = Math.floor(Math.random() * 20) - 10;
    qty = Math.max(0, currentQty + variation + Math.floor(Math.random() * 15) - 7);
    data.push({
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      quantity: qty,
    });
  }

  return data;
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
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const daysMap = { "7d": 7, "30d": 30, "90d": 90 };

  const inventoryHistory = useMemo(
    () => generateInventoryHistory(item.qty, daysMap[timeRange]),
    [item.qty, timeRange]
  );

  const minQty = Math.min(...inventoryHistory.map((d) => d.quantity));
  const maxQty = Math.max(...inventoryHistory.map((d) => d.quantity));
  const avgQty = Math.round(
    inventoryHistory.reduce((sum, d) => sum + d.quantity, 0) / inventoryHistory.length
  );
  const trend =
    inventoryHistory[inventoryHistory.length - 1].quantity > inventoryHistory[0].quantity
      ? "up"
      : inventoryHistory[inventoryHistory.length - 1].quantity < inventoryHistory[0].quantity
      ? "down"
      : "stable";
  const change =
    inventoryHistory[inventoryHistory.length - 1].quantity - inventoryHistory[0].quantity;

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
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-base-content">Inventory Levels Over Time</h3>
                <StatusChip label="Mock Data" tone="neutral" />
              </div>
              <p className="text-sm text-base-content/60 mt-1">Track inventory changes and trends</p>
            </div>
            <div className="flex gap-2">
              {(["7d", "30d", "90d"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={clsx("btn btn-sm", timeRange === range ? "btn-primary" : "btn-ghost")}
                >
                  {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Current</div>
              <div className="text-lg font-bold text-base-content">{item.qty}</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Average</div>
              <div className="text-lg font-bold text-base-content">{avgQty}</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Minimum</div>
              <div className="text-lg font-bold text-warning">{minQty}</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Maximum</div>
              <div className="text-lg font-bold text-success">{maxQty}</div>
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inventoryHistory}>
                  <defs>
                    <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#CF0F47" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#CF0F47" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                    formatter={(value: number) => [`${value} units`, "Quantity"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="quantity"
                    stroke="#CF0F47"
                    strokeWidth={2}
                    fill="url(#colorQuantity)"
                    dot={{ r: 3, fill: "#CF0F47" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
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
