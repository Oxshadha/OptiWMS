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
  RoutingGraphNode,
  RoutingRack,
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

interface ViewportSize {
  width: number;
  height: number;
}

interface RouteVisual {
  route: WorkerRouteSession;
  color: string;
  activeLegs: WorkerRouteSession["route"];
  futureLegs: WorkerRouteSession["route"];
  releasedLegs: WorkerRouteSession["route"];
}

const routeColors = [
  "#cf0f47",
  "#2563eb",
  "#059669",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
];

/**
 * A worker's colour, fixed to the worker rather than to their position in the list.
 *
 * The list is sorted by last update, so indexing into the palette meant a worker's route
 * changed colour whenever somebody else's route moved — the one thing an operator watching
 * the floor uses to keep track of who is where.
 */
function routeColorFor(workerId: string) {
  let hash = 0;
  for (let i = 0; i < workerId.length; i += 1) {
    hash = (hash * 31 + workerId.charCodeAt(i)) | 0;
  }
  return routeColors[Math.abs(hash) % routeColors.length];
}

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
  const [viewportSize, setViewportSize] = useState<ViewportSize>({
    width: 1280,
    height: 720,
  });
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
  const visibleRoutes = useMemo(
    () => (detail === "worker" && primaryRoute ? [primaryRoute] : routes),
    [detail, primaryRoute, routes]
  );
  const routeVisuals = useMemo<RouteVisual[]>(
    () =>
      visibleRoutes.map((route) => ({
        route,
        color: routeColorFor(route.workerId),
        ...splitRouteLegs(route),
      })),
    [visibleRoutes]
  );
  const primaryVisual =
    routeVisuals.find((visual) => visual.route.id === primaryRoute?.id) ||
    routeVisuals[0] ||
    null;
  const hasRoute = routeVisuals.some(
    (visual) => visual.activeLegs.length > 0 || visual.futureLegs.length > 0
  );

  const warehouseBounds = useMemo(() => {
    const xs = graph.nodes.map((node) => node.x);
    const ys = graph.nodes.map((node) => node.y);
    return boundsFromPoints(xs, ys, 4);
  }, [graph.nodes]);

  const routeBounds = useMemo(() => {
    const focusLegs =
      detail === "worker" && primaryVisual?.activeLegs.length
        ? primaryVisual.activeLegs
        : primaryRoute?.route || [];
    const points = focusLegs.flatMap((leg) => [
      leg.from,
      leg.to,
    ]);
    if (points.length === 0) return null;
    return boundsFromPoints(
      points.map((point) => point.x),
      points.map((point) => point.y),
      6
    );
  }, [detail, primaryRoute?.route, primaryVisual?.activeLegs]);

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
        setViewportSize({ width: rect.width, height: rect.height });
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
        visibleRoutes.flatMap((route) =>
          route.stops
            .filter((stop) => stop.status === "COMPLETED")
            .map((stop) => stop.accessNodeId)
        )
      ),
    [visibleRoutes]
  );
  const plannedFaces = useMemo(
    () =>
      new Set(
        visibleRoutes.flatMap((route) =>
          route.stops.map((stop) => stop.accessNodeId)
        )
      ),
    [visibleRoutes]
  );

  const zoom = Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, fitWarehouseBounds.width / view.width)
  );
  const showRackLabels = zoom >= 3;
  // At low zoom the worker dots sit on top of the station callouts; the legend covers
  // identity there instead.
  const showWorkerIdLabels = detail === "worker" || zoom >= 2;
  const operationalNodes = useMemo(() => {
    const facilityNodes = graph.nodes.filter((node) =>
      ["STATION", "PARKING", "DOOR"].includes(node.type)
    );
    if (detail === "admin" || !primaryRoute) return facilityNodes;
    const relevantIds = new Set(
      [primaryRoute.startNodeId, primaryRoute.currentNodeId, primaryRoute.endNodeId].filter(
        (value): value is string => Boolean(value)
      )
    );
    return facilityNodes.filter((node) => relevantIds.has(node.id));
  }, [detail, graph.nodes, primaryRoute]);
  const operationalCallouts = useMemo(
    () => buildOperationalCallouts(operationalNodes, view, viewportSize),
    [operationalNodes, view, viewportSize]
  );
  const screenUnit = view.width / Math.max(viewportSize.width, 1);
  const showOperationalLabels = detail === "worker" || zoom >= 1.6 || hasRoute;
  const currentStop = primaryRoute?.stops.find((stop) => stop.status === "CURRENT");

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
      <div className="flex flex-col gap-3 border-b border-base-300 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">
              {detail === "worker" ? "Route to next stop" : "Live aisle map"}
            </h3>
            <span
              className={`badge badge-sm ${
                hasRoute ? "badge-primary" : "badge-ghost"
              }`}
            >
              {hasRoute
                ? detail === "worker" && currentStop
                  ? `Next · ${currentStop.locationCode}`
                  : `${visibleRoutes.length} active ${visibleRoutes.length === 1 ? "route" : "routes"}`
                : "No active route"}
            </span>
          </div>
          {detail === "worker" ? (
            <p className="mt-0.5 text-[11px] text-base-content/60">
              Follow the dark dashed line. The grey line is later.
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-base-content/60">
              {graph.rackFootprintCount} rack bays · {graph.nodes.length} nodes ·
              graph {graph.graphHash.slice(0, 10)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="join" aria-label="Map focus">
            <button
              type="button"
              className={`btn btn-sm min-h-11 join-item ${
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
              className={`btn btn-sm min-h-11 join-item ${
                viewPreset === "warehouse" ? "btn-primary" : "btn-ghost"
              }`}
              onClick={focusWarehouse}
              title="Fit the whole warehouse in the viewport"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Fit warehouse
            </button>
          </div>
          <span className="hidden min-w-[52px] text-right text-xs font-semibold tabular-nums text-base-content/60 sm:inline">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative touch-none overflow-hidden bg-slate-100 outline-none ${
          detail === "worker"
            ? // Sized off the viewport on handhelds: a fixed 360px box left the route
              // too small to read on a phone. min-h keeps it usable on short screens.
              "h-[68vh] min-h-[380px] sm:h-[520px] lg:h-[560px]"
            : "h-[520px] lg:h-[640px]"
        } ${
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
              ? `Warehouse map showing ${visibleRoutes.length} active routes`
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
            const palette =
              detail === "worker"
                ? workerRackPalette(planned)
                : rackPalette(rack);
            return (
              <g key={rack.rackId} opacity={completed ? 0.28 : 1}>
                <rect
                  x={rack.centerX - rack.widthM / 2}
                  y={rack.centerY - rack.depthM / 2}
                  width={rack.widthM}
                  height={rack.depthM}
                  rx="0.28"
                  fill={palette.fill}
                  stroke={planned ? "#075985" : palette.stroke}
                  strokeWidth={planned ? "1.75" : "1"}
                  vectorEffect="non-scaling-stroke"
                />
                {zoom >= 4.5 && palette.code ? (
                  <text
                    x={rack.centerX}
                    y={rack.centerY + 3.5 * screenUnit}
                    textAnchor="middle"
                    fontSize={10 * screenUnit}
                    fontWeight="900"
                    fill={palette.text}
                    pointerEvents="none"
                  >
                    {palette.code}
                  </text>
                ) : null}
              </g>
            );
          })}

          {operationalCallouts.map((callout) => {
            const node = callout.node;
            const color = operationalNodeColor(node);
            const nodeRadius = operationalNodeRadius(node, screenUnit);
            return (
              <g key={node.id}>
                {showOperationalLabels ? (
                  <>
                    <line
                      x1={node.x}
                      y1={node.y}
                      x2={callout.anchorX}
                      y2={callout.anchorY}
                      stroke={color}
                      strokeWidth="1.25"
                      vectorEffect="non-scaling-stroke"
                    />
                    <rect
                      x={callout.labelX}
                      y={callout.labelY}
                      width={callout.labelWidth}
                      height={callout.labelHeight}
                      rx={4 * screenUnit}
                      fill="rgba(255,255,255,0.94)"
                      stroke={color}
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={callout.labelX + 8 * screenUnit}
                      y={callout.labelY + 14 * screenUnit}
                      fontSize={12 * screenUnit}
                      fontWeight="800"
                      fill="#0f172a"
                      pointerEvents="none"
                    >
                      {callout.label}
                    </text>
                  </>
                ) : null}
                {/* Squares, not circles: a filled circle on this map means "a stop on a route",
                    and station discs of a similar size and blue read as dulled stop markers. */}
                <rect
                  x={node.x - (nodeRadius + 3 * screenUnit)}
                  y={node.y - (nodeRadius + 3 * screenUnit)}
                  width={(nodeRadius + 3 * screenUnit) * 2}
                  height={(nodeRadius + 3 * screenUnit) * 2}
                  rx={2 * screenUnit}
                  fill={color}
                  opacity="0.14"
                  pointerEvents="none"
                />
                <rect
                  x={node.x - nodeRadius}
                  y={node.y - nodeRadius}
                  width={nodeRadius * 2}
                  height={nodeRadius * 2}
                  rx={1.5 * screenUnit}
                  fill={color}
                  stroke="#fff"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {routeVisuals.map(({ route, color, activeLegs, futureLegs, releasedLegs }, index) => {
            const isPrimary = route.id === primaryRoute?.id;
            // Fan the routes out around the true centre line: 0, +0.9, -0.9, +1.8, -1.8 metres.
            // Alternating sides keeps the busiest (first) route on the real geometry.
            const lane = detail === "admin" ? Math.ceil(index / 2) * (index % 2 === 1 ? 1 : -1) : 0;
            const offsetM = lane * 0.9;
            const activePath = pathFromLegs(activeLegs, offsetM);
            const futurePath = pathFromLegs(futureLegs, offsetM);
            const releasedPath = pathFromLegs(releasedLegs, offsetM);

            return (
              <g key={`route-${route.id}`}>
                {detail === "admin" && releasedPath ? (
                  <path
                    d={releasedPath}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="2 6"
                    opacity="0.16"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                {futurePath ? (
                  <path
                    d={futurePath}
                    fill="none"
                    stroke={detail === "worker" ? "#64748b" : color}
                    strokeWidth={isPrimary ? "3" : "2.5"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="2 8"
                    opacity={detail === "worker" ? "0.34" : "0.25"}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                {activePath ? (
                  <path
                    d={activePath}
                    fill="none"
                    stroke={color}
                    strokeWidth={isPrimary ? "5" : "4"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={route.status === "WAITING" ? "0.7" : "1"}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </g>
            );
          })}

          {routeVisuals.map(({ route, color }) => {
            const node = nodeById.get(route.currentNodeId);
            if (!node) return null;
            return (
              <g key={`worker-${route.id}`}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={(detail === "worker" ? 9 : 8) * screenUnit}
                  fill={color}
                  stroke="#fff"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
                {/* Below the dot, not beside it. A worker starts on a station node, and the
                    station's callout box is anchored at that same height to the side — so text
                    placed to the right landed straight on "Receiving Door" or "Inbound Staging".
                    Hidden when zoomed out, where the legend already maps colour to worker. */}
                {showWorkerIdLabels ? (
                  <text
                    x={node.x}
                    y={node.y + 20 * screenUnit}
                    textAnchor="middle"
                    fontSize={11 * screenUnit}
                    fontWeight="800"
                    fill={color}
                    paintOrder="stroke"
                    stroke="#fff"
                    strokeWidth="2.5"
                  >
                    {route.workerId.slice(0, 6)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {(detail === "admin" ? routeVisuals : primaryVisual ? [primaryVisual] : []).flatMap(
            ({ route, color }) =>
              route.stops.map((stop) => {
                const node = nodeById.get(stop.accessNodeId);
                if (!node || (detail === "worker" && stop.status === "COMPLETED")) return null;
                const isCurrent = stop.status === "CURRENT";
                return (
                  <g
                    key={`${route.id}-${stop.id}`}
                    opacity={stop.status === "COMPLETED" ? 0.22 : isCurrent ? 1 : 0.5}
                  >
                    {/* The stop the worker is on is filled in their colour; the rest are hollow
                        rings in the same colour rather than anonymous slate, so a queue of "2"s
                        from two workers can still be told apart. */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={(isCurrent ? 10 : 7.5) * screenUnit}
                      fill={isCurrent ? color : "#fff"}
                      stroke={isCurrent ? "#fff" : color}
                      strokeWidth={isCurrent ? "3" : "2.5"}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={node.x}
                      y={node.y + 3.5 * screenUnit}
                      textAnchor="middle"
                      fontSize={(isCurrent ? 10 : 9) * screenUnit}
                      fontWeight="900"
                      fill={isCurrent ? "#fff" : color}
                    >
                      {stop.sequence}
                    </text>
                    {isCurrent || showRackLabels ? (
                      <text
                        x={node.x + 13 * screenUnit}
                        y={node.y + 4 * screenUnit}
                        fontSize={(isCurrent ? 12 : 10) * screenUnit}
                        fontWeight="900"
                        fill="#0f172a"
                        paintOrder="stroke"
                        stroke="#fff"
                        strokeWidth="0.9"
                      >
                        {isCurrent
                          ? `NEXT · ${stop.locationCode}${
                              detail === "admin" ? ` · ${route.workerId.slice(0, 6)}` : ""
                            }`
                          : stop.locationCode}
                      </text>
                    ) : null}
                  </g>
                );
              })
          )}
        </svg>

        {detail === "admin" ? (
          <>
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-base-300 bg-base-100/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
              <Move className="h-4 w-4 text-base-content/60" />
              <span>Drag to pan · Scroll to zoom</span>
            </div>
            <div className="pointer-events-none absolute left-3 top-14 rounded-lg border border-base-300 bg-base-100/95 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
              <div className="mb-1 font-bold text-base-content/70">Rack velocity zones</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <VelocityKey code="F" label="Fast · near door" color="#059669" />
                <VelocityKey code="M" label="Medium" color="#d97706" />
                <VelocityKey code="S" label="Slow · deep" color="#4f46e5" />
              </div>
            </div>
          </>
        ) : currentStop ? (
          <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-5rem)] rounded-xl border border-primary/30 bg-base-100/95 px-3 py-2 shadow-md backdrop-blur">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
              Next stop · {currentStop.sequence} of {primaryRoute?.stops.length || 1}
            </div>
            <div className="mt-0.5 font-mono text-base font-black text-base-content">
              {currentStop.locationCode}
            </div>
            <div className="text-[11px] text-base-content/60">Follow the dark dashed line</div>
          </div>
        ) : null}

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
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-5rem)] rounded-lg border border-base-300 bg-base-100/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
            <div className="flex items-center gap-2">
              {/* Swatches mirror the SVG: the current leg is solid, the rest finely dotted. */}
              <span className="w-8 border-t-[3px] border-solid border-primary" />
              <span className="font-semibold">Go now</span>
              <span className="text-base-content/40">·</span>
              <span className="w-7 border-t-2 border-dotted border-slate-500 opacity-60" />
              <span className="font-semibold">Later</span>
            </div>
            {detail === "admin" && routeVisuals.length > 1 ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-base-300 pt-2">
                {/* Colour identifies the worker, so the map has to say which worker. */}
                {routeVisuals.map(({ route, color }) => (
                  <span key={`legend-${route.id}`} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-mono">{route.workerId.slice(0, 6)}</span>
                    <span className="text-base-content/50">
                      {route.stops.filter((stop) => stop.status !== "COMPLETED").length} left
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div
          className="absolute right-3 top-3 join join-vertical shadow-md"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn-square min-h-11 min-w-11 join-item bg-base-100"
            onClick={() => zoomAt(0.8)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn btn-square min-h-11 min-w-11 join-item bg-base-100"
            onClick={() => zoomAt(1.25)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn btn-square min-h-11 min-w-11 join-item bg-base-100"
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

        {detail === "admin" ? (
          <MiniMap
            warehouseBounds={warehouseBounds}
            view={view}
            graph={graph}
            routes={visibleRoutes}
            onReset={focusWarehouse}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 bg-base-100 px-4 py-2 text-[11px] text-base-content/55">
        <span>
          {detail === "worker"
            ? "Receiving side ↑ · same warehouse orientation as admin"
            : `Showing ${showRackLabels ? "rack-level detail" : "operational overview"}`}
        </span>
        <span className="hidden sm:inline">Keyboard: + / − to zoom · 0 to reset</span>
      </div>
    </section>
  );
}

interface OperationalCallout {
  node: RoutingGraphNode;
  label: string;
  labelX: number;
  labelY: number;
  labelWidth: number;
  labelHeight: number;
  anchorX: number;
  anchorY: number;
}

function buildOperationalCallouts(
  nodes: RoutingGraphNode[],
  view: ViewBounds,
  viewport: ViewportSize
): OperationalCallout[] {
  const widthPx = Math.max(viewport.width, 1);
  const heightPx = Math.max(viewport.height, 1);
  const unitX = view.width / widthPx;
  const unitY = view.height / heightPx;
  const placed: Array<{ x: number; y: number; width: number; height: number }> = [];

  const overlaps = (
    x: number,
    y: number,
    width: number,
    height: number,
    other: { x: number; y: number; width: number; height: number }
  ) =>
    x < other.x + other.width + 6 &&
    x + width + 6 > other.x &&
    y < other.y + other.height + 5 &&
    y + height + 5 > other.y;

  return [...nodes]
    .sort((a, b) => a.y - b.y || a.x - b.x || a.label.localeCompare(b.label))
    .map((node) => {
      const label = operationalNodeLabel(node);
      const pointX = ((node.x - view.minX) / view.width) * widthPx;
      const pointY = ((node.y - view.minY) / view.height) * heightPx;
      const labelWidthPx = Math.max(82, Math.min(240, label.length * 7.2 + 18));
      const labelHeightPx = 22;

      const clampX = (value: number) =>
        Math.max(12, Math.min(value, widthPx - labelWidthPx - 12));
      const clampY = (value: number) =>
        Math.max(12, Math.min(value, heightPx - labelHeightPx - 12));

      // Candidate placements around the node, nearest first: right, left, then progressively
      // further above and below on both sides.
      //
      // The old solver could only push a label downwards and clamped it to the bottom edge
      // *after* it had stopped checking, so once the cascade reached the floor every remaining
      // label was stacked in the same band — which is how zone names ended up printed on top of
      // one another near the doors.
      const candidates: Array<{ x: number; y: number }> = [];
      for (let ring = 0; ring < 6; ring += 1) {
        const dy = ring * (labelHeightPx + 5);
        for (const side of [20, -labelWidthPx - 20]) {
          candidates.push({ x: pointX + side, y: pointY - labelHeightPx / 2 - dy });
          if (ring > 0) {
            candidates.push({ x: pointX + side, y: pointY - labelHeightPx / 2 + dy });
          }
        }
      }

      let labelX = clampX(pointX + 20);
      let labelY = clampY(pointY - labelHeightPx / 2);
      for (const candidate of candidates) {
        const x = clampX(candidate.x);
        const y = clampY(candidate.y);
        // Clamp first, then test — so a placement pushed back inside the viewport is still
        // checked against what is already there.
        if (!placed.some((other) => overlaps(x, y, labelWidthPx, labelHeightPx, other))) {
          labelX = x;
          labelY = y;
          break;
        }
      }
      placed.push({ x: labelX, y: labelY, width: labelWidthPx, height: labelHeightPx });

      const labelIsRight = labelX >= pointX;
      const anchorPxX = labelIsRight ? labelX : labelX + labelWidthPx;
      const anchorPxY = labelY + labelHeightPx / 2;
      return {
        node,
        label,
        labelX: view.minX + labelX * unitX,
        labelY: view.minY + labelY * unitY,
        labelWidth: labelWidthPx * unitX,
        labelHeight: labelHeightPx * unitY,
        anchorX: view.minX + anchorPxX * unitX,
        anchorY: view.minY + anchorPxY * unitY,
      };
    });
}

function operationalNodeLabel(node: RoutingGraphNode) {
  const labels: Record<string, string> = {
    "DOOR-01": "Receiving Door",
    "QTN-01": "Quarantine",
    "RCV-01": "Receiving",
    "STG-01": "Inbound Staging",
    "PACK-01": "Packing",
    "DSP-01": "Dispatch",
  };
  return labels[node.label.toUpperCase()] || node.label;
}

function operationalNodeColor(_node: RoutingGraphNode) {
  // A single operational blue separates facilities from the F/M/S rack
  // palette and avoids asking operators to learn another color taxonomy.
  return "#0369a1";
}

function operationalNodeRadius(node: RoutingGraphNode, screenUnit: number) {
  const physicalRadius = node.type === "PARKING" ? 1.1 : node.type === "DOOR" ? 1 : 0.9;
  return Math.max(7 * screenUnit, physicalRadius);
}

function splitRouteLegs(route: WorkerRouteSession) {
  const releasedLegs = route.route.filter((leg) => leg.status === "RELEASED");
  const remainingLegs = route.route.filter((leg) => leg.status !== "RELEASED");
  const currentStop = route.stops.find((stop) => stop.status === "CURRENT");

  if (remainingLegs.length === 0) {
    return { activeLegs: [], futureLegs: [], releasedLegs };
  }

  if (!currentStop) {
    return { activeLegs: remainingLegs, futureLegs: [], releasedLegs };
  }

  const currentStopLegIndex = remainingLegs.findIndex(
    (leg) => leg.toNodeId === currentStop.accessNodeId
  );
  const activeEnd = currentStopLegIndex >= 0 ? currentStopLegIndex + 1 : 1;
  return {
    activeLegs: remainingLegs.slice(0, activeEnd),
    futureLegs: remainingLegs.slice(activeEnd),
    releasedLegs,
  };
}

/**
 * Route geometry, shifted sideways by `offsetM` metres.
 *
 * Two workers routed down one aisle share identical coordinates, and interleaved dash phases
 * did not separate them — wherever the dashes coincided one route simply painted over the
 * other, so the map showed one line where two workers were converging. Nudging each route
 * perpendicular to its own direction of travel keeps both visible, at the cost of drawing them
 * a metre or so off the true centre line.
 */
function pathFromLegs(legs: WorkerRouteSession["route"], offsetM = 0): string {
  if (legs.length === 0) return "";
  let path = "";
  legs.forEach((leg, index) => {
    const previous = index > 0 ? legs[index - 1] : null;
    const dx = leg.to.x - leg.from.x;
    const dy = leg.to.y - leg.from.y;
    const length = Math.hypot(dx, dy);
    // Perpendicular unit vector; a zero-length leg has no direction to offset along.
    const nx = length > 0 ? (-dy / length) * offsetM : 0;
    const ny = length > 0 ? (dx / length) * offsetM : 0;
    if (!previous || previous.toNodeId !== leg.fromNodeId) {
      path += `M ${leg.from.x + nx} ${leg.from.y + ny} `;
    }
    path += `L ${leg.to.x + nx} ${leg.to.y + ny} `;
  });
  return path.trim();
}

function rackVelocity(rack: RoutingRack): "F" | "M" | "S" | "" {
  if (rack.velocityClass === "F" || rack.velocityClass === "M" || rack.velocityClass === "S") {
    return rack.velocityClass;
  }
  const suffix = rack.amalgamatedClass?.slice(-1).toUpperCase();
  return suffix === "F" || suffix === "M" || suffix === "S" ? suffix : "";
}

function rackPalette(rack: RoutingRack) {
  switch (rackVelocity(rack)) {
    case "F":
      return { code: "F", fill: "#d1fae5", stroke: "#059669", text: "#065f46" };
    case "M":
      return { code: "M", fill: "#fef3c7", stroke: "#d97706", text: "#92400e" };
    case "S":
      return { code: "S", fill: "#e0e7ff", stroke: "#4f46e5", text: "#3730a3" };
    default:
      return { code: "", fill: "#e2e8f0", stroke: "#64748b", text: "#334155" };
  }
}

function workerRackPalette(isPlanned: boolean) {
  return isPlanned
    ? { code: "", fill: "#e0f2fe", stroke: "#0284c7", text: "#075985" }
    : { code: "", fill: "#f8fafc", stroke: "#cbd5e1", text: "#475569" };
}

function VelocityKey({
  code,
  label,
  color,
}: {
  code: string;
  label: string;
  color: string;
}) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span
        className="grid h-4 w-4 place-items-center rounded-sm text-[9px] font-black text-white"
        style={{ backgroundColor: color }}
      >
        {code}
      </span>
      <span>{label}</span>
    </span>
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
            fill={rackPalette(rack).fill}
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
