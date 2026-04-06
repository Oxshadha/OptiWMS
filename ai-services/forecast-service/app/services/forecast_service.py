import pandas as pd
from sqlalchemy.orm import Session
from pathlib import Path

from app.core.config import settings
from app.db.models import ForecastRun, ForecastPrediction, ForecastMetric, InventoryRecommendation
from app.services.runtime_data_source import resolve_online_history_series, resolve_inventory_snapshot

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


def _build_online_history_series_from_csv(dataset: str, model_name: str, max_series: int = 500) -> list[dict]:
    forecast_path = _resolve_report_path("forecasts", REPORT_PATH, dataset, model_name)
    if not forecast_path or not forecast_path.exists():
        raise FileNotFoundError(f"No forecast history source found for dataset={dataset}, model={model_name}")

    frame = pd.read_csv(forecast_path)
    required = {"dataset", "model", "fg_code", "month"}
    missing = [c for c in required if c not in frame.columns]
    if missing:
        raise ValueError(f"History source missing required columns: {missing}")

    frame = frame[(frame["dataset"].astype(str) == str(dataset)) & (frame["model"].astype(str) == str(model_name))].copy()
    if frame.empty:
        raise ValueError("No matching rows in history source for requested dataset/model.")

    if "y_true" in frame.columns:
        frame["demand_value"] = pd.to_numeric(frame["y_true"], errors="coerce")
    elif "y_pred" in frame.columns:
        frame["demand_value"] = pd.to_numeric(frame["y_pred"], errors="coerce")
    elif "forecast_p50" in frame.columns:
        frame["demand_value"] = pd.to_numeric(frame["forecast_p50"], errors="coerce")
    else:
        raise ValueError("History source has no demand column (expected y_true/y_pred/forecast_p50).")

    frame["month"] = pd.to_datetime(frame["month"], errors="coerce")
    frame = frame.dropna(subset=["month", "demand_value", "fg_code"])
    if frame.empty:
        raise ValueError("History source has no usable rows after cleaning.")

    frame["fg_code"] = frame["fg_code"].astype(str)
    frame["fg_category"] = frame.get("fg_category", "UNKNOWN").fillna("UNKNOWN").astype(str)
    monthly = (
        frame.groupby(["fg_code", "fg_category", frame["month"].dt.to_period("M")], as_index=False)["demand_value"]
        .mean()
        .rename(columns={"month": "period"})
    )

    series_payloads: list[dict] = []
    for fg_code, group in monthly.groupby("fg_code"):
        g = group.sort_values("period")
        if len(g) < 2:
            continue
        history = [
            {
                "month": str(period),
                "demand_units": float(max(0.0, val)),
            }
            for period, val in zip(g["period"], g["demand_value"])
        ]
        series_payloads.append(
            {
                "series_id": str(fg_code),
                "fg_code": str(fg_code),
                "fg_category": str(g["fg_category"].iloc[-1]),
                "history": history,
                "static_features": {},
            }
        )

    if not series_payloads:
        raise ValueError("No series with sufficient history for online inference.")

    return series_payloads[:max_series]


def _build_online_history_series(dataset: str, model_name: str, warehouse_id: str | None, max_series: int = 500) -> tuple[list[dict], str]:
    rows, source = resolve_online_history_series(
        dataset=dataset,
        warehouse_id=warehouse_id,
        csv_fallback_loader=lambda max_series=max_series: _build_online_history_series_from_csv(dataset, model_name, max_series=max_series),
        max_series=max_series,
    )
    if not rows:
        raise ValueError(f"No series with sufficient history for online inference (source={source}).")
    return rows, source


def _persist_online_predictions(
    db: Session,
    run: ForecastRun,
    online_rows: list[dict],
    horizon: int,
) -> int:
    inserted = 0
    for row in online_rows:
        p50 = float(row.get("prediction", 0.0))
        p10 = max(0.0, p50 * 0.9)
        p90 = max(p50, p50 * 1.1)
        db.add(
            ForecastPrediction(
                run_id=run.id,
                dataset=run.dataset,
                model_name=run.model_name,
                warehouse_id=run.warehouse_id,
                sku=str(row.get("fg_code") or row.get("series_id")),
                category=str(row.get("fg_category")) if row.get("fg_category") is not None else None,
                month=f"H+{horizon}",
                horizon=horizon,
                p10=float(p10),
                p50=float(p50),
                p90=float(p90),
                y_true=None,
            )
        )
        inserted += 1
    return inserted


def _persist_online_inventory_recommendations(
    db: Session,
    run: ForecastRun,
    h1_predictions: dict[str, float],
) -> int:
    snapshot_rows, _source = resolve_inventory_snapshot(run.warehouse_id)
    if not snapshot_rows:
        return 0

    inserted = 0
    for row in snapshot_rows:
        pred_h1 = float(h1_predictions.get(row.sku, 0.0))
        reorder_point = float(row.reorder_point if row.reorder_point > 0 else max(pred_h1 * 0.8, 0.0))
        target_max = float(row.target_max if row.target_max > 0 else max(pred_h1 * 2.0, reorder_point))
        safety_stock = float(row.safety_stock if row.safety_stock > 0 else max(pred_h1 * 0.15, 0.0))
        on_hand = float(max(row.on_hand_inventory, 0.0))
        suggested = max(target_max - on_hand, 0.0) if on_hand < reorder_point else 0.0

        db.add(
            InventoryRecommendation(
                run_id=run.id,
                dataset=run.dataset,
                model_name=run.model_name,
                warehouse_id=run.warehouse_id,
                sku=row.sku,
                category=row.category,
                safety_stock=safety_stock,
                reorder_point=reorder_point,
                target_max=target_max,
                on_hand_inventory=on_hand,
                suggested_order_qty=suggested,
            )
        )
        inserted += 1

    return inserted


def publish_online(db: Session, run: ForecastRun, horizons: list[int] | None = None) -> dict:
    from app.services.artifact_service import infer_boosting_online

    horizons = horizons or list(range(1, 13))
    series, history_source = _build_online_history_series(run.dataset, run.model_name, run.warehouse_id)

    total_pred = 0
    total_fallback = 0
    total_errors = 0
    h1_predictions: dict[str, float] = {}
    for h in horizons:
        res = infer_boosting_online(
            dataset=run.dataset,
            model_name=run.model_name,
            horizon=h,
            series=series,
            stage="production",
            clip_negative=True,
        )
        items = res.get("items") or []
        total_pred += _persist_online_predictions(db, run, items, h)
        if h == 1:
            for it in items:
                sku = str(it.get("fg_code") or it.get("series_id") or "").strip()
                if not sku:
                    continue
                pred = float(it.get("prediction") or 0.0)
                if pred > 0:
                    h1_predictions[sku] = pred
        total_fallback += int(res.get("fallback_count", 0) or 0)
        total_errors += len(res.get("errors") or [])

    inventory_rows = _persist_online_inventory_recommendations(db, run, h1_predictions)

    # Minimal online metric record for audit visibility.
    db.add(
        ForecastMetric(
            run_id=run.id,
            dataset=run.dataset,
            model_name=run.model_name,
            warehouse_id=run.warehouse_id,
            split="online",
            horizon=0,
            wape=None,
            mase_mean=None,
            rmse=None,
            bias=None,
        )
    )

    db.flush()
    return {
        "predictions": total_pred,
        "metrics": 1,
        "inventory": inventory_rows,
        "fallback_count": total_fallback,
        "errors_count": total_errors,
        "mode": "online",
        "history_source": history_source,
    }
