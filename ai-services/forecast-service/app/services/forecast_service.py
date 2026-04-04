import pandas as pd
from sqlalchemy.orm import Session
from pathlib import Path

from app.core.config import settings
from app.db.models import ForecastRun, ForecastPrediction, ForecastMetric, InventoryRecommendation

REPORT_PATH = f"{settings.reports_dir}/{settings.forecast_report_file}"
INV_PATH = f"{settings.reports_dir}/{settings.inventory_report_file}"
METRIC_PATH = f"{settings.reports_dir}/{settings.metrics_report_file}"


def _resolve_report_path(kind: str, configured_path: str, dataset: str, model_name: str) -> Path | None:
    configured = Path(configured_path)
    if configured.exists():
        return configured

    reports_dir = Path(settings.reports_dir)
    if not reports_dir.exists():
        return None

    patterns = {
        "forecasts": "*_forecasts.csv",
        "metrics": "*_metrics.csv",
        "inventory": "*inventory*.csv",
    }
    pattern = patterns.get(kind, "*.csv")
    candidates = sorted(reports_dir.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    for candidate in candidates:
        try:
            sample = pd.read_csv(candidate, nrows=2000)
        except Exception:
            continue
        if "dataset" not in sample.columns or "model" not in sample.columns:
            continue
        matched = sample[
            sample["dataset"].astype(str).eq(str(dataset))
            & sample["model"].astype(str).eq(str(model_name))
        ]
        if not matched.empty:
            return candidate
    return None


def ingest_snapshot(db: Session, run: ForecastRun) -> dict:
    inserted = {"predictions": 0, "metrics": 0, "inventory": 0}

    forecast_path = _resolve_report_path("forecasts", REPORT_PATH, run.dataset, run.model_name)
    if forecast_path and pd.io.common.file_exists(str(forecast_path)):
        f = pd.read_csv(forecast_path)
        f = f[(f["dataset"] == run.dataset) & (f["model"] == run.model_name)]
        pred_col = "forecast_p50" if "forecast_p50" in f.columns else "y_pred"
        if pred_col not in f.columns:
            f = pd.DataFrame()
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
                    p50=float(getattr(r, pred_col)),
                    p90=float(r.p90),
                    y_true=float(r.y_true) if pd.notna(r.y_true) else None,
                )
            )
            inserted["predictions"] += 1

    metric_path = _resolve_report_path("metrics", METRIC_PATH, run.dataset, run.model_name)
    if metric_path and pd.io.common.file_exists(str(metric_path)):
        m = pd.read_csv(metric_path)
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

    inventory_path = _resolve_report_path("inventory", INV_PATH, run.dataset, run.model_name)
    if inventory_path and pd.io.common.file_exists(str(inventory_path)):
        i = pd.read_csv(inventory_path)
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
