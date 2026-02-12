import type { PackingStatus } from "../types";

interface PackingHeaderProps {
  searchQuery: string;
  statusFilter: PackingStatus | "all";
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (status: PackingStatus | "all") => void;
}

export function PackingHeader({
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
}: PackingHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold text-base-content">Packing Management</h1>
      <div className="flex gap-3">
        <div className="form-control">
          <div className="relative">
            <input
              type="text"
              placeholder="Search orders..."
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
            <li>
              <button
                className={statusFilter === "all" ? "active" : ""}
                onClick={() => onStatusFilterChange("all")}
              >
                All Status
              </button>
            </li>
            <li>
              <button
                className={statusFilter === "pending" ? "active" : ""}
                onClick={() => onStatusFilterChange("pending")}
              >
                Pending
              </button>
            </li>
            <li>
              <button
                className={statusFilter === "in_progress" ? "active" : ""}
                onClick={() => onStatusFilterChange("in_progress")}
              >
                In Progress
              </button>
            </li>
            <li>
              <button
                className={statusFilter === "packed" ? "active" : ""}
                onClick={() => onStatusFilterChange("packed")}
              >
                Packed
              </button>
            </li>
            <li>
              <button
                className={statusFilter === "shipped" ? "active" : ""}
                onClick={() => onStatusFilterChange("shipped")}
              >
                Shipped
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
