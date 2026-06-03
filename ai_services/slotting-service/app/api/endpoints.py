"""
Slotting Service API Endpoints
Provides the FastAPI router that wires the DEAP-based Genetic Algorithm engine
(ga_components.py + fitness.py) into HTTP endpoints.
"""

import sys
import os
import logging
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Ensure the app/api directory is on sys.path so that the flat-module imports
# inside ga_components.py, fitness.py, warehouse_state.py and config.py work.
# (Those files import each other without a package prefix, e.g.
#  `from config import …` rather than `from app.api.config import …`)
# ---------------------------------------------------------------------------
_API_DIR = os.path.dirname(__file__)
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Lazy-import the GA modules so that import errors are surfaced at request
# time with a clear message rather than crashing the whole service on startup.
# ---------------------------------------------------------------------------

def _load_ga():
    """Import the DEAP-based GA modules from the api directory."""
    try:
        import importlib.util, pathlib
        # Load app/api/main.py by file path to avoid collision with Python 'main'
        _main_path = pathlib.Path(_API_DIR) / "main.py"
        _spec = importlib.util.spec_from_file_location("ga_engine_main", _main_path)
        ga_main_mod = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
        _spec.loader.exec_module(ga_main_mod)  # type: ignore[union-attr]

        import ga_components as gc
        import fitness as fit
        import warehouse_state as ws
        return ga_main_mod, gc, fit, ws
    except ImportError as exc:
        raise RuntimeError(
            f"Could not import GA modules: {exc}. "
            "Make sure 'deap' is installed: pip install deap"
        ) from exc


# ---------------------------------------------------------------------------
# Pydantic schemas (mirrors app/models/schemas.py to avoid circular imports)
# ---------------------------------------------------------------------------

class SlottingRecommendationItemRequest(BaseModel):
    material_id: str
    quantity: int
    weight_kg: Optional[float] = None
    volume_cm3: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    hazard_class: Optional[str] = None
    velocity: Optional[float] = None
    preferred_zone: Optional[str] = None
    current_location_code: Optional[str] = None


class SlottingRecommendationRequest(BaseModel):
    warehouse_id: str
    items: List[SlottingRecommendationItemRequest] = []
    population_size: int = 20
    generations: int = 50
    mutation_rate: float = 0.05
    top_k_alternatives: int = 3


class SlottingRecommendationAlternativeResponse(BaseModel):
    location_id: str
    location_code: str
    score: float


class SlottingRecommendationItemResponse(BaseModel):
    material_id: str
    material_code: str
    recommended_location_id: str
    recommended_location_code: str
    score: float
    reason: str
    alternatives: List[SlottingRecommendationAlternativeResponse] = []


class SlottingRecommendationResponse(BaseModel):
    warehouse_id: str
    algorithm: str
    best_fitness: float
    recommendations: List[SlottingRecommendationItemResponse] = []


class SlottingOptimizationRequest(BaseModel):
    warehouse_id: str
    population_size: int = 20
    generations: int = 50
    mutation_rate: float = 0.05


class SlottingAssignmentResponse(BaseModel):
    material_id: str
    material_code: str
    location_id: str
    location_code: str


class SlottingOptimizationResponse(BaseModel):
    warehouse_id: str
    best_fitness: float
    assignments: List[SlottingAssignmentResponse] = []


# ---------------------------------------------------------------------------
# Helper: derive qualitative labels from numeric values
# ---------------------------------------------------------------------------

def _volume_class(volume_cm3: Optional[float]) -> str:
    """Map a volume in cm³ to 'high' / 'medium' / 'low'."""
    if volume_cm3 is None:
        return "medium"
    if volume_cm3 >= 50_000:   # ≥ 50 000 cm³  (~50 L)
        return "high"
    if volume_cm3 >= 5_000:    # ≥  5 000 cm³  (~5 L)
        return "medium"
    return "low"


def _movement_speed(velocity: Optional[float]) -> str:
    """Map a numeric velocity / pick-frequency to 'fast' / 'medium' / 'slow'."""
    if velocity is None:
        return "medium"
    if velocity >= 100:
        return "fast"
    if velocity >= 20:
        return "medium"
    return "slow"


