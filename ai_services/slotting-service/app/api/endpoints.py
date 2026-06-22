"""
endpoints.py — FastAPI router wiring the DEAP GA into HTTP endpoints.
"""
import sys
import os
import hashlib
import logging
import uuid
from datetime import datetime
from typing import List, Optional
 
from fastapi import APIRouter
from pydantic import BaseModel
 
_API_DIR = os.path.dirname(__file__)
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)
 
logger = logging.getLogger(__name__)
router = APIRouter()
 
_GA_MODULES = None
 
def _load_ga():
    global _GA_MODULES
    if _GA_MODULES is not None:
        return _GA_MODULES
 
    try:
        import importlib.util, pathlib
 
        _main_path = pathlib.Path(_API_DIR) / "main.py"
        _spec = importlib.util.spec_from_file_location("ga_engine_main", _main_path)
        ga_main_mod = importlib.util.module_from_spec(_spec)          
        _spec.loader.exec_module(ga_main_mod)                          
 
        import ga_components as gc
        import fitness as fit
        import warehouse_state as ws
        import bin_registry as br
 
        _GA_MODULES = (ga_main_mod, gc, fit, ws, br)
        return _GA_MODULES
 
    except ImportError as exc:
        raise RuntimeError(
            f"Could not import GA modules: {exc}. "
            "Make sure 'deap' is installed: pip install deap"
        ) from exc
 

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
    population_size: int = 50
    generations: int = 100
    mutation_rate: float = 0.2
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
    population_size: int = 50
    generations: int = 100
    mutation_rate: float = 0.2
 
class SlottingAssignmentResponse(BaseModel):
    material_id: str
    material_code: str
    location_id: str
    location_code: str
 
class SlottingOptimizationResponse(BaseModel):
    warehouse_id: str
    best_fitness: float
    assignments: List[SlottingAssignmentResponse] = []


class PlanReserveAssignmentResponse(BaseModel):
    location_code: str
    reserve_pallet_positions: int = 1
    reserve_zone_hint: str = "deep_reserve"


class PlanAssignmentItemResponse(BaseModel):
    material_id: str
    material_code: str
    recommended_primary_location_code: Optional[str] = None
    recommended_primary_location_id: Optional[str] = None
    final_primary_location_code: Optional[str] = None
    active_pick_pallet_positions: int = 1
    required_reserve_pallet_positions: int = 0
    max_stock_pallet_positions: int = 1
    reserve_locations: List[PlanReserveAssignmentResponse] = []
    distance_saved_meters: float = 0
    zone_upgrade: Optional[str] = None
    move_reason: str = ""
    gain_score: float = 0
    relocation_applied: bool = False
    status: str = "PROPOSED"


class PlanOptimizeRequestBody(BaseModel):
    warehouse_id: str
    relocation_budget_pct: float = 30.0
    materials: List[dict] = []
    locations: List[dict] = []
    locked_material_ids: List[str] = []
    use_milp_a_class: bool = False


class PlanOptimizeResponseBody(BaseModel):
    warehouse_id: str
    algorithm: str
    assignments: List[PlanAssignmentItemResponse] = []
    total_moves_proposed: int = 0
    relocation_moves_applied: int = 0
 

def _stable_location_id(location_code: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, location_code))
 
def _build_reason(
    item: SlottingRecommendationItemRequest,
    location_code: str,
    movement_speed: str,
    volume_class: str,
) -> str:
    parts: List[str] = []
    parts.append(f"{movement_speed.capitalize()}-moving item")
    parts.append(f"{volume_class}-volume class")
 
    if item.weight_kg is not None:
        if item.weight_kg > 200:
            parts.append("heavy item — lower level preferred")
        elif item.weight_kg < 10:
            parts.append("light item — upper level preferred")
 
    if item.height_cm is not None:
        if item.height_cm > 80:
            parts.append("tall carton — Zone A clearance required")
        elif item.height_cm <= 40:
            parts.append("compact height — Zone C/D compatible")
 
    zone = location_code[0] if location_code else "?"
    zone_desc = {
        "A": "Zone A (fast/high-volume, near dispatch)",
        "B": "Zone B (medium-volume)",
        "C": "Zone C (low-volume / compact)",
        "D": "Zone D (overflow / slow-moving)",
    }.get(zone, f"Zone {zone}")
    parts.append(f"assigned to {zone_desc}")
 
    return "; ".join(parts) + "."
 

def _enrich_from_db(material_id: str) -> dict:
    """Load material dimensions, forecast, and classification from PostgreSQL."""
    try:
        from app.db.database import SessionLocal
        from app.models.db_models import MaterialDB
        db = SessionLocal()
        try:
            mat = db.query(MaterialDB).filter(
                (MaterialDB.id == material_id) | (MaterialDB.material_code == material_id)
            ).first()
            if mat is None:
                return {}
            return {
                "weight_kg": mat.weight_kg,
                "length_cm": mat.length_cm,
                "width_cm": mat.width_cm,
                "height_cm": mat.height_cm,
                "volume_cm3": mat.volume_cm3,
                "storage_type": mat.storage_type,
                "hazard_class": mat.hazard_class,
                "abc_class": mat.abc_class,
                "fms_class": mat.fms_class,
                "forecast_p50": mat.forecast_p50,
                "forecast_p90": mat.forecast_p90,
                "forecast_p10": mat.forecast_p10,
                "velocity": mat.future_average,
            }
        finally:
            db.close()
    except Exception as exc:
        logger.debug("DB enrichment unavailable: %s", exc)
        return {}


