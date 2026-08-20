"use client";

import { StatusChip } from "@/components/StatusChip";
import { getMaterialTypeChip } from "@/lib/ui/material-type-chip";
import { formatDecimal, InventoryDisplayItem, inventoryStatusTone } from "../types";

interface InventoryTableProps {
  items: InventoryDisplayItem[];
  visibleColumns: Set<string>;
  onViewItem: (item: InventoryDisplayItem) => void;
  onEditItem: (item: InventoryDisplayItem) => void;
}

// Columns whose value is optional per row. A row created through "Add Item" never
// captures these, so a page of hand-entered rows shows nothing but em-dashes and
// reads as broken data -- while the same columns are fully populated for the seeded
// materials. Hiding a column that is empty across every visible row keeps the table
// honest in both cases: present when there is something to show, absent when there
// is not.
const OPTIONAL_COLUMNS: Record<string, (item: InventoryDisplayItem) => unknown> = {
  location: (item) => item.location,
  reorderPoint: (item) => item.reorderPoint,
  bufferStock: (item) => item.bufferStock,
  moq: (item) => item.moq,
  leadTimeDays: (item) => item.leadTimeDays,
};

function hasAnyValue(items: InventoryDisplayItem[], read: (item: InventoryDisplayItem) => unknown): boolean {
  return items.some((item) => {
    const value = read(item);
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    return text !== "" && text !== "N/A" && text !== "0";
  });
}

