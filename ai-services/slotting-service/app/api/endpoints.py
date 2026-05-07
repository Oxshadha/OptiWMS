from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.db.database import get_db
from app.models.schemas import SlottingOptimizationRequest, SlottingOptimizationResponse, SlottingAssignmentResponse
from app.models.db_models import MaterialDB, LocationDB
from app.services.slotting import run_slotting_optimization, SKU, Location

router = APIRouter()

@router.post("/optimize", response_model=SlottingOptimizationResponse)
def optimize_warehouse_slotting(
    request: SlottingOptimizationRequest, 
    db: Session = Depends(get_db)
):
    try:
        # 1. Fetch Locations for the specific warehouse
        warehouse_uuid = uuid.UUID(request.warehouse_id)
        db_locations = db.query(LocationDB).filter(LocationDB.warehouse_id == warehouse_uuid).all()
        
        if not db_locations:
            raise HTTPException(status_code=404, detail=f"No locations found for warehouse {request.warehouse_id}")

        # 2. Fetch Materials (SKUs) scoped to the requested warehouse
        if not hasattr(MaterialDB, "warehouse_id"):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Warehouse-scoped material optimization is not supported by the current "
                    "material model. Update the query to load materials through a "
                    "warehouse-scoped source such as inventory or material planning."
                )
            )

        db_materials = (
            db.query(MaterialDB)
            .filter(MaterialDB.warehouse_id == warehouse_uuid)
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during optimization: {str(e)}")
