"use client";

import { useMemo, useState } from "react";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { useAdmin } from "@/contexts/AdminContext";

type Algorithm = "astar" | "dijkstra";
type ScenarioId = "putaway" | "picking" | "conflict";
type Point = { x: number; y: number };
type CellKind = "aisle" | "rack" | "zone" | "door" | "parking" | "block";

interface RouteResult {
  cells: Point[];
  found: boolean;
  distance: number;
  turns: number;
  visited: number;
  executionMs: number;
}

interface WorkerPlan {
  id: string;
  label: string;
  color: string;
  startLabel: string;
  targetLabel: string;
  endLabel: string;
  start: Point;
  stops: Point[];
  end: Point;
}

interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  workers: [WorkerPlan, WorkerPlan];
}

const COLS = 18;
const ROWS = 12;
const CELL = 42;

const keyOf = (point: Point) => `${point.x},${point.y}`;
const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const manhattan = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const RACKS: Record<string, Point> = {
  "A-01": { x: 8, y: 2 },
  "A-02": { x: 10, y: 2 },
  "A-03": { x: 12, y: 2 },
  "A-04": { x: 14, y: 2 },
  "A-05": { x: 16, y: 2 },
  "B-01": { x: 8, y: 5 },
  "B-02": { x: 10, y: 5 },
  "B-03": { x: 12, y: 5 },
  "B-04": { x: 14, y: 5 },
  "B-05": { x: 16, y: 5 },
  "C-01": { x: 8, y: 8 },
  "C-02": { x: 10, y: 8 },
  "C-03": { x: 12, y: 8 },
  "C-04": { x: 14, y: 8 },
  "C-05": { x: 16, y: 8 },
};

const SPECIAL_CELLS: Array<{
  point: Point;
  label: string;
  kind: CellKind;
  title: string;
}> = [
  { point: { x: 0, y: 5 }, label: "DOOR", kind: "door", title: "Main door" },
  {
    point: { x: 2, y: 1 },
    label: "IN",
    kind: "zone",
    title: "Inbound wait zone",
  },
  {
    point: { x: 2, y: 9 },
    label: "PACK",
    kind: "zone",
    title: "Packing zone",
  },
  {
    point: { x: 16, y: 0 },
    label: "P",
    kind: "parking",
    title: "Outbound forklift parking",
  },
  {
    point: { x: 3, y: 10 },
    label: "P",
    kind: "parking",
    title: "Inbound forklift parking",
  },
];

// Rack rows are entirely impassable horizontally, forklifts must use aisles (y=1,4,7,10)
const BASE_BLOCKS = new Set(
  [
    // Wall pillars separating left zones from rack area
    { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }, 
    { x: 5, y: 8 }, { x: 5, y: 9 }, { x: 5, y: 10 },
    // Solid rack blocks for Row A (y=2 and y=3)
    ...Array.from({ length: 10 }, (_, i) => ({ x: 7 + i, y: 2 })),
    ...Array.from({ length: 10 }, (_, i) => ({ x: 7 + i, y: 3 })),
    // Solid rack blocks for Row B (y=5 and y=6)
    ...Array.from({ length: 10 }, (_, i) => ({ x: 7 + i, y: 5 })),
    ...Array.from({ length: 10 }, (_, i) => ({ x: 7 + i, y: 6 })),
    // Solid rack blocks for Row C (y=8 and y=9)
    ...Array.from({ length: 10 }, (_, i) => ({ x: 7 + i, y: 8 })),
    ...Array.from({ length: 10 }, (_, i) => ({ x: 7 + i, y: 9 })),
  ].map(keyOf),
);

