"use client";

import {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minus,
  Move,
  Plus,
  Route as RouteIcon,
} from "lucide-react";
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

interface ViewBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

const routeColors = [
  "#cf0f47",
  "#2563eb",
  "#059669",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 24;

export function LiveWarehouseRouteMap({
  graph,
  routes,
  primaryRouteId,
  detail,
}: LiveWarehouseRouteMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    view: ViewBounds;
  } | null>(null);
  const [viewportAspect, setViewportAspect] = useState(16 / 9);
  const [isDragging, setIsDragging] = useState(false);
  const [viewPreset, setViewPreset] = useState<
    "route" | "warehouse" | "custom"
  >(routes.some((route) => route.route.length > 0) ? "route" : "warehouse");

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes]
  );
  const primaryRoute =
    routes.find((route) => route.id === primaryRouteId) || routes[0] || null;
  const hasRoute = Boolean(primaryRoute?.route.length);

  const warehouseBounds = useMemo(() => {
    const xs = graph.nodes.map((node) => node.x);
    const ys = graph.nodes.map((node) => node.y);
    return boundsFromPoints(xs, ys, 4);
  }, [graph.nodes]);

  const routeBounds = useMemo(() => {
    const points = (primaryRoute?.route || []).flatMap((leg) => [
      leg.from,
      leg.to,
    ]);
    if (points.length === 0) return null;
    return boundsFromPoints(
      points.map((point) => point.x),
      points.map((point) => point.y),
      6
    );
  }, [primaryRoute?.route]);

  const fitWarehouseBounds = useMemo(
    () => fitBoundsToAspect(warehouseBounds, viewportAspect),
    [viewportAspect, warehouseBounds]
  );
  const fitRouteBounds = useMemo(
    () =>
      routeBounds ? fitBoundsToAspect(routeBounds, viewportAspect) : null,
    [routeBounds, viewportAspect]
  );
  const [view, setView] = useState<ViewBounds>(() =>
    fitBoundsToAspect(warehouseBounds, viewportAspect)
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const updateAspect = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportAspect(rect.width / rect.height);
      }
    };
    updateAspect();
    const observer = new ResizeObserver(updateAspect);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (viewPreset === "route" && fitRouteBounds) {
      setView(fitRouteBounds);
      return;
    }
    if (viewPreset === "warehouse") {
      setView(fitWarehouseBounds);
    }
  }, [fitRouteBounds, fitWarehouseBounds, graph.graphHash, viewPreset]);

  const previousRouteIdRef = useRef(primaryRoute?.id);
  useEffect(() => {
    const nextRouteId = primaryRoute?.id;
    if (
      nextRouteId &&
      nextRouteId !== previousRouteIdRef.current &&
      fitRouteBounds
    ) {
      setView(fitRouteBounds);
      setViewPreset("route");
    } else if (!nextRouteId && previousRouteIdRef.current) {
      setView(fitWarehouseBounds);
      setViewPreset("warehouse");
    }
    previousRouteIdRef.current = nextRouteId;
  }, [fitRouteBounds, fitWarehouseBounds, primaryRoute?.id]);

  const completedFaces = useMemo(
    () =>
      new Set(
        routes.flatMap((route) =>
          route.stops
            .filter((stop) => stop.status === "COMPLETED")
            .map((stop) => stop.accessNodeId)
        )
      ),
    [routes]
  );
  const plannedFaces = useMemo(
    () =>
      new Set(
        routes.flatMap((route) =>
          route.stops.map((stop) => stop.accessNodeId)
        )
      ),
    [routes]
  );

  const zoom = Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, fitWarehouseBounds.width / view.width)
  );
  const showRackLabels = zoom >= 3;

  const focusWarehouse = useCallback(() => {
    setView(fitWarehouseBounds);
    setViewPreset("warehouse");
  }, [fitWarehouseBounds]);

  const focusRoute = useCallback(() => {
    if (!fitRouteBounds) return;
    setView(fitRouteBounds);
    setViewPreset("route");
  }, [fitRouteBounds]);

  const zoomAt = useCallback(
    (factor: number, anchorX = 0.5, anchorY = 0.5) => {
      setView((current) => {
        const currentZoom = fitWarehouseBounds.width / current.width;
        const nextZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, currentZoom / factor)
        );
        const nextWidth = fitWarehouseBounds.width / nextZoom;
        const nextHeight = nextWidth / viewportAspect;
        const anchorWorldX = current.minX + current.width * anchorX;
        const anchorWorldY = current.minY + current.height * anchorY;
        return {
          minX: anchorWorldX - nextWidth * anchorX,
          minY: anchorWorldY - nextHeight * anchorY,
          width: nextWidth,
          height: nextHeight,
        };
      });
      setViewPreset("custom");
    },
    [fitWarehouseBounds.width, viewportAspect]
  );

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      zoomAt(
        event.deltaY > 0 ? 1.16 : 0.86,
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height
      );
    },
    [zoomAt]
  );

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        view,
      };
      setIsDragging(true);
    },
    [view]
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const dx = ((event.clientX - drag.clientX) / rect.width) * drag.view.width;
      const dy =
        ((event.clientY - drag.clientY) / rect.height) * drag.view.height;
      setView({
        ...drag.view,
        minX: drag.view.minX - dx,
        minY: drag.view.minY - dy,
      });
      setViewPreset("custom");
    },
    []
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);
    },
    []
  );

  return (
    <section
      className="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm"
      aria-label="Live warehouse route map"
    >
      <div className="flex flex-col gap-3 border-b border-base-300 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">Live aisle map</h3>
            <span
              className={`badge badge-sm ${
                hasRoute ? "badge-primary" : "badge-ghost"
              }`}
            >
              {hasRoute
                ? `${routes.length} active ${routes.length === 1 ? "route" : "routes"}`
                : "No active route"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-base-content/60">
            {graph.rackFootprintCount} rack bays · {graph.nodes.length} nodes ·
            graph {graph.graphHash.slice(0, 10)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="join" aria-label="Map focus">
            <button
              type="button"
              className={`btn btn-xs join-item ${
                viewPreset === "route" ? "btn-primary" : "btn-ghost"
              }`}
              onClick={focusRoute}
              disabled={!hasRoute}
              title={
                hasRoute
                  ? "Fit the selected route in the viewport"
                  : "A route will appear here when a worker starts one"
              }
            >
              <RouteIcon className="h-3.5 w-3.5" />
              Focus route
            </button>
            <button
              type="button"
              className={`btn btn-xs join-item ${
                viewPreset === "warehouse" ? "btn-primary" : "btn-ghost"
              }`}
              onClick={focusWarehouse}
              title="Fit the whole warehouse in the viewport"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Fit warehouse
            </button>
          </div>
          <span className="min-w-[52px] text-right text-xs font-semibold tabular-nums text-base-content/60">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative h-[520px] touch-none overflow-hidden bg-slate-100 outline-none lg:h-[640px] ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onWheel={handleWheel}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=") zoomAt(0.8);
          if (event.key === "-") zoomAt(1.25);
          if (event.key === "0") focusWarehouse();
        }}
        role="application"
        tabIndex={0}
        aria-label="Interactive warehouse map. Drag to pan, use the mouse wheel or controls to zoom, and press zero to fit the warehouse."
      >
        <svg
          role="img"
          aria-label={
            hasRoute
              ? `Warehouse map showing ${routes.length} active routes`
              : "Warehouse map with no active routes"
          }
          viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
          className="h-full w-full select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id={`warehouse-grid-${safeId(graph.graphHash)}`}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 8 0 L 0 0 0 8"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
            {routes.map((route, index) => (
              <marker
                key={route.id}
                id={`route-arrow-${safeId(route.id)}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  fill={routeColors[index % routeColors.length]}
                />
              </marker>
            ))}
          </defs>

          <rect
            x={view.minX}
            y={view.minY}
            width={view.width}
            height={view.height}
            fill={`url(#warehouse-grid-${safeId(graph.graphHash)})`}
          />

          {graph.edges
            .filter(
              (edge) => edge.type === "AISLE" || edge.type === "CROSS_AISLE"
            )
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
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

          {graph.racks.map((rack) => {
            const completed = rack.accessNodeIds.some((id) =>
              completedFaces.has(id)
            );
            const planned = rack.accessNodeIds.some((id) =>
              plannedFaces.has(id)
            );
            return (
              <g key={rack.rackId} opacity={completed ? 0.28 : 1}>
                <rect
                  x={rack.centerX - rack.widthM / 2}
                  y={rack.centerY - rack.depthM / 2}
                  width={rack.widthM}
                  height={rack.depthM}
                  rx="0.28"
                  fill={planned ? "#bae6fd" : "#dbeafe"}
                  stroke={planned ? "#075985" : "#64748b"}
                  strokeWidth={planned ? "1.75" : "1"}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {graph.nodes
            .filter((node) =>
              ["STATION", "PARKING", "DOOR"].includes(node.type)
            )
            .map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="1.25"
                  fill={
                    node.type === "PARKING"
                      ? "#7c3aed"
                      : node.type === "DOOR"
                        ? "#334155"
                        : "#f59e0b"
                  }
                  stroke="#fff"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                {(zoom >= 1.8 || hasRoute) && (
                  <text
                    x={node.x + 1.7}
                    y={node.y + 0.5}
                    fontSize="1.55"
                    fontWeight="700"
                    fill="#0f172a"
                    paintOrder="stroke"
                    stroke="#f8fafc"
                    strokeWidth="0.65"
                  >
                    {node.label}
                  </text>
                )}
              </g>
            ))}

          {routes.flatMap((route, routeIndex) =>
            route.route.map((leg) => {
              const color = routeColors[routeIndex % routeColors.length];
              const isPrimary = route.id === primaryRoute?.id;
              return (
                <g key={`${route.id}-${leg.sequence}`}>
                  <line
                    x1={leg.from.x}
                    y1={leg.from.y}
                    x2={leg.to.x}
                    y2={leg.to.y}
                    stroke="#fff"
                    strokeWidth={isPrimary ? "8" : "6"}
                    strokeLinecap="round"
                    opacity={leg.status === "RELEASED" ? 0.18 : 0.96}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={leg.from.x}
                    y1={leg.from.y}
                    x2={leg.to.x}
                    y2={leg.to.y}
                    stroke={color}
                    strokeWidth={isPrimary ? "4" : "3"}
                    strokeLinecap="round"
                    markerEnd={`url(#route-arrow-${safeId(route.id)})`}
                    opacity={leg.status === "RELEASED" ? 0.28 : 0.96}
                    strokeDasharray={leg.waitSeconds > 0 ? "7 5" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
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
                  r={detail === "worker" ? "1.8" : "1.55"}
                  fill={color}
                  stroke="#fff"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={node.x + 2}
                  y={node.y + 0.55}
                  fontSize="1.5"
                  fontWeight="800"
                  fill={color}
                  paintOrder="stroke"
                  stroke="#fff"
                  strokeWidth="0.7"
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
                  r="1.4"
                  fill={stop.status === "CURRENT" ? "#cf0f47" : "#2563eb"}
                  stroke="#fff"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
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
                {showRackLabels ? (
                  <text
                    x={node.x + 2.2}
                    y={node.y + 0.5}
                    fontSize="1.25"
                    fontWeight="800"
                    fill="#0f172a"
                    paintOrder="stroke"
                    stroke="#fff"
                    strokeWidth="0.75"
                  >
                    {stop.locationCode}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-base-300 bg-base-100/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
          <Move className="h-4 w-4 text-base-content/60" />
          <span className="hidden sm:inline">Drag to pan · Scroll to zoom</span>
          <span className="sm:hidden">Drag · Use zoom controls</span>
        </div>

        {!hasRoute ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-base-300 bg-base-100/95 p-3 shadow-lg backdrop-blur">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-base-200">
              <RouteIcon className="h-4 w-4 text-base-content/50" />
            </span>
            <div>
              <div className="text-sm font-bold">No route is active yet</div>
              <div className="text-xs text-base-content/60">
                The warehouse graph is ready. A worker route will be highlighted
                here as soon as it is assigned.
              </div>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-base-300 bg-base-100/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="h-1 w-7 rounded-full bg-primary" />
              <span className="font-semibold">Reserved route</span>
              <span className="text-base-content/50">•</span>
              <span className="h-3 w-3 rounded-sm border border-slate-500 bg-blue-100" />
              <span className="font-semibold">Rack bay</span>
            </div>
          </div>
        )}

        <div
          className="absolute right-3 top-3 join join-vertical shadow-md"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn-sm join-item bg-base-100"
            onClick={() => zoomAt(0.8)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn btn-sm join-item bg-base-100"
            onClick={() => zoomAt(1.25)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn btn-sm join-item bg-base-100"
            onClick={hasRoute ? focusRoute : focusWarehouse}
            aria-label={hasRoute ? "Focus active route" : "Fit warehouse"}
            title={hasRoute ? "Focus active route" : "Fit warehouse"}
          >
            {hasRoute ? (
              <LocateFixed className="h-4 w-4" />
            ) : (
              <MapIcon className="h-4 w-4" />
            )}
          </button>
        </div>

        <MiniMap
          warehouseBounds={warehouseBounds}
          view={view}
          graph={graph}
          routes={routes}
          onReset={focusWarehouse}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 bg-base-100 px-4 py-2 text-[11px] text-base-content/55">
        <span>
          Showing {showRackLabels ? "rack-level detail" : "operational overview"}
        </span>
        <span>Keyboard: + / − to zoom · 0 to reset</span>
      </div>
    </section>
  );
}

function MiniMap({
  warehouseBounds,
  view,
  graph,
  routes,
  onReset,
}: {
  warehouseBounds: ViewBounds;
  view: ViewBounds;
  graph: WarehouseRoutingGraph;
  routes: WorkerRouteSession[];
  onReset: () => void;
}) {
  return (
    <button
      type="button"
      className="absolute bottom-3 right-3 hidden h-28 w-36 overflow-hidden rounded-lg border border-base-300 bg-base-100/95 p-1 shadow-md backdrop-blur sm:block"
      onClick={onReset}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label="Warehouse overview. Activate to fit the whole warehouse."
      title="Warehouse overview · click to reset"
    >
      <svg
        viewBox={`${warehouseBounds.minX} ${warehouseBounds.minY} ${warehouseBounds.width} ${warehouseBounds.height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {graph.racks.map((rack) => (
          <rect
            key={rack.rackId}
            x={rack.centerX - rack.widthM / 2}
            y={rack.centerY - rack.depthM / 2}
            width={rack.widthM}
            height={rack.depthM}
            fill="#bfdbfe"
          />
        ))}
        {routes.flatMap((route, routeIndex) =>
          route.route.map((leg) => (
            <line
              key={`${route.id}-mini-${leg.sequence}`}
              x1={leg.from.x}
              y1={leg.from.y}
              x2={leg.to.x}
              y2={leg.to.y}
              stroke={routeColors[routeIndex % routeColors.length]}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ))
        )}
        <rect
          x={view.minX}
          y={view.minY}
          width={view.width}
          height={view.height}
          fill="rgba(207, 15, 71, 0.08)"
          stroke="#cf0f47"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </button>
  );
}

function boundsFromPoints(
  xs: number[],
  ys: number[],
  padding: number
): ViewBounds {
  const safeXs = xs.length > 0 ? xs : [0];
  const safeYs = ys.length > 0 ? ys : [0];
  const minX = Math.min(...safeXs) - padding;
  const maxX = Math.max(...safeXs) + padding;
  const minY = Math.min(...safeYs) - padding;
  const maxY = Math.max(...safeYs) + padding;
  return {
    minX,
    minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function fitBoundsToAspect(bounds: ViewBounds, aspect: number): ViewBounds {
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;
  let width = bounds.width;
  let height = bounds.height;

  if (width / height < aspect) {
    width = height * aspect;
  } else {
    height = width / aspect;
  }

  return {
    minX: centerX - width / 2,
    minY: centerY - height / 2,
    width,
    height,
  };
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
