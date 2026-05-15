from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ForecastPrediction, ForecastRunSummary, InventoryRecommendation

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_dashboard_summary(
    dataset: str | None = None,
    model: str | None = None,
    warehouse_id: str | None = None,
    run_id: int | None = None,
    sku: str | None = None,
    horizon: int | None = Query(default=None, ge=1, le=12),
    top_n: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    summary_stmt = select(ForecastRunSummary)
    if run_id is not None:
        summary_stmt = summary_stmt.where(ForecastRunSummary.run_id == run_id)
    if dataset:
        summary_stmt = summary_stmt.where(ForecastRunSummary.dataset == dataset)
    if model:
        summary_stmt = summary_stmt.where(func.lower(ForecastRunSummary.model_name) == model.lower())
    if warehouse_id:
        summary_stmt = summary_stmt.where(ForecastRunSummary.warehouse_id == warehouse_id)
    summary = db.execute(summary_stmt.order_by(ForecastRunSummary.run_id.desc()).limit(1)).scalar_one_or_none()
    if summary is None:
        return {"item": None, "top_reorder": [], "forecast_points": []}

    rec_stmt = select(InventoryRecommendation).where(InventoryRecommendation.run_id == summary.run_id)
    if sku:
        rec_stmt = rec_stmt.where(InventoryRecommendation.sku == sku)
    top_reorder_rows = db.execute(
        rec_stmt.order_by(InventoryRecommendation.suggested_order_qty.desc(), InventoryRecommendation.sku.asc()).limit(top_n)
    ).scalars().all()

    pred_stmt = select(ForecastPrediction).where(ForecastPrediction.run_id == summary.run_id)
    if sku:
        pred_stmt = pred_stmt.where(ForecastPrediction.sku == sku)
    if horizon is not None:
        pred_stmt = pred_stmt.where(ForecastPrediction.horizon == horizon)
    pred_rows = db.execute(
        pred_stmt.order_by(ForecastPrediction.sku.asc(), ForecastPrediction.horizon.asc()).limit(5000)
    ).scalars().all()

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
        },
        "top_reorder": [
            {
                "sku": r.sku,
                "category": r.category,
                "on_hand_inventory": r.on_hand_inventory,
                "reorder_point": r.reorder_point,
                "target_max": r.target_max,
                "suggested_order_qty": r.suggested_order_qty,
            }
            for r in top_reorder_rows
        ],
        "forecast_points": [
            {
                "sku": p.sku,
                "horizon": p.horizon,
                "month": p.month,
                "p10": p.p10,
                "p50": p.p50,
                "p90": p.p90,
                "y_true": p.y_true,
            }
            for p in pred_rows
        ],
    }
