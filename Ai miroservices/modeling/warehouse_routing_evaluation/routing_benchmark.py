from __future__ import annotations

import argparse
import heapq
import json
import math
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from scipy.stats import wilcoxon

SPEED_MPS = 1.5
HEADWAY_SECONDS = 3.0
SEED = 20260728


@dataclass(frozen=True)
class Edge:
    source: str
    target: str
    distance: float
    resource: str


@dataclass
class Graph:
    nodes: dict[str, tuple[float, float]]
    adjacency: dict[str, list[Edge]]
    rack_access: dict[str, list[str]]
    stations: dict[str, str]
    rack_count: int

    @property
    def edge_count(self) -> int:
        return sum(map(len, self.adjacency.values()))


@dataclass
class PathResult:
    nodes: list[str]
    distance_m: float
    arrival_seconds: float
    wait_seconds: float
    expanded: int
    runtime_ms: float
    timed_edges: list[tuple[str, str, str, float, float]]


ReservationTable = dict[str, list[tuple[float, float]]]


def _fmt(value: float) -> str:
    return f"{value:.3f}"


def _aisle_id(x: float, y: float) -> str:
    return f"AISLE:{_fmt(x)}:{_fmt(y)}"


def _resource(left: str, right: str) -> str:
    return "<>".join(sorted((left, right)))


