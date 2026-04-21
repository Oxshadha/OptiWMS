from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import InventoryRecommendation, ForecastRunSummary

router = APIRouter(prefix="/inventory-recommendations", tags=["inventory"])


@router.get("")
def get_inventory_recommendations(
    sku: str | None = None,
    run_id: int | None = None,
    dataset: str | None = None,
    model: str | None = None,
    warehouse_id: str | None = None,
    db: Session = Depends(get_db),
):
    base_stmt = select(InventoryRecommendation)
    if sku:
        base_stmt = base_stmt.where(InventoryRecommendation.sku == sku)
    if dataset:
        base_stmt = base_stmt.where(InventoryRecommendation.dataset == dataset)
    if model:
        base_stmt = base_stmt.where(func.lower(InventoryRecommendation.model_name) == model.lower())
    if warehouse_id:
        base_stmt = base_stmt.where(InventoryRecommendation.warehouse_id == warehouse_id)

    selected_run_id = run_id
    if selected_run_id is None:
        # Prefer latest summarized run so inventory and forecast views stay aligned.
        summary_stmt = select(func.max(ForecastRunSummary.run_id))
        if dataset:
            summary_stmt = summary_stmt.where(ForecastRunSummary.dataset == dataset)
        if model:
            summary_stmt = summary_stmt.where(func.lower(ForecastRunSummary.model_name) == model.lower())
        if warehouse_id:
            summary_stmt = summary_stmt.where(ForecastRunSummary.warehouse_id == warehouse_id)
        selected_run_id = db.execute(summary_stmt).scalar_one_or_none()

    if selected_run_id is None:
        run_stmt = select(func.max(InventoryRecommendation.run_id))
        if dataset:
            run_stmt = run_stmt.where(InventoryRecommendation.dataset == dataset)
        if model:
            run_stmt = run_stmt.where(func.lower(InventoryRecommendation.model_name) == model.lower())
        if warehouse_id:
            run_stmt = run_stmt.where(InventoryRecommendation.warehouse_id == warehouse_id)
        selected_run_id = db.execute(run_stmt).scalar_one_or_none()

    stmt = base_stmt
    if selected_run_id is not None:
        stmt = stmt.where(InventoryRecommendation.run_id == selected_run_id)

    rows = db.execute(stmt.order_by(InventoryRecommendation.suggested_order_qty.desc(), InventoryRecommendation.sku.asc()).limit(50000)).scalars().all()
    items = [
        {
            "run_id": r.run_id,
            "dataset": r.dataset,
            "model": r.model_name,
            "warehouse_id": r.warehouse_id,
            "sku": r.sku,
            "category": r.category,
            "safety_stock": r.safety_stock,
            "reorder_point": r.reorder_point,
            "target_max": r.target_max,
            "on_hand_inventory": r.on_hand_inventory,
            "suggested_order_qty": r.suggested_order_qty,
        }
        for r in rows
    ]
    return {"items": items, "count": len(items)}
