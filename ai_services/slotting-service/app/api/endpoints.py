from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.schemas import (
    SlottingOptimizationRequest,
    SlottingOptimizationResponse,
    SlottingAssignmentResponse,
    SlottingRecommendationRequest,
    SlottingRecommendationResponse,
    SlottingRecommendationItemResponse,
    SlottingRecommendationAlternativeResponse,
)
from app.models.db_models import MaterialDB, LocationDB
from app.services.slotting import run_slotting_optimization, SKU, Location

router = APIRouter()


def _safe_zone_label(zone_type: str | None) -> str:
    if not zone_type:
        return "DEFAULT"
    return str(zone_type).strip().upper() or "DEFAULT"


def _location_distance(location: LocationDB) -> float:
    if location.coordinate_x is not None or location.coordinate_y is not None:
        x = float(location.coordinate_x or 0.0)
        y = float(location.coordinate_y or 0.0)
        return (x * x + y * y) ** 0.5
    if location.zone_type:
        zone = str(location.zone_type).strip().upper()
        if zone == "STORAGE":
            return 10.0
        if zone == "RECEIVING":
            return 100.0
    return 50.0


def _score_location_for_item(item, material: MaterialDB, location: LocationDB) -> tuple[float, str]:
    score = 1000.0
    reasons: list[str] = []

    location_zone = _safe_zone_label(location.zone_type)
    preferred_zone = (item.preferred_zone or getattr(material, "preferred_zone", None) or "").strip().upper()

    if preferred_zone and location_zone == preferred_zone:
        score += 220.0
        reasons.append("preferred zone match")

    if item.current_location_code and location.location_code == item.current_location_code:
        score += 120.0
        reasons.append("current location preferred")

    if item.hazard_class:
        location_condition = (location.storage_condition or "").strip().lower()
        material_hazard = str(item.hazard_class).strip().lower()
        if location_condition and material_hazard in location_condition:
            score += 150.0
            reasons.append("hazard/storage compatibility")

    if material.weight_kg is not None and location.max_weight_kg is not None:
        if float(material.weight_kg) <= float(location.max_weight_kg):
            score += 100.0
            reasons.append("weight fits")
        else:
            score -= 300.0

    if material.volume_cm3 is not None and location.capacity is not None:
        if float(material.volume_cm3) <= float(location.capacity):
            score += 100.0
            reasons.append("volume fits")
        else:
            score -= 300.0

    if item.length_cm is not None and item.width_cm is not None and item.height_cm is not None:
        carton_volume = float(item.length_cm) * float(item.width_cm) * float(item.height_cm)
        if location.capacity is not None and carton_volume <= float(location.capacity):
            score += 50.0
            reasons.append("carton dimensions fit")

    velocity = float(item.velocity or material.future_average or 0.0)
    score -= _location_distance(location) * max(1.0, velocity / 10.0)

    if not reasons:
        reasons.append("best available capacity")

    return score, ", ".join(reasons)

