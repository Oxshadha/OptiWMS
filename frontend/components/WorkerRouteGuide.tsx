"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { LiveWarehouseRouteMap } from "@/components/LiveWarehouseRouteMap";
import { useOffline } from "@/hooks/useOffline";
import { useWorker } from "@/contexts/WorkerContext";
import {
  routingApi,
  WarehouseRoutingGraph,
  WorkerRouteSession,
} from "@/lib/api/routing";

interface WorkerRouteGuideProps {
  warehouseId?: string;
  taskId?: string;
  orderId?: string;
  targetLocationCode?: string | null;
  targetLocationCodes?: Array<string | null | undefined>;
  completedLocationCodes?: Array<string | null | undefined>;
  operationType: "putaway" | "picking" | "transfer";
}

/**
 * The session is per route; the graph is per warehouse.
 *
 * They used to be cached together under every route key, so each new move wrote another copy of a
 * ~1,000-node graph into localStorage. After a handful of moves that filled the 5MB origin quota
 * and setItem threw, surfacing as a red failure on a route that had actually planned fine.
 */
interface CachedRoute {
  key: string;
  session: WorkerRouteSession;
}

const routeRequests = new Map<
  string,
  Promise<{ graph: WarehouseRoutingGraph; session: WorkerRouteSession }>
>();