def _build_reason(item: SlottingRecommendationItemRequest, location_code: str) -> str:
    """Construct a human-readable explanation for the GA's recommendation."""
    parts: List[str] = []

    speed = _movement_speed(item.velocity)
    vol   = _volume_class(item.volume_cm3)

    parts.append(f"{speed.capitalize()}-moving item")
    parts.append(f"{vol}-volume class")

    if item.weight_kg:
        if item.weight_kg > 200:
            parts.append("heavy item - lower level preferred")
        elif item.weight_kg < 10:
            parts.append("light item - upper level preferred")

    if item.height_cm:
        if item.height_cm > 80:
            parts.append("tall carton - Zone A clearance required")
        elif item.height_cm <= 40:
            parts.append("compact height - Zone C/D compatible")

    zone = location_code[0] if location_code else "?"
    zone_desc = {
        "A": "Zone A (fast/high-volume, near dispatch)",
        "B": "Zone B (medium-volume)",
        "C": "Zone C (low-volume / compact)",
        "D": "Zone D (overflow / slow-moving)",
    }.get(zone, f"Zone {zone}")
    parts.append(f"assigned to {zone_desc}")

    return "; ".join(parts) + "."


# ---------------------------------------------------------------------------
# Endpoint: POST /recommend
# Runs the DEAP GA per item and returns recommended location codes.
# ---------------------------------------------------------------------------

@router.post("/recommend", response_model=SlottingRecommendationResponse)
def recommend_placement(request: SlottingRecommendationRequest):
    """
    Run the DEAP Genetic Algorithm for each item in the inbound order and
    return the best slot location (Zone-Row-Slot-Level-Bin) together with
    a set of alternative locations.
    """
    ga_main_mod, gc, fit, ws = _load_ga()

    recommendations: List[SlottingRecommendationItemResponse] = []
    overall_best_fitness: float = 0.0

    for item in request.items:
        # Build the parcel dict expected by fitness.evaluate()
        parcel = {
            "weight":         item.weight_kg   if item.weight_kg   is not None else 10.0,
            "length":         item.length_cm   if item.length_cm   is not None else 30.0,
            "height":         item.height_cm   if item.height_cm   is not None else 30.0,
            "width":          item.width_cm    if item.width_cm    is not None else 30.0,
            "product_volume": _volume_class(item.volume_cm3),
            "movement_speed": _movement_speed(item.velocity),
        }

        try:
            # Run GA — returns the DEAP Individual with lowest cost
            best_individual = ga_main_mod.run_ga(parcel, pop_size=request.population_size)
            best_code = gc.decode(best_individual)
            best_cost = best_individual.fitness.values[0]

            # Collect alternative locations by running a small secondary population
            alt_population = gc.toolbox.population(n=max(request.top_k_alternatives * 4, 20))
            fit.register_evaluate(parcel)
            for ind in alt_population:
                ind.fitness.values = gc.toolbox.evaluate(ind)
            alt_population.sort(key=lambda x: x.fitness.values[0])

            seen_codes = {best_code}
            alternatives: List[SlottingRecommendationAlternativeResponse] = []
            for alt_ind in alt_population:
                alt_code = gc.decode(alt_ind)
                if alt_code not in seen_codes:
                    seen_codes.add(alt_code)
                    # Score: invert cost so higher = better (for display)
                    alt_score = max(0.0, 1000.0 - alt_ind.fitness.values[0]) / 1000.0
                    alternatives.append(
                        SlottingRecommendationAlternativeResponse(
                            location_id=str(uuid.uuid4()),
                            location_code=alt_code,
                            score=round(alt_score, 3),
                        )
                    )
                if len(alternatives) >= request.top_k_alternatives:
                    break

            # Violations check for the reason string
            violations = fit.hard_violations(best_individual, parcel)
            feasibility_note = "" if not violations else f" [INFEASIBLE: {', '.join(violations)}]"

            best_score = max(0.0, 1000.0 - best_cost) / 1000.0
            overall_best_fitness = max(overall_best_fitness, best_score * 1000.0)

            recommendations.append(
                SlottingRecommendationItemResponse(
                    material_id=item.material_id,
                    material_code=item.material_id,          # code resolved by frontend
                    recommended_location_id=str(uuid.uuid4()),
                    recommended_location_code=best_code,
                    score=round(best_score, 3),
                    reason=_build_reason(item, best_code) + feasibility_note,
                    alternatives=alternatives,
                )
            )

        except Exception as exc:
            logger.error("GA failed for item %s: %s", item.material_id, exc, exc_info=True)
            # Return a graceful fallback so the order creation is not blocked
            recommendations.append(
                SlottingRecommendationItemResponse(
                    material_id=item.material_id,
                    material_code=item.material_id,
                    recommended_location_id=str(uuid.uuid4()),
                    recommended_location_code="A-01-01-L1-A",   # default safe location
                    score=0.0,
                    reason=f"GA could not compute a recommendation ({exc}). "
                           "Default location assigned — please verify manually.",
                    alternatives=[],
                )
            )

    return SlottingRecommendationResponse(
        warehouse_id=request.warehouse_id,
        algorithm="DEAP Genetic Algorithm (fitness.py + ga_components.py)",
        best_fitness=round(overall_best_fitness, 2),
        recommendations=recommendations,
    )


