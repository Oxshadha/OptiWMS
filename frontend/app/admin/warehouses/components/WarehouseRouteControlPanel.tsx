"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LiveWarehouseRouteMap } from "@/components/LiveWarehouseRouteMap";
import {
  routingApi,
  RoutingStats,
  subscribeRoutingEvents,
  WarehouseRoutingGraph,
  WorkerRouteSession,
} from "@/lib/api/routing";
import { logger } from "@/lib/utils/logger";
import { showToast } from "@/lib/utils/toast";

export function WarehouseRouteControlPanel({
  warehouseId,
}: {
  warehouseId: string;
}) {
  const [graph, setGraph] = useState<WarehouseRoutingGraph | null>(null);
  const [routes, setRoutes] = useState<WorkerRouteSession[]>([]);
  const [stats, setStats] = useState<RoutingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [streamState, setStreamState] = useState<"connected" | "recovering">(
    "recovering"
  );

  const refresh = useCallback(async () => {
    try {
      const [nextGraph, nextRoutes, nextStats] = await Promise.all([
        routingApi.getGraph(warehouseId, true),
        routingApi.getActive(warehouseId),
        routingApi.getStats(warehouseId),
      ]);
      setGraph(nextGraph);
      setRoutes(nextRoutes);
      setStats(nextStats);
    } catch (error) {
      logger.error("Failed to load live routing control panel:", error);
      showToast.error("Failed to load the authoritative routing graph.");
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeRoutingEvents(
      warehouseId,
      (eventName, payload) => {
        setStreamState("connected");
        if (eventName === "snapshot" && Array.isArray(payload)) {
          setRoutes(payload as WorkerRouteSession[]);
          return;
        }
        if (eventName === "graph") {
          setGraph(payload as WarehouseRoutingGraph);
          return;
        }
        if (eventName === "route") {
          const route = payload as WorkerRouteSession;
          setRoutes((current) => {
            const remaining = current.filter((item) => item.id !== route.id);
            return ["ACTIVE", "WAITING", "PLANNED"].includes(route.status)
              ? [route, ...remaining]
              : remaining;
          });
          void routingApi.getStats(warehouseId).then(setStats).catch(() => {});
          return;
        }
        if (eventName === "route-expired") {
          const sessionId = (payload as { sessionId?: string })?.sessionId;
          if (sessionId) {
            setRoutes((current) =>
              current.filter((route) => route.id !== sessionId)
            );
          }
        }
      },
      () => setStreamState("recovering")
    );
    // A slow poll is deliberately retained as recovery for mobile networks and
    // proxies that terminate long-lived SSE connections.
    const recoveryPoll = window.setInterval(() => void refresh(), 15_000);
    return () => {
      unsubscribe();
      window.clearInterval(recoveryPoll);
    };
  }, [refresh, warehouseId]);

  const temporalConflicts = useMemo(() => countTemporalConflicts(routes), [routes]);
  const totalWait = routes.reduce(
    (sum, route) => sum + route.totalWaitSeconds,
    0
  );

  const rebuild = async () => {
    setRebuilding(true);
    try {
      const nextGraph = await routingApi.rebuildGraph(warehouseId);
      setGraph(nextGraph);
      await refresh();
      showToast.success("Routing graph rebuilt from the active warehouse dataset.");
    } catch (error) {
      logger.error("Failed to rebuild routing graph:", error);
      showToast.error("Routing graph rebuild failed.");
    } finally {
      setRebuilding(false);
    }
  };

  if (loading && !graph) {
    return (
      <div className="card bg-base-100 border border-base-300 rounded-xl p-12 items-center">
        <span className="loading loading-spinner loading-lg" />
        <div className="mt-3 text-sm">Generating the active aisle graph…</div>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="alert alert-error">
        <span>No authoritative route graph is available for this warehouse.</span>
        <button className="btn btn-sm" onClick={() => void refresh()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
      <div className="border-b border-base-300 p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight">
                Live Forklift Route Control
              </h2>
              <span
                className={`badge ${
                  streamState === "connected" ? "badge-success" : "badge-warning"
                }`}
              >
                {streamState === "connected" ? "Live" : "Recovering"}
              </span>
            </div>
            <p className="text-sm text-base-content/60 mt-1">
              Server-authoritative routes, edge-time reservations and released
              worker progress on {graph.layoutVersion}.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => void refresh()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => void rebuild()}
              disabled={rebuilding || routes.length > 0}
              title={
                routes.length > 0
                  ? "Finish active routes before replacing the graph"
                  : "Rebuild from the active warehouse dataset"
              }
            >
              {rebuilding ? (
                <span className="loading loading-spinner loading-xs" />
              ) : null}
              Rebuild graph
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mt-5">
          <Metric label="Active routes" value={String(routes.length)} />
          <Metric label="Rack bays" value={String(graph.rackFootprintCount)} />
          <Metric label="Graph nodes" value={String(stats?.nodeCount || graph.nodes.length)} />
          <Metric label="Graph edges" value={String(stats?.edgeCount || graph.edges.length)} />
          <Metric
            label="Reservations"
            value={String(stats?.reservedResources || 0)}
          />
          <Metric label="Planned wait" value={`${totalWait.toFixed(0)} sec`} />
          <Metric
            label="Time conflicts"
            value={String(temporalConflicts)}
            status={temporalConflicts === 0 ? "success" : "error"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-5 border-b xl:border-b-0 xl:border-r border-base-300">
          <LiveWarehouseRouteMap
            graph={graph}
            routes={routes}
            detail="admin"
          />
          {routes.length === 0 ? (
            <div className="alert mt-3">
              <span>
                No worker has an active route. The active graph remains ready for
                inbound putaway and outbound picking.
              </span>
            </div>
          ) : null}
        </div>

        <div className="p-5 bg-base-200/40">
          <h3 className="font-bold mb-3">Active workers and reservations</h3>
          <div className="space-y-3">
            {routes.map((route) => {
              const currentStop = route.stops.find(
                (stop) => stop.status === "CURRENT"
              );
              return (
                <div
                  key={route.id}
                  className="rounded-xl border border-base-300 bg-base-100 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">
                        Worker {route.workerId.slice(0, 8)}
                      </div>
                      <div className="text-xs text-base-content/60">
                        {route.operationType} · {route.vehicleType}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        route.status === "WAITING"
                          ? "badge-warning"
                          : "badge-success"
                      }`}
                    >
                      {route.status} · v{route.routeVersion}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                    <div>
                      <div className="text-base-content/50">Current node</div>
                      <div className="font-mono truncate">{route.currentNodeId}</div>
                    </div>
                    <div>
                      <div className="text-base-content/50">Next stop</div>
                      <div className="font-mono truncate">
                        {currentStop?.locationCode || route.endNodeId || "Complete"}
                      </div>
                    </div>
                    <div>
                      <div className="text-base-content/50">Distance</div>
                      <div>{route.totalDistanceM.toFixed(1)} m</div>
                    </div>
                    <div>
                      <div className="text-base-content/50">Planned wait</div>
                      <div>{route.totalWaitSeconds.toFixed(0)} sec</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 mt-4 text-xs leading-relaxed">
            <div className="font-bold mb-1">Operational safety boundary</div>
            Routes coordinate expected aisle occupancy. Operators must still
            maintain visibility, speed, stopping distance and local right-of-way.
            A worker with an expired/offline lease must stop before a reserved
            narrow aisle.
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "success" | "error";
}) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-base-content/50">
        {label}
      </div>
      <div
        className={`font-black ${
          status === "success"
            ? "text-success"
            : status === "error"
            ? "text-error"
            : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function countTemporalConflicts(routes: WorkerRouteSession[]) {
  let conflicts = 0;
  const legs = routes.flatMap((route) =>
    route.route
      .filter((leg) => leg.status === "RESERVED")
      .map((leg) => ({
        sessionId: route.id,
        resource: [leg.fromNodeId, leg.toNodeId].sort().join("<>"),
        from: Date.parse(leg.reservedFrom),
        until: Date.parse(leg.reservedUntil),
      }))
  );
  for (let left = 0; left < legs.length; left += 1) {
    for (let right = left + 1; right < legs.length; right += 1) {
      if (legs[left].sessionId === legs[right].sessionId) continue;
      if (legs[left].resource !== legs[right].resource) continue;
      if (
        legs[left].from < legs[right].until &&
        legs[right].from < legs[left].until
      ) {
        conflicts += 1;
      }
    }
  }
  return conflicts;
}
