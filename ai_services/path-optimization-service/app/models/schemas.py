"""
Pydantic schemas for Path Optimization Service
All request/response models for pathfinding APIs
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


# ─── Shared primitives ──────────────────────────────────────────────────────

class BlockedLocation(BaseModel):
    row: Optional[int] = None
    col: Optional[int] = None
    node_id: Optional[str] = None


class Constraint(BaseModel):
    avoid_congestion: bool = False
    avoid_narrow_aisles: bool = False
    worker_type: str = "picker"   # picker | forklift


class PathNodeDTO(BaseModel):
    node_id: str
    row: int
    col: int
    cost: float


class TurnByTurnStep(BaseModel):
    step_number: int
    instruction: str
    from_node: str
    to_node: str
    direction: str          # North | South | East | West | Diagonal | Arrive
    distance: float


# ─── Single-path optimize ────────────────────────────────────────────────────

class PathRequest(BaseModel):
    start: str
    end: str
    grid_rows: Optional[int] = None
    grid_cols: Optional[int] = None
    blocked_locations: Optional[List[BlockedLocation]] = None
    constraints: Optional[Constraint] = None
    warehouse_config: Optional[Dict[str, Any]] = None


class PathResponse(BaseModel):
    path_found: bool
    path: List[PathNodeDTO]
    path_length: int
    total_cost: float
    execution_time_ms: float
    message: str
    node_count: Optional[int] = None
    turn_by_turn: Optional[List[TurnByTurnStep]] = None
    estimated_travel_seconds: Optional[float] = None


# ─── Multi-stop picking route ────────────────────────────────────────────────

class PickStop(BaseModel):
    """A single stop on a picking run"""
    node_id: str
    label: Optional[str] = None     # e.g. "Pick SKU-001 x2"
    quantity: Optional[int] = None
    sku: Optional[str] = None


class MultiStopRequest(BaseModel):
    start: str = "ENTRY"
    end: str = "EXIT"
    stops: List[PickStop]
    warehouse_config: Optional[Dict[str, Any]] = None
    constraints: Optional[Constraint] = None
    blocked_locations: Optional[List[BlockedLocation]] = None


class StopSegment(BaseModel):
    """Path segment between two stops"""
    from_stop: str
    to_stop: str
    segment_path: List[PathNodeDTO]
    segment_cost: float
    turn_by_turn: List[TurnByTurnStep]


class MultiStopResponse(BaseModel):
    route_found: bool
    ordered_stops: List[str]        # optimised visit order
    segments: List[StopSegment]
    total_path: List[PathNodeDTO]   # flattened deduplicated path
    total_cost: float
    total_steps: int
    estimated_travel_seconds: float
    execution_time_ms: float
    message: str
    optimization_method: str        # "nearest_neighbour" | "a_star_direct"


# ─── Putaway location suggestion ────────────────────────────────────────────

class PutawaySuggestRequest(BaseModel):
    start: str = "ENTRY"
    available_locations: List[str]          # candidate node IDs
    warehouse_config: Optional[Dict[str, Any]] = None
    constraints: Optional[Constraint] = None
    prefer_type: Optional[str] = None       # rack | bin | aisle


class PutawaySuggestion(BaseModel):
    node_id: str
    travel_cost: float
    estimated_travel_seconds: float
    path_to_location: List[PathNodeDTO]
    turn_by_turn: List[TurnByTurnStep]
    rank: int


class PutawaySuggestResponse(BaseModel):
    suggestions: List[PutawaySuggestion]
    best_location: str
    execution_time_ms: float
    message: str


# ─── Batch ──────────────────────────────────────────────────────────────────

class BatchPathRequest(BaseModel):
    requests: List[PathRequest]


# ─── Warehouse info ─────────────────────────────────────────────────────────

class WarehouseInfoResponse(BaseModel):
    node_count: int
    edge_count: int
    layout_type: str
    nodes: List[Dict[str, Any]]