const SCENARIOS: Scenario[] = [
  {
    id: "putaway",
    label: "Putaway from inbound",
    description:
      "Worker 1 receives from inbound wait and visits A/B slots. Worker 2 starts later from inbound parking.",
    workers: [
      {
        id: "FL-01",
        label: "Forklift 1",
        color: "#d60b52",
        startLabel: "Inbound wait",
        targetLabel: "A-03, B-04",
        endLabel: "Inbound parking",
        start: { x: 2, y: 1 },
        stops: [RACKS["A-03"], RACKS["B-04"]],
        end: { x: 3, y: 10 },
      },
      {
        id: "FL-02",
        label: "Forklift 2",
        color: "#2563eb",
        startLabel: "Inbound parking",
        targetLabel: "A-04, C-02",
        endLabel: "Packing zone",
        start: { x: 3, y: 10 },
        stops: [RACKS["A-04"], RACKS["C-02"]],
        end: { x: 2, y: 9 },
      },
    ],
  },
  {
    id: "picking",
    label: "Picking to packing",
    description:
      "Worker 1 begins at outbound forklift parking, picks slots, and returns to packing.",
    workers: [
      {
        id: "FL-01",
        label: "Picker 1",
        color: "#d60b52",
        startLabel: "Outbound parking",
        targetLabel: "A-05, C-04",
        endLabel: "Packing zone",
        start: { x: 16, y: 0 },
        stops: [RACKS["A-05"], RACKS["C-04"]],
        end: { x: 2, y: 9 },
      },
      {
        id: "FL-02",
        label: "Picker 2",
        color: "#2563eb",
        startLabel: "Outbound parking",
        targetLabel: "B-05, C-05",
        endLabel: "Packing zone",
        start: { x: 16, y: 0 },
        stops: [RACKS["B-05"], RACKS["C-05"]],
        end: { x: 2, y: 9 },
      },
    ],
  },
  {
    id: "conflict",
    label: "Multi-forklift conflict test",
    description:
      "Both workers want the same central aisle. Toggle avoidance to force the second route around the active path.",
    workers: [
      {
        id: "FL-01",
        label: "Worker 1",
        color: "#d60b52",
        startLabel: "Inbound wait",
        targetLabel: "B-03",
        endLabel: "Outbound parking",
        start: { x: 2, y: 1 },
        stops: [RACKS["B-03"]],
        end: { x: 16, y: 0 },
      },
      {
        id: "FL-02",
        label: "Worker 2",
        color: "#2563eb",
        startLabel: "Packing zone",
        targetLabel: "B-04",
        endLabel: "Outbound parking",
        start: { x: 2, y: 9 },
        stops: [RACKS["B-04"]],
        end: { x: 16, y: 0 },
      },
    ],
  },
];

function isCorePoint(point: Point, worker: WorkerPlan) {
  return (
    samePoint(point, worker.start) ||
    samePoint(point, worker.end) ||
    worker.stops.some((stop) => samePoint(stop, point))
  );
}

function neighbors(point: Point) {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ].filter((next) => next.x >= 0 && next.x < COLS && next.y >= 0 && next.y < ROWS);
}

function reconstruct(cameFrom: Map<string, string>, currentKey: string) {
  const path: Point[] = [];
  let cursor = currentKey;
  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    path.unshift({ x, y });
    const previous = cameFrom.get(cursor);
    if (!previous) break;
    cursor = previous;
  }
  return path;
}

