"use client";

import { YardTrailer } from "@/lib/api/operations";
import { formatTime, getStatusColor } from "../utils";

export function YardTrailerQueueCard({ yardTrailers }: { yardTrailers: YardTrailer[] }) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-xl">Yard Trailer Queue</h2>
        <div className="overflow-x-auto mt-4">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Trailer Number</th>
                <th>Carrier</th>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Arrived</th>
                <th>Wait Time</th>
                <th>Status</th>
                <th>Assigned Dock</th>
              </tr>
            </thead>
            <tbody>
              {yardTrailers.map((trailer) => (
                <tr key={trailer.id}>
                  <td className="font-semibold">{trailer.trailerNumber}</td>
                  <td>{trailer.carrierName}</td>
                  <td>{trailer.inboundOrderNumber || "N/A"}</td>
                  <td>{trailer.supplierName || "N/A"}</td>
                  <td>{formatTime(trailer.arrivedAt)}</td>
                  <td>
                    <span className={(trailer.waitTimeMinutes ?? 0) > 60 ? "text-error font-semibold" : ""}>
                      {trailer.waitTimeMinutes != null ? `${trailer.waitTimeMinutes} min` : "N/A"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusColor(trailer.status)}`}>
                      {trailer.status.charAt(0).toUpperCase() + trailer.status.slice(1)}
                    </span>
                  </td>
                  <td>{trailer.assignedDockDoorNumber || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
