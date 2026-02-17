import { StatusChip } from "@/components/StatusChip";
import { packingStatusTone, type PackingRecord } from "../types";

interface PackingViewsProps {
  viewMode: "queue" | "monitor" | "history";
  pendingOrders: PackingRecord[];
  inProgressOrders: PackingRecord[];
  historyOrders: PackingRecord[];
  onViewDetails: (record: PackingRecord) => void;
  onAssignPacker: (record: PackingRecord) => void;
  onPrintLabel: (record: PackingRecord) => void;
  onPrintSlip: (record: PackingRecord) => void;
}

export function PackingViews({
  viewMode,
  pendingOrders,
  inProgressOrders,
  historyOrders,
  onViewDetails,
  onAssignPacker,
  onPrintLabel,
  onPrintSlip,
}: PackingViewsProps) {
  if (viewMode === "queue") {
    return (
      <div className="card bg-base-100 border border-base-300">
        <div className="p-4 border-b border-base-200">
          <h2 className="text-lg font-semibold text-base-content">Orders Ready to Pack</h2>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[32rem]">
          <table className="table">
            <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((record) => (
                <tr key={record.id}>
                  <td>
                    <span className="font-semibold text-base-content">{record.orderNumber}</span>
                  </td>
                  <td className="text-base-content/70">{record.customer}</td>
                  <td>
                    <StatusChip
                      label={record.priority === "express" ? "Express" : "Normal"}
                      tone={record.priority === "express" ? "danger" : "neutral"}
                    />
                  </td>
                  <td>
                    <StatusChip
                      label={record.status.replace("_", " ").toUpperCase()}
                      tone={packingStatusTone(record.status)}
                      showDot
                    />
                  </td>
                  <td className="text-base-content/70">{new Date(record.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => onAssignPacker(record)} className="btn btn-primary btn-xs">
                        Assign
                      </button>
                      <button onClick={() => onViewDetails(record)} className="btn btn-ghost btn-xs">
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pendingOrders.length === 0 && (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">inventory</span>
            <h3 className="text-lg font-semibold text-base-content mb-2">No orders pending</h3>
            <p className="text-sm text-base-content/60">All orders have been assigned or packed</p>
          </div>
        )}
      </div>
    );
  }

  if (viewMode === "monitor") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {inProgressOrders.map((record) => {
          const startTime = record.startedAt ? new Date(record.startedAt).getTime() : Date.now();
          const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
          return (
            <div key={record.id} className="card bg-base-100 border border-base-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-base-content">{record.orderNumber}</span>
                <StatusChip label="In Progress" tone="warning" showDot />
              </div>
              <div className="text-sm text-base-content/60 mb-2">Packer: {record.packerName || "Unassigned"}</div>
              <div className="text-sm text-base-content/60 mb-2">Customer: {record.customer}</div>
              <div className="text-sm text-base-content/60">Time Elapsed: {elapsedMinutes} min</div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => onViewDetails(record)} className="btn btn-primary btn-sm flex-1">
                  View Details
                </button>
              </div>
            </div>
          );
        })}
        {inProgressOrders.length === 0 && (
          <div className="col-span-full card bg-base-100 border border-base-300 p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">sync</span>
            <h3 className="text-lg font-semibold text-base-content mb-2">No active packing</h3>
            <p className="text-sm text-base-content/60">No orders are currently being packed</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="overflow-x-auto overflow-y-auto max-h-[32rem]">
        <table className="table">
          <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Packaging</th>
              <th>Weight (kg)</th>
              <th>Tracking</th>
              <th>Packer</th>
              <th>Completed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {historyOrders.map((record) => (
              <tr key={record.id}>
                <td>
                  <span className="font-semibold text-base-content">{record.orderNumber}</span>
                </td>
                <td className="text-base-content/70">{record.customer}</td>
                <td>
                  <StatusChip label={record.packagingType || "N/A"} tone="neutral" className="capitalize" />
                </td>
                <td>
                  <span className="font-semibold text-base-content">{record.chargeableWeight.toFixed(2)}</span>
                </td>
                <td>
                  {record.trackingNumber ? (
                    <span className="font-mono text-sm text-primary">{record.trackingNumber}</span>
                  ) : (
                    <span className="text-base-content/50">N/A</span>
                  )}
                </td>
                <td className="text-base-content/70">{record.packerName || "N/A"}</td>
                <td className="text-base-content/70">
                  {record.completedAt ? new Date(record.completedAt).toLocaleDateString() : "N/A"}
                </td>
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
                        <button onClick={() => onViewDetails(record)}>
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          View Details
                        </button>
                      </li>
                      <li>
                        <button onClick={() => onPrintLabel(record)}>
                          <span className="material-symbols-outlined text-sm">print</span>
                          Print Label
                        </button>
                      </li>
                      <li>
                        <button onClick={() => onPrintSlip(record)}>
                          <span className="material-symbols-outlined text-sm">print</span>
                          Print Slip
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
    </div>
  );
}