export function WorkerRouteGuide({
  warehouseId,
  taskId,
  orderId,
  targetLocationCode,
  targetLocationCodes,
  completedLocationCodes = [],
  operationType,
}: WorkerRouteGuideProps) {
  const { worker } = useWorker();
  const { isOnline } = useOffline();
  const [graph, setGraph] = useState<WarehouseRoutingGraph | null>(null);
  const [session, setSession] = useState<WorkerRouteSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<WorkerRouteSession | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const requestNumberRef = useRef(0);
  const completedSentRef = useRef(new Set<string>());
  const progressQueueRef = useRef<Promise<void>>(Promise.resolve());

  const remainingCodes = useMemo(
    () =>
      normalizeCodes(
        targetLocationCodes?.length
          ? targetLocationCodes
          : [targetLocationCode]
      ),
    [targetLocationCode, targetLocationCodes]
  );
  const completedCodes = useMemo(
    () => normalizeCodes(completedLocationCodes),
    [completedLocationCodes]
  );
  const allCodesKey = useMemo(
    () => Array.from(new Set([...remainingCodes, ...completedCodes])).sort().join(","),
    [completedCodes, remainingCodes]
  );
  const allCodes = useMemo(
    () => (allCodesKey ? allCodesKey.split(",") : []),
    [allCodesKey]
  );
  const effectiveWarehouseId = warehouseId || worker?.warehouseId;
  const routeKey = useMemo(
    () =>
      [
        effectiveWarehouseId || "",
        worker?.id || "",
        operationType,
        orderId || "",
        taskId || "",
        allCodes.join(","),
      ].join("|"),
    [
      allCodes,
      effectiveWarehouseId,
      operationType,
      orderId,
      taskId,
      worker?.id,
    ]
  );
  const cacheKey = `optiwms-live-route:${routeKey}`;
  const graphCacheKey = `optiwms-route-graph:${effectiveWarehouseId ?? "none"}`;

  /**
   * Writes through, and treats a full quota as a cache miss rather than an error: the route is
   * already planned server-side, so failing to cache it must not look like a failure to plan it.
   */
  const writeCache = useCallback((key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      try {
        // Drop this app's stale route entries and retry once before giving up.
        Object.keys(localStorage)
          .filter((k) => k.startsWith("optiwms-live-route:") && k !== key)
          .forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Offline replay is a convenience, not a requirement for the move to proceed.
      }
    }
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    completedSentRef.current = new Set<string>();
    progressQueueRef.current = Promise.resolve();
  }, [routeKey]);

  useEffect(() => {
    if (!effectiveWarehouseId || !worker?.id || allCodes.length === 0) {
      setSession(null);
      setGraph(null);
      return;
    }

    let cancelled = false;
    const requestNumber = ++requestNumberRef.current;

    const load = async () => {
      setLoading(true);
      setError(null);
      let cached: CachedRoute | null = null;
      try {
        const raw = localStorage.getItem(cacheKey);
        cached = raw ? (JSON.parse(raw) as CachedRoute) : null;
        const rawGraph = localStorage.getItem(graphCacheKey);
        if (rawGraph) {
          try { setGraph(JSON.parse(rawGraph) as WarehouseRoutingGraph); } catch { /* refetched below */ }
        }
        if (cached?.key === routeKey) {
          setSession(cached.session);
          sessionRef.current = cached.session;
        }
      } catch {
        cached = null;
      }

      if (!isOnline) {
        if (!cached) {
          setError("No conflict-safe route is cached for offline use.");
        }
        setLoading(false);
        return;
      }

      try {
        let routeRequest = routeRequests.get(routeKey);
        if (!routeRequest) {
          routeRequest = (async () => {
            const nextGraph = await routingApi.getGraph(effectiveWarehouseId, true);
            let nextSession: WorkerRouteSession | null = null;
            if (
              cached?.key === routeKey &&
              ["ACTIVE", "WAITING", "PLANNED"].includes(cached.session.status)
            ) {
              try {
                nextSession = await routingApi.getSession(cached.session.id);
              } catch {
                nextSession = null;
              }
            }

            if (!nextSession || !["ACTIVE", "WAITING", "PLANNED"].includes(nextSession.status)) {
              const previous = sessionRef.current;
              if (
                previous &&
                activeKeyRef.current &&
                activeKeyRef.current !== routeKey &&
                ["ACTIVE", "WAITING", "PLANNED"].includes(previous.status)
              ) {
                try {
                  await routingApi.cancel(previous.id, previous.routeVersion);
                } catch {
                  // Lease expiry is the server-side fallback.
                }
              }
              nextSession = await routingApi.createSession({
                warehouseId: effectiveWarehouseId,
                workerId: worker.id,
                taskId,
                orderId,
                operationType: operationType === "putaway" ? "PUTAWAY"
                  : operationType === "transfer" ? "TRANSFER" : "PICKING",
                vehicleType: "FORKLIFT",
                locationCodes: allCodes,
              });
            }

            return { graph: nextGraph, session: nextSession };
          })();
          routeRequests.set(routeKey, routeRequest);
          void routeRequest.finally(() => {
            if (routeRequests.get(routeKey) === routeRequest) {
              routeRequests.delete(routeKey);
            }
          }).catch(() => undefined);
        }

        const { graph: nextGraph, session: nextSession } = await routeRequest;

        if (cancelled || requestNumber !== requestNumberRef.current) return;
        activeKeyRef.current = routeKey;
        setGraph(nextGraph);
        setSession(nextSession);
        sessionRef.current = nextSession;
        writeCache(graphCacheKey, nextGraph);
        writeCache(cacheKey, { key: routeKey, session: nextSession });
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to create a conflict-safe route."
          );
        }
      } finally {
        // Clear loading even when superseded: only the newest request owns the state, but a
        // cancelled one must not leave the panel spinning if no newer request follows.
        if (!cancelled || requestNumber === requestNumberRef.current) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    allCodes,
    cacheKey,
    effectiveWarehouseId,
    isOnline,
    operationType,
    orderId,
    routeKey,
    taskId,
    worker?.id,
  ]);

  useEffect(() => {
    if (!session || !isOnline || completedCodes.length === 0) return;
    const pendingCompletions = completedCodes.filter(
      (code) => !completedSentRef.current.has(code)
    );
    if (pendingCompletions.length === 0) return;

    for (const locationCode of pendingCompletions) {
      progressQueueRef.current = progressQueueRef.current.then(async () => {
        const active = sessionRef.current;
        if (!active || !["ACTIVE", "WAITING", "PLANNED"].includes(active.status)) return;
        const updated = await routingApi.progress(active.id, {
          routeVersion: active.routeVersion,
          eventType: "STOP_COMPLETED",
          locationCode,
          clientEventId: crypto.randomUUID(),
        });
        completedSentRef.current.add(locationCode);
        setSession(updated);
        sessionRef.current = updated;
        // Session only: the graph is cached once per warehouse, not per route.
        writeCache(cacheKey, { key: routeKey, session: updated });
      }).catch((progressError) => {
        setError(
          progressError instanceof Error
            ? progressError.message
            : "Route progress could not be synchronized."
        );
      });
    }
  }, [cacheKey, completedCodes, graph, isOnline, routeKey, session]);

  useEffect(() => {
    if (!session || !isOnline) return;
    const timer = window.setInterval(() => {
      const active = sessionRef.current;
      if (!active || !["ACTIVE", "WAITING", "PLANNED"].includes(active.status)) return;
      void routingApi
        .progress(active.id, {
          routeVersion: active.routeVersion,
          eventType: "HEARTBEAT",
          clientEventId: crypto.randomUUID(),
        })
        .then((updated) => {
          setSession(updated);
          sessionRef.current = updated;
        })
        .catch(() => {
          setError("Route heartbeat failed. Stop before entering a reserved narrow aisle.");
        });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [isOnline, session]);

  const finishAtEnd = async () => {
    const active = sessionRef.current;
    if (!active?.endNodeId) return;
    try {
      const arrived = await routingApi.progress(active.id, {
        routeVersion: active.routeVersion,
        eventType: "ARRIVED_NODE",
        nodeId: active.endNodeId,
        clientEventId: crypto.randomUUID(),
      });
      setSession(arrived);
      sessionRef.current = arrived;
    } catch (finishError) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : "Could not complete the return route."
      );
    }
  };

  if (allCodes.length === 0) return null;

  const currentStop = session?.stops.find((stop) => stop.status === "CURRENT");
  const laterStops =
    session?.stops.filter((stop) => stop.status === "PENDING") || [];
  const pendingStops =
    session?.stops.filter((stop) => ["CURRENT", "PENDING"].includes(stop.status))
      .length || 0;
  const firstLeg = session?.route.find((leg) => leg.status === "RESERVED");
  const distanceToNextStop = session && currentStop
    ? distanceThroughNode(session.route, currentStop.accessNodeId)
    : session?.totalDistanceM || 0;

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-3 mt-3">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold">Server-authorized route</div>
          <div className="text-xs text-base-content/60">
            {operationType === "putaway"
              ? "Inbound staging → rack faces → forklift parking"
              : "Forklift parking → pick faces → packing"}
          </div>
        </div>
        <div className="flex gap-2">
          <span className="badge badge-outline">
            {session ? `v${session.routeVersion}` : "planning"}
          </span>
          <span
            className={`badge ${
              !isOnline
                ? "badge-warning"
                : session?.status === "WAITING"
                ? "badge-warning"
                : session?.status === "COMPLETED"
                ? "badge-success"
                : "badge-primary"
            }`}
          >
            {!isOnline ? "Offline cache" : session?.status || "Loading"}
          </span>
        </div>
      </div>

      {!isOnline ? (
        <div className="alert alert-warning py-2 text-xs mb-3">
          <span>
            Cached guidance only. Do not enter a narrow aisle until the server renews this reservation.
          </span>
        </div>
      ) : null}
      {error ? (
        <div className="alert alert-error py-2 text-xs mb-3">
          <span>{error}</span>
        </div>
      ) : null}

      {loading && !session ? (
        <div className="flex items-center gap-2 py-6 justify-center text-sm">
          <span className="loading loading-spinner loading-sm" />
          Generating conflict-safe route…
        </div>
      ) : null}

      {graph && session ? (
        <div className="space-y-3">
          <LiveWarehouseRouteMap
            graph={graph}
            routes={[session]}
            primaryRouteId={session.id}
            detail="worker"
          />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="Remaining stops" value={String(pendingStops)} />
            <Metric label="To next stop" value={`${distanceToNextStop.toFixed(1)} m`} />
            <Metric
              label="Total travel"
              value={`${Math.ceil(session.estimatedTravelSeconds / 60)} min`}
            />
            <Metric
              label="Reserved wait"
              value={`${session.totalWaitSeconds.toFixed(0)} sec`}
              warning={session.totalWaitSeconds > 0}
            />
          </div>
          <div className="rounded-lg bg-base-200 px-3 py-3 text-sm">
            {currentStop ? (
              <>
                <div className="text-xs text-base-content/60">Next confirmed stop</div>
                <div className="font-bold font-mono">{currentStop.locationCode}</div>
              </>
            ) : session.status === "COMPLETED" ? (
              <div className="font-semibold text-success">Route completed and reservations released.</div>
            ) : (
              <div className="font-semibold">
                Return to {session.endNodeId?.replace("STATION:", "").replace("PARKING:", "")}.
              </div>
            )}
            {firstLeg ? (
              <div className="text-xs text-base-content/60 mt-1">
                Next aisle segment: {direction(firstLeg.from, firstLeg.to)}
                {firstLeg.waitSeconds > 0
                  ? ` · wait ${Math.ceil(firstLeg.waitSeconds)} seconds`
                  : ""}
              </div>
            ) : null}
            {laterStops.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-base-content/55">Later:</span>
                {laterStops.slice(0, 3).map((stop) => (
                  <span key={stop.id} className="badge badge-ghost badge-sm font-mono">
                    {stop.locationCode}
                  </span>
                ))}
                {laterStops.length > 3 ? (
                  <span className="text-base-content/55">+{laterStops.length - 3}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          {pendingStops === 0 &&
          session.status !== "COMPLETED" &&
          session.endNodeId ? (
            <button
              type="button"
              className="btn btn-success w-full"
              onClick={() => void finishAtEnd()}
              disabled={!isOnline}
            >
              Confirm arrival at packing/parking
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-base-300 px-3 py-2">
      <div className="text-base-content/60">{label}</div>
      <div className={`font-semibold ${warning ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}

function normalizeCodes(
  values: Array<string | null | undefined> | undefined
): string[] {
  return Array.from(
    new Set(
      (values || [])
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim().toUpperCase())
    )
  );
}

function direction(
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  if (to.x > from.x) return "east";
  if (to.x < from.x) return "west";
  if (to.y > from.y) return "south";
  if (to.y < from.y) return "north";
  return "hold position";
}

function distanceThroughNode(
  legs: WorkerRouteSession["route"],
  targetNodeId: string
) {
  let distance = 0;
  for (const leg of legs) {
    if (leg.status === "RELEASED") continue;
    distance += leg.distanceM;
    if (leg.toNodeId === targetNodeId) break;
  }
  return distance;
}
