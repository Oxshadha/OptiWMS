import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import ForecastRun, ForecastPrediction, ForecastMetric, InventoryRecommendation

REPORT_PATH = f"{settings.reports_dir}/{settings.forecast_report_file}"
INV_PATH = f"{settings.reports_dir}/{settings.inventory_report_file}"
METRIC_PATH = f"{settings.reports_dir}/{settings.metrics_report_file}"


def ingest_snapshot(db: Session, run: ForecastRun) -> dict:
    inserted = {"predictions": 0, "metrics": 0, "inventory": 0}

    if pd.io.common.file_exists(REPORT_PATH):
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

    if pd.io.common.file_exists(METRIC_PATH):
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
                    split=str(getattr(r, "split", "test")),
                    horizon=int(r.horizon),
                    wape=float(r.WAPE) if pd.notna(r.WAPE) else None,
                    mase_mean=float(r.MASE_mean) if pd.notna(r.MASE_mean) else None,
                    rmse=float(r.RMSE) if pd.notna(r.RMSE) else None,
                    bias=float(r.Bias) if pd.notna(r.Bias) else None,
                )
            )
            inserted["metrics"] += 1

    if pd.io.common.file_exists(INV_PATH):
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
                    on_hand_inventory=float(r.on_hand_inventory) if pd.notna(r.on_hand_inventory) else None,
                    suggested_order_qty=float(r.suggested_order_qty),
                )
            )
            inserted["inventory"] += 1

    db.flush()
    return inserted
