from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import ForecastMetric, ForecastPrediction
from app.core.config import settings

router = APIRouter(prefix="/forecast-metrics", tags=["metrics"])


@router.get("")
def get_metrics(
    split: str | None = None,
    horizon: int | None = None,
    dataset: str | None = None,
    model: str | None = None,
    warehouse_id: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(ForecastMetric)
    if split:
        stmt = stmt.where(ForecastMetric.split == split)
    if horizon is not None:
        stmt = stmt.where(ForecastMetric.horizon == horizon)
    if dataset:
        stmt = stmt.where(ForecastMetric.dataset == dataset)
    if model:
        stmt = stmt.where(ForecastMetric.model_name == model)
    if warehouse_id:
        stmt = stmt.where(ForecastMetric.warehouse_id == warehouse_id)
    rows = db.execute(stmt.limit(2000)).scalars().all()
    items = [
        {
            "run_id": r.run_id,
            "dataset": r.dataset,
            "model": r.model_name,
            "warehouse_id": r.warehouse_id,
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


@router.get("/drift-summary")
def get_drift_summary(
    dataset: str | None = None,
    model: str | None = None,
    warehouse_id: str | None = None,
    min_rows: int | None = None,
    db: Session = Depends(get_db),
):
    min_rows = max(1, min_rows or settings.drift_eval_min_rows)

    run_stmt = select(ForecastPrediction.run_id)
    if dataset:
        run_stmt = run_stmt.where(ForecastPrediction.dataset == dataset)
    if model:
        run_stmt = run_stmt.where(ForecastPrediction.model_name == model)
    if warehouse_id:
        run_stmt = run_stmt.where(ForecastPrediction.warehouse_id == warehouse_id)
    run_ids = [r[0] for r in db.execute(run_stmt.distinct().order_by(ForecastPrediction.run_id.desc()).limit(2)).all()]
    if not run_ids:
        return {"status": "insufficient_data", "message": "No forecast predictions available."}

    current_run = run_ids[0]
    prev_run = run_ids[1] if len(run_ids) > 1 else None

    def _wape_for_run(run_id: int | None) -> tuple[float | None, int]:
        if run_id is None:
            return None, 0
        stmt = select(ForecastPrediction).where(ForecastPrediction.run_id == run_id)
        rows = db.execute(stmt).scalars().all()
        pairs = [
            (float(r.y_true), float(r.p50))
            for r in rows
            if r.y_true is not None
        ]
        if len(pairs) < min_rows:
            return None, len(pairs)
        denom = sum(abs(y) for y, _ in pairs)
        if denom <= 0:
            return None, len(pairs)
        numer = sum(abs(y - p) for y, p in pairs)
        return float(numer / denom), len(pairs)

    current_wape, current_rows = _wape_for_run(current_run)
    prev_wape, prev_rows = _wape_for_run(prev_run)
    drift_ratio = None
    if current_wape is not None and prev_wape is not None and prev_wape > 0:
        drift_ratio = (current_wape - prev_wape) / prev_wape

    status = "ok"
    if current_wape is None:
        status = "insufficient_data"
    elif drift_ratio is not None and drift_ratio > settings.drift_alert_wape_increase_ratio:
        status = "warn"

    return {
        "status": status,
        "dataset": dataset,
        "model": model,
        "warehouse_id": warehouse_id,
        "current_run_id": current_run,
        "previous_run_id": prev_run,
        "current_wape": current_wape,
        "previous_wape": prev_wape,
        "wape_drift_ratio": drift_ratio,
        "current_rows": current_rows,
        "previous_rows": prev_rows,
        "drift_threshold": settings.drift_alert_wape_increase_ratio,
        "min_rows": min_rows,
    }
