export type RouteOperation = "putaway" | "picking";

export interface GridCoord {
  x: number;
  y: number;
}

export interface RouteStation {
  id: string;
  label: string;
  shortLabel: string;
  type: "inbound-wait" | "packing" | "door" | "inbound-park" | "outbound-park" | "outbound-zone";
  coord: GridCoord;
  width: number;
  height: number;
}

export interface RouteRack {
  id: string;
  zone: "A" | "B" | "C";
  row: number;
  bay: number;
  coord: GridCoord;
  width: number;
  height: number;
}

export interface ParsedRouteLocation {
  raw: string;
  zone: "A" | "B" | "C";
  row: number;
  bay: number;
  level?: number;
  position?: string;
  rackId: string;
  access: GridCoord;
  rackCenter: GridCoord;
}

export interface RouteSegment {
  from: string;
  to: string;
  path: GridCoord[];
  distance: number;
}

export type PathfindingAlgorithm = "astar" | "dijkstra";

export interface OptimizedRoute {
  operation: RouteOperation;
  start: RouteStation;
  end?: RouteStation;
  stops: ParsedRouteLocation[];
  orderedStops: ParsedRouteLocation[];
  segments: RouteSegment[];
  path: GridCoord[];
  distance: number;
  blockedCellsUsed: GridCoord[];
  totalVisitedNodes: number;
  totalRuntimeMs: number;
  overlapCells: GridCoord[];
}

export interface RoutePreset {
  id: string;
  name: string;
  description: string;
  operation: RouteOperation;
  locationCodes: string[];
}

export const ROUTE_PRESETS: RoutePreset[] = [
  {
    id: "putaway-2-items-near",
    name: "Putaway: 2 items (nearby)",
    description: "Place 2 items in Zone A, close bays",
    operation: "putaway",
    locationCodes: ["A-01-02-1-A", "A-01-04-2-B"],
  },
  {
    id: "putaway-3-items-spread",
    name: "Putaway: 3 items (spread)",
    description: "Place 3 items across all zones",
    operation: "putaway",
    locationCodes: ["A-02-01-1-A", "B-01-03-2-A", "C-02-05-1-B"],
  },
  {
    id: "picking-2-items-same-zone",
    name: "Picking: 2 items → Packing",
    description: "Pick from Zone B, then go to Packing",
    operation: "picking",
    locationCodes: ["B-01-02-1-A", "B-02-04-1-B"],
  },
  {
    id: "picking-3-items-cross-zone",
    name: "Picking: 3 items → Packing",
    description: "Pick across zones A & C, then Packing",
    operation: "picking",
    locationCodes: ["A-01-05-1-A", "C-01-02-2-A", "C-02-04-1-B"],
  },
];

const GRID_WIDTH = 28;
const GRID_HEIGHT = 18;
const RACK_BAYS = 5;
const ZONE_START_Y: Record<"A" | "B" | "C", number> = { A: 4, B: 8, C: 12 };
const RACK_X_START = 15;

export const WAREHOUSE_ROUTE_GRID = {
  width: GRID_WIDTH,
  height: GRID_HEIGHT,
  cellSize: 28,
};

export const ROUTE_STATIONS: RouteStation[] = [
  {
    id: "INBOUND_WAIT",
    label: "Inbound Wait Zone",
    shortLabel: "IN",
    type: "inbound-wait",
    coord: { x: 4, y: 5 },
    width: 5,
    height: 3,
  },
  {
    id: "PACKING",
    label: "Packing Zone",
    shortLabel: "PK",
    type: "packing",
    coord: { x: 4, y: 13 },
    width: 6,
    height: 3,
  },
  {
    id: "MAIN_DOOR",
    label: "Main Door",
    shortLabel: "DR",
    type: "door",
    coord: { x: 0, y: 8 },
    width: 2,
    height: 2,
  },
  {
    id: "INBOUND_PARK",
    label: "Parking",
    shortLabel: "P",
    type: "inbound-park",
    coord: { x: 3, y: 2 },
    width: 4,
    height: 2,
  },
  {
    id: "OUTBOUND_PARK",
    label: "Parking",
    shortLabel: "P",
    type: "outbound-park",
    coord: { x: 21, y: 2 },
    width: 4,
    height: 2,
  },
  {
    id: "OUTBOUND_ZONE",
    label: "Outbound Zone",
    shortLabel: "OUT",
    type: "outbound-zone",
    coord: { x: 3, y: 1 },
    width: 5,
    height: 2,
  },
];

