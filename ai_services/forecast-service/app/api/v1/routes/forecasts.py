from fastapi import APIRouter, Query, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ForecastPrediction

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


@router.get("")
def get_forecasts(
    sku: str | None = None,
    horizon: int | None = Query(default=None, ge=1, le=12),
    run_id: int | None = None,
    dataset: str | None = None,
    model: str | None = None,
    warehouse_id: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(ForecastPrediction)
    if run_id is not None:
        stmt = stmt.where(ForecastPrediction.run_id == run_id)
    if sku:
        stmt = stmt.where(ForecastPrediction.sku == sku)
    if horizon is not None:
        stmt = stmt.where(ForecastPrediction.horizon == horizon)
    if dataset:
        stmt = stmt.where(ForecastPrediction.dataset == dataset)
    if model:
        stmt = stmt.where(ForecastPrediction.model_name == model)
    if warehouse_id:
        stmt = stmt.where(ForecastPrediction.warehouse_id == warehouse_id)

    rows = db.execute(stmt.limit(5000)).scalars().all()
    items = [
        {
            "run_id": r.run_id,
            "dataset": r.dataset,
            "model": r.model_name,
            "warehouse_id": r.warehouse_id,
            "sku": r.sku,
            "category": r.category,
            "month": r.month,
            "horizon": r.horizon,
            "p10": r.p10,
            "p50": r.p50,
            "p90": r.p90,
            "y_true": r.y_true,
        }
        for r in rows
    ]
    return {"items": items, "count": len(items)}
