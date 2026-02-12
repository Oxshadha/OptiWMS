interface StockTransferStatsProps {
  totalTransfers: number;
  inTransitCount: number;
  receivedCount: number;
  pendingCount: number;
}

export function StockTransferStats({
  totalTransfers,
  inTransitCount,
  receivedCount,
  pendingCount,
}: StockTransferStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-base-content/60">Total Transfers</div>
            <div className="text-2xl font-bold text-base-content">{totalTransfers}</div>
          </div>
          <span className="material-symbols-outlined text-3xl text-primary">swap_horiz</span>
        </div>
      </div>
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-base-content/60">In Transit</div>
            <div className="text-2xl font-bold text-info">{inTransitCount}</div>
          </div>
          <span className="material-symbols-outlined text-3xl text-info">sync</span>
        </div>
      </div>
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-base-content/60">Received</div>
            <div className="text-2xl font-bold text-success">{receivedCount}</div>
          </div>
          <span className="material-symbols-outlined text-3xl text-success">check_circle</span>
        </div>
      </div>
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-base-content/60">Pending</div>
            <div className="text-2xl font-bold text-warning">{pendingCount}</div>
          </div>
          <span className="material-symbols-outlined text-3xl text-warning">schedule</span>
        </div>
      </div>
    </div>
  );
}
