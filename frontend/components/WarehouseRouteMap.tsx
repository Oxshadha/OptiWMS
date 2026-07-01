"use client";

import clsx from "clsx";
import {
  GridCoord,
  OptimizedRoute,
  ROUTE_RACKS,
  ROUTE_STATIONS,
  WAREHOUSE_ROUTE_GRID,
  centerOfStation,
  parseRouteLocation,
} from "@/lib/warehouse-routing";

export interface RouteWorkerMarker {
  id: string;
  name: string;
  coord: GridCoord;
  status: "putaway" | "picking" | "idle";
}

interface WarehouseRouteMapProps {
  route?: OptimizedRoute | null;
  completedLocationCodes?: Array<string | null | undefined>;
  activeLocationCode?: string | null;
  workers?: RouteWorkerMarker[];
  detail?: "worker" | "admin";
}

const cell = WAREHOUSE_ROUTE_GRID.cellSize;
const svgWidth = WAREHOUSE_ROUTE_GRID.width * cell;
const svgHeight = WAREHOUSE_ROUTE_GRID.height * cell;

const toSvg = (coord: GridCoord) => ({
  x: coord.x * cell,
  y: coord.y * cell,
});

const pathD = (path: GridCoord[]) =>
  path
    .map((coord, index) => {
      const point = toSvg(coord);
      return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
    })
    .join(" ");

const stationFill: Record<string, string> = {
  "inbound-wait": "#dbeafe",
  packing: "#fef3c7",
  door: "#e5e7eb",
  "inbound-park": "#dcfce7",
  "outbound-park": "#f3e8ff",
  "outbound-zone": "#fee2e2",
};

const workerFill: Record<RouteWorkerMarker["status"], string> = {
  putaway: "#2563eb",
  picking: "#7c3aed",
  idle: "#64748b",
};

export function WarehouseRouteMap({
  route,
  completedLocationCodes = [],
  activeLocationCode,
  workers = [],
  detail = "worker",
}: WarehouseRouteMapProps) {
  const completed = new Set(
    completedLocationCodes
      .map((locationCode) => parseRouteLocation(locationCode)?.rackId)
      .filter((value): value is string => !!value)
  );
  const active = parseRouteLocation(activeLocationCode)?.rackId;
  const ordered = new Set(route?.orderedStops.map((stop) => stop.rackId) ?? []);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <style jsx>{`
        .marching-route {
          stroke-dasharray: 10 8;
          animation: route-dash 0.9s linear infinite;
        }
        @keyframes route-dash {
          to {
            stroke-dashoffset: -18;
          }
        }
      `}</style>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className={clsx("block w-full", detail === "worker" ? "h-[260px]" : "h-[560px]")}
        role="img"
        aria-label="Warehouse route map"
      >
        <rect x={cell} y={cell} width={svgWidth - cell * 2} height={svgHeight - cell * 2} rx="6" fill="#f8fafc" stroke="#334155" strokeWidth="3" />

        {detail === "admin" &&
          Array.from({ length: WAREHOUSE_ROUTE_GRID.width - 1 }).map((_, index) => (
            <line key={`vx-${index}`} x1={(index + 1) * cell} y1={cell} x2={(index + 1) * cell} y2={svgHeight - cell} stroke="#e2e8f0" strokeWidth="1" />
          ))}
        {detail === "admin" &&
          Array.from({ length: WAREHOUSE_ROUTE_GRID.height - 1 }).map((_, index) => (
            <line key={`hy-${index}`} x1={cell} y1={(index + 1) * cell} x2={svgWidth - cell} y2={(index + 1) * cell} stroke="#e2e8f0" strokeWidth="1" />
          ))}

        {ROUTE_STATIONS.map((station) => {
          const point = toSvg(station.coord);
          const center = toSvg(centerOfStation(station));
          return (
            <g key={station.id}>
              <rect
                x={point.x}
                y={point.y}
                width={station.width * cell}
                height={station.height * cell}
                rx="7"
                fill={stationFill[station.type]}
                stroke={station.type === "door" ? "#334155" : "#475569"}
                strokeWidth="2"
              />
              <text x={center.x} y={center.y + 4} textAnchor="middle" fontSize={detail === "worker" ? "16" : "13"} fontWeight="700" fill="#0f172a">
                {detail === "worker" ? station.shortLabel : station.label}
              </text>
            </g>
          );
        })}

        <text x={cell * 1.5} y={cell * 9.3} fontSize="12" fontWeight="700" fill="#334155" transform={`rotate(-90 ${cell * 1.5} ${cell * 9.3})`}>
          MAIN DOOR
        </text>

        {(["A", "B", "C"] as const).map((zone) => {
          const y = ROUTE_RACKS.find((rack) => rack.zone === zone)?.coord.y ?? 0;
          return (
            <text key={zone} x={cell * 13.2} y={(y + 0.75) * cell} textAnchor="end" fontSize="14" fontWeight="800" fill="#1e3a8a">
              Zone {zone}
            </text>
          );
        })}

        {ROUTE_RACKS.map((rack) => {
          const point = toSvg(rack.coord);
          const syntheticCode = `${rack.zone}-${String(rack.row).padStart(2, "0")}-${String(rack.bay).padStart(2, "0")}`;
          const isCompleted = completed.has(rack.id);
          const isActive = active === rack.id;
          const isPlanned = ordered.has(rack.id);
          return (
            <g key={rack.id} opacity={isCompleted ? 0.28 : 1}>
              <rect
                x={point.x}
                y={point.y}
                width={rack.width * cell - 4}
                height={rack.height * cell - 4}
                rx="3"
                fill={isActive ? "#cf0f47" : isPlanned ? "#bae6fd" : "#e0f2fe"}
                stroke={isActive ? "#881337" : "#1e3a8a"}
                strokeWidth={isActive ? "3" : "2"}
              />
              <text x={point.x + rack.width * cell / 2 - 2} y={point.y + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill={isActive ? "#ffffff" : "#1e3a8a"}>
                {syntheticCode}
              </text>
            </g>
          );
        })}

        {route?.blockedCellsUsed.map((coord) => {
          const point = toSvg(coord);
          return <rect key={`blocked-${coord.x}-${coord.y}`} x={point.x - 6} y={point.y - 6} width="12" height="12" rx="3" fill="#f97316" opacity="0.45" />;
        })}

        {route?.segments.map((segment, index) => (
          <path
            key={`${segment.from}-${segment.to}-${index}`}
            d={pathD(segment.path)}
            fill="none"
            stroke={index === 0 ? "#cf0f47" : "#2563eb"}
            strokeWidth={detail === "worker" ? "8" : "5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="marching-route"
            opacity="0.9"
          />
        ))}

        {route?.orderedStops.map((stop, index) => {
          const point = toSvg(stop.access);
          return (
            <g key={`${stop.raw}-${index}`}>
              <circle cx={point.x} cy={point.y} r={detail === "worker" ? 12 : 10} fill="#111827" />
              <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#ffffff">
                {index + 1}
              </text>
            </g>
          );
        })}

        {workers.map((worker) => {
          const point = toSvg(worker.coord);
          return (
            <g key={worker.id}>
              <circle cx={point.x} cy={point.y} r="11" fill={workerFill[worker.status]} stroke="#ffffff" strokeWidth="3" />
              <text x={point.x + 15} y={point.y + 4} fontSize="11" fontWeight="700" fill="#0f172a">
                {worker.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