export const ROUTE_RACKS: RouteRack[] = (["A", "B", "C"] as const).flatMap((zone) =>
  Array.from({ length: 2 }).flatMap((_, rowIndex) =>
    Array.from({ length: RACK_BAYS }).map((__, bayIndex) => ({
      id: `${zone}-${String(rowIndex + 1).padStart(2, "0")}-${String(bayIndex + 1).padStart(2, "0")}`,
      zone,
      row: rowIndex + 1,
      bay: bayIndex + 1,
      coord: { x: RACK_X_START + bayIndex * 2, y: ZONE_START_Y[zone] + rowIndex * 2 },
      width: 2,
      height: 1,
    }))
  )
);

const stationById = new Map(ROUTE_STATIONS.map((station) => [station.id, station]));
const rackByKey = new Map(ROUTE_RACKS.map((rack) => [`${rack.zone}:${rack.row}:${rack.bay}`, rack]));

export const getRouteStation = (id: string): RouteStation => {
  const station = stationById.get(id);
  if (!station) throw new Error(`Unknown route station: ${id}`);
  return station;
};

export const parseRouteLocation = (code?: string | null): ParsedRouteLocation | null => {
  if (!code) return null;
  const raw = code.trim().toUpperCase();
  const match = raw.match(/(?:^|[-_])([ABC])[-_]?(\d{1,2})[-_]?(\d{1,2})(?:[-_](\d{1,2}))?(?:[-_]([A-Z]))?/);
  if (!match) return null;

  const zone = match[1] as "A" | "B" | "C";
  const row = Math.max(1, Math.min(Number(match[2]) || 1, 2));
  const bay = Math.max(1, Math.min(Number(match[3]) || 1, RACK_BAYS));
  const rack = rackByKey.get(`${zone}:${row}:${bay}`) ?? rackByKey.get(`${zone}:1:${bay}`);
  if (!rack) return null;

  // Access is on the aisle row between the two rack rows
  const accessY = rack.coord.y + (row === 1 ? 1 : -1);

  return {
    raw,
    zone,
    row,
    bay,
    level: match[4] ? Number(match[4]) : undefined,
    position: match[5],
    rackId: rack.id,
    access: { x: rack.coord.x, y: accessY },
    rackCenter: { x: rack.coord.x + rack.width / 2, y: rack.coord.y + rack.height / 2 },
  };
};

const key = (coord: GridCoord) => `${coord.x}:${coord.y}`;
const manhattan = (a: GridCoord, b: GridCoord) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const blockedCells = (): Set<string> => {
  const blocked = new Set<string>();
  ROUTE_RACKS.forEach((rack) => {
    for (let x = rack.coord.x; x < rack.coord.x + rack.width; x += 1) {
      for (let y = rack.coord.y; y < rack.coord.y + rack.height; y += 1) {
        blocked.add(key({ x, y }));
      }
    }
  });
  return blocked;
};

const neighbors = (coord: GridCoord, blocked: Set<string>): GridCoord[] => {
  const candidates = [
    { x: coord.x + 1, y: coord.y },
    { x: coord.x - 1, y: coord.y },
    { x: coord.x, y: coord.y + 1 },
    { x: coord.x, y: coord.y - 1 },
  ];
  return candidates.filter(
    (candidate) =>
      candidate.x >= 1 &&
      candidate.x < GRID_WIDTH - 1 &&
      candidate.y >= 1 &&
      candidate.y < GRID_HEIGHT - 1 &&
      !blocked.has(key(candidate))
  );
};

export interface PathfindingResult {
  path: GridCoord[];
  visitedNodes: number;
  runtimeMs: number;
  algorithm: PathfindingAlgorithm;
}

