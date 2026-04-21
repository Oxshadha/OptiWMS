from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import ForecastMetric, ForecastPrediction
from app.core.config import settings
from app.services.run_summary_service import get_latest_run_summary

router = APIRouter(prefix="/forecast-metrics", tags=["metrics"])


@router.get("")
def get_metrics(
    split: str | None = None,
    horizon: int | None = None,
    dataset: str | None = None,
    model: str | None = None,
    run_id: int | None = None,
    warehouse_id: str | None = None,
    db: Session = Depends(get_db),
):
    base_stmt = select(ForecastMetric)
    if split:
        base_stmt = base_stmt.where(ForecastMetric.split == split)
    if horizon is not None:
        base_stmt = base_stmt.where(ForecastMetric.horizon == horizon)
    if dataset:
        base_stmt = base_stmt.where(ForecastMetric.dataset == dataset)
    if model:
        base_stmt = base_stmt.where(func.lower(ForecastMetric.model_name) == model.lower())
    if warehouse_id:
        base_stmt = base_stmt.where(ForecastMetric.warehouse_id == warehouse_id)

    selected_run_id = run_id
    if selected_run_id is None:
        run_stmt = select(func.max(ForecastMetric.run_id))
        if split:
            run_stmt = run_stmt.where(ForecastMetric.split == split)
        if dataset:
            run_stmt = run_stmt.where(ForecastMetric.dataset == dataset)
        if model:
            run_stmt = run_stmt.where(func.lower(ForecastMetric.model_name) == model.lower())
        if warehouse_id:
            run_stmt = run_stmt.where(ForecastMetric.warehouse_id == warehouse_id)
        selected_run_id = db.execute(run_stmt).scalar_one_or_none()

    stmt = base_stmt
    if selected_run_id is not None:
        stmt = stmt.where(ForecastMetric.run_id == selected_run_id)

    rows = db.execute(stmt.order_by(ForecastMetric.horizon.asc()).limit(2000)).scalars().all()
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


@router.get("/run-summary")
def get_run_summary(
    dataset: str | None = None,
    model: str | None = None,
    warehouse_id: str | None = None,
    run_id: int | None = None,
    db: Session = Depends(get_db),
):
    summary = get_latest_run_summary(
        db=db,
        dataset=dataset,
        model=model,
        warehouse_id=warehouse_id,
        run_id=run_id,
    )
    if summary is None:
        return {"item": None}
    return {
        "item": {
            "run_id": summary.run_id,
            "dataset": summary.dataset,
            "model": summary.model_name,
            "warehouse_id": summary.warehouse_id,
            "forecast_rows": summary.forecast_rows,
            "metric_rows": summary.metric_rows,
            "inventory_rows": summary.inventory_rows,
            "sku_count": summary.sku_count,
            "horizon_count": summary.horizon_count,
            "reorder_now_count": summary.reorder_now_count,
            "overstock_risk_count": summary.overstock_risk_count,
            "total_suggested_order_qty": summary.total_suggested_order_qty,
            "avg_wape_test": summary.avg_wape_test,
            "avg_rmse_test": summary.avg_rmse_test,
            "avg_mase_test": summary.avg_mase_test,
            "avg_abs_bias_test": summary.avg_abs_bias_test,
            "rmse_vs_avg_demand_pct": summary.rmse_vs_avg_demand_pct,
        }
    }


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
