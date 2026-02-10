"use client";

const COLUMN_OPTIONS = [
  { key: "sku", label: "SKU" },
  { key: "name", label: "Item Name" },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "warehouse", label: "Warehouse" },
  { key: "quantity", label: "Quantity" },
  { key: "location", label: "Location" },
  { key: "status", label: "Status" },
  { key: "reorderPoint", label: "ROP" },
  { key: "ropInDays", label: "ROP (Days)" },
  { key: "bufferStock", label: "Buffer Stock" },
  { key: "bufferDays", label: "Buffer Days" },
  { key: "maxStock", label: "Max Stock" },
  { key: "minStock", label: "Min Stock" },
  { key: "moq", label: "MOQ" },
  { key: "leadTimeDays", label: "Lead Time (Days)" },
  { key: "leadTimeMonths", label: "Lead Time (Months)" },
  { key: "stackingQuantity", label: "Stacking Qty" },
  { key: "varianceDemand", label: "Variance Demand" },
  { key: "varianceLeadTimeDemand", label: "Variance Lead Time" },
  { key: "difference", label: "Difference" },
  { key: "orderDeliveryDays", label: "Order Delivery" },
  { key: "orderQuantity", label: "Order Quantity" },
  { key: "palletRequirement", label: "Pallet Requirement" },
] as const;

interface InventoryColumnSelectorProps {
  showColumnMenu: boolean;
  visibleColumns: Set<string>;
  onToggleMenu: () => void;
  onToggleColumn: (columnKey: string, checked: boolean) => void;
}

export function InventoryColumnSelector({
  showColumnMenu,
  visibleColumns,
  onToggleMenu,
  onToggleColumn,
}: InventoryColumnSelectorProps) {
  return (
    <div className="dropdown dropdown-end">
      <button className="btn btn-ghost btn-sm" onClick={onToggleMenu}>
        <span className="material-symbols-outlined">view_column</span>
        <span>Columns</span>
      </button>
      {showColumnMenu && (
        <ul className="dropdown-content menu bg-base-100 border border-base-300 rounded-box shadow-lg z-50 p-2 w-64 max-h-96 overflow-y-auto">
          {COLUMN_OPTIONS.map((col) => (
            <li key={col.key}>
              <label className="label cursor-pointer">
                <span className="label-text">{col.label}</span>
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={visibleColumns.has(col.key)}
                  onChange={(e) => onToggleColumn(col.key, e.target.checked)}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

