from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import ForecastMetric

router = APIRouter(prefix="/forecast-metrics", tags=["metrics"])


@router.get("")
def get_metrics(split: str | None = None, horizon: int | None = None, db: Session = Depends(get_db)):
    stmt = select(ForecastMetric)
    if split:
        stmt = stmt.where(ForecastMetric.split == split)
    if horizon is not None:
        stmt = stmt.where(ForecastMetric.horizon == horizon)
    rows = db.execute(stmt.limit(2000)).scalars().all()
    items = [
        {
            "run_id": r.run_id,
            "split": r.split,
            "horizon": r.horizon,
            "WAPE": r.wape,
            "MASE_mean": r.mase_mean,
            "RMSE": r.rmse,
            "Bias": r.bias,
        }
        for r in rows
    ]
    return {"items": items, "count": len(items)}