# ---------------------------------------------------------------------------
# Endpoint: POST /optimize
# Bulk warehouse slotting optimization using services/slotting.py (non-DEAP GA).
# ---------------------------------------------------------------------------

@router.post("/optimize", response_model=SlottingOptimizationResponse)
def optimize_slotting(request: SlottingOptimizationRequest):
    """
    Run the bulk Genetic Algorithm optimization for all SKUs and locations in
    the warehouse (uses app/services/slotting.py).
    Returns the best chromosome's SKU→location assignments.
    """
    try:
        from app.services.slotting import (
            run_slotting_optimization,
            Location,
            SKU,
        )
        from app.db.database import SessionLocal
        from app.models.db_models import MaterialDB, LocationDB
    except ImportError as exc:
        logger.error("Could not import bulk slotting modules: %s", exc)
        # Return empty response if DB modules are not available
        return SlottingOptimizationResponse(
            warehouse_id=request.warehouse_id,
            best_fitness=0.0,
            assignments=[],
        )

    db = SessionLocal()
    try:
        # Load locations for the warehouse from the DB
        db_locations = db.query(LocationDB).filter(
            LocationDB.warehouse_id == uuid.UUID(request.warehouse_id)
        ).all()

        # Load materials from the DB
        db_materials = db.query(MaterialDB).all()

        if not db_locations or not db_materials:
            return SlottingOptimizationResponse(
                warehouse_id=request.warehouse_id,
                best_fitness=0.0,
                assignments=[],
            )

        locations = [
            Location(
                id=str(loc.id),
                zone=loc.zone_type or "A",
                aisle="1",
                rack="1",
                bin="1",
                max_weight=loc.max_weight_kg or 500.0,
                max_volume=loc.capacity or 100.0,
                allowed_hazard_classes=["none"],
                distance_to_dispatch=(
                    (loc.coordinate_x or 0) ** 2 +
                    (loc.coordinate_y or 0) ** 2
                ) ** 0.5,
            )
            for loc in db_locations
        ]

        skus = [
            SKU(
                id=str(mat.id),
                weight=mat.weight_kg or 10.0,
                volume=mat.volume_cm3 or 10.0,
                hazard_class=mat.storage_condition if mat.hazardous else None,
                stackability_score=5,
                velocity=mat.future_average or 10.0,
            )
            for mat in db_materials
        ]

        best_chromosome = run_slotting_optimization(
            skus=skus,
            locations=locations,
            population_size=request.population_size,
            generations=request.generations,
            mutation_rate=request.mutation_rate,
        )

        location_map = {str(loc.id): loc for loc in db_locations}
        material_map = {str(mat.id): mat for mat in db_materials}

        assignments = []
        for gene in best_chromosome.genes:
            loc = location_map.get(gene.location_id)
            mat = material_map.get(gene.sku_id)
            if loc and mat:
                assignments.append(
                    SlottingAssignmentResponse(
                        material_id=str(mat.id),
                        material_code=mat.material_code or str(mat.id),
                        location_id=str(loc.id),
                        location_code=loc.location_code or str(loc.id),
                    )
                )

        return SlottingOptimizationResponse(
            warehouse_id=request.warehouse_id,
            best_fitness=round(best_chromosome.fitness, 2),
            assignments=assignments,
        )

    finally:
        db.close()


# ---------------------------------------------------------------------------
# Health check (also reachable at top-level /health via app/main.py)
# ---------------------------------------------------------------------------

@router.get("/health")
def slotting_health():
    return {
        "status": "ok",
        "service": "slotting-service",
        "algorithm": "DEAP Genetic Algorithm",
        "timestamp": datetime.utcnow().isoformat(),
    }