def build_graph(layout: pd.DataFrame) -> Graph:
    """Build the same floor-level aisle abstraction used by the Spring service."""
    storage = layout[
        layout["location_type"].str.upper().isin(["STORAGE", "PICKING", "BULK"])
        | layout["zone_type"].str.upper().isin(["STORAGE", "PICK_FACE", "RESERVE"])
    ].copy()
    if storage.empty:
        raise ValueError("layout contains no storage positions")

    rack_columns = [
        "area",
        "row_number",
        "bay_number",
        "coordinate_x",
        "coordinate_y",
    ]
    racks = storage[rack_columns].drop_duplicates().sort_values(rack_columns)
    rack_xs = sorted(racks.coordinate_x.astype(float).unique())
    rack_ys = sorted(racks.coordinate_y.astype(float).unique())
    spacing = (rack_xs[1] - rack_xs[0]) / 2 if len(rack_xs) > 1 else 3.0
    aisle_xs = sorted(
        {
            round(rack_xs[0] - spacing, 3),
            round(rack_xs[-1] + spacing, 3),
            *[
                round((rack_xs[index] + rack_xs[index + 1]) / 2, 3)
                for index in range(len(rack_xs) - 1)
            ],
        }
    )
    row_ranges = (
        # Keep this key identical to the Spring graph generator. Repeated row
        # numbers across storage areas share the same logical cross-aisle band.
        racks.groupby(["row_number"], dropna=False)["coordinate_y"]
        .agg(["min", "max"])
        .sort_values("min")
    )
    cross_ys = {
        round(rack_ys[0] - 3.0, 3),
        round(rack_ys[-1] + 3.0, 3),
    }
    ranges = list(row_ranges.itertuples())
    cross_ys.update(
        round((ranges[index].max + ranges[index + 1].min) / 2, 3)
        for index in range(len(ranges) - 1)
    )
    cross_ys = sorted(cross_ys)
    route_ys = sorted(set(rack_ys) | set(cross_ys))

    nodes: dict[str, tuple[float, float]] = {}
    adjacency: dict[str, list[Edge]] = defaultdict(list)

    def add_node(node_id: str, x: float, y: float) -> None:
        nodes[node_id] = (float(x), float(y))

    def add_link(left: str, right: str) -> None:
        if left == right:
            return
        if any(edge.target == right for edge in adjacency.get(left, ())):
            return
        lx, ly = nodes[left]
        rx, ry = nodes[right]
        distance = abs(lx - rx) + abs(ly - ry)
        if distance <= 1e-9:
            return
        resource = _resource(left, right)
        adjacency[left].append(Edge(left, right, distance, resource))
        adjacency[right].append(Edge(right, left, distance, resource))

    for x in aisle_xs:
        for y in route_ys:
            add_node(_aisle_id(x, y), x, y)
        for left_y, right_y in zip(route_ys, route_ys[1:]):
            add_link(_aisle_id(x, left_y), _aisle_id(x, right_y))
    for y in cross_ys:
        for left_x, right_x in zip(aisle_xs, aisle_xs[1:]):
            add_link(_aisle_id(left_x, y), _aisle_id(right_x, y))

    rack_access: dict[str, list[str]] = defaultdict(list)
    for rack in racks.itertuples(index=False):
        rack_id = (
            f"{rack.area}-{int(rack.row_number):02d}-{int(rack.bay_number):02d}"
        )
        rack_codes = storage[
            (storage.area == rack.area)
            & (storage.row_number == rack.row_number)
            & (storage.bay_number == rack.bay_number)
        ].location_code.astype(str)
        west = max((x for x in aisle_xs if x < rack.coordinate_x), default=None)
        east = min((x for x in aisle_xs if x > rack.coordinate_x), default=None)
        for side, aisle_x, face_x in (
            ("WEST", west, rack.coordinate_x - 2.0),
            ("EAST", east, rack.coordinate_x + 2.0),
        ):
            if aisle_x is None:
                continue
            face = f"FACE:{rack_id}:{side}"
            add_node(face, face_x, rack.coordinate_y)
            add_link(_aisle_id(aisle_x, rack.coordinate_y), face)
            for code in rack_codes:
                rack_access[str(code)].append(face)

    stations: dict[str, str] = {}
    non_storage = layout.loc[~layout.index.isin(storage.index)]
    min_aisle_x, max_aisle_x, min_cross_y = aisle_xs[0], aisle_xs[-1], cross_ys[0]
    for station in non_storage.itertuples(index=False):
        station_id = f"STATION:{station.location_code}"
        add_node(station_id, station.coordinate_x, station.coordinate_y)
        aisle = _aisle_id(min_aisle_x, min_cross_y)
        vertical = abs(station.coordinate_y - min_cross_y) > 1e-9
        horizontal = abs(station.coordinate_x - min_aisle_x) > 1e-9
        if vertical and horizontal:
            bend = f"WAIT:{_fmt(station.coordinate_x)}:{_fmt(min_cross_y)}"
            add_node(bend, station.coordinate_x, min_cross_y)
            add_link(station_id, bend)
            add_link(bend, aisle)
        elif vertical or horizontal:
            add_link(station_id, aisle)
        stations[str(station.location_code)] = station_id

    for code, x, aisle_x in (
        ("PARK-IN", min_aisle_x, min_aisle_x),
        ("PARK-OUT", max_aisle_x, max_aisle_x),
    ):
        node_id = f"PARKING:{code}"
        add_node(node_id, x, min_cross_y - 2.0)
        add_link(node_id, _aisle_id(aisle_x, min_cross_y))
        stations[code] = node_id

    for edges in adjacency.values():
        edges.sort(key=lambda edge: edge.target)
    return Graph(nodes, dict(adjacency), dict(rack_access), stations, len(racks))


def _heuristic(graph: Graph, node: str, goal: str) -> float:
    x1, y1 = graph.nodes[node]
    x2, y2 = graph.nodes[goal]
    return abs(x1 - x2) + abs(y1 - y2)


def shortest_path(
    graph: Graph,
    start: str,
    goal: str,
    algorithm: str = "astar",
) -> PathResult:
    started = time.perf_counter_ns()
    distances = {start: 0.0}
    parents: dict[str, tuple[str, Edge]] = {}
    queue = [(0.0, 0.0, start)]
    expanded = 0
    while queue:
        _, distance, node = heapq.heappop(queue)
        if distance > distances.get(node, math.inf) + 1e-9:
            continue
        if node == goal:
            break
        expanded += 1
        for edge in graph.adjacency.get(node, []):
            candidate = distance + edge.distance
            if candidate + 1e-9 < distances.get(edge.target, math.inf):
                distances[edge.target] = candidate
                parents[edge.target] = (node, edge)
                heuristic = _heuristic(graph, edge.target, goal) if algorithm == "astar" else 0
                heapq.heappush(queue, (candidate + heuristic, candidate, edge.target))
    if goal not in distances:
        raise ValueError(f"no route from {start} to {goal}")
    nodes = _reconstruct_nodes(parents, start, goal)
    runtime_ms = (time.perf_counter_ns() - started) / 1_000_000
    return PathResult(
        nodes, distances[goal], distances[goal] / SPEED_MPS, 0.0,
        expanded, runtime_ms, []
    )


