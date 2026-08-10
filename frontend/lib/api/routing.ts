import { apiClient } from "./client";

export interface RoutingGraphNode {
  id: string;
  type: "AISLE" | "CROSS_AISLE" | "RACK_FACE" | "STATION" | "PARKING" | "DOOR" | "WAIT";
  label: string;
  x: number;
  y: number;
  metadata: Record<string, unknown>;
}

export interface RoutingGraphEdge {
  id: string;
  from: string;
  to: string;
  resourceKey: string;
  type: string;
  distanceM: number;
  baseTravelSeconds: number;
  widthM: number;
  capacity: number;
}

export interface RoutingRack {
  rackId: string;
  area: string;
  row: string;
  bay: string;
  amalgamatedClass?: string;
  velocityClass?: "F" | "M" | "S" | "";
  centerX: number;
  centerY: number;
  widthM: number;
  depthM: number;
  accessNodeIds: string[];
}

export interface WarehouseRoutingGraph {
  graphId: string;
  warehouseId: string;
  datasetVersion: string;
  layoutVersion: string;
  graphHash: string;
  rackFootprintCount: number;
  nodes: RoutingGraphNode[];
  edges: RoutingGraphEdge[];
  racks: RoutingRack[];
}

export interface WorkerRouteStop {
  id: string;
  sequence: number;
  locationCode: string;
  accessNodeId: string;
  status: "PENDING" | "CURRENT" | "COMPLETED" | "SKIPPED";
  completedAt?: string;
}

export interface WorkerRouteLeg {
  sequence: number;
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  reservedFrom: string;
  reservedUntil: string;
  distanceM: number;
  waitSeconds: number;
  status: "RESERVED" | "RELEASED" | "EXPIRED";
}

export interface WorkerRouteSession {
  id: string;
  warehouseId: string;
  graphId: string;
  workerId: string;
  taskId?: string;
  orderId?: string;
  operationType: "PUTAWAY" | "PICKING" | "TRANSFER" | "REPLENISHMENT";
  vehicleType: "WORKER" | "PALLET_JACK" | "REACH_TRUCK" | "FORKLIFT";
  status: "PLANNED" | "ACTIVE" | "WAITING" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  routeVersion: number;
  startNodeId: string;
  currentNodeId: string;
  endNodeId?: string;
  totalDistanceM: number;
  estimatedTravelSeconds: number;
  totalWaitSeconds: number;
  leaseExpiresAt: string;
  updatedAt: string;
  stops: WorkerRouteStop[];
  route: WorkerRouteLeg[];
}

export interface CreateWorkerRouteRequest {
  warehouseId: string;
  workerId: string;
  taskId?: string;
  orderId?: string;
  operationType: "PUTAWAY" | "PICKING" | "TRANSFER" | "REPLENISHMENT";
  vehicleType?: "WORKER" | "PALLET_JACK" | "REACH_TRUCK" | "FORKLIFT";
  locationCodes: string[];
  startNodeId?: string;
  endNodeId?: string;
}

export interface RouteProgressRequest {
  routeVersion: number;
  eventType: "HEARTBEAT" | "ARRIVED_NODE" | "STOP_COMPLETED" | "COMPLETE" | "CANCEL";
  nodeId?: string;
  locationCode?: string;
  clientEventId: string;
}

export interface RoutingStats {
  warehouseId: string;
  graphId: string;
  graphHash: string;
  datasetVersion: string;
  nodeCount: number;
  edgeCount: number;
  rackFootprints: number;
  activeSessions: number;
  reservedResources: number;
  waitingSessions: number;
  expiredSessions: number;
}

const apiRoot = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export const routingApi = {
  getGraph: (warehouseId: string, ensure = true) =>
    apiClient.get<WarehouseRoutingGraph>(
      `/routing/graph?warehouseId=${encodeURIComponent(warehouseId)}&ensure=${String(ensure)}`
    ),

  rebuildGraph: (warehouseId: string) =>
    apiClient.post<WarehouseRoutingGraph>(
      `/routing/graph/rebuild?warehouseId=${encodeURIComponent(warehouseId)}`
    ),

  createSession: (request: CreateWorkerRouteRequest) =>
    apiClient.post<WorkerRouteSession>("/routing/sessions", request),

  getSession: (sessionId: string) =>
    apiClient.get<WorkerRouteSession>(`/routing/sessions/${sessionId}`),

  progress: (sessionId: string, request: RouteProgressRequest) =>
    apiClient.post<WorkerRouteSession>(
      `/routing/sessions/${sessionId}/progress`,
      request
    ),

  cancel: (sessionId: string, routeVersion: number) =>
    apiClient.post<WorkerRouteSession>(
      `/routing/sessions/${sessionId}/cancel?routeVersion=${routeVersion}`
    ),

  getActive: (warehouseId: string) =>
    apiClient.get<WorkerRouteSession[]>(
      `/routing/active?warehouseId=${encodeURIComponent(warehouseId)}`
    ),

  getStats: (warehouseId: string) =>
    apiClient.get<RoutingStats>(
      `/routing/stats?warehouseId=${encodeURIComponent(warehouseId)}`
    ),
};

export function subscribeRoutingEvents(
  warehouseId: string,
  onEvent: (eventName: string, payload: unknown) => void,
  onError?: (error: unknown) => void
): () => void {
  const controller = new AbortController();
  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const start = async () => {
    try {
      const response = await fetch(
        `${apiRoot}/routing/events/stream?warehouseId=${encodeURIComponent(warehouseId)}`,
        {
          method: "GET",
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}`, Accept: "text/event-stream" }
            : { Accept: "text/event-stream" },
          credentials: "include",
          signal: controller.signal,
        }
      );
      if (!response.ok || !response.body) {
        throw new Error(`Routing event stream returned ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          let name = "message";
          const dataLines: string[] = [];
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) name = line.slice(6).trim();
            if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length === 0) continue;
          const raw = dataLines.join("\n");
          try {
            onEvent(name, JSON.parse(raw));
          } catch {
            onEvent(name, raw);
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) onError?.(error);
    }
  };

  void start();
  return () => controller.abort();
}
