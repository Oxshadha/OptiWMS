"""
Multi-Stop Route Optimizer
Nearest-Neighbour heuristic over A* pairwise distances for TSP-like picking lists.
"""
import time
import math
import logging
from typing import List, Tuple, Dict, Optional

from app.algorithms.astar import AStarPathfinder
from app.models.schemas import (
    PickStop, StopSegment, PathNodeDTO, TurnByTurnStep
)

logger = logging.getLogger(__name__)

# Walking speed (m per cost-unit assumed = 1 m, picker ~1.4 m/s)
PICKER_SPEED_MPS = 1.4
FORKLIFT_SPEED_MPS = 2.5


def get_direction(from_row: int, from_col: int, to_row: int, to_col: int) -> str:
    """Return compass direction between two adjacent nodes."""
    dr = to_row - from_row
    dc = to_col - from_col
    if dr == 0 and dc > 0:
        return "East"
    if dr == 0 and dc < 0:
        return "West"
    if dr > 0 and dc == 0:
        return "South"
    if dr < 0 and dc == 0:
        return "North"
    if dr < 0 and dc > 0:
        return "North-East"
    if dr < 0 and dc < 0:
        return "North-West"
    if dr > 0 and dc > 0:
        return "South-East"
    if dr > 0 and dc < 0:
        return "South-West"
    return "Straight"


def build_turn_by_turn(
    path_ids: List[str],
    pathfinder: AStarPathfinder
) -> List[TurnByTurnStep]:
    """Convert a list of node IDs into human-readable turn-by-turn instructions."""
    if not path_ids:
        return []

    steps: List[TurnByTurnStep] = []
    steps.append(TurnByTurnStep(
        step_number=1,
        instruction=f"Start at {path_ids[0]}",
        from_node=path_ids[0],
        to_node=path_ids[0],
        direction="Start",
        distance=0.0
    ))

    for i in range(len(path_ids) - 1):
        curr_id = path_ids[i]
        next_id = path_ids[i + 1]

        curr_node = pathfinder.nodes.get(curr_id)
        next_node = pathfinder.nodes.get(next_id)

        if not curr_node or not next_node:
            continue

        direction = get_direction(curr_node.row, curr_node.col,
                                  next_node.row, next_node.col)
        dist = math.sqrt(
            (next_node.row - curr_node.row) ** 2
            + (next_node.col - curr_node.col) ** 2
        )
        is_last = i == len(path_ids) - 2
        instruction = (
            f"Arrive at {next_id}" if is_last
            else f"Move {direction} to {next_id}"
        )

        steps.append(TurnByTurnStep(
            step_number=i + 2,
            instruction=instruction,
            from_node=curr_id,
            to_node=next_id,
            direction="Arrive" if is_last else direction,
            distance=round(dist, 3)
        ))

    return steps


def path_to_dto(
    path_ids: List[str],
    pathfinder: AStarPathfinder
) -> Tuple[List[PathNodeDTO], float]:
    """Convert path node IDs into DTOs and return (dtos, total_cost)."""
    dtos: List[PathNodeDTO] = []
    total = 0.0
    for nid in path_ids:
        node = pathfinder.nodes.get(nid)
        if node:
            total = node.g_cost if node.g_cost != float('inf') else total
            dtos.append(PathNodeDTO(
                node_id=nid,
                row=node.row,
                col=node.col,
                cost=round(node.g_cost if node.g_cost != float('inf') else total, 4)
            ))
    return dtos, total