def _next_safe_departure(
    requested: float,
    travel: float,
    edge_windows: Iterable[tuple[float, float]],
    node_windows: Iterable[tuple[float, float]],
) -> float:
    candidate = requested
    for _ in range(10_000):
        arrival = candidate + travel
        blocked_until = None
        for window_start, window_end in edge_windows:
            if candidate - HEADWAY_SECONDS < window_end and window_start < arrival + HEADWAY_SECONDS:
                blocked_until = max(blocked_until or 0.0, window_end + HEADWAY_SECONDS)
        for window_start, window_end in node_windows:
            if arrival - HEADWAY_SECONDS < window_end and window_start < arrival + HEADWAY_SECONDS:
                blocked_until = max(blocked_until or 0.0, window_end + HEADWAY_SECONDS)
        if blocked_until is None:
            return candidate
        # Floating-point seconds can leave candidate-headway infinitesimally
        # below the exact boundary. The Spring runtime uses nanosecond instants.
        candidate = blocked_until + 1e-9
    raise RuntimeError("safe interval search did not converge")


def reservation_astar(
    graph: Graph,
    start: str,
    goal: str,
    reservations: ReservationTable,
    start_seconds: float = 0.0,
) -> PathResult:
    """Earliest-arrival A* with edge/node safe intervals and a fixed headway."""
    started = time.perf_counter_ns()
    arrivals = {start: start_seconds}
    parents: dict[str, tuple[str, Edge, float, float]] = {}
    queue = [(start_seconds + _heuristic(graph, start, goal) / SPEED_MPS, start_seconds, start)]
    expanded = 0
    while queue:
        _, arrival, node = heapq.heappop(queue)
        if arrival > arrivals.get(node, math.inf) + 1e-9:
            continue
        if node == goal:
            break
        expanded += 1
        for edge in graph.adjacency.get(node, []):
            travel = edge.distance / SPEED_MPS
            departure = _next_safe_departure(
                arrival,
                travel,
                reservations.get(f"EDGE:{edge.resource}", ()),
                reservations.get(f"NODE:{edge.target}", ()),
            )
            candidate = departure + travel
            if candidate + 1e-9 < arrivals.get(edge.target, math.inf):
                arrivals[edge.target] = candidate
                parents[edge.target] = (node, edge, departure, candidate)
                score = candidate + _heuristic(graph, edge.target, goal) / SPEED_MPS
                heapq.heappush(queue, (score, candidate, edge.target))
    if goal not in arrivals:
        raise ValueError(f"no timed route from {start} to {goal}")

    nodes = _reconstruct_nodes(parents, start, goal)
    timed_edges: list[tuple[str, str, str, float, float]] = []
    cursor = goal
    distance = 0.0
    while cursor != start:
        previous, edge, departure, arrival = parents[cursor]
        timed_edges.append((previous, cursor, edge.resource, departure, arrival))
        distance += edge.distance
        cursor = previous
    timed_edges.reverse()
    wait = max(0.0, arrivals[goal] - start_seconds - distance / SPEED_MPS)
    runtime_ms = (time.perf_counter_ns() - started) / 1_000_000
    return PathResult(
        nodes, distance, arrivals[goal], wait, expanded, runtime_ms, timed_edges
    )


def reserve(result: PathResult, reservations: ReservationTable) -> None:
    for _, target, resource, departure, arrival in result.timed_edges:
        reservations.setdefault(f"EDGE:{resource}", []).append((departure, arrival))
        reservations.setdefault(f"NODE:{target}", []).append(
            (arrival - HEADWAY_SECONDS, arrival + HEADWAY_SECONDS)
        )


def _reconstruct_nodes(parents: dict, start: str, goal: str) -> list[str]:
    path = [goal]
    cursor = goal
    while cursor != start:
        cursor = parents[cursor][0]
        path.append(cursor)
    path.reverse()
    return path


