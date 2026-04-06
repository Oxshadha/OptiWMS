from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import ForecastMetric, ForecastPrediction, ForecastRun, ForecastRunSummary, InventoryRecommendation


def _avg(values: list[float]) -> float | None:
    if not values:
        return None
    return float(sum(values) / len(values))


def upsert_run_summary(db: Session, run_id: int) -> ForecastRunSummary | None:
    run = db.get(ForecastRun, run_id)
    if not run:
        return None

    pred_rows = db.execute(select(ForecastPrediction).where(ForecastPrediction.run_id == run_id)).scalars().all()
    metric_rows = db.execute(select(ForecastMetric).where(ForecastMetric.run_id == run_id)).scalars().all()
    inv_rows = db.execute(select(InventoryRecommendation).where(InventoryRecommendation.run_id == run_id)).scalars().all()

    sku_count = len({str(r.sku) for r in pred_rows if r.sku})
    horizon_count = len({int(r.horizon) for r in pred_rows if r.horizon is not None})

    reorder_now_count = sum(
        1
        for r in inv_rows
        if r.on_hand_inventory is not None and float(r.on_hand_inventory) < float(r.reorder_point or 0.0)
    )
    overstock_risk_count = sum(
        1
        for r in inv_rows
        if r.on_hand_inventory is not None and float(r.on_hand_inventory) > float(r.target_max or 0.0)
    )
    total_suggested_order_qty = float(sum(float(r.suggested_order_qty or 0.0) for r in inv_rows))

    test_metrics = [m for m in metric_rows if str(m.split or "").lower() == "test"]
    wapes = [float(m.wape) for m in test_metrics if m.wape is not None]
    rmses = [float(m.rmse) for m in test_metrics if m.rmse is not None]
    mases = [float(m.mase_mean) for m in test_metrics if m.mase_mean is not None]
    abs_bias = [abs(float(m.bias)) for m in test_metrics if m.bias is not None]

    demand_values = [abs(float(r.y_true)) for r in pred_rows if r.y_true is not None]
    avg_demand = _avg(demand_values)
    avg_rmse = _avg(rmses)
    rmse_vs_avg_demand_pct = ((avg_rmse / avg_demand) * 100.0) if (avg_rmse is not None and avg_demand and avg_demand > 0) else None

    existing = db.execute(select(ForecastRunSummary).where(ForecastRunSummary.run_id == run_id)).scalar_one_or_none()
    if existing is None:
        existing = ForecastRunSummary(
            run_id=run_id,
            dataset=run.dataset,
            model_name=run.model_name,
            warehouse_id=run.warehouse_id,
        )
        db.add(existing)

    existing.dataset = run.dataset
    existing.model_name = run.model_name
    existing.warehouse_id = run.warehouse_id
    existing.forecast_rows = len(pred_rows)
    existing.metric_rows = len(metric_rows)
    existing.inventory_rows = len(inv_rows)
    existing.sku_count = sku_count
    existing.horizon_count = horizon_count
    existing.reorder_now_count = reorder_now_count
    existing.overstock_risk_count = overstock_risk_count
    existing.total_suggested_order_qty = total_suggested_order_qty
    existing.avg_wape_test = _avg(wapes)
    existing.avg_rmse_test = avg_rmse
    existing.avg_mase_test = _avg(mases)
    existing.avg_abs_bias_test = _avg(abs_bias)
    existing.rmse_vs_avg_demand_pct = rmse_vs_avg_demand_pct

    db.flush()
    return existing


def get_latest_run_summary(
    db: Session,
    dataset: str | None = None,
    model: str | None = None,
    warehouse_id: str | None = None,
    run_id: int | None = None,
) -> ForecastRunSummary | None:
    if run_id is not None:
        return db.execute(select(ForecastRunSummary).where(ForecastRunSummary.run_id == run_id)).scalar_one_or_none()

    stmt = select(ForecastRunSummary)
    if dataset:
        stmt = stmt.where(ForecastRunSummary.dataset == dataset)
    if model:
        stmt = stmt.where(func.lower(ForecastRunSummary.model_name) == model.lower())
    if warehouse_id:
        stmt = stmt.where(ForecastRunSummary.warehouse_id == warehouse_id)
    stmt = stmt.order_by(ForecastRunSummary.run_id.desc()).limit(1)
    return db.execute(stmt).scalar_one_or_none()