@router.post("/optimize", response_model=SlottingOptimizationResponse)
def optimize_warehouse_slotting(
    request: SlottingOptimizationRequest, 
    db: Session = Depends(get_db)
):
    try:
        # 1. Fetch Locations for the specific warehouse
        warehouse_id = str(request.warehouse_id)
        db_locations = db.query(LocationDB).filter(LocationDB.warehouse_id == warehouse_id).all()
        
        if not db_locations:
            raise HTTPException(status_code=404, detail=f"No locations found for warehouse {request.warehouse_id}")

        # 2. Fetch Materials (SKUs) scoped to the requested warehouse
        db_materials = (
            db.query(MaterialDB)
            .limit(500)
            .all()
        )  # Limit for safety in this PoC
        
        if not db_materials:
            raise HTTPException(status_code=404, detail=f"No materials found for warehouse {request.warehouse_id}")

        # 3. Convert DB Models to GA Domain Models
        locations = []
        for loc in db_locations:
            # Provide sensible defaults if DB fields are null
            locations.append(Location(
                id=str(loc.id),
                zone=loc.zone_type or "DEFAULT",
                aisle="1", # Placeholder if not in DB
                rack="1", # Placeholder
                bin="1", # Placeholder
                max_weight=loc.max_weight_kg or 1000.0,
                max_volume=loc.capacity or 1000.0,
                allowed_hazard_classes=["none"], # Simplify for PoC
                distance_to_dispatch=0.0 # Simplify for PoC
            ))

        skus = []
        for mat in db_materials:
            skus.append(SKU(
                id=str(mat.id),
                weight=mat.weight_kg or 1.0,
                volume=mat.volume_cm3 or 1.0,
                hazard_class="flammable" if mat.hazardous else "none",
                stackability_score=1,
                velocity=mat.future_average or 10.0
            ))

        # 4. Run the Genetic Algorithm
        best_chromosome = run_slotting_optimization(
            skus=skus,
            locations=locations,
            population_size=request.population_size,
            generations=request.generations,
            mutation_rate=request.mutation_rate
        )

        # 5. Format Response
        assignments = []
        
        # Build lookup maps for response richness
        material_code_map = {str(m.id): m.material_code for m in db_materials}
        location_code_map = {str(l.id): l.location_code for l in db_locations}
        
        for gene in best_chromosome.genes:
            assignments.append(SlottingAssignmentResponse(
                material_id=gene.sku_id,
                material_code=material_code_map.get(gene.sku_id, "UNKNOWN"),
                location_id=gene.location_id,
                location_code=location_code_map.get(gene.location_id, "UNKNOWN")
            ))

        return SlottingOptimizationResponse(
            warehouse_id=request.warehouse_id,
            best_fitness=best_chromosome.fitness,
            assignments=assignments
        )

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="An error occurred during optimization.")


@router.post("/recommend", response_model=SlottingRecommendationResponse)
def recommend_slotting_locations(
    request: SlottingRecommendationRequest,
    db: Session = Depends(get_db)
):
    try:
        warehouse_id = str(request.warehouse_id)
        db_locations = db.query(LocationDB).filter(LocationDB.warehouse_id == warehouse_id).all()
        if not db_locations:
            raise HTTPException(status_code=404, detail=f"No locations found for warehouse {request.warehouse_id}")

        if not request.items:
            raise HTTPException(status_code=400, detail="At least one item is required for recommendation")

        material_ids = [str(item.material_id) for item in request.items]
        db_materials = db.query(MaterialDB).filter(MaterialDB.id.in_(material_ids)).all()
        material_map = {str(material.id): material for material in db_materials}

        recommendations = []
        best_fitness = 0.0

        for item in request.items:
            material = material_map.get(str(item.material_id))
            if material is None:
                raise HTTPException(status_code=404, detail=f"Material not found: {item.material_id}")

            scored_locations = []
            for location in db_locations:
                if not location.location_code:
                    continue
                score, reason = _score_location_for_item(item, material, location)
                scored_locations.append((score, reason, location))

            if not scored_locations:
                raise HTTPException(status_code=404, detail=f"No valid locations found for warehouse {request.warehouse_id}")

            scored_locations.sort(key=lambda entry: entry[0], reverse=True)
            best_score, best_reason, best_location = scored_locations[0]
            best_fitness += best_score

            alternatives = [
                SlottingRecommendationAlternativeResponse(
                    location_id=str(location.id),
                    location_code=location.location_code,
                    score=score,
                )
                for score, _, location in scored_locations[1 : 1 + request.top_k_alternatives]
            ]

            recommendations.append(
                SlottingRecommendationItemResponse(
                    material_id=str(material.id),
                    material_code=material.material_code,
                    recommended_location_id=str(best_location.id),
                    recommended_location_code=best_location.location_code,
                    score=best_score,
                    reason=best_reason,
                    alternatives=alternatives,
                )
            )

        return SlottingRecommendationResponse(
            warehouse_id=request.warehouse_id,
            algorithm="heuristic-ga",
            best_fitness=best_fitness,
            recommendations=recommendations,
        )

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to generate GA slotting recommendations")