export const findGridPathAStar = (
  start: GridCoord,
  end: GridCoord,
  dynamicBlocked: GridCoord[] = []
): PathfindingResult => {
  const startTime = performance.now();
  const blocked = blockedCells();
  dynamicBlocked.forEach((coord) => {
    if ((coord.x !== start.x || coord.y !== start.y) && (coord.x !== end.x || coord.y !== end.y)) {
      blocked.add(key(coord));
    }
  });

  const open = new Map<string, GridCoord>([[key(start), start]]);
  const cameFrom = new Map<string, GridCoord>();
  const gScore = new Map<string, number>([[key(start), 0]]);
  const fScore = new Map<string, number>([[key(start), manhattan(start, end)]]);
  let visitedNodes = 0;

  while (open.size > 0) {
    const current = Array.from(open.values()).reduce((best, point) =>
      (fScore.get(key(point)) ?? Number.MAX_SAFE_INTEGER) < (fScore.get(key(best)) ?? Number.MAX_SAFE_INTEGER)
        ? point
        : best
    );

    visitedNodes++;

    if (current.x === end.x && current.y === end.y) {
      const path = [current];
      let currentKey = key(current);
      while (cameFrom.has(currentKey)) {
        const previous = cameFrom.get(currentKey)!;
        path.unshift(previous);
        currentKey = key(previous);
      }
      return { path, visitedNodes, runtimeMs: performance.now() - startTime, algorithm: "astar" };
    }

    open.delete(key(current));
    neighbors(current, blocked).forEach((next) => {
      const tentative = (gScore.get(key(current)) ?? Number.MAX_SAFE_INTEGER) + 1;
      if (tentative < (gScore.get(key(next)) ?? Number.MAX_SAFE_INTEGER)) {
        cameFrom.set(key(next), current);
        gScore.set(key(next), tentative);
        fScore.set(key(next), tentative + manhattan(next, end));
        if (!open.has(key(next))) open.set(key(next), next);
      }
    });
  }

  return { path: [start, end], visitedNodes, runtimeMs: performance.now() - startTime, algorithm: "astar" };
};

export const findGridPathDijkstra = (
  start: GridCoord,
  end: GridCoord,
  dynamicBlocked: GridCoord[] = []
): PathfindingResult => {
  const startTime = performance.now();
  const blocked = blockedCells();
  dynamicBlocked.forEach((coord) => {
    if ((coord.x !== start.x || coord.y !== start.y) && (coord.x !== end.x || coord.y !== end.y)) {
      blocked.add(key(coord));
    }
  });

  const open = new Map<string, GridCoord>([[key(start), start]]);
  const cameFrom = new Map<string, GridCoord>();
  const gScore = new Map<string, number>([[key(start), 0]]);
  let visitedNodes = 0;

  while (open.size > 0) {
    const current = Array.from(open.values()).reduce((best, point) =>
      (gScore.get(key(point)) ?? Number.MAX_SAFE_INTEGER) < (gScore.get(key(best)) ?? Number.MAX_SAFE_INTEGER)
        ? point
        : best
    );

    visitedNodes++;

    if (current.x === end.x && current.y === end.y) {
      const path = [current];
      let currentKey = key(current);
      while (cameFrom.has(currentKey)) {
        const previous = cameFrom.get(currentKey)!;
        path.unshift(previous);
        currentKey = key(previous);
      }
      return { path, visitedNodes, runtimeMs: performance.now() - startTime, algorithm: "dijkstra" };
    }

    open.delete(key(current));
    neighbors(current, blocked).forEach((next) => {
      const tentative = (gScore.get(key(current)) ?? Number.MAX_SAFE_INTEGER) + 1;
      if (tentative < (gScore.get(key(next)) ?? Number.MAX_SAFE_INTEGER)) {
        cameFrom.set(key(next), current);
        gScore.set(key(next), tentative);
        if (!open.has(key(next))) open.set(key(next), next);
      }
    });
  }

  return { path: [start, end], visitedNodes, runtimeMs: performance.now() - startTime, algorithm: "dijkstra" };
};

