from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ForecastRun, RawMaterialRequirement
from app.services.raw_material_service import BomInputRow, list_bom_mappings, upsert_bom_mappings

router = APIRouter(tags=["raw-materials"])


class BomMappingIn(BaseModel):
    fg_sku: str = Field(min_length=1, max_length=64)
    rm_sku: str = Field(min_length=1, max_length=64)
    qty_per_fg_unit: float = Field(gt=0)
    scrap_rate: float = Field(default=0.0, ge=0, le=5)
    lead_time_days: int | None = Field(default=None, ge=0, le=3650)
    source: str = Field(default="manual", max_length=32)
    notes: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class BomMappingUpsertRequest(BaseModel):
    items: list[BomMappingIn]


@router.get("/bom-mappings")
def get_bom_mappings(
    fg_sku: str | None = None,
    rm_sku: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    rows = list_bom_mappings(db, fg_sku=fg_sku, rm_sku=rm_sku, active_only=active_only)
    return {
        "items": [
            {
                "id": r.id,
                "fg_sku": r.fg_sku,
                "rm_sku": r.rm_sku,
                "qty_per_fg_unit": r.qty_per_fg_unit,
                "scrap_rate": r.scrap_rate,
                "lead_time_days": r.lead_time_days,
                "is_active": bool(r.is_active),
                "source": r.source,
                "notes": r.notes,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ],
        "count": len(rows),
    }


@router.put("/bom-mappings")
def put_bom_mappings(payload: BomMappingUpsertRequest, db: Session = Depends(get_db)):
    result = upsert_bom_mappings(
        db,
        [
            BomInputRow(
                fg_sku=i.fg_sku,
                rm_sku=i.rm_sku,
                qty_per_fg_unit=i.qty_per_fg_unit,
                scrap_rate=i.scrap_rate,
                lead_time_days=i.lead_time_days,
                source=i.source,
                notes=i.notes,
                is_active=i.is_active,
            )
            for i in payload.items
        ],
    )
    db.commit()
    return {"ok": True, **result}


@router.get("/raw-material-requirements")
def get_raw_material_requirements(
    run_id: int | None = None,
    dataset: str | None = None,
    model: str | None = None,
    warehouse_id: str | None = None,
    rm_sku: str | None = None,
    db: Session = Depends(get_db),
):
    selected_run_id = run_id
    if selected_run_id is None:
        run_stmt = select(func.max(RawMaterialRequirement.run_id))
        if dataset:
            run_stmt = run_stmt.where(RawMaterialRequirement.dataset == dataset)
        if model:
            run_stmt = run_stmt.where(func.lower(RawMaterialRequirement.model_name) == model.lower())
        if warehouse_id:
            run_stmt = run_stmt.where(RawMaterialRequirement.warehouse_id == warehouse_id)
        selected_run_id = db.execute(run_stmt).scalar_one_or_none()

    base = select(RawMaterialRequirement)
    if selected_run_id is not None:
        base = base.where(RawMaterialRequirement.run_id == selected_run_id)
    if dataset:
        base = base.where(RawMaterialRequirement.dataset == dataset)
    if model:
        base = base.where(func.lower(RawMaterialRequirement.model_name) == model.lower())
    if warehouse_id:
        base = base.where(RawMaterialRequirement.warehouse_id == warehouse_id)
    if rm_sku:
        base = base.where(RawMaterialRequirement.rm_sku == rm_sku)

    rows = db.execute(
        base.order_by(RawMaterialRequirement.suggested_procure_qty.desc(), RawMaterialRequirement.rm_sku.asc()).limit(50000)
    ).scalars().all()

    run_info = None
    if selected_run_id is not None:
        run = db.get(ForecastRun, selected_run_id)
        if run is not None:
            run_info = {
                "run_id": run.id,
                "dataset": run.dataset,
                "model": run.model_name,
                "warehouse_id": run.warehouse_id,
                "status": run.status,
            }

    return {
        "run": run_info,
        "items": [
            {
                "run_id": r.run_id,
                "dataset": r.dataset,
                "model": r.model_name,
                "warehouse_id": r.warehouse_id,
                "rm_sku": r.rm_sku,
                "rm_category": r.rm_category,
                "fg_sku_count": r.fg_sku_count,
                "gross_requirement_qty": r.gross_requirement_qty,
                "on_hand_inventory": r.on_hand_inventory,
                "safety_stock": r.safety_stock,
                "reorder_point": r.reorder_point,
                "net_requirement_qty": r.net_requirement_qty,
                "suggested_procure_qty": r.suggested_procure_qty,
            }
            for r in rows
        ],
        "count": len(rows),
    }
