interface PackingStatsProps {
  pendingCount: number;
  inProgressCount: number;
  packedCount: number;
  totalCount: number;
}

export function PackingStats({ pendingCount, inProgressCount, packedCount, totalCount }: PackingStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-base-content/60">Awaiting Packing</div>
            <div className="text-2xl font-bold text-base-content">{pendingCount}</div>
          </div>
          <span className="material-symbols-outlined text-3xl text-warning">schedule</span>
        </div>
      </div>
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-base-content/60">In Progress</div>
            <div className="text-2xl font-bold text-info">{inProgressCount}</div>
          </div>
          <span className="material-symbols-outlined text-3xl text-info">sync</span>
        </div>
      </div>
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-base-content/60">Packed</div>
            <div className="text-2xl font-bold text-success">{packedCount}</div>
          </div>
          <span className="material-symbols-outlined text-3xl text-success">check_circle</span>
        </div>
      </div>
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-base-content/60">Total Orders</div>
            <div className="text-2xl font-bold text-base-content">{totalCount}</div>
          </div>
          <span className="material-symbols-outlined text-3xl text-primary">inventory</span>
        </div>
      </div>
    </div>
  );
}
