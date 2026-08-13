"use client";

import { useMemo, useState } from "react";
import {
  WarehouseRoutingGraph,
  WorkerRouteSession,
} from "@/lib/api/routing";

interface LiveWarehouseRouteMapProps {
  graph: WarehouseRoutingGraph;
  routes: WorkerRouteSession[];
  primaryRouteId?: string;
  detail: "worker" | "admin";
}

const routeColors = [
  "#cf0f47",
  "#2563eb",
  "#059669",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
];

export function LiveWarehouseRouteMap({
  graph,
  routes,
  primaryRouteId,
  detail,
}: LiveWarehouseRouteMapProps) {
  const [viewMode, setViewMode] = useState<"route" | "overview">(
    detail === "worker" ? "route" : "overview"
  );
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes]
  );
  const primaryRoute =
    routes.find((route) => route.id === primaryRouteId) || routes[0] || null;

  const fullBounds = useMemo(() => {
    const xs = graph.nodes.map((node) => node.x);
    const ys = graph.nodes.map((node) => node.y);
    return boundsFromPoints(xs, ys, 4);
  }, [graph.nodes]);

  const routeBounds = useMemo(() => {
    const points = (primaryRoute?.route || []).flatMap((leg) => [
      leg.from,
      leg.to,
    ]);
    if (points.length === 0) return fullBounds;
    return boundsFromPoints(
      points.map((point) => point.x),
      points.map((point) => point.y),
      6
    );
  }, [fullBounds, primaryRoute?.route]);

  const bounds = viewMode === "route" ? routeBounds : fullBounds;
  const completedFaces = new Set(
    routes.flatMap((route) =>
      route.stops
        .filter((stop) => stop.status === "COMPLETED")
        .map((stop) => stop.accessNodeId)
    )
  );
  const plannedFaces = new Set(
    routes.flatMap((route) => route.stops.map((stop) => stop.accessNodeId))
  );

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
        <div>
          <div className="text-sm font-semibold">Live aisle route</div>
          <div className="text-[11px] text-base-content/60">
            {graph.rackFootprintCount} rack bays · graph {graph.graphHash.slice(0, 10)}
          </div>
        </div>
        <div className="join">
          <button
            type="button"
            className={`btn btn-xs join-item ${viewMode === "route" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setViewMode("route")}
          >
            Route focus
          </button>
          <button
            type="button"
            className={`btn btn-xs join-item ${viewMode === "overview" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setViewMode("overview")}
          >
            Overview
          </button>
        </div>
      </div>

      <div className="overflow-auto bg-slate-50">
        <svg
          role="img"
          aria-label="Warehouse aisle route map"
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          className={detail === "worker" ? "w-full min-h-[420px] max-h-[65vh]" : "w-full min-h-[620px] max-h-[78vh]"}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {routes.map((route, index) => (
              <marker
                key={route.id}
                id={`route-arrow-${safeId(route.id)}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="4"
                markerHeight="4"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={routeColors[index % routeColors.length]} />
              </marker>
            ))}
          </defs>

          {viewMode === "overview" &&
            graph.edges
              .filter((edge) => edge.type === "AISLE" || edge.type === "CROSS_AISLE")
              .map((edge) => {
                const from = nodeById.get(edge.from);
                const to = nodeById.get(edge.to);
                if (!from || !to || edge.from > edge.to) return null;
                return (
                  <line
                    key={edge.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="#cbd5e1"
                    strokeWidth="0.35"
                  />
                );
              })}

          {graph.racks.map((rack) => {
            const completed = rack.accessNodeIds.some((id) => completedFaces.has(id));
            const planned = rack.accessNodeIds.some((id) => plannedFaces.has(id));
            return (
              <g key={rack.rackId} opacity={completed ? 0.28 : 1}>
                <rect
                  x={rack.centerX - rack.widthM / 2}
                  y={rack.centerY - rack.depthM / 2}
                  width={rack.widthM}
                  height={rack.depthM}
                  rx="0.35"
                  fill={planned ? "#bae6fd" : "#dbeafe"}
                  stroke={planned ? "#075985" : "#64748b"}
                  strokeWidth={planned ? "0.45" : "0.25"}
                />
                {viewMode === "route" && planned ? (
                  <text
                    x={rack.centerX}
                    y={rack.centerY + 0.5}
                    textAnchor="middle"
                    fontSize="1.4"
                    fontWeight="700"
                    fill="#0f172a"
                  >
                    {rack.rackId}
                  </text>
                ) : null}
              </g>
            );
          })}

          {graph.nodes
            .filter((node) => ["STATION", "PARKING", "DOOR"].includes(node.type))
            .map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="1.25"
                  fill={node.type === "PARKING" ? "#7c3aed" : node.type === "DOOR" ? "#334155" : "#f59e0b"}
                  stroke="#fff"
                  strokeWidth="0.35"
                />
                <text
                  x={node.x + 1.7}
                  y={node.y + 0.5}
                  fontSize="1.55"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  {node.label}
                </text>
              </g>
            ))}

          {routes.flatMap((route, routeIndex) =>
            route.route.map((leg) => {
              const color = routeColors[routeIndex % routeColors.length];
              return (
                <line
                  key={`${route.id}-${leg.sequence}`}
                  x1={leg.from.x}
                  y1={leg.from.y}
                  x2={leg.to.x}
                  y2={leg.to.y}
                  stroke={color}
                  strokeWidth={detail === "worker" && route.id === primaryRoute?.id ? "1.25" : "0.8"}
                  strokeLinecap="round"
                  markerEnd={`url(#route-arrow-${safeId(route.id)})`}
                  opacity={leg.status === "RELEASED" ? 0.24 : 0.9}
                  strokeDasharray={leg.waitSeconds > 0 ? "2 1" : undefined}
                />
              );
            })
          )}

          {routes.map((route, index) => {
            const node = nodeById.get(route.currentNodeId);
            if (!node) return null;
            const color = routeColors[index % routeColors.length];
            return (
              <g key={`worker-${route.id}`}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={detail === "worker" ? "1.7" : "1.35"}
                  fill={color}
                  stroke="#fff"
                  strokeWidth="0.5"
                />
                <text
                  x={node.x + 2}
                  y={node.y + 0.55}
                  fontSize="1.5"
                  fontWeight="800"
                  fill={color}
                >
                  {route.workerId.slice(0, 6)}
                </text>
              </g>
            );
          })}

          {primaryRoute?.stops.map((stop) => {
            const node = nodeById.get(stop.accessNodeId);
            if (!node) return null;
            return (
              <g key={stop.id} opacity={stop.status === "COMPLETED" ? 0.3 : 1}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="1.3"
                  fill={stop.status === "CURRENT" ? "#cf0f47" : "#2563eb"}
                  stroke="#fff"
                  strokeWidth="0.4"
                />
                <text
                  x={node.x}
                  y={node.y + 0.5}
                  textAnchor="middle"
                  fontSize="1.25"
                  fontWeight="800"
                  fill="#fff"
                >
                  {stop.sequence}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function boundsFromPoints(xs: number[], ys: number[], padding: number) {
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  return {
    minX,
    minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

