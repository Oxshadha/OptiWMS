from pathlib import Path
import pandas as pd
from sqlalchemy.orm import Session

from app.db.models import ForecastRun, ForecastPrediction, ForecastMetric, InventoryRecommendation

REPORT_PATH = Path("/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/dashboard_forecast_output.csv")
INV_PATH = Path("/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/dashboard_inventory_recommendations.csv")
METRIC_PATH = Path("/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/test_metrics_by_horizon.csv")


def ingest_snapshot(db: Session, run: ForecastRun) -> dict:
    inserted = {"predictions": 0, "metrics": 0, "inventory": 0}

    if REPORT_PATH.exists():
        f = pd.read_csv(REPORT_PATH)
        f = f[(f["dataset"] == run.dataset) & (f["model"] == run.model_name)]
        for r in f.itertuples(index=False):
            wh = str(getattr(r, "warehouse_id", "")) if hasattr(r, "warehouse_id") else None
            db.add(
                ForecastPrediction(
                    run_id=run.id,
                    dataset=run.dataset,
                    model_name=run.model_name,
                    warehouse_id=(wh if wh else run.warehouse_id),
                    sku=str(r.fg_code),
                    category=str(r.fg_category) if hasattr(r, "fg_category") else None,
                    month=str(r.month)[:10],
                    horizon=int(r.horizon),
                    p10=float(r.p10),
                    p50=float(r.forecast_p50),
                    p90=float(r.p90),
                    y_true=float(r.y_true) if pd.notna(r.y_true) else None,
                )
            )
            inserted["predictions"] += 1

    if METRIC_PATH.exists():
        m = pd.read_csv(METRIC_PATH)
        if "dataset" in m.columns and "model" in m.columns:
            m = m[(m["dataset"] == run.dataset) & (m["model"] == run.model_name)]
        for r in m.itertuples(index=False):
            db.add(
                ForecastMetric(
                    run_id=run.id,
                    dataset=run.dataset,
                    model_name=run.model_name,
                    warehouse_id=run.warehouse_id,
                    split=str(r.split),
                    horizon=int(r.horizon),
                    wape=float(r.WAPE) if pd.notna(r.WAPE) else None,
                    mase_mean=float(r.MASE_mean) if pd.notna(r.MASE_mean) else None,
                    rmse=float(r.RMSE) if pd.notna(r.RMSE) else None,
                    bias=float(r.Bias) if pd.notna(r.Bias) else None,
                )
            )
            inserted["metrics"] += 1

    if INV_PATH.exists():
        i = pd.read_csv(INV_PATH)
        if "dataset" in i.columns and "model" in i.columns:
            i = i[(i["dataset"] == run.dataset) & (i["model"] == run.model_name)]
        for r in i.itertuples(index=False):
            wh = str(getattr(r, "warehouse_id", "")) if hasattr(r, "warehouse_id") else None
            db.add(
                InventoryRecommendation(
                    run_id=run.id,
                    dataset=run.dataset,
                    model_name=run.model_name,
                    warehouse_id=(wh if wh else run.warehouse_id),
                    sku=str(r.fg_code),
                    category=str(r.fg_category) if hasattr(r, "fg_category") else None,
                    safety_stock=float(r.safety_stock),
                    reorder_point=float(r.reorder_point),
                    target_max=float(r.target_max),
                    suggested_order_qty=float(r.suggested_order_qty),
                )
            )
            inserted["inventory"] += 1

    db.flush()
    return inserted