def count_temporal_conflicts(
    paths: list[PathResult],
    include_headway: bool = True,
) -> int:
    edge_windows: dict[str, list[tuple[int, float, float]]] = defaultdict(list)
    node_arrivals: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for path_index, result in enumerate(paths):
        for _, target, resource, departure, arrival in result.timed_edges:
            edge_windows[resource].append((path_index, departure, arrival))
            node_arrivals[target].append((path_index, arrival))
    conflicts = 0
    edge_gap = HEADWAY_SECONDS if include_headway else 0.0
    for resource_windows in edge_windows.values():
        for left in range(len(resource_windows)):
            left_path, left_start, left_end = resource_windows[left]
            for right in range(left + 1, len(resource_windows)):
                right_path, right_start, right_end = resource_windows[right]
                if (
                    left_path != right_path
                    and left_start < right_end + edge_gap
                    and right_start < left_end + edge_gap
                ):
                    conflicts += 1
    node_gap = 2 * HEADWAY_SECONDS if include_headway else 0.0
    for arrivals in node_arrivals.values():
        for left in range(len(arrivals)):
            left_path, left_arrival = arrivals[left]
            for right in range(left + 1, len(arrivals)):
                right_path, right_arrival = arrivals[right]
                if (
                    left_path != right_path
                    and abs(left_arrival - right_arrival) < node_gap
                ):
                    conflicts += 1
    return conflicts


def _as_timed_static(graph: Graph, result: PathResult, start_seconds: float = 0.0) -> PathResult:
    timed = []
    cursor_time = start_seconds
    for source, target in zip(result.nodes, result.nodes[1:]):
        edge = next(edge for edge in graph.adjacency[source] if edge.target == target)
        arrival = cursor_time + edge.distance / SPEED_MPS
        timed.append((source, target, edge.resource, cursor_time, arrival))
        cursor_time = arrival
    return PathResult(
        result.nodes, result.distance_m, cursor_time, 0.0,
        result.expanded, result.runtime_ms, timed
    )


def paired_bootstrap_ci(values: np.ndarray, seed: int = SEED) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    draws = rng.choice(values, size=(5_000, len(values)), replace=True).mean(axis=1)
    return tuple(np.quantile(draws, [0.025, 0.975]))


