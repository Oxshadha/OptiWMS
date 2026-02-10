import { statusClass, type StockTransfer } from "../types";

interface StockTransferTableProps {
  transfers: StockTransfer[];
  onViewDetails: (transfer: StockTransfer) => void;
  onCancelTransfer: (transfer: StockTransfer) => void;
  onPrintSlip: (transfer: StockTransfer) => void;
}

export function StockTransferTable({
  transfers,
  onViewDetails,
  onCancelTransfer,
  onPrintSlip,
}: StockTransferTableProps) {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Transfer #</th>
              <th>Type</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>From → To</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id}>
                <td>
                  <span className="font-semibold text-base-content">{transfer.transferNumber}</span>
                </td>
                <td>
                  <span className="badge badge-outline badge-sm">
                    {transfer.transferType === "intra_warehouse" ? "Intra" : "Inter"}
                  </span>
                </td>
                <td>
                  <div>
                    <div className="font-medium text-base-content">{transfer.itemName}</div>
                    <div className="text-sm text-base-content/60">{transfer.itemSku}</div>
                  </div>
                </td>
                <td>
                  <span className="font-semibold text-base-content">{transfer.quantity}</span>
                </td>
                <td>
                  <div className="text-sm">
                    <div className="font-mono text-primary">{transfer.sourceLocationCode}</div>
                    <div className="text-base-content/60">→</div>
                    <div className="font-mono text-primary">{transfer.destLocationCode}</div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${statusClass(transfer.status)} whitespace-nowrap`}>
                    {transfer.status.replace("_", " ").toUpperCase()}
                  </span>
                </td>
                <td className="text-base-content/70">{new Date(transfer.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-ghost btn-xs">
                      <span className="material-symbols-outlined">more_vert</span>
                    </label>
                    <ul
                      tabIndex={0}
                      className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
                    >
                      <li>
                        <button onClick={() => onViewDetails(transfer)}>
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          View Details
                        </button>
                      </li>
                      {transfer.status === "draft" && (
                        <li>
                          <button onClick={() => onCancelTransfer(transfer)} className="text-error">
                            <span className="material-symbols-outlined text-sm">cancel</span>
                            Cancel Transfer
                          </button>
                        </li>
                      )}
                      <li>
                        <button onClick={() => onPrintSlip(transfer)}>
                          <span className="material-symbols-outlined text-sm">print</span>
                          Print Transfer Slip
                        </button>
                      </li>
                    </ul>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {transfers.length === 0 && (
        <div className="p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">swap_horiz</span>
          <h3 className="text-lg font-semibold text-base-content mb-2">No transfers found</h3>
          <p className="text-sm text-base-content/60">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