class MultiStopRouteOptimizer:
    """
    Nearest-Neighbour Travelling Salesman Heuristic on top of A*.

    For N stops, builds a pairwise cost matrix using A* between every pair,
    then greedily selects the cheapest unvisited next stop.
    Complexity: O(N² × A*) — acceptable for warehouse pick lists (N ≤ 50).
    """

    def __init__(self, pathfinder: AStarPathfinder,
                 worker_type: str = "picker"):
        self.pf = pathfinder
        self.speed = (FORKLIFT_SPEED_MPS if worker_type == "forklift"
                      else PICKER_SPEED_MPS)

    # ── public ────────────────────────────────────────────────────────────

    def optimize(
        self,
        start: str,
        end: str,
        stops: List[PickStop]
    ) -> Optional[Dict]:
        """
        Returns:
            {
                ordered_stops: List[str],
                segments: List[StopSegment],
                total_path: List[PathNodeDTO],
                total_cost: float,
                total_steps: int,
                estimated_travel_seconds: float,
                optimization_method: str,
            }
        or None if no route found.
        """
        t0 = time.time()
        stop_ids = [s.node_id for s in stops]
        all_waypoints = [start] + stop_ids + [end]

        # Validate all nodes exist
        for nid in all_waypoints:
            if nid not in self.pf.nodes:
                logger.warning("Node not found: %s", nid)
                return None

        # Build pairwise cost matrix
        cost_matrix: Dict[str, Dict[str, Tuple[List[str], float]]] = {}
        relevant = [start] + stop_ids  # no need to compute from 'end'
        for a in relevant:
            cost_matrix[a] = {}
            targets = [b for b in all_waypoints if b != a]
            for b in targets:
                path_ids, cost = self.pf.find_path(a, b)
                cost_matrix[a][b] = (path_ids, cost)

        # Nearest-neighbour TSP: start → nearest unvisited → … → end
        ordered = self._nearest_neighbour(start, stop_ids, end, cost_matrix)

        # Build segments
        segments: List[StopSegment] = []
        flat_path: List[PathNodeDTO] = []
        total_cost = 0.0

        for i in range(len(ordered) - 1):
            a_id = ordered[i]
            b_id = ordered[i + 1]
            path_ids, seg_cost = cost_matrix.get(a_id, {}).get(
                b_id, self.pf.find_path(a_id, b_id)
            )
            if not path_ids:
                logger.warning("No path from %s to %s", a_id, b_id)
                return None

            seg_dtos, _ = path_to_dto(path_ids, self.pf)
            tbt = build_turn_by_turn(path_ids, self.pf)
            seg = StopSegment(
                from_stop=a_id,
                to_stop=b_id,
                segment_path=seg_dtos,
                segment_cost=round(seg_cost, 4),
                turn_by_turn=tbt
            )
            segments.append(seg)
            total_cost += seg_cost

            # Flatten (skip duplicate junction node)
            for j, dto in enumerate(seg_dtos):
                if j == 0 and flat_path:
                    continue
                flat_path.append(dto)

        elapsed_ms = (time.time() - t0) * 1000
        travel_s = total_cost / self.speed

        return {
            "ordered_stops": ordered,
            "segments": segments,
            "total_path": flat_path,
            "total_cost": round(total_cost, 4),
            "total_steps": len(flat_path),
            "estimated_travel_seconds": round(travel_s, 1),
            "execution_time_ms": round(elapsed_ms, 2),
            "optimization_method": "nearest_neighbour_astar",
        }

    # ── private ───────────────────────────────────────────────────────────

    def _nearest_neighbour(
        self,
        start: str,
        stops: List[str],
        end: str,
        matrix: Dict[str, Dict[str, Tuple[List[str], float]]]
    ) -> List[str]:
        """Greedy nearest-neighbour ordering."""
        unvisited = list(stops)
        route = [start]
        current = start

        while unvisited:
            best_cost = float('inf')
            best_node = None
            for candidate in unvisited:
                _, cost = matrix.get(current, {}).get(candidate, ([], float('inf')))
                if cost < best_cost:
                    best_cost = cost
                    best_node = candidate

            if best_node is None:
                # Fallback: take first
                best_node = unvisited[0]

            route.append(best_node)
            unvisited.remove(best_node)
            current = best_node

        route.append(end)
        return route
