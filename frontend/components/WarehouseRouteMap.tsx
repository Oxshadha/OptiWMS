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
  route2?: OptimizedRoute | null;
  completedLocationCodes?: Array<string | null | undefined>;
  activeLocationCode?: string | null;
  workers?: RouteWorkerMarker[];
  detail?: "worker" | "admin";
  showCoordinates?: boolean;
  showVisitedNodes?: boolean;
  visitedNodesCount?: number;
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
  "inbound-park": "#fecaca",
  "outbound-park": "#fecaca",
  "outbound-zone": "#fee2e2",
};

const workerFill: Record<RouteWorkerMarker["status"], string> = {
  putaway: "#2563eb",
  picking: "#7c3aed",
  idle: "#64748b",
};

export function WarehouseRouteMap({
  route,
  route2,
  completedLocationCodes = [],
  activeLocationCode,
  workers = [],
  detail = "worker",
  showCoordinates = false,
  showVisitedNodes = false,
  visitedNodesCount = 0,
}: WarehouseRouteMapProps) {
  const completed = new Set(
    completedLocationCodes
      .map((locationCode) => parseRouteLocation(locationCode)?.rackId)
      .filter((value): value is string => !!value)
  );
  const active = parseRouteLocation(activeLocationCode)?.rackId;
  const ordered = new Set(route?.orderedStops.map((stop) => stop.rackId) ?? []);
  const ordered2 = new Set(route2?.orderedStops.map((stop) => stop.rackId) ?? []);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <style jsx>{`
        .marching-route {
          stroke-dasharray: 10 8;
          animation: route-dash 0.9s linear infinite;
        }
        .marching-route-2 {
          stroke-dasharray: 10 8;
          animation: route-dash-reverse 0.9s linear infinite;
        }
        @keyframes route-dash {
          to {
            stroke-dashoffset: -18;
          }
        }
        @keyframes route-dash-reverse {
          to {
            stroke-dashoffset: 18;
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

        {/* Visited nodes pseudo-visualization */}
        {showVisitedNodes && visitedNodesCount > 0 && (
          <g opacity={0.15}>
            {Array.from({ length: Math.min(visitedNodesCount, 150) }).map((_, i) => {
              // Scatter some highlighted nodes near the path
              const pathPoint = route?.path[i % (route.path.length || 1)] || { x: 10, y: 10 };
              const offsetX = (i % 5) - 2;
              const offsetY = ((i * 3) % 5) - 2;
              const point = toSvg({ x: pathPoint.x + offsetX, y: pathPoint.y + offsetY });
              return (
                <rect key={`visited-${i}`} x={point.x - cell/2} y={point.y - cell/2} width={cell} height={cell} fill="#10b981" />
              );
            })}
          </g>
        )}

        {/* Aisle Corridors */}
        {[5, 9, 13].map((y) => (
          <rect key={`aisle-${y}`} x={cell * 14} y={y * cell - cell/2} width={cell * 11} height={cell} fill="#f1f5f9" opacity="0.6" />
        ))}
        {/* Main NS Corridor */}
        <rect x={cell * 14 - cell/2} y={cell * 4} width={cell} height={cell * 10} fill="#f1f5f9" opacity="0.6" />

        {showCoordinates &&
          Array.from({ length: WAREHOUSE_ROUTE_GRID.width - 1 }).map((_, index) => (
            <line key={`vx-${index}`} x1={(index + 1) * cell} y1={cell} x2={(index + 1) * cell} y2={svgHeight - cell} stroke="#e2e8f0" strokeWidth="1" />
          ))}
        {showCoordinates &&
          Array.from({ length: WAREHOUSE_ROUTE_GRID.height - 1 }).map((_, index) => (
            <line key={`hy-${index}`} x1={cell} y1={(index + 1) * cell} x2={svgWidth - cell} y2={(index + 1) * cell} stroke="#e2e8f0" strokeWidth="1" />
          ))}

        {showCoordinates && 
          Array.from({ length: WAREHOUSE_ROUTE_GRID.width }).map((_, x) => 
            Array.from({ length: WAREHOUSE_ROUTE_GRID.height }).map((__, y) => (
              <text key={`coord-${x}-${y}`} x={x * cell} y={y * cell + 4} fontSize="6" fill="#cbd5e1" textAnchor="middle">
                {x},{y}
              </text>
            ))
          )
        }

        {ROUTE_STATIONS.map((station) => {
          const point = toSvg(station.coord);
          const center = toSvg(centerOfStation(station));
          const isParking = station.type === "inbound-park" || station.type === "outbound-park";
          
          return (
            <g key={station.id}>
              <rect
                x={point.x}
                y={point.y}
                width={station.width * cell}
                height={station.height * cell}
                rx="7"
                fill={stationFill[station.type]}
                stroke={station.type === "door" ? "#334155" : (isParking ? "#ef4444" : "#475569")}
                strokeWidth="2"
              />
              {isParking ? (
                <circle cx={center.x} cy={center.y} r="12" fill="#ef4444" />
              ) : null}
              <text x={center.x} y={center.y + (isParking ? 4 : 4)} textAnchor="middle" fontSize={isParking ? "14" : (detail === "worker" ? "16" : "13")} fontWeight="700" fill={isParking ? "#ffffff" : "#0f172a"}>
                {detail === "worker" ? station.shortLabel : (isParking ? "P" : station.label)}
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
            <text key={zone} x={cell * 13.2} y={(y + 1) * cell} textAnchor="end" fontSize="14" fontWeight="800" fill="#1e3a8a">
              Zone {zone}
            </text>
          );
        })}

        {ROUTE_RACKS.map((rack) => {
          const point = toSvg(rack.coord);
          const rackLabel = rack.id;
          const isCompleted = completed.has(rack.id);
          const isActive = active === rack.id;
          const isPlanned1 = ordered.has(rack.id);
          const isPlanned2 = ordered2.has(rack.id);
          const isPlanned = isPlanned1 || isPlanned2;
          
          let fillColor = "#e0f2fe";
          if (isActive) fillColor = "#cf0f47";
          else if (isPlanned1 && isPlanned2) fillColor = "#c084fc"; // purple for both
          else if (isPlanned1) fillColor = "#bae6fd";
          else if (isPlanned2) fillColor = "#bfdbfe";

          return (
            <g key={rack.id} opacity={isCompleted ? 0.28 : 1}>
              <rect
                x={point.x}
                y={point.y}
                width={rack.width * cell - 4}
                height={rack.height * cell - 4}
                rx="3"
                fill={fillColor}
                stroke={isActive ? "#881337" : "#1e3a8a"}
                strokeWidth={isActive ? "3" : "2"}
              />
              <text x={point.x + rack.width * cell / 2 - 2} y={point.y + 18} textAnchor="middle" fontSize="9" fontWeight="700" fill={isActive ? "#ffffff" : "#1e3a8a"}>
                {rackLabel}
              </text>
            </g>
          );
        })}

        {/* Route 1 Blocked Cells (if avoided by Route 2) */}
        {route2?.blockedCellsUsed.map((coord) => {
          const point = toSvg(coord);
          return <rect key={`blocked-${coord.x}-${coord.y}`} x={point.x - 6} y={point.y - 6} width="12" height="12" rx="3" fill="#f97316" opacity="0.45" />;
        })}

        {/* Overlap Cells */}
        {(route?.overlapCells || route2?.overlapCells || []).map((coord) => {
          const point = toSvg(coord);
          return <rect key={`overlap-${coord.x}-${coord.y}`} x={point.x - 10} y={point.y - 10} width="20" height="20" rx="10" fill="#f59e0b" opacity="0.6" />;
        })}

        {/* Route 1 */}
        {route?.segments.map((segment, index) => (
          <path
            key={`r1-${segment.from}-${segment.to}-${index}`}
            d={pathD(segment.path)}
            fill="none"
            stroke="#e11d48"
            strokeWidth={detail === "worker" ? "8" : "5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="marching-route"
            opacity="0.9"
          />
        ))}

        {/* Route 2 */}
        {route2?.segments.map((segment, index) => (
          <path
            key={`r2-${segment.from}-${segment.to}-${index}`}
            d={pathD(segment.path)}
            fill="none"
            stroke="#2563eb"
            strokeWidth={detail === "worker" ? "8" : "5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="marching-route-2"
            opacity="0.9"
          />
        ))}

        {route?.orderedStops.map((stop, index) => {
          const point = toSvg(stop.access);
          return (
            <g key={`r1-stop-${stop.raw}-${index}`}>
              <circle cx={point.x} cy={point.y} r={detail === "worker" ? 12 : 10} fill="#e11d48" />
              <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#ffffff">
                {index + 1}
              </text>
            </g>
          );
        })}

        {route2?.orderedStops.map((stop, index) => {
          const point = toSvg(stop.access);
          return (
            <g key={`r2-stop-${stop.raw}-${index}`}>
              <circle cx={point.x} cy={point.y} r={detail === "worker" ? 12 : 10} fill="#2563eb" />
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

