/**
 * Path Optimization Service Client
 * Typed API client for all pathfinding endpoints (port 8081)
 * Falls back to local BFS if the service is unavailable.
 */

const PATH_SERVICE_URL = process.env.NEXT_PUBLIC_PATH_SERVICE_URL || 'http://localhost:8081';

export interface PathNode {
  node_id: string;
  row: number;
  col: number;
  cost: number;
}

export interface TurnByTurnStep {
  step_number: number;
  instruction: string;
  from_node: string;
  to_node: string;
  direction: string;
  distance: number;
}

export interface PathResponse {
  path_found: boolean;
  path: PathNode[];
  path_length: number;
  total_cost: number;
  execution_time_ms: number;
  message: string;
  node_count?: number;
  turn_by_turn?: TurnByTurnStep[];
  estimated_travel_seconds?: number;
}

export interface PickStop {
  node_id: string;
  label?: string;
  quantity?: number;
  sku?: string;
}

export interface StopSegment {
  from_stop: string;
  to_stop: string;
  segment_path: PathNode[];
  segment_cost: number;
  turn_by_turn: TurnByTurnStep[];
}

export interface MultiStopResponse {
  route_found: boolean;
  ordered_stops: string[];
  segments: StopSegment[];
  total_path: PathNode[];
  total_cost: number;
  total_steps: number;
  estimated_travel_seconds: number;
  execution_time_ms: number;
  message: string;
  optimization_method: string;
}

export interface PutawaySuggestion {
  node_id: string;
  travel_cost: number;
  estimated_travel_seconds: number;
  path_to_location: PathNode[];
  turn_by_turn: TurnByTurnStep[];
  rank: number;
}

export interface PutawaySuggestResponse {
  suggestions: PutawaySuggestion[];
  best_location: string;
  execution_time_ms: number;
  message: string;
}

export interface Constraint {
  avoid_congestion?: boolean;
  avoid_narrow_aisles?: boolean;
  worker_type?: 'picker' | 'forklift';
}

// ─── API calls ─────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${PATH_SERVICE_URL}/api/pathfinding${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Path service ${path} returned ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${PATH_SERVICE_URL}/api/pathfinding${path}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Path service GET ${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

// ─── Single-path ────────────────────────────────────────────────────────────

export async function optimizePath(
  start: string,
  end: string,
  warehouseConfig: unknown,
  constraints?: Constraint,
  blockedLocations?: { node_id?: string }[]
): Promise<PathResponse> {
  return post<PathResponse>('/optimize', {
    start,
    end,
    warehouse_config: warehouseConfig,
    constraints,
    blocked_locations: blockedLocations,
  });
}

// ─── Multi-stop picking ──────────────────────────────────────────────────────

export async function optimizeMultiStop(
  start: string,
  end: string,
  stops: PickStop[],
  warehouseConfig: unknown,
  constraints?: Constraint,
  blockedLocations?: { node_id?: string }[]
): Promise<MultiStopResponse> {
  return post<MultiStopResponse>('/multi-stop', {
    start,
    end,
    stops,
    warehouse_config: warehouseConfig,
    constraints,
    blocked_locations: blockedLocations,
  });
}

// ─── Putaway suggestion ──────────────────────────────────────────────────────

export async function suggestPutaway(
  start: string,
  availableLocations: string[],
  warehouseConfig: unknown,
  constraints?: Constraint
): Promise<PutawaySuggestResponse> {
  return post<PutawaySuggestResponse>('/putaway-suggest', {
    start,
    available_locations: availableLocations,
    warehouse_config: warehouseConfig,
    constraints,
  });
}

// ─── Service health ──────────────────────────────────────────────────────────

export async function getPathServiceHealth(): Promise<{ status: string }> {
  const res = await fetch(`${PATH_SERVICE_URL}/health/`, {
    signal: AbortSignal.timeout(3000),
  });
  return res.json();
}

export async function getPathServiceStats(): Promise<unknown> {
  return get<unknown>('/stats');
}

// ─── Local BFS fallback ──────────────────────────────────────────────────────
// Used when the Python service is unavailable.

interface LocalNode { id: string; row: number; col: number; type: string; walkable: boolean; }
interface LocalEdge { from: string; to: string; cost: number; }

function localBFS(
  start: string,
  end: string,
  nodes: LocalNode[],
  edges: LocalEdge[]
): PathResponse {
  const t0 = performance.now();
  const adj: Record<string, { to: string; cost: number }[]> = {};
  for (const n of nodes) adj[n.id] = [];
  for (const e of edges) {
    adj[e.from]?.push({ to: e.to, cost: e.cost });
    adj[e.to]?.push({ to: e.from, cost: e.cost });
  }

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const n of nodes) { dist[n.id] = Infinity; prev[n.id] = null; }
  dist[start] = 0;

  const queue = [start];
  const visited = new Set<string>();

  while (queue.length) {
    queue.sort((a, b) => dist[a] - dist[b]);
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    if (curr === end) break;
    for (const { to, cost } of (adj[curr] || [])) {
      const node = nodes.find(n => n.id === to);
      if (!node?.walkable) continue;
      const newDist = dist[curr] + cost;
      if (newDist < dist[to]) {
        dist[to] = newDist;
        prev[to] = curr;
        if (!visited.has(to)) queue.push(to);
      }
    }
  }

  if (dist[end] === Infinity) {
    return {
      path_found: false, path: [], path_length: 0,
      total_cost: 0, execution_time_ms: performance.now() - t0,
      message: `[Local fallback] No path from ${start} to ${end}`,
    };
  }

  const pathIds: string[] = [];
  let cur: string | null = end;
  while (cur) { pathIds.unshift(cur); cur = prev[cur]; }

  const pathDTOs: PathNode[] = pathIds.map(id => {
    const n = nodes.find(x => x.id === id)!;
    return { node_id: id, row: n.row, col: n.col, cost: dist[id] };
  });

  return {
    path_found: true,
    path: pathDTOs,
    path_length: pathIds.length,
    total_cost: dist[end],
    execution_time_ms: performance.now() - t0,
    message: `[Local fallback] Path found: ${pathIds.length} steps`,
  };
}

// ─── Smart wrapper (service → local fallback) ────────────────────────────────

export async function findPathWithFallback(
  start: string,
  end: string,
  warehouseConfig: { nodes?: LocalNode[]; edges?: LocalEdge[] } & Record<string, unknown>,
  constraints?: Constraint,
  blockedLocations?: { node_id?: string }[]
): Promise<PathResponse> {
  try {
    return await optimizePath(start, end, warehouseConfig, constraints, blockedLocations);
  } catch (err) {
    console.warn('[pathfinding-client] Service unavailable, using local BFS fallback:', err);
    const nodes = (warehouseConfig.nodes || []) as LocalNode[];
    const edges = (warehouseConfig.edges || []) as LocalEdge[];
    if (!nodes.length) {
      return {
        path_found: false, path: [], path_length: 0,
        total_cost: 0, execution_time_ms: 0,
        message: 'No warehouse data available for fallback',
      };
    }
    return localBFS(start, end, nodes, edges);
  }
}
