from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import InventoryRecommendation

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
    stmt = select(InventoryRecommendation)
    if run_id is not None:
        stmt = stmt.where(InventoryRecommendation.run_id == run_id)
    if sku:
        stmt = stmt.where(InventoryRecommendation.sku == sku)
    if dataset:
        stmt = stmt.where(InventoryRecommendation.dataset == dataset)
    if model:
        stmt = stmt.where(InventoryRecommendation.model_name == model)
    if warehouse_id:
        stmt = stmt.where(InventoryRecommendation.warehouse_id == warehouse_id)

    rows = db.execute(stmt.limit(5000)).scalars().all()
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
