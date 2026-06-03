"""
Pathfinding API Routes
Endpoints: /optimize, /find-path, /multi-stop, /putaway-suggest,
           /batch-optimize, /warehouse-info, /sample-warehouse, /stats
"""
import time
import logging
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException

from app.algorithms.astar import AStarPathfinder
from app.algorithms.graph_builder import WarehouseGraphBuilder, SAMPLE_SMALL_WAREHOUSE
from app.algorithms.route_optimizer import (
    MultiStopRouteOptimizer,
    build_turn_by_turn,
    path_to_dto,
    PICKER_SPEED_MPS,
    FORKLIFT_SPEED_MPS,
)
from app.models.schemas import (
    PathRequest, PathResponse, PathNodeDTO, TurnByTurnStep,
    MultiStopRequest, MultiStopResponse,
    PutawaySuggestRequest, PutawaySuggestResponse, PutawaySuggestion,
    BatchPathRequest, WarehouseInfoResponse,
    BlockedLocation,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Helpers ────────────────────────────────────────────────────────────────

def _build_pathfinder(
    warehouse_config: Optional[Dict[str, Any]],
    blocked_locations: Optional[List[BlockedLocation]] = None,
) -> AStarPathfinder:
    """Build (or load) a pathfinder from config, apply blocked nodes."""
    builder = WarehouseGraphBuilder()
    cfg = warehouse_config or SAMPLE_SMALL_WAREHOUSE
    pf = builder.build_from_config(cfg)

    if blocked_locations:
        for bl in blocked_locations:
            if bl.node_id and bl.node_id in pf.nodes:
                pf.block_node(bl.node_id)
    return pf


def _single_path(
    pf: AStarPathfinder,
    start: str,
    end: str,
    start_time: float,
    worker_type: str = "picker",
    with_tbt: bool = True,
) -> PathResponse:
    """Run A* and wrap result in PathResponse."""
    if start not in pf.nodes:
        return PathResponse(
            path_found=False, path=[], path_length=0, total_cost=0,
            execution_time_ms=(time.time() - start_time) * 1000,
            message=f"Start node '{start}' not found",
            node_count=len(pf.nodes),
        )
    if end not in pf.nodes:
        return PathResponse(
            path_found=False, path=[], path_length=0, total_cost=0,
            execution_time_ms=(time.time() - start_time) * 1000,
            message=f"End node '{end}' not found",
            node_count=len(pf.nodes),
        )

    path_ids, total_cost = pf.find_path(start, end)
    path_dto, _ = path_to_dto(path_ids, pf)
    exec_ms = (time.time() - start_time) * 1000
    path_found = len(path_ids) > 0

    speed = FORKLIFT_SPEED_MPS if worker_type == "forklift" else PICKER_SPEED_MPS
    est_seconds = round(total_cost / speed, 1) if total_cost else 0.0

    tbt: Optional[List[TurnByTurnStep]] = None
    if with_tbt and path_found:
        tbt = build_turn_by_turn(path_ids, pf)

    return PathResponse(
        path_found=path_found,
        path=path_dto,
        path_length=len(path_ids),
        total_cost=round(total_cost, 4),
        execution_time_ms=round(exec_ms, 2),
        message="Path found successfully" if path_found else "No path found",
        node_count=len(pf.nodes),
        turn_by_turn=tbt,
        estimated_travel_seconds=est_seconds,
    )


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/optimize", response_model=PathResponse)
async def optimize_path(request: PathRequest) -> PathResponse:
    """
    Find optimal single path using A* algorithm.
    Supports named warehouse nodes (e.g. 'ENTRY', 'A1', 'B-02-03').
    Includes turn-by-turn navigation instructions and travel time estimate.
    """
    t0 = time.time()
    try:
        pf = _build_pathfinder(request.warehouse_config, request.blocked_locations)
        worker_type = request.constraints.worker_type if request.constraints else "picker"
        return _single_path(pf, request.start, request.end, t0, worker_type)
    except Exception as exc:
        logger.error("optimize_path error: %s", exc, exc_info=True)
        return PathResponse(
            path_found=False, path=[], path_length=0, total_cost=0,
            execution_time_ms=(time.time() - t0) * 1000,
            message=f"Internal error: {exc}",
        )


@router.post("/find-path", response_model=PathResponse)
async def find_path(request: PathRequest) -> PathResponse:
    """Alias of /optimize kept for backward compatibility."""
    return await optimize_path(request)


# ── Multi-stop picking route ─────────────────────────────────────────────────

@router.post("/multi-stop", response_model=MultiStopResponse)
async def multi_stop_optimize(request: MultiStopRequest) -> MultiStopResponse:
    """
    Optimise a multi-stop picking run using nearest-neighbour TSP + A*.

    Accepts a list of warehouse stops (e.g. pick locations), automatically
    orders them for minimum travel distance, and returns:
    - Optimised visit order
    - Full flattened path
    - Per-segment turn-by-turn instructions
    - Total travel time estimate
    """
    t0 = time.time()
    if not request.stops:
        raise HTTPException(status_code=400, detail="At least one stop is required")

    try:
        pf = _build_pathfinder(request.warehouse_config, request.blocked_locations)
        worker_type = request.constraints.worker_type if request.constraints else "picker"
        optimizer = MultiStopRouteOptimizer(pf, worker_type=worker_type)

        result = optimizer.optimize(request.start, request.end, request.stops)
        exec_ms = (time.time() - t0) * 1000

        if result is None:
            return MultiStopResponse(
                route_found=False,
                ordered_stops=[],
                segments=[],
                total_path=[],
                total_cost=0.0,
                total_steps=0,
                estimated_travel_seconds=0.0,
                execution_time_ms=round(exec_ms, 2),
                message="No route found — check that all stop nodes exist and are reachable",
                optimization_method="nearest_neighbour_astar",
            )

        logger.info(
            "Multi-stop: %d stops, cost=%.2f, %.1fs, %.0fms",
            len(request.stops), result["total_cost"],
            result["estimated_travel_seconds"], exec_ms,
        )

        return MultiStopResponse(
            route_found=True,
            ordered_stops=result["ordered_stops"],
            segments=result["segments"],
            total_path=result["total_path"],
            total_cost=result["total_cost"],
            total_steps=result["total_steps"],
            estimated_travel_seconds=result["estimated_travel_seconds"],
            execution_time_ms=round(exec_ms, 2),
            message=f"Optimised route: {len(request.stops)} stops, "
                    f"est. {result['estimated_travel_seconds']}s travel",
            optimization_method=result["optimization_method"],
        )

    except Exception as exc:
        logger.error("multi_stop_optimize error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Putaway location suggestion ──────────────────────────────────────────────

@router.post("/putaway-suggest", response_model=PutawaySuggestResponse)
async def putaway_suggest(request: PutawaySuggestRequest) -> PutawaySuggestResponse:
    """
    Suggest the best putaway location from a list of candidates.

    Ranks candidate locations by A* travel cost from the start node
    (typically ENTRY or current worker position).
    Returns top-3 suggestions with full path and turn-by-turn instructions.
    """
    t0 = time.time()
    if not request.available_locations:
        raise HTTPException(status_code=400, detail="available_locations must not be empty")

    try:
        pf = _build_pathfinder(request.warehouse_config)
        worker_type = "picker"
        speed = PICKER_SPEED_MPS

        candidates = []
        for loc_id in request.available_locations:
            if loc_id not in pf.nodes:
                logger.warning("Putaway candidate not in graph: %s", loc_id)
                continue

            path_ids, cost = pf.find_path(request.start, loc_id)
            if not path_ids:
                continue

            path_dto, _ = path_to_dto(path_ids, pf)
            tbt = build_turn_by_turn(path_ids, pf)
            candidates.append({
                "node_id": loc_id,
                "travel_cost": cost,
                "estimated_travel_seconds": round(cost / speed, 1),
                "path_to_location": path_dto,
                "turn_by_turn": tbt,
            })

        if not candidates:
            return PutawaySuggestResponse(
                suggestions=[],
                best_location="",
                execution_time_ms=round((time.time() - t0) * 1000, 2),
                message="No reachable locations found",
            )

        # Sort by travel cost, keep top 5
        candidates.sort(key=lambda x: x["travel_cost"])
        top = candidates[:5]

        suggestions = [
            PutawaySuggestion(rank=i + 1, **c) for i, c in enumerate(top)
        ]
        exec_ms = round((time.time() - t0) * 1000, 2)

        return PutawaySuggestResponse(
            suggestions=suggestions,
            best_location=top[0]["node_id"],
            execution_time_ms=exec_ms,
            message=f"Best location: {top[0]['node_id']} "
                    f"({top[0]['estimated_travel_seconds']}s travel)",
        )

    except Exception as exc:
        logger.error("putaway_suggest error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Batch ────────────────────────────────────────────────────────────────────

@router.post("/batch-optimize")
async def batch_optimize(batch_request: BatchPathRequest):
    """Find paths for multiple requests in a single call."""
    results = []
    total_time = 0.0

    for req in batch_request.requests:
        result = await optimize_path(req)
        results.append(result)
        total_time += result.execution_time_ms

    return {
        "batch_size": len(batch_request.requests),
        "results": results,
        "total_execution_time_ms": round(total_time, 2),
        "average_time_ms": round(
            total_time / len(batch_request.requests), 2
        ) if batch_request.requests else 0,
    }


# ── Warehouse info ────────────────────────────────────────────────────────────

@router.post("/warehouse-info")
async def get_warehouse_info(
    warehouse_config: Optional[Dict[str, Any]] = None,
) -> WarehouseInfoResponse:
    """Return metadata about the warehouse graph."""
    try:
        builder = WarehouseGraphBuilder()
        pf = builder.build_from_config(warehouse_config or SAMPLE_SMALL_WAREHOUSE)

        nodes_info = [
            {
                "id": nid,
                "row": node.row,
                "col": node.col,
                "type": node.type,
                "walkable": node.walkable,
            }
            for nid, node in pf.nodes.items()
        ]
        edge_count = sum(len(edges) for edges in pf.edges.values())

        return WarehouseInfoResponse(
            node_count=len(pf.nodes),
            edge_count=edge_count,
            layout_type="graph-based",
            nodes=nodes_info,
        )
    except Exception as exc:
        logger.error("warehouse_info error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/sample-warehouse")
async def get_sample_warehouse() -> Dict[str, Any]:
    """Return the built-in sample warehouse configuration."""
    return SAMPLE_SMALL_WAREHOUSE


@router.get("/stats")
async def get_stats():
    """Service capability summary."""
    return {
        "service": "path-optimization-service",
        "algorithm": "A* (Euclidean heuristic, graph-based)",
        "version": "2.0.0",
        "capabilities": {
            "single_path": "/api/pathfinding/optimize",
            "multi_stop_picking": "/api/pathfinding/multi-stop",
            "putaway_suggestion": "/api/pathfinding/putaway-suggest",
            "batch": "/api/pathfinding/batch-optimize",
            "turn_by_turn": "included in all path responses",
        },
        "features": [
            "A* graph-based pathfinding",
            "Multi-stop picking route (nearest-neighbour TSP)",
            "Putaway location recommendation",
            "Turn-by-turn navigation (N/S/E/W compass)",
            "Travel time estimation (picker & forklift speeds)",
            "Dynamic obstacle/congestion support",
            "Batch processing",
        ],
        "status": "operational",
    }