@router.post("/recommend", response_model=SlottingRecommendationResponse)
def recommend_placement(request: SlottingRecommendationRequest):
    from config import classify_volume, classify_velocity

    ga_main_mod, gc, fit, ws, br = _load_ga()

    registry = br.BinRegistry()
    order_state = ws.WarehouseState(registry)

    recommendations: List[SlottingRecommendationItemResponse] = []
    overall_best_fitness: float = 0.0

    for item in request.items:
        db_data = _enrich_from_db(item.material_id)

        eff_weight = item.weight_kg if item.weight_kg is not None else db_data.get("weight_kg", 10.0)
        eff_length = item.length_cm if item.length_cm is not None else db_data.get("length_cm", 30.0)
        eff_height = item.height_cm if item.height_cm is not None else db_data.get("height_cm", 30.0)
        eff_width = item.width_cm if item.width_cm is not None else db_data.get("width_cm", 30.0)
        eff_volume = item.volume_cm3 if item.volume_cm3 is not None else db_data.get("volume_cm3")
        eff_velocity = item.velocity if item.velocity is not None else db_data.get("velocity")

        volume_class   = classify_volume(eff_volume)
        movement_speed = classify_velocity(eff_velocity)

        forecast_p50 = getattr(item, "forecast_p50", None) or db_data.get("forecast_p50", 0.0)
        forecast_p90 = getattr(item, "forecast_p90", None) or db_data.get("forecast_p90")
        forecast_p10 = getattr(item, "forecast_p10", None) or db_data.get("forecast_p10")
        volatility = (forecast_p90 - forecast_p10) if (forecast_p90 and forecast_p10) else None

        parcel = {
            "weight":         eff_weight or 10.0,
            "length":         eff_length or 30.0,
            "height":         eff_height or 30.0,
            "width":          eff_width or 30.0,
            "product_volume": volume_class,
            "movement_speed": movement_speed,
            "storage_type":   getattr(item, "storage_type", None) or db_data.get("storage_type"),
            "abc_class":      getattr(item, "abc_class", None) or db_data.get("abc_class"),
            "fms_class":      getattr(item, "fms_class", None) or db_data.get("fms_class"),
            "forecast_p50":   forecast_p50 or 0.0,
            "forecast_volatility": volatility,
            "quantity":       item.quantity,
            "is_relocation":  item.current_location_code is not None,
        }
 
        try:
            best_individual = ga_main_mod.run_ga(
                parcel,
                state=order_state,
                pop_size=request.population_size,
                generations=request.generations,
                mut_prob=request.mutation_rate,
            )
            best_code = gc.decode(best_individual)
            best_cost = best_individual.fitness.values[0]
 
            violations = fit.hard_violations(best_individual, parcel, order_state)
            if not violations:
                order_state.reserve_space(best_individual, item.material_id, parcel["length"], parcel["weight"])
 
            alt_population = gc.toolbox.population(
                n=max(request.top_k_alternatives * 4, 20)
            )
            fit.register_evaluate(parcel, order_state)
            for ind in alt_population:
                ind.fitness.values = gc.toolbox.evaluate(ind)
            alt_population.sort(key=lambda x: x.fitness.values[0])
 
            seen_codes = {best_code}
            alternatives: List[SlottingRecommendationAlternativeResponse] = []
            for alt_ind in alt_population:
                alt_code = gc.decode(alt_ind)
                if alt_code not in seen_codes:
                    seen_codes.add(alt_code)
                    alt_score = max(0.0, 1000.0 - alt_ind.fitness.values[0]) / 1000.0
                    alternatives.append(
                        SlottingRecommendationAlternativeResponse(
                            location_id=_stable_location_id(alt_code),
                            location_code=alt_code,
                            score=round(alt_score, 3),
                        )
                    )
                if len(alternatives) >= request.top_k_alternatives:
                    break
 
            feasibility_note = (
                "" if not violations
                else f" [INFEASIBLE: {', '.join(violations)}]"
            )
 
            best_score = max(0.0, 1000.0 - best_cost) / 1000.0
            overall_best_fitness = max(overall_best_fitness, best_cost)
 
            recommendations.append(
                SlottingRecommendationItemResponse(
                    material_id=item.material_id,
                    material_code=item.material_id,
                    recommended_location_id=_stable_location_id(best_code),
                    recommended_location_code=best_code,
                    score=round(best_score, 3),
                    reason=_build_reason(
                        item, best_code, movement_speed, volume_class
                    ) + feasibility_note,
                    alternatives=alternatives,
                )
            )
 
        except Exception as exc:
            logger.error("GA failed for item %s: %s", item.material_id, exc, exc_info=True)
            recommendations.append(
                SlottingRecommendationItemResponse(
                    material_id=item.material_id,
                    material_code=item.material_id,
                    recommended_location_id=_stable_location_id("A-01-01-L1-A"),
                    recommended_location_code="A-01-01-L1-A",
                    score=0.0,
                    reason=f"GA could not compute a recommendation ({exc}). Default location assigned — please verify manually.",
                    alternatives=[],
                )
            )
 
    return SlottingRecommendationResponse(
        warehouse_id=request.warehouse_id,
        algorithm="DEAP Genetic Algorithm (fitness.py + ga_components.py)",
        best_fitness=round(overall_best_fitness, 2),
        recommendations=recommendations,
    )
 
 
