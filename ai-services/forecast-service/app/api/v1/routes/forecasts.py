from fastapi import APIRouter, Query, Depends
from sqlalchemy import select, func
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
    base_stmt = select(ForecastPrediction)
    if sku:
        base_stmt = base_stmt.where(ForecastPrediction.sku == sku)
    if horizon is not None:
        base_stmt = base_stmt.where(ForecastPrediction.horizon == horizon)
    if dataset:
        base_stmt = base_stmt.where(ForecastPrediction.dataset == dataset)
    if model:
        base_stmt = base_stmt.where(func.lower(ForecastPrediction.model_name) == model.lower())
    if warehouse_id:
        base_stmt = base_stmt.where(ForecastPrediction.warehouse_id == warehouse_id)

    selected_run_id = run_id
    if selected_run_id is None:
        run_stmt = select(func.max(ForecastPrediction.run_id))
        if dataset:
            run_stmt = run_stmt.where(ForecastPrediction.dataset == dataset)
        if model:
            run_stmt = run_stmt.where(func.lower(ForecastPrediction.model_name) == model.lower())
        if warehouse_id:
            run_stmt = run_stmt.where(ForecastPrediction.warehouse_id == warehouse_id)
        selected_run_id = db.execute(run_stmt).scalar_one_or_none()

    stmt = base_stmt
    if selected_run_id is not None:
        stmt = stmt.where(ForecastPrediction.run_id == selected_run_id)

    rows = db.execute(stmt.order_by(ForecastPrediction.horizon.asc(), ForecastPrediction.sku.asc()).limit(50000)).scalars().all()
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