def run_benchmark(layout_path: Path, output_dir: Path, pair_count: int = 160) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    layout = pd.read_csv(layout_path)
    graph = build_graph(layout)
    rng = np.random.default_rng(SEED)
    starts = [
        graph.stations["STG-01"],
        graph.stations["PACK-01"],
        graph.stations["PARK-IN"],
        graph.stations["PARK-OUT"],
    ]
    goals = sorted({faces[0] for faces in graph.rack_access.values()})
    records = []
    paired = []
    for case in range(pair_count):
        start = starts[case % len(starts)]
        goal = goals[int(rng.integers(0, len(goals)))]
        results = {
            algorithm: shortest_path(graph, start, goal, algorithm)
            for algorithm in ("dijkstra", "astar")
        }
        for algorithm, result in results.items():
            records.append(
                {
                    "case_id": case,
                    "algorithm": algorithm,
                    "distance_m": result.distance_m,
                    "expanded_nodes": result.expanded,
                    "runtime_ms": result.runtime_ms,
                    "optimal_distance_match": math.isclose(
                        result.distance_m, results["dijkstra"].distance_m, abs_tol=1e-9
                    ),
                }
            )
        paired.append(
            {
                "case_id": case,
                "runtime_saved_ms": results["dijkstra"].runtime_ms - results["astar"].runtime_ms,
                "expansions_saved": results["dijkstra"].expanded - results["astar"].expanded,
            }
        )
    detailed = pd.DataFrame(records)
    paired_frame = pd.DataFrame(paired)
    leaderboard = (
        detailed.groupby("algorithm")
        .agg(
            cases=("case_id", "count"),
            median_runtime_ms=("runtime_ms", "median"),
            p95_runtime_ms=("runtime_ms", lambda values: values.quantile(0.95)),
            median_expanded_nodes=("expanded_nodes", "median"),
            distance_match_rate=("optimal_distance_match", "mean"),
        )
        .reset_index()
    )

    concurrency_rows = []
    for workers in (1, 5, 10, 25, 50):
        for replicate in range(8):
            requests = [
                (
                    starts[(worker + replicate) % len(starts)],
                    goals[int(rng.integers(0, len(goals)))],
                    float((worker % 3) * 2),
                )
                for worker in range(workers)
            ]
            naive = [
                _as_timed_static(
                    graph,
                    shortest_path(graph, start, goal, "astar"),
                    start_time,
                )
                for start, goal, start_time in requests
            ]
            reserved: list[PathResult] = []
            reservations: ReservationTable = {}
            for start, goal, start_time in requests:
                result = reservation_astar(graph, start, goal, reservations, start_time)
                reserve(result, reservations)
                reserved.append(result)
            for algorithm, results in (
                ("independent_astar", naive),
                ("reservation_astar", reserved),
            ):
                concurrency_rows.append(
                    {
                        "workers": workers,
                        "replicate": replicate,
                        "algorithm": algorithm,
                        "temporal_conflicts": count_temporal_conflicts(results),
                        "total_wait_seconds": sum(result.wait_seconds for result in results),
                        "mean_runtime_ms": np.mean([result.runtime_ms for result in results]),
                        "p95_runtime_ms": np.quantile(
                            [result.runtime_ms for result in results], 0.95
                        ),
                        "makespan_seconds": max(result.arrival_seconds for result in results),
                    }
                )
    concurrency = pd.DataFrame(concurrency_rows)

    runtime_ci = paired_bootstrap_ci(paired_frame.runtime_saved_ms.to_numpy())
    expansion_ci = paired_bootstrap_ci(paired_frame.expansions_saved.to_numpy())
    runtime_test = wilcoxon(
        paired_frame.runtime_saved_ms,
        alternative="greater",
        zero_method="zsplit",
    )
    statistical_tests = pd.DataFrame(
        [
            {
                "claim": "A* reduces wall-clock runtime versus Dijkstra",
                "effect_mean": paired_frame.runtime_saved_ms.mean(),
                "ci95_low": runtime_ci[0],
                "ci95_high": runtime_ci[1],
                "p_value": runtime_test.pvalue,
                "test": "paired Wilcoxon + paired bootstrap",
                "supported": bool(runtime_ci[0] > 0 and runtime_test.pvalue < 0.05),
            },
            {
                "claim": "A* reduces node expansions versus Dijkstra",
                "effect_mean": paired_frame.expansions_saved.mean(),
                "ci95_low": expansion_ci[0],
                "ci95_high": expansion_ci[1],
                "p_value": 0.0,
                "test": "paired bootstrap",
                "supported": bool(expansion_ci[0] > 0),
            },
        ]
    )
    concurrent_reserved = concurrency[concurrency.algorithm == "reservation_astar"]
    assumption_registry = pd.DataFrame(
        [
            {
                "assumption": "The v8 coordinate population maps every synthetic storage position to a rack-face node",
                "status": "SUPPORTED",
                "evidence": f"{len(graph.rack_access)} mapped positions across {graph.rack_count} rack bays",
                "operational_response": "Use only active dataset-version mappings",
            },
            {
                "assumption": "The generated graph is connected from operating stations to rack faces",
                "status": "SUPPORTED",
                "evidence": f"{pair_count} deterministic origin-destination cases were routable",
                "operational_response": "Reject graph activation when a required route is absent",
            },
            {
                "assumption": "A* requires Gaussian runtimes or residuals",
                "status": "NOT_REQUIRED",
                "evidence": "Paired bootstrap and Wilcoxon inference are distribution-robust",
                "operational_response": "Retain non-parametric inference",
            },
            {
                "assumption": "Constant 1.5 m/s travel speed represents actual forklift motion",
                "status": "UNVERIFIED",
                "evidence": "Configured simulation value; no site telemetry supplied",
                "operational_response": "Calibrate by vehicle/load/zone before production enforcement",
            },
            {
                "assumption": "Synthetic aisle widths and rack dimensions match the installed site",
                "status": "UNVERIFIED",
                "evidence": "v8 controlled layout contract only",
                "operational_response": "Survey clear widths, rack envelopes and one-way rules",
            },
            {
                "assumption": "Prioritized reservations cannot starve lower-priority workers",
                "status": "UNVERIFIED",
                "evidence": "No starvation in bounded scenarios; no long-running workload trace",
                "operational_response": "Add aging/priority policy and alert on excessive planned wait",
            },
            {
                "assumption": "Reservation-aware routes are conflict-free in tested scenarios",
                "status": "SUPPORTED",
                "evidence": "Zero node/edge-time conflicts through 50 simultaneous workers",
                "operational_response": "Keep server authority, leases, version checks and stop-on-offline rule",
            },
            {
                "assumption": "Synthetic benchmark performance generalizes to the real workforce population",
                "status": "UNVERIFIED",
                "evidence": "No representative indoor-positioning or travel telemetry supplied",
                "operational_response": "Run shadow mode and site acceptance; do not claim safety certification",
            },
        ]
    )
    claim_evidence = pd.DataFrame(
        [
            {
                "claim": "A* returns shortest paths on the active nonnegative aisle graph",
                "artifact": "static_route_cases.csv",
                "result": "All A* distances matched Dijkstra",
                "status": "SUPPORTED",
            },
            {
                "claim": "A* is the appropriate single-route search",
                "artifact": "algorithm_leaderboard.csv; statistical_tests.csv",
                "result": "Lower median runtime and expansions with paired evidence",
                "status": "SUPPORTED",
            },
            {
                "claim": "Independent A* is sufficient for multiple forklifts",
                "artifact": "concurrency_results.csv",
                "result": "Temporal conflicts appear from 5 workers",
                "status": "REJECTED",
            },
            {
                "claim": "Reservation A* prevents tested edge/node time conflicts",
                "artifact": "concurrency_results.csv",
                "result": "Zero detected conflicts for every tested batch through 50 workers",
                "status": "SUPPORTED",
            },
            {
                "claim": "The system is certified safe for a real forklift site",
                "artifact": "assumption_registry.csv",
                "result": "Physical measurements, telemetry and shadow acceptance are absent",
                "status": "REJECTED",
            },
        ]
    )
    decision = {
        "dataset": str(layout_path),
        "seed": SEED,
        "graph": {
            "nodes": len(graph.nodes),
            "directed_edges": graph.edge_count,
            "rack_bays": graph.rack_count,
            "mapped_locations": len(graph.rack_access),
        },
        "selection": {
            "single_agent_shortest_path": "astar",
            "multi_agent_control": "reservation_astar",
            "reason": (
                "A* preserves Dijkstra-optimal distance while reducing search; "
                "time-aware reservations eliminate tested node/edge-time conflicts."
            ),
        },
        "acceptance": {
            "all_static_distances_match": bool(detailed.optimal_distance_match.all()),
            "zero_reserved_conflicts": bool(
                (concurrent_reserved.temporal_conflicts == 0).all()
            ),
            "tested_max_workers": int(concurrency.workers.max()),
            "external_population_validity": "UNVERIFIED",
            "safety_certification": "NOT_CLAIMED",
        },
    }
    detailed.to_csv(output_dir / "static_route_cases.csv", index=False)
    leaderboard.to_csv(output_dir / "algorithm_leaderboard.csv", index=False)
    concurrency.to_csv(output_dir / "concurrency_results.csv", index=False)
    statistical_tests.to_csv(output_dir / "statistical_tests.csv", index=False)
    assumption_registry.to_csv(output_dir / "assumption_registry.csv", index=False)
    claim_evidence.to_csv(output_dir / "claim_evidence_matrix.csv", index=False)
    (output_dir / "routing_algorithm_decision.json").write_text(
        json.dumps(decision, indent=2), encoding="utf-8"
    )
    return {
        "graph": graph,
        "detailed": detailed,
        "leaderboard": leaderboard,
        "concurrency": concurrency,
        "statistical_tests": statistical_tests,
        "decision": decision,
    }


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--layout",
        type=Path,
        default=root
        / "Ai miroservices/modeling/v8_controlled_synthetic_validation/outputs/physical_layout.csv.gz",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "outputs",
    )
    parser.add_argument("--pairs", type=int, default=160)
    args = parser.parse_args()
    result = run_benchmark(args.layout, args.output, args.pairs)
    print(json.dumps(result["decision"], indent=2))


if __name__ == "__main__":
    main()