@router.post("/optimize", response_model=SlottingOptimizationResponse)
def optimize_slotting(request: SlottingOptimizationRequest):
    try:
        from app.services.slotting import run_slotting_optimization, Location, SKU
        from app.db.database import SessionLocal
        from app.models.db_models import MaterialDB, LocationDB
    except ImportError as exc:
        logger.warning(
            "Bulk slotting modules unavailable — returning empty response. "
            "Cause: %s", exc,
        )
        return SlottingOptimizationResponse(
            warehouse_id=request.warehouse_id,
            best_fitness=0.0,
            assignments=[],
        )
 
    db = SessionLocal()
    try:
        warehouse_uuid = uuid.UUID(request.warehouse_id)
 
        db_locations = (
            db.query(LocationDB)
            .filter(LocationDB.warehouse_id == warehouse_uuid)
            .all()
        )
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
 
        assignments = [
            SlottingAssignmentResponse(
                material_id=str(mat.id),
                material_code=mat.material_code or str(mat.id),
                location_id=str(loc.id),
                location_code=loc.location_code or str(loc.id),
            )
            for gene in best_chromosome.genes
            if (loc := location_map.get(gene.location_id))
            and (mat := material_map.get(gene.sku_id))
        ]
 
        return SlottingOptimizationResponse(
            warehouse_id=request.warehouse_id,
            best_fitness=round(best_chromosome.fitness, 2),
            assignments=assignments,
        )
 
    finally:
        db.close()


@router.post("/plan/optimize", response_model=PlanOptimizeResponseBody)
def optimize_plan_endpoint(request: PlanOptimizeRequestBody):
  """Deterministic quarterly plan optimizer — returns assignments only (backend persists)."""
  try:
      from app.services.plan_optimizer import (
          PlanOptimizeRequest,
          PlanMaterialInput,
          PlanLocationInput,
          optimize_plan,
      )
  except ImportError as exc:
      logger.error("plan_optimizer unavailable: %s", exc)
      return PlanOptimizeResponseBody(
          warehouse_id=request.warehouse_id,
          algorithm="HEURISTIC_V1",
          assignments=[],
      )

  materials = [PlanMaterialInput(**m) for m in request.materials]
  locations = [PlanLocationInput(**loc) for loc in request.locations]
  result = optimize_plan(PlanOptimizeRequest(
      warehouse_id=request.warehouse_id,
      relocation_budget_pct=request.relocation_budget_pct,
      materials=materials,
      locations=locations,
      locked_material_ids=request.locked_material_ids,
      use_milp_a_class=request.use_milp_a_class,
  ))

  return PlanOptimizeResponseBody(
      warehouse_id=result.warehouse_id,
      algorithm=result.algorithm,
      total_moves_proposed=result.total_moves_proposed,
      relocation_moves_applied=result.relocation_moves_applied,
      assignments=[
          PlanAssignmentItemResponse(
              material_id=a.material_id,
              material_code=a.material_code,
              recommended_primary_location_code=a.recommended_primary_location_code,
              recommended_primary_location_id=a.recommended_primary_location_id,
              final_primary_location_code=a.final_primary_location_code,
              active_pick_pallet_positions=a.active_pick_pallet_positions,
              required_reserve_pallet_positions=a.required_reserve_pallet_positions,
              max_stock_pallet_positions=a.max_stock_pallet_positions,
              reserve_locations=[
                  PlanReserveAssignmentResponse(
                      location_code=r.location_code,
                      reserve_pallet_positions=r.reserve_pallet_positions,
                      reserve_zone_hint=r.reserve_zone_hint,
                  )
                  for r in a.reserve_locations
              ],
              distance_saved_meters=a.distance_saved_meters,
              zone_upgrade=a.zone_upgrade,
              move_reason=a.move_reason,
              gain_score=a.gain_score,
              relocation_applied=a.relocation_applied,
              status=a.status,
          )
          for a in result.assignments
      ],
  )


@router.get("/health")
def slotting_health():
    return {
        "status":    "ok",
        "service":   "slotting-service",
        "algorithm": "DEAP Genetic Algorithm",
        "timestamp": datetime.utcnow().isoformat(),
    }