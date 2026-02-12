import type { TransferStatus, TransferType } from "../types";

interface StockTransferHeaderProps {
  totalTransfers: number;
  searchQuery: string;
  statusFilter: TransferStatus | "all";
  typeFilter: TransferType | "all";
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: TransferStatus | "all") => void;
  onTypeFilterChange: (value: TransferType | "all") => void;
  onCreateTransfer: () => void;
}

export function StockTransferHeader({
  totalTransfers,
  searchQuery,
  statusFilter,
  typeFilter,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onCreateTransfer,
}: StockTransferHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold text-base-content">Stock Transfers ({totalTransfers})</h1>
      <div className="flex gap-3">
        <button className="btn btn-primary btn-sm" onClick={onCreateTransfer}>
          <span className="material-symbols-outlined text-sm">add</span>
          Create Transfer
        </button>
        <div className="form-control">
          <div className="relative">
            <input
              type="text"
              placeholder="Search transfers..."
              className="input input-bordered input-sm w-64 pl-10 pr-10"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none">
              search
            </span>
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                type="button"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            )}
          </div>
        </div>

        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">filter_list</span>
            <span>Filter</span>
          </label>
          <ul
            tabIndex={0}
            className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
          >
            <li><button className={statusFilter === "all" ? "active" : ""} onClick={() => onStatusFilterChange("all")}>All Status</button></li>
            <li><button className={statusFilter === "draft" ? "active" : ""} onClick={() => onStatusFilterChange("draft")}>Draft</button></li>
            <li><button className={statusFilter === "released" ? "active" : ""} onClick={() => onStatusFilterChange("released")}>Released</button></li>
            <li><button className={statusFilter === "in_progress" ? "active" : ""} onClick={() => onStatusFilterChange("in_progress")}>In Progress</button></li>
            <li><button className={statusFilter === "partially_completed" ? "active" : ""} onClick={() => onStatusFilterChange("partially_completed")}>Partially Completed</button></li>
            <li><button className={statusFilter === "in_transit" ? "active" : ""} onClick={() => onStatusFilterChange("in_transit")}>In Transit</button></li>
            <li><button className={statusFilter === "completed" ? "active" : ""} onClick={() => onStatusFilterChange("completed")}>Completed</button></li>
            <li><button className={statusFilter === "received" ? "active" : ""} onClick={() => onStatusFilterChange("received")}>Received</button></li>
            <li><button className={statusFilter === "cancelled" ? "active" : ""} onClick={() => onStatusFilterChange("cancelled")}>Cancelled</button></li>
          </ul>
        </div>

        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">swap_horiz</span>
            <span>Type</span>
          </label>
          <ul
            tabIndex={0}
            className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
          >
            <li><button className={typeFilter === "all" ? "active" : ""} onClick={() => onTypeFilterChange("all")}>All Types</button></li>
            <li><button className={typeFilter === "intra_warehouse" ? "active" : ""} onClick={() => onTypeFilterChange("intra_warehouse")}>Intra-Warehouse</button></li>
            <li><button className={typeFilter === "inter_warehouse" ? "active" : ""} onClick={() => onTypeFilterChange("inter_warehouse")}>Inter-Warehouse</button></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
