import type { WarehouseStats } from "../types";

interface WarehouseStatsCardsProps {
  stats: WarehouseStats;
}

export function WarehouseStatsCards({ stats }: WarehouseStatsCardsProps) {
  const labelWithHint = (label: string, hint: string) => (
    <div className="flex items-center gap-1 text-sm font-medium text-base-content/70">
      <span>{label}</span>
      <span
        className="material-symbols-outlined text-[14px] text-base-content/40 cursor-help"
        title={hint}
        aria-label={hint}
      >
        info
      </span>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Total Racks</div>
            <span className="material-symbols-outlined text-base-content/40">inventory_2</span>
          </div>
          <div className="text-3xl font-bold text-base-content">{stats.totalRacks}</div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Total Bins</div>
            <span className="material-symbols-outlined text-base-content/40">category</span>
          </div>
          <div className="text-3xl font-bold text-base-content">{stats.totalBins}</div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Occupied Bins</div>
            <span className="material-symbols-outlined text-success">check_circle</span>
          </div>
          <div className="text-3xl font-bold text-success">{stats.occupiedBins}</div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            {labelWithHint(
              "Reserved Bins",
              "Number of bin locations currently marked reserved."
            )}
            <span className="material-symbols-outlined text-info">lock</span>
          </div>
          <div className="text-3xl font-bold text-info">{stats.reservedBins}</div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Occupancy Rate</div>
            <span className="material-symbols-outlined text-base-content/40">percent</span>
          </div>
          <div className="text-3xl font-bold text-base-content">{stats.occupancyRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-success rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Active Racks</div>
            <span className="material-symbols-outlined text-success">check_circle</span>
          </div>
          <div className="text-3xl font-bold text-success">{stats.activeRacks}</div>
        </div>
        <div className="card bg-base-100 border border-sky-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            {labelWithHint(
              "Reserved Racks",
              "Number of entire racks marked reserved. This is different from reserved bins."
            )}
            <span className="material-symbols-outlined text-sky-600">lock</span>
          </div>
          <div className="text-3xl font-bold text-sky-600">{stats.reservedRacks}</div>
        </div>
        <div className="card bg-base-100 border border-orange-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Maintenance</div>
            <span className="material-symbols-outlined text-orange-500">build</span>
          </div>
          <div className="text-3xl font-bold text-orange-600">{stats.maintenanceRacks}</div>
        </div>
        <div className="card bg-base-100 border border-error rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-base-content/70">Out of Service</div>
            <span className="material-symbols-outlined text-error">warning</span>
          </div>
          <div className="text-3xl font-bold text-error">{stats.outOfServiceRacks}</div>
        </div>
      </div>
    </>
  );
}
