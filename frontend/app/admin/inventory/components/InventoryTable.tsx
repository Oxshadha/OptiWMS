"use client";

import { formatDecimal, InventoryDisplayItem, statusClass } from "../types";

interface InventoryTableProps {
  items: InventoryDisplayItem[];
  visibleColumns: Set<string>;
  onViewItem: (item: InventoryDisplayItem) => void;
  onEditItem: (item: InventoryDisplayItem) => void;
}

export function InventoryTable({
  items,
  visibleColumns,
  onViewItem,
  onEditItem,
}: InventoryTableProps) {
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
              {visibleColumns.has("sku") && <th className="font-semibold text-base-content">SKU</th>}
              {visibleColumns.has("name") && <th className="font-semibold text-base-content">Item Name</th>}
              {visibleColumns.has("type") && <th className="font-semibold text-base-content">Type</th>}
              {visibleColumns.has("category") && <th className="font-semibold text-base-content">Category</th>}
              {visibleColumns.has("warehouse") && <th className="font-semibold text-base-content">Warehouse</th>}
              {visibleColumns.has("quantity") && <th className="font-semibold text-base-content">Quantity</th>}
              {visibleColumns.has("location") && <th className="font-semibold text-base-content">Location</th>}
              {visibleColumns.has("status") && <th className="font-semibold text-base-content">Status</th>}
              {visibleColumns.has("reorderPoint") && <th className="font-semibold text-base-content">ROP</th>}
              {visibleColumns.has("ropInDays") && <th className="font-semibold text-base-content">ROP (Days)</th>}
              {visibleColumns.has("bufferStock") && <th className="font-semibold text-base-content">Buffer Stock</th>}
              {visibleColumns.has("bufferDays") && <th className="font-semibold text-base-content">Buffer Days</th>}
              {visibleColumns.has("maxStock") && <th className="font-semibold text-base-content">Max Stock</th>}
              {visibleColumns.has("minStock") && <th className="font-semibold text-base-content">Min Stock</th>}
              {visibleColumns.has("moq") && <th className="font-semibold text-base-content">MOQ</th>}
              {visibleColumns.has("leadTimeDays") && <th className="font-semibold text-base-content">Lead Time (Days)</th>}
              {visibleColumns.has("leadTimeMonths") && <th className="font-semibold text-base-content">Lead Time (Months)</th>}
              {visibleColumns.has("stackingQuantity") && <th className="font-semibold text-base-content">Stacking Qty</th>}
              {visibleColumns.has("varianceDemand") && <th className="font-semibold text-base-content">Variance Demand</th>}
              {visibleColumns.has("varianceLeadTimeDemand") && <th className="font-semibold text-base-content">Variance Lead Time</th>}
              {visibleColumns.has("difference") && <th className="font-semibold text-base-content">Difference</th>}
              {visibleColumns.has("orderDeliveryDays") && <th className="font-semibold text-base-content">Order Delivery</th>}
              {visibleColumns.has("orderQuantity") && <th className="font-semibold text-base-content">Order Quantity</th>}
              {visibleColumns.has("palletRequirement") && <th className="font-semibold text-base-content">Pallet Requirement</th>}
              <th className="font-semibold text-base-content">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-base-200/50">
                {visibleColumns.has("sku") && (
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
                {visibleColumns.has("name") && <td>{item.name}</td>}
                {visibleColumns.has("type") && (
                  <td>
                    <span
                      className={`badge text-xs whitespace-nowrap ${
                        item.itemType === "Raw Material"
                          ? "badge-info"
                          : item.itemType === "Product"
                            ? "badge-success"
                            : "badge-neutral"
                      }`}
                    >
                      {item.itemType}
                    </span>
                  </td>
                )}
                {visibleColumns.has("category") && (
                  <td>
                    <span
                      className="badge text-xs whitespace-nowrap"
                      style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                    >
                      {item.category}
                    </span>
                  </td>
                )}
                {visibleColumns.has("warehouse") && (
                  <td>
                    <span className="badge badge-info text-xs whitespace-nowrap">{item.warehouseName}</span>
                  </td>
                )}
                {visibleColumns.has("quantity") && <td className="font-semibold">{Math.ceil(item.qty)}</td>}
                {visibleColumns.has("location") && (
                  <td>
                    <span className="badge badge-ghost">{item.location}</span>
                  </td>
                )}
                {visibleColumns.has("status") && (
                  <td>
                    <span className={`badge ${statusClass(item.status)} whitespace-nowrap text-xs`}>{item.status}</span>
                  </td>
                )}
                {visibleColumns.has("reorderPoint") && <td><span className="text-sm font-mono">{item.reorderPoint ? formatDecimal(parseFloat(item.reorderPoint)) : "—"}</span></td>}
                {visibleColumns.has("ropInDays") && <td><span className="text-sm font-mono">{item.ropInDays ? formatDecimal(parseFloat(item.ropInDays)) : "—"}</span></td>}
                {visibleColumns.has("bufferStock") && <td><span className="text-sm font-mono">{item.bufferStock ? formatDecimal(parseFloat(item.bufferStock)) : "—"}</span></td>}
                {visibleColumns.has("bufferDays") && <td><span className="text-sm">{item.bufferDays ? `${item.bufferDays} days` : "—"}</span></td>}
                {visibleColumns.has("maxStock") && <td><span className="text-sm font-mono">{item.maxStock ? formatDecimal(parseFloat(item.maxStock)) : "—"}</span></td>}
                {visibleColumns.has("minStock") && <td><span className="text-sm font-mono">{item.minStock ? formatDecimal(parseFloat(item.minStock)) : "—"}</span></td>}
                {visibleColumns.has("moq") && <td><span className="text-sm font-mono">{item.moq ? formatDecimal(parseFloat(item.moq)) : "—"}</span></td>}
                {visibleColumns.has("leadTimeDays") && <td><span className="text-sm">{item.leadTimeDays ? `${item.leadTimeDays} days` : "—"}</span></td>}
                {visibleColumns.has("leadTimeMonths") && <td><span className="text-sm font-mono">{item.leadTimeMonths ? formatDecimal(parseFloat(item.leadTimeMonths)) : "—"}</span></td>}
                {visibleColumns.has("stackingQuantity") && <td><span className="text-sm">{item.stackingQuantity ? item.stackingQuantity.toLocaleString() : "—"}</span></td>}
                {visibleColumns.has("varianceDemand") && <td><span className="text-sm font-mono">{item.varianceDemand ? formatDecimal(parseFloat(item.varianceDemand)) : "—"}</span></td>}
                {visibleColumns.has("varianceLeadTimeDemand") && <td><span className="text-sm font-mono">{item.varianceLeadTimeDemand ? formatDecimal(parseFloat(item.varianceLeadTimeDemand)) : "—"}</span></td>}
                {visibleColumns.has("difference") && <td><span className="text-sm font-mono">{item.difference ? formatDecimal(parseFloat(item.difference)) : "—"}</span></td>}
                {visibleColumns.has("orderDeliveryDays") && <td><span className="text-sm">{item.orderDeliveryDays ? `${item.orderDeliveryDays} days` : "—"}</span></td>}
                {visibleColumns.has("orderQuantity") && <td><span className="text-sm font-mono">{item.orderQuantity ? formatDecimal(parseFloat(item.orderQuantity)) : "—"}</span></td>}
                {visibleColumns.has("palletRequirement") && <td><span className="text-sm font-mono">{item.palletRequirement ? formatDecimal(parseFloat(item.palletRequirement)) : "—"}</span></td>}
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