function findLeg(
  start: Point,
  goal: Point,
  algorithm: Algorithm,
  avoidCells: Set<string>,
  allowedAvoidKeys: Set<string>,
) {
  const startAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const startKey = keyOf(start);
  const goalKey = keyOf(goal);
  const open = new Set<string>([startKey]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([
    [startKey, algorithm === "astar" ? manhattan(start, goal) : 0],
  ]);
  let visited = 0;

  while (open.size > 0) {
    const currentKey = Array.from(open).sort(
      (a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity),
    )[0];
    const [cx, cy] = currentKey.split(",").map(Number);
    const current = { x: cx, y: cy };
    visited += 1;

    if (currentKey === goalKey) {
      return {
        path: reconstruct(cameFrom, currentKey),
        visited,
        executionMs:
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          startAt,
      };
    }

    open.delete(currentKey);

    for (const next of neighbors(current)) {
      const nextKey = keyOf(next);
      if (BASE_BLOCKS.has(nextKey) && nextKey !== goalKey && nextKey !== startKey) continue;

      const avoidPenalty =
        avoidCells.has(nextKey) && !allowedAvoidKeys.has(nextKey) ? 4 : 0;
      const tentative = (gScore.get(currentKey) ?? Infinity) + 1 + avoidPenalty;

      if (tentative < (gScore.get(nextKey) ?? Infinity)) {
        cameFrom.set(nextKey, currentKey);
        gScore.set(nextKey, tentative);
        fScore.set(
          nextKey,
          tentative + (algorithm === "astar" ? manhattan(next, goal) : 0),
        );
        open.add(nextKey);
      }
    }
  }

  return {
    path: [] as Point[],
    visited,
    executionMs:
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      startAt,
  };
}

function routeForWorker(
  worker: WorkerPlan,
  algorithm: Algorithm,
  avoidCells: Set<string>,
) {
  const allowedAvoidKeys = new Set(
    [worker.start, worker.end, ...worker.stops].map(keyOf),
  );
  const targets = [...worker.stops, worker.end];
  let cursor = worker.start;
  let fullPath: Point[] = [];
  let visited = 0;
  let executionMs = 0;

  for (const target of targets) {
    const leg = findLeg(cursor, target, algorithm, avoidCells, allowedAvoidKeys);
    visited += leg.visited;
    executionMs += leg.executionMs;

    if (leg.path.length === 0) {
      return {
        cells: fullPath,
        found: false,
        distance: fullPath.length,
        turns: countTurns(fullPath),
        visited,
        executionMs,
      };
    }

    fullPath = fullPath.length ? [...fullPath, ...leg.path.slice(1)] : leg.path;
    cursor = target;
  }

  return {
    cells: fullPath,
    found: true,
    distance: Math.max(fullPath.length - 1, 0),
    turns: countTurns(fullPath),
    visited,
    executionMs,
  };
}

function countTurns(path: Point[]) {
  let turns = 0;
  for (let index = 2; index < path.length; index += 1) {
    const previous = path[index - 2];
    const current = path[index - 1];
    const next = path[index];
    const dx1 = current.x - previous.x;
    const dy1 = current.y - previous.y;
    const dx2 = next.x - current.x;
    const dy2 = next.y - current.y;
    if (dx1 !== dx2 || dy1 !== dy2) turns += 1;
  }
  return turns;
}

function center(point: Point) {
  return `${point.x * CELL + CELL / 2},${point.y * CELL + CELL / 2}`;
}

function routePoints(route: Point[]) {
  return route.map(center).join(" ");
}

function compactPath(route: Point[]) {
  if (route.length <= 8) return route.map(keyOf).join(" -> ");
  return `${route.slice(0, 4).map(keyOf).join(" -> ")} -> ... -> ${route
    .slice(-3)
    .map(keyOf)
    .join(" -> ")}`;
}

export default function AdminPathfindingPage() {
  const { hasPermission } = useAdmin();
  const canView = hasPermission(ADMIN_ROUTES.PATHFINDING, "view");
  const [scenarioId, setScenarioId] = useState<ScenarioId>("picking");
  const [algorithm, setAlgorithm] = useState<Algorithm>("astar");
  const [workerCount, setWorkerCount] = useState<1 | 2>(1);
  const [avoidActiveRoutes, setAvoidActiveRoutes] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [runCounter, setRunCounter] = useState(0);

  const scenario =
    SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0];

  const simulation = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _trigger = runCounter; // depend on run button clicks
    const first = routeForWorker(scenario.workers[0], algorithm, new Set());
    const firstRouteKeys = new Set(first.cells.map(keyOf));

    if (workerCount === 1) {
      return {
        first,
        second: null as RouteResult | null,
        overlap: [] as string[],
        activeRouteKeys: firstRouteKeys,
        totalMs: first.executionMs,
      };
    }

    const secondAvoidCells = avoidActiveRoutes ? firstRouteKeys : new Set<string>();
    const second = routeForWorker(scenario.workers[1], algorithm, secondAvoidCells);
    const secondRouteKeys = new Set(second.cells.map(keyOf));
    const coreKeys = new Set(
      scenario.workers
        .flatMap((worker) => [worker.start, worker.end, ...worker.stops])
        .map(keyOf),
    );
    const overlap = Array.from(firstRouteKeys).filter(
      (key) => secondRouteKeys.has(key) && !coreKeys.has(key),
    );

    return {
      first,
      second,
      overlap,
      activeRouteKeys: firstRouteKeys,
      totalMs: first.executionMs + second.executionMs,
    };
  }, [algorithm, avoidActiveRoutes, scenario, workerCount, runCounter]);

  const rackLabels = useMemo(
    () =>
      Object.entries(RACKS).reduce<Record<string, string>>((acc, [label, point]) => {
        acc[keyOf(point)] = label;
        return acc;
      }, {}),
    [],
  );

  const specialLabels = useMemo(
    () =>
      SPECIAL_CELLS.reduce<Record<string, (typeof SPECIAL_CELLS)[number]>>(
        (acc, item) => {
          acc[keyOf(item.point)] = item;
          return acc;
        },
        {},
      ),
    [],
  );

  if (!canView) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-lg text-base-content/60">
          You do not have permission to view pathfinding controls.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Warehouse operations
            </p>
            <h1 className="mt-1 text-3xl font-bold text-base-content">
              Pathfinding Lab
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-base-content/60">
              Test A* and Dijkstra routes on a synthetic warehouse coordinate
              map, then verify whether a second forklift route collides with an
              active path or reroutes around it.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Algorithm" value={algorithm === "astar" ? "A*" : "Dijkstra"} />
            <Metric
              label="Overlap cells"
              value={simulation.overlap.length.toString()}
              tone={simulation.overlap.length ? "warning" : "success"}
            />
            <Metric
              label="Visited nodes"
              value={(simulation.first.visited + (simulation.second?.visited ?? 0)).toString()}
            />
            <Metric label="Runtime" value={`${simulation.totalMs.toFixed(2)} ms`} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <section className="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Simulation controls</h2>
            <div className="mt-4 space-y-4">
              <label className="form-control">
                <span className="label-text font-medium">Scenario</span>
                <select
                  className="select select-bordered mt-1"
                  value={scenarioId}
                  onChange={(event) => setScenarioId(event.target.value as ScenarioId)}
                >
                  {SCENARIOS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text font-medium">Algorithm</span>
                <select
                  className="select select-bordered mt-1"
                  value={algorithm}
                  onChange={(event) => setAlgorithm(event.target.value as Algorithm)}
                >
                  <option value="astar">A* with Manhattan heuristic</option>
                  <option value="dijkstra">Dijkstra baseline</option>
                </select>
              </label>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-base-300 p-3 mt-4">
                <span>
                  <span className="block font-medium">Simulate Collision (Worker 2)</span>
                  <span className="block text-xs text-base-content/60">
                    Add a second forklift to test path overlap
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="toggle toggle-secondary"
                  checked={workerCount === 2}
                  onChange={(event) => setWorkerCount(event.target.checked ? 2 : 1)}
                />
              </label>

              {workerCount === 2 && (
                <label className="flex items-center justify-between gap-3 rounded-lg border border-base-300 p-3 mt-3">
                  <span>
                    <span className="block font-medium">Avoid active path</span>
                    <span className="block text-xs text-base-content/60">
                      Adds moderate cost to active routes to prefer empty aisles
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={avoidActiveRoutes}
                    onChange={(event) => setAvoidActiveRoutes(event.target.checked)}
                  />
                </label>
              )}

              <label className="flex items-center justify-between gap-3 rounded-lg border border-base-300 p-3 mt-3">
                <span className="font-medium">Show grid coordinates</span>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={showCoordinates}
                  onChange={(event) => setShowCoordinates(event.target.checked)}
                />
              </label>
            </div>

            <button
              className="btn btn-primary w-full mt-4"
              onClick={() => setRunCounter((c) => c + 1)}
            >
              ▶ Run Pathfinding
            </button>

            <div className="mt-5 rounded-lg bg-base-200 p-4 text-sm">
              <p className="font-semibold text-base-content">{scenario.label}</p>
              <p className="mt-1 text-base-content/70">{scenario.description}</p>
            </div>

            <div className="mt-5 space-y-3">
              <RouteSummary worker={scenario.workers[0]} route={simulation.first} />
              {workerCount === 2 && simulation.second && (
                <RouteSummary worker={scenario.workers[1]} route={simulation.second} />
              )}
            </div>

            <div
              className={`mt-5 rounded-lg border p-4 text-sm ${
                simulation.overlap.length
                  ? "border-warning/40 bg-warning/10 text-warning-content"
                  : "border-success/30 bg-success/10 text-success-content"
              }`}
            >
              <p className="font-semibold">
                {simulation.overlap.length
                  ? "Route overlap detected"
                  : "No route overlap detected"}
              </p>
              <p className="mt-1">
                {simulation.overlap.length
                  ? `Shared cells: ${simulation.overlap.join(", ")}`
                  : avoidActiveRoutes
                    ? "Second route avoided the active forklift path."
                    : "The selected scenario does not collide in the current mode."}
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-semibold">Bird-view warehouse map</h2>
                <p className="text-sm text-base-content/60">
                  Synthetic coordinates represent the real rack logic until
                  physical survey coordinates are connected.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Legend color="#d60b52" label="Route 1" />
                <Legend color="#2563eb" label="Route 2" />
                <Legend color="#f59e0b" label="Overlap" />
                <Legend color="#cbd5e1" label="Rack block" />
              </div>
            </div>

            <div className="mt-4 overflow-auto rounded-lg border border-base-300 bg-white p-3">
              <svg
                viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
                className="min-w-[756px]"
                role="img"
                aria-label="Warehouse pathfinding map"
              >
                <defs>
                  <marker
                    id="arrow-one"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L0,6 L7,3 z" fill="#d60b52" />
                  </marker>
                  <marker
                    id="arrow-two"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L0,6 L7,3 z" fill="#2563eb" />
                  </marker>
                </defs>

                {Array.from({ length: ROWS }).map((_, y) =>
                  Array.from({ length: COLS }).map((__, x) => {
                    const point = { x, y };
                    const key = keyOf(point);
                    const rackLabel = rackLabels[key];
                    const special = specialLabels[key];
                    const isBlock = BASE_BLOCKS.has(key);
                    const isOverlap = simulation.overlap.includes(key);
                    const isCongested =
                      workerCount === 2 && avoidActiveRoutes && simulation.activeRouteKeys.has(key);
                    const coreOne = isCorePoint(point, scenario.workers[0]);
                    const coreTwo = workerCount === 2 ? isCorePoint(point, scenario.workers[1]) : false;

                    let fill = "#ffffff";
                    let stroke = "#e5e7eb";
                    if (isBlock) fill = "#e2e8f0";
                    if (rackLabel) { fill = "#dbeafe"; stroke = "#93c5fd"; }
                    if (special?.kind === "zone") fill = "#dcfce7";
                    if (special?.kind === "parking") { fill = "#fee2e2"; stroke = "#fca5a5"; }
                    if (special?.kind === "door") fill = "#fee2e2";
                    if (isCongested && !isBlock && !rackLabel) fill = "#ffe4e6";
                    if (isOverlap && workerCount === 2) {
                      fill = "#fbbf24";
                      stroke = "#b45309";
                    }
                    if (coreOne || coreTwo) stroke = "#111827";

                    return (
                      <g key={key}>
                        <rect
                          x={x * CELL}
                          y={y * CELL}
                          width={CELL}
                          height={CELL}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={isOverlap || coreOne || coreTwo ? 2 : 1}
                        />
                        {rackLabel && (
                          <text
                            x={x * CELL + CELL / 2}
                            y={y * CELL + CELL / 2 - 2}
                            textAnchor="middle"
                            className="fill-slate-700 text-[9px] font-semibold"
                          >
                            {rackLabel}
                          </text>
                        )}
                        {special && (
                          <text
                            x={x * CELL + CELL / 2}
                            y={y * CELL + CELL / 2 + 4}
                            textAnchor="middle"
                            className="fill-slate-900 text-[9px] font-bold"
                          >
                            {special.label}
                          </text>
                        )}
                        {showCoordinates && !rackLabel && !special && !isBlock && (
                          <text
                            x={x * CELL + CELL / 2}
                            y={y * CELL + CELL / 2 + 3}
                            textAnchor="middle"
                            className="fill-slate-400 text-[8px]"
                          >
                            {key}
                          </text>
                        )}
                      </g>
                    );
                  }),
                )}

                {simulation.first.cells.length > 1 && (
                  <polyline
                    points={routePoints(simulation.first.cells)}
                    fill="none"
                    stroke="#d60b52"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd="url(#arrow-one)"
                    className="route-line"
                  />
                )}
                {workerCount === 2 && simulation.second && simulation.second.cells.length > 1 && (
                  <polyline
                    points={routePoints(simulation.second.cells)}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd="url(#arrow-two)"
                    className="route-line route-line-two"
                  />
                )}
              </svg>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .route-line {
          stroke-dasharray: 14 10;
          animation: march 1s linear infinite;
        }
        .route-line-two {
          animation-duration: 1.25s;
        }
        @keyframes march {
          to {
            stroke-dashoffset: -24;
          }
        }
      `}</style>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-base-content";

  return (
    <div className="rounded-lg border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-base-300 px-3 py-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function RouteSummary({
  worker,
  route,
}: {
  worker: WorkerPlan;
  route: RouteResult;
}) {
  return (
    <div className="rounded-lg border border-base-300 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold" style={{ color: worker.color }}>
            {worker.label} ({worker.id})
          </p>
          <p className="mt-1 text-xs text-base-content/60">
            {worker.startLabel} {"->"} {worker.targetLabel} {"->"} {worker.endLabel}
          </p>
        </div>
        <span
          className={`badge ${route.found ? "badge-success" : "badge-error"} badge-outline`}
        >
          {route.found ? "Found" : "No path"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-base-content/50">Distance</p>
          <p className="font-semibold">{route.distance}</p>
        </div>
        <div>
          <p className="text-xs text-base-content/50">Turns</p>
          <p className="font-semibold">{route.turns}</p>
        </div>
        <div>
          <p className="text-xs text-base-content/50">Runtime</p>
          <p className="font-semibold">{route.executionMs.toFixed(2)} ms</p>
        </div>
      </div>
      <p className="mt-3 break-words rounded bg-base-200 p-2 text-xs text-base-content/60">
        {compactPath(route.cells)}
      </p>
    </div>
  );
}