export const optimizeWarehouseRoute = ({
  operation,
  locationCodes,
  completedLocationCodes = [],
  avoidPath = [],
  algorithm = "astar",
}: {
  operation: RouteOperation;
  locationCodes: Array<string | null | undefined>;
  completedLocationCodes?: Array<string | null | undefined>;
  avoidPath?: GridCoord[];
  algorithm?: PathfindingAlgorithm;
}): OptimizedRoute | null => {
  const start = operation === "putaway" ? getRouteStation("INBOUND_WAIT") : getRouteStation("OUTBOUND_PARK");
  const end = operation === "picking" ? getRouteStation("PACKING") : undefined;
  const completed = new Set(
    completedLocationCodes
      .map((locationCode) => parseRouteLocation(locationCode)?.raw)
      .filter((value): value is string => !!value)
  );
  const stops = locationCodes
    .map((locationCode) => parseRouteLocation(locationCode))
    .filter((value): value is ParsedRouteLocation => !!value)
    .filter((location, index, array) => array.findIndex((item) => item.raw === location.raw) === index)
    .filter((location) => !completed.has(location.raw));

  if (stops.length === 0) return null;

  const orderedStops: ParsedRouteLocation[] = [];
  const remaining = [...stops];
  let cursor = centerOfStation(start);
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestCost = Number.MAX_SAFE_INTEGER;
    remaining.forEach((stop, index) => {
      const cost = manhattan(cursor, stop.access);
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = index;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    orderedStops.push(next);
    cursor = next.access;
  }

  const points = [centerOfStation(start), ...orderedStops.map((stop) => stop.access)];
  if (end) points.push(centerOfStation(end));

  const segments: RouteSegment[] = [];
  const path: GridCoord[] = [];
  let totalVisitedNodes = 0;
  let totalRuntimeMs = 0;

  const pathfindingFn = algorithm === "dijkstra" ? findGridPathDijkstra : findGridPathAStar;

  for (let index = 0; index < points.length - 1; index += 1) {
    const fromPoint = points[index];
    const toPoint = points[index + 1];
    
    const result = pathfindingFn(fromPoint, toPoint, avoidPath);
    totalVisitedNodes += result.visitedNodes;
    totalRuntimeMs += result.runtimeMs;
    
    const segmentPath = result.path;
    const from = index === 0 ? start.label : orderedStops[index - 1]?.rackId ?? "Start";
    const to =
      index < orderedStops.length
        ? `${orderedStops[index].rackId}`
        : end?.label ?? "End";
    segments.push({ from, to, path: segmentPath, distance: Math.max(segmentPath.length - 1, 0) });
    path.push(...(path.length > 0 ? segmentPath.slice(1) : segmentPath));
  }

  const overlapCells = path.filter(p => avoidPath.some(ap => ap.x === p.x && ap.y === p.y));

  return {
    operation,
    start,
    end,
    stops,
    orderedStops,
    segments,
    path,
    distance: segments.reduce((sum, segment) => sum + segment.distance, 0),
    blockedCellsUsed: avoidPath,
    totalVisitedNodes,
    totalRuntimeMs,
    overlapCells,
  };
};

export const centerOfStation = (station: RouteStation): GridCoord => ({
  x: Math.round(station.coord.x + station.width / 2),
  y: Math.round(station.coord.y + station.height / 2),
});

export const buildRouteInstruction = (route: OptimizedRoute): string[] => {
  const firstStop = route.orderedStops[0];
  const lines = [`Start at ${route.start.label}.`];
  if (firstStop) {
    lines.push(`Go to ${firstStop.rackId} via aisle.`);
  }
  if (route.orderedStops.length > 1) {
    lines.push(`Then follow the marked route through ${route.orderedStops.length - 1} more location(s).`);
  }
  if (route.operation === "picking") {
    lines.push("Finish at Packing Zone.");
  }
  lines.push(`Estimated grid distance: ${route.distance} points.`);
  return lines;
};