export function InventoryTable({
  items,
  visibleColumns,
  onViewItem,
  onEditItem,
}: InventoryTableProps) {
  // Drop optional columns that are empty for every row currently shown.
  const columns = new Set(visibleColumns);
  if (items.length) {
    for (const [key, read] of Object.entries(OPTIONAL_COLUMNS)) {
      if (columns.has(key) && !hasAnyValue(items, read)) columns.delete(key);
    }
  }

  return (
    <>
      <div
        className="w-full"
        style={{
          height: "calc(100vh - 450px)",
          minHeight: "500px",
          overflow: "auto",
          position: "relative",
        }}
      >
        <table className="table w-full" style={{ minWidth: "1400px", width: "max-content" }}>
          <thead className="bg-base-200 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
            <tr>
              {columns.has("sku") && <th className="font-semibold text-base-content">SKU</th>}
              {columns.has("name") && <th className="font-semibold text-base-content">Item Name</th>}
              {columns.has("type") && <th className="font-semibold text-base-content">Type</th>}
              {columns.has("warehouse") && <th className="font-semibold text-base-content">Warehouse</th>}
              {columns.has("quantity") && <th className="font-semibold text-base-content">Quantity</th>}
              {columns.has("location") && <th className="font-semibold text-base-content">Location</th>}
              {columns.has("status") && <th className="font-semibold text-base-content">Status</th>}
              {columns.has("reorderPoint") && <th className="font-semibold text-base-content">ROP</th>}
              {columns.has("ropInDays") && <th className="font-semibold text-base-content">ROP (Days)</th>}
              {columns.has("bufferStock") && <th className="font-semibold text-base-content">Buffer Stock</th>}
              {columns.has("bufferDays") && <th className="font-semibold text-base-content">Buffer Days</th>}
              {columns.has("maxStock") && <th className="font-semibold text-base-content">Max Stock</th>}
              {columns.has("minStock") && <th className="font-semibold text-base-content">Min Stock</th>}
              {columns.has("moq") && <th className="font-semibold text-base-content">MOQ</th>}
              {columns.has("leadTimeDays") && <th className="font-semibold text-base-content">Lead Time (Days)</th>}
              {columns.has("leadTimeMonths") && <th className="font-semibold text-base-content">Lead Time (Months)</th>}
              {columns.has("stackingQuantity") && <th className="font-semibold text-base-content">Stacking Qty</th>}
              {columns.has("varianceDemand") && <th className="font-semibold text-base-content">Variance Demand</th>}
              {columns.has("varianceLeadTimeDemand") && <th className="font-semibold text-base-content">Variance Lead Time</th>}
              {columns.has("difference") && <th className="font-semibold text-base-content">Difference</th>}
              {columns.has("orderDeliveryDays") && <th className="font-semibold text-base-content">Order Delivery</th>}
              {columns.has("orderQuantity") && <th className="font-semibold text-base-content">Order Quantity</th>}
              {columns.has("palletRequirement") && <th className="font-semibold text-base-content">Pallet Requirement</th>}
              <th className="font-semibold text-base-content">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-base-200/50">
                {columns.has("sku") && (
                  <td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewItem(item);
                      }}
                      className="font-mono font-semibold text-primary hover:underline text-left"
                    >
                      {item.sku}
                    </button>
                  </td>
                )}
                {columns.has("name") && <td>{item.name}</td>}
                {columns.has("type") && (
                  <td>
                    {(() => {
                      const typeChip = getMaterialTypeChip(item.itemType);
                      return (
                        <StatusChip
                          label={typeChip.label}
                          tone={typeChip.tone}
                          className={`whitespace-nowrap ${typeChip.className || ""}`.trim()}
                        />
                      );
                    })()}
                  </td>
                )}
                {columns.has("warehouse") && (
                  <td>
                    <StatusChip label={item.warehouseName} tone="neutral" className="whitespace-nowrap" />
                  </td>
                )}
                {columns.has("quantity") && <td className="font-semibold">{Math.ceil(item.qty)}</td>}
                {columns.has("location") && (
                  <td>
                    <StatusChip
                      label={
                        item.locations && item.locations.length > 1
                          ? `${item.location} +${item.locations.length - 1}`
                          : item.location
                      }
                      tone="neutral"
                      className="whitespace-nowrap"
                    />
                  </td>
                )}
                {columns.has("status") && (
                  <td>
                    <StatusChip
                      label={item.status}
                      tone={inventoryStatusTone(item.status)}
                      showDot
                      className="whitespace-nowrap"
                    />
                  </td>
                )}
                {columns.has("reorderPoint") && <td><span className="text-sm font-mono">{item.reorderPoint ? formatDecimal(parseFloat(item.reorderPoint)) : "—"}</span></td>}
                {columns.has("ropInDays") && <td><span className="text-sm font-mono">{item.ropInDays ? formatDecimal(parseFloat(item.ropInDays)) : "—"}</span></td>}
                {columns.has("bufferStock") && <td><span className="text-sm font-mono">{item.bufferStock ? formatDecimal(parseFloat(item.bufferStock)) : "—"}</span></td>}
                {columns.has("bufferDays") && <td><span className="text-sm">{item.bufferDays ? `${item.bufferDays} days` : "—"}</span></td>}
                {columns.has("maxStock") && <td><span className="text-sm font-mono">{item.maxStock ? formatDecimal(parseFloat(item.maxStock)) : "—"}</span></td>}
                {columns.has("minStock") && <td><span className="text-sm font-mono">{item.minStock ? formatDecimal(parseFloat(item.minStock)) : "—"}</span></td>}
                {columns.has("moq") && <td><span className="text-sm font-mono">{item.moq ? formatDecimal(parseFloat(item.moq)) : "—"}</span></td>}
                {columns.has("leadTimeDays") && <td><span className="text-sm">{item.leadTimeDays ? `${item.leadTimeDays} days` : "—"}</span></td>}
                {columns.has("leadTimeMonths") && <td><span className="text-sm font-mono">{item.leadTimeMonths ? formatDecimal(parseFloat(item.leadTimeMonths)) : "—"}</span></td>}
                {columns.has("stackingQuantity") && <td><span className="text-sm">{item.stackingQuantity ? item.stackingQuantity.toLocaleString() : "—"}</span></td>}
                {columns.has("varianceDemand") && <td><span className="text-sm font-mono">{item.varianceDemand ? formatDecimal(parseFloat(item.varianceDemand)) : "—"}</span></td>}
                {columns.has("varianceLeadTimeDemand") && <td><span className="text-sm font-mono">{item.varianceLeadTimeDemand ? formatDecimal(parseFloat(item.varianceLeadTimeDemand)) : "—"}</span></td>}
                {columns.has("difference") && <td><span className="text-sm font-mono">{item.difference ? formatDecimal(parseFloat(item.difference)) : "—"}</span></td>}
                {columns.has("orderDeliveryDays") && <td><span className="text-sm">{item.orderDeliveryDays ? `${item.orderDeliveryDays} days` : "—"}</span></td>}
                {columns.has("orderQuantity") && <td><span className="text-sm font-mono">{item.orderQuantity ? formatDecimal(parseFloat(item.orderQuantity)) : "—"}</span></td>}
                {columns.has("palletRequirement") && <td><span className="text-sm font-mono">{item.palletRequirement ? formatDecimal(parseFloat(item.palletRequirement)) : "—"}</span></td>}
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-xs" title="View" onClick={() => onViewItem(item)}>
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </button>
                    <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => onEditItem(item)}>
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <div className="p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">inventory_2</span>
          <h3 className="text-lg font-semibold text-base-content mb-2">No items found</h3>
          <p className="text-sm text-base-content/60">Try adjusting your search or filters</p>
        </div>
      )}
    </>
  );
}
