"use client";

import { isUUID } from "@/lib/utils/material-display";

type ReceivingItem = {
  id: string;
  sku: string;
  name: string;
  expected: number;
  received: number;
  materialId: string;
};

export function ReceivingItemCard({
  item,
  index,
  blindMode,
  onChangeQty,
  onBlindSkuChange,
  onBlindSkuBlur,
}: {
  item: ReceivingItem;
  index: number;
  blindMode: boolean;
  onChangeQty: (index: number, quantity: number) => void;
  onBlindSkuChange: (index: number, value: string) => void;
  onBlindSkuBlur: (index: number, value: string) => void;
}) {
  return (
    <div className="bg-base-100 rounded-xl p-4 border border-base-300 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-bold text-lg text-base-content mb-1">{item.name || "Unknown Item"}</div>
          {item.sku && item.sku !== "N/A" && !isUUID(item.sku) ? (
            <div className="text-sm text-base-content/60">
              <span className="font-mono font-semibold text-primary">SKU: {item.sku}</span>
              {item.name &&
                item.name !== item.sku &&
                item.name !== "Unknown Item" &&
                item.name !== "Material details not available" && (
                  <span className="ml-2 text-base-content/40">• {item.name}</span>
                )}
            </div>
          ) : !item.materialId || item.materialId === "" ? (
            <div className="text-sm text-warning">SKU: Not set - Please enter Material Code</div>
          ) : (
            <div className="text-sm text-base-content/60">
              <span className="font-mono font-semibold text-primary">SKU: {item.sku || "N/A"}</span>
            </div>
          )}
        </div>
        {!blindMode && (
          <div className="text-right">
            <div className="text-xs text-base-content/60">Expected</div>
            <div className="font-bold text-base-content">{item.expected}</div>
          </div>
        )}
      </div>

      <div className="bg-base-200 rounded-lg p-4">
        <div className="text-sm text-base-content/60 mb-3">Received Quantity</div>
        <div className="flex items-center gap-4">
          <button onClick={() => onChangeQty(index, item.received - 1)} className="btn btn-circle btn-outline btn-sm">
            <span className="material-symbols-outlined">remove</span>
          </button>
          <div className="flex-1 text-center">
            <input
              type="number"
              className={`input input-bordered w-full text-center text-2xl font-bold ${
                !blindMode && item.received > item.expected ? "input-warning" : ""
              }`}
              value={item.received}
              onChange={(e) => {
                const qty = Math.max(0, parseInt(e.target.value) || 0);
                onChangeQty(index, qty);
              }}
              min="0"
              required
            />
          </div>
          <button onClick={() => onChangeQty(index, item.received + 1)} className="btn btn-circle btn-outline btn-sm">
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>
        {!blindMode && (
          <div className="text-center mt-3">
            <div
              className={`text-xs ${
                item.expected - item.received > 0
                  ? "text-base-content/60"
                  : item.received > item.expected
                    ? "text-warning font-semibold"
                    : "text-success font-semibold"
              }`}
            >
              {item.expected - item.received > 0
                ? `${item.expected - item.received} remaining`
                : item.received > item.expected
                  ? `${item.received - item.expected} over expected`
                  : "Complete"}
            </div>
          </div>
        )}
      </div>

      {blindMode && (!item.materialId || item.materialId === "") && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
          <label className="label">
            <span className="label-text text-sm font-semibold">SKU / Material Code *</span>
            <span className="label-text-alt text-xs text-base-content/60">
              Enter code like: 100036, MAT-12345, or PROD-001
            </span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full font-mono"
            placeholder="Enter Material Code (e.g., 100036)"
            value={item.sku || ""}
            onChange={(e) => onBlindSkuChange(index, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            onBlur={(e) => onBlindSkuBlur(index, e.target.value)}
            autoComplete="off"
            required
          />
          {item.sku && !item.materialId && (
            <div className="text-xs text-warning mt-1">Material lookup pending... Enter a valid Material Code</div>
          )}
        </div>
      )}
    </div>
  );
}
