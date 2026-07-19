import type { Warehouse } from "@/lib/api/warehouses";

interface WarehouseHeaderProps {
  isSystemAdmin: boolean;
  isWarehouseManager: boolean;
  canEditRacks: boolean;
  assignedWarehouseName?: string;
  selectedWarehouseId: string | null;
  availableWarehouses: Warehouse[];
  isLoadingLayout: boolean;
  onRefresh: () => void;
  onOpenBulkRackCreate: () => void;
  onOpenSlottingPlanner: () => void;
  onWarehouseChange: (warehouseId: string) => void;
}

export function WarehouseHeader({
  isSystemAdmin,
  isWarehouseManager,
  canEditRacks,
  assignedWarehouseName,
  selectedWarehouseId,
  availableWarehouses,
  isLoadingLayout,
  onRefresh,
  onOpenBulkRackCreate,
  onOpenSlottingPlanner,
  onWarehouseChange,
}: WarehouseHeaderProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold text-base-content">Warehouse Layout</h1>
        <p className="text-base-content/70 mt-1">
          {isWarehouseManager
            ? `Viewing ${assignedWarehouseName || "your assigned warehouse"}`
            : "Interactive visualization of warehouse storage locations"}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <button className="btn btn-sm btn-ghost" onClick={onRefresh} title="Refresh layout" disabled={isLoadingLayout}>
          <span className="material-symbols-outlined">refresh</span>
        </button>

        {canEditRacks && (
          <button className="btn btn-sm btn-outline" onClick={onOpenSlottingPlanner}>
            <span className="material-symbols-outlined text-sm">rule_settings</span>
            Slotting Rules
          </button>
        )}

        {canEditRacks && (
          <button className="btn btn-sm btn-outline" onClick={onOpenBulkRackCreate}>
            <span className="material-symbols-outlined text-sm">add</span>
            Add Zone Racks
          </button>
        )}

        {isSystemAdmin && (
          <div className="form-control w-full sm:w-64">
            <label className="label">
              <span className="label-text font-semibold">Select Warehouse</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={selectedWarehouseId || ""}
              onChange={(event) => onWarehouseChange(event.target.value)}
              disabled={availableWarehouses.length === 0}
            >
              {availableWarehouses.length === 0 ? (
                <option value="">Loading warehouses...</option>
              ) : (
                availableWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {isWarehouseManager && assignedWarehouseName && (
          <div className="badge badge-lg bg-base-100 border border-base-300 text-base-content font-medium shadow-sm">{assignedWarehouseName}</div>
        )}
      </div>
    </div>
  );
}
