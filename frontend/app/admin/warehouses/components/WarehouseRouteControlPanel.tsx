"use client";

import { useMemo, useState } from "react";
import { WarehouseRouteMap, type RouteWorkerMarker } from "@/components/WarehouseRouteMap";
import {
  GridCoord,
  buildRouteInstruction,
  optimizeWarehouseRoute,
} from "@/lib/warehouse-routing";

const SAMPLE_PUTAWAY = ["A-01-02-1-A", "B-02-04-2-A", "C-01-03-1-B"];
const SAMPLE_PICKING = ["A-02-05-1-A", "B-01-02-1-A", "C-02-04-1-B"];

const sampleWorkerPath: GridCoord[] = [
  { x: 7, y: 6 },
  { x: 8, y: 6 },
  { x: 9, y: 6 },
  { x: 10, y: 6 },
  { x: 11, y: 6 },
  { x: 12, y: 6 },
  { x: 13, y: 6 },
  { x: 14, y: 6 },
];

const workers: RouteWorkerMarker[] = [
  { id: "w-001", name: "Forklift 01", coord: { x: 13, y: 6 }, status: "putaway" },
  { id: "w-002", name: "Forklift 02", coord: { x: 21, y: 3 }, status: "picking" },
  { id: "w-003", name: "Forklift 03", coord: { x: 6, y: 14 }, status: "idle" },
];

export function WarehouseRouteControlPanel() {
  const [mode, setMode] = useState<"putaway" | "picking">("putaway");
  const [avoidActiveForklift, setAvoidActiveForklift] = useState(false);

  const route = useMemo(
    () =>
      optimizeWarehouseRoute({
        operation: mode,
        locationCodes: mode === "putaway" ? SAMPLE_PUTAWAY : SAMPLE_PICKING,
        avoidPath: avoidActiveForklift ? sampleWorkerPath : [],
      }),
    [avoidActiveForklift, mode]
  );

  return (
    <div className="card bg-base-100 border border-base-300 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-base-content">Forklift Route Control</h3>
          <p className="text-sm text-base-content/60">
            Synthetic coordinate view for worker PWA routes and manager collision checks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="join">
            <button className={`btn btn-sm join-item ${mode === "putaway" ? "btn-primary" : "btn-outline"}`} onClick={() => setMode("putaway")}>
              Putaway
            </button>
            <button className={`btn btn-sm join-item ${mode === "picking" ? "btn-primary" : "btn-outline"}`} onClick={() => setMode("picking")}>
              Picking
            </button>
          </div>
          <label className="label cursor-pointer gap-2 rounded-lg border border-base-300 px-3 py-1">
            <span className="label-text text-xs">Avoid active path</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={avoidActiveForklift}
              onChange={(event) => setAvoidActiveForklift(event.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <WarehouseRouteMap route={route} workers={workers} detail="admin" />
        <div className="space-y-3">
          <div className="rounded-lg border border-base-300 bg-base-200 p-3">
            <div className="text-sm font-semibold mb-2">Route Summary</div>
            {route ? (
              <div className="space-y-2">
                {buildRouteInstruction(route).map((line) => (
                  <div key={line} className="text-xs text-base-content/75">
                    {line}
                  </div>
                ))}
                <div className="divider my-1"></div>
                {route.orderedStops.map((stop, index) => (
                  <div key={stop.raw} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{index + 1}. {stop.raw}</span>
                    <span>({stop.access.x}, {stop.access.y})</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-base-content/60">No route available.</div>
            )}
          </div>

          <div className="rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="text-sm font-semibold mb-2">Active Forklifts</div>
            <div className="space-y-2">
              {workers.map((worker) => (
                <div key={worker.id} className="flex items-center justify-between text-xs">
                  <span>{worker.name}</span>
                  <span className="badge badge-outline capitalize">{worker.status}</span>
                  <span className="font-mono">({worker.coord.x}, {worker.coord.y})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-base-300 bg-base-100 p-3 text-xs text-base-content/70">
            Phase two can pass each active forklift path into the same route engine as blocked cells. If the shortest path overlaps, A* returns the next available route.
          </div>
        </div>
      </div>
    </div>
  );
}
