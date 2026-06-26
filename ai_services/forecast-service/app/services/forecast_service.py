import json
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from pathlib import Path

from app.core.config import settings
from app.db.models import ForecastRun, ForecastPrediction, ForecastMetric, InventoryRecommendation
from app.services.runtime_data_source import resolve_online_history_series, resolve_inventory_snapshot, InventorySnapshotRow
from app.services.raw_material_service import persist_raw_material_requirements
from app.services.shap_service import compute_and_persist_shap

REPORT_PATH = f"{settings.reports_dir}/{settings.forecast_report_file}"
INV_PATH = f"{settings.reports_dir}/{settings.inventory_report_file}"
METRIC_PATH = f"{settings.reports_dir}/{settings.metrics_report_file}"


def _resolve_report_path(kind: str, configured_path: str, dataset: str, model_name: str) -> Path | None:
    configured = Path(configured_path)
    if configured.exists():
        try:
            sample = pd.read_csv(configured, nrows=2000)
            if "dataset" in sample.columns and "model" in sample.columns:
                matched = sample[
                    sample["dataset"].astype(str).eq(str(dataset))
                    & sample["model"].astype(str).eq(str(model_name))
                ]
                if not matched.empty:
                    return configured
            else:
                # If the configured file is not dataset/model keyed, keep legacy behavior.
                return configured
        except Exception:
            # Keep legacy behavior for unreadable but explicitly configured paths.
            return configured

    reports_dir = Path(settings.reports_dir)
    if not reports_dir.exists():
        return None

    patterns_by_kind: dict[str, list[str]] = {
        "forecasts": ["*_forecasts.csv"],
        # Support both strict metrics exports and leaderboard-style files.
        "metrics": ["*_metrics.csv", "*leaderboard*.csv"],
        "inventory": ["*inventory*.csv"],
    }
    patterns = patterns_by_kind.get(kind, ["*.csv"])
    candidates: list[Path] = []
    for pattern in patterns:
        candidates.extend(list(reports_dir.glob(pattern)))
    candidates = sorted(candidates, key=lambda p: p.stat().st_mtime, reverse=True)
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
    rm_result = persist_raw_material_requirements(db, run)
    inserted["raw_materials"] = int(rm_result.get("rows", 0) or 0)
    return inserted


def ingest_snapshot_test_metrics_only(db: Session, run: ForecastRun) -> int:
    existing = (
        db.query(ForecastMetric)
        .filter(ForecastMetric.run_id == run.id, ForecastMetric.split == "test")
        .count()
    )
    if existing > 0:
        return 0

    inserted = 0
    
    # Check for v6 horizon_metrics.json
    v6_runs_dir = Path("/v6_academic_final/pipeline/runs")
    if v6_runs_dir.exists():
        candidates = list(v6_runs_dir.glob("*/horizon_metrics.json"))
        if candidates:
            latest_json = sorted(candidates, key=lambda p: p.stat().st_mtime, reverse=True)[0]
            try:
                metrics_data = json.loads(latest_json.read_text())
                for item in metrics_data:
                    db.add(
                        ForecastMetric(
                            run_id=run.id,
                            dataset=run.dataset,
                            model_name=run.model_name,
                            warehouse_id=run.warehouse_id,
                            split="test",
                            horizon=int(item.get("horizon", 0)),
                            wape=float(item.get("WAPE")) if item.get("WAPE") is not None else None,
                            mase_mean=float(item.get("NRMSE")) if item.get("NRMSE") is not None else None,
                            rmse=float(item.get("RMSE")) if item.get("RMSE") is not None else None,
                            bias=float(item.get("Bias")) if item.get("Bias") is not None else None,
                        )
                    )
                    inserted += 1
                db.flush()
                return inserted
            except Exception:
                pass

    # Fallback to legacy CSV
    metric_path = _resolve_report_path("metrics", METRIC_PATH, run.dataset, run.model_name)
    if not metric_path or not pd.io.common.file_exists(str(metric_path)):
        return 0

    m = pd.read_csv(metric_path)
    if "dataset" in m.columns and "model" in m.columns:
        m = m[(m["dataset"] == run.dataset) & (m["model"] == run.model_name)]
    if "split" in m.columns:
        m = m[m["split"].astype(str).str.lower() == "test"]
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
        inserted += 1
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
        
        # Use true quantile models if available, otherwise fallback to ±10%
        p10_val = row.get("p10")
        p90_val = row.get("p90")
        
        p10 = float(p10_val) if p10_val is not None else max(0.0, p50 * 0.9)
        p90 = float(p90_val) if p90_val is not None else max(p50, p50 * 1.1)
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
    series_meta: dict[str, dict[str, str | None]],
    forecast_skus: set[str] | None = None,
) -> int:
    snapshot_rows, _source = resolve_inventory_snapshot(run.warehouse_id)
    if not snapshot_rows:
        # Fallback 1: use latest persisted inventory recommendations for same dataset/model.
        latest_run_id = db.execute(
            select(func.max(InventoryRecommendation.run_id)).where(
                InventoryRecommendation.dataset == run.dataset,
                InventoryRecommendation.model_name == run.model_name,
            )
        ).scalar_one_or_none()
        if latest_run_id:
            prev_rows = db.execute(
                select(InventoryRecommendation).where(InventoryRecommendation.run_id == latest_run_id)
            ).scalars().all()
            snapshot_rows = [
                InventorySnapshotRow(
                    sku=str(r.sku),
                    category=str(r.category) if r.category else None,
                    on_hand_inventory=float(r.on_hand_inventory or 0.0),
                    reorder_point=float(r.reorder_point or 0.0),
                    target_max=float(r.target_max or 0.0),
                    safety_stock=float(r.safety_stock or 0.0),
                )
                for r in prev_rows
            ]

    if not snapshot_rows and h1_predictions:
        # Fallback 2: build minimal operational inventory profile directly from forecasted H+1.
        snapshot_rows = []
        for sku, pred_h1 in h1_predictions.items():
            category = series_meta.get(sku, {}).get("fg_category")
            snapshot_rows.append(
                InventorySnapshotRow(
                    sku=sku,
                    category=str(category) if category is not None else None,
                    on_hand_inventory=0.0,
                    reorder_point=float(max(pred_h1 * 0.8, 0.0)),
                    target_max=float(max(pred_h1 * 2.0, 0.0)),
                    safety_stock=float(max(pred_h1 * 0.15, 0.0)),
                )
            )

    if not snapshot_rows:
        return 0

    if forecast_skus is not None:
        snapshot_rows = [row for row in snapshot_rows if row.sku in forecast_skus]
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
    
    # Publish backtest actuals (y_true) for charts and metrics
    for s in series:
        sku = s.get("fg_code") or s.get("series_id")
        category = s.get("fg_category")
        for hist in s.get("history", []):
            db.add(
                ForecastPrediction(
                    run_id=run.id,
                    dataset=run.dataset,
                    model_name=run.model_name,
                    warehouse_id=run.warehouse_id,
                    sku=str(sku),
                    category=str(category) if category else None,
                    month=str(hist["month"]),
                    horizon=0,
                    p10=0.0,
                    p50=0.0,
                    p90=0.0,
                    y_true=float(hist["demand_units"])
                )
            )
            total_pred += 1

    total_fallback = 0
    total_errors = 0
    h1_predictions: dict[str, float] = {}
    total_fg_demand: dict[str, float] = {}
    series_meta: dict[str, dict[str, str | None]] = {}
    for h in horizons:
        res = infer_boosting_online(
            dataset=run.dataset,
            model_name=run.model_name,
            horizon=h,
            series=series,
            stage="production",
            clip_negative=True,
            return_feature_matrix=True,   # needed for SHAP
        )
        items = res.get("items") or []
        total_pred += _persist_online_predictions(db, run, items, h)
        # ── SHAP explanations (pre-compute at publish time) ───────────────────
        if settings.shap_explainer_enabled and not res.get("fallback_used"):
            feature_frame = res.get("feature_frame")
            if feature_frame is not None and not feature_frame.empty:
                sku_list = [
                    str(it.get("fg_code") or it.get("series_id") or "")
                    for it in items
                    if not it.get("fallback_used")
                ]
                pred_list = [
                    float(it.get("prediction") or 0.0)
                    for it in items
                    if not it.get("fallback_used")
                ]
                try:
                    compute_and_persist_shap(
                        db=db,
                        run_id=run.id,
                        dataset=run.dataset,
                        model_name=run.model_name,
                        horizon=h,
                        feature_frame=feature_frame,
                        sku_list=sku_list,
                        predictions=pred_list,
                    )
                except Exception as shap_exc:  # noqa: BLE001
                    import logging
                    logging.getLogger(__name__).warning(
                        "SHAP computation failed for horizon=%d: %s", h, shap_exc
                    )
        if h == 1:
            for it in items:
                sku = str(it.get("fg_code") or it.get("series_id") or "").strip()
                if not sku:
                    continue
                pred = float(it.get("prediction") or 0.0)
                if pred > 0:
                    h1_predictions[sku] = pred
                if sku not in series_meta:
                    series_meta[sku] = {"fg_category": it.get("fg_category")}
        for it in items:
            sku = str(it.get("fg_code") or it.get("series_id") or "").strip()
            if not sku:
                continue
            pred = float(it.get("prediction") or 0.0)
            total_fg_demand[sku] = float(total_fg_demand.get(sku, 0.0) + max(pred, 0.0))
        total_fallback += int(res.get("fallback_count", 0) or 0)
        total_errors += len(res.get("errors") or [])

    forecast_skus = set(series_meta.keys())
    inventory_rows = _persist_online_inventory_recommendations(
        db,
        run,
        h1_predictions,
        series_meta,
        forecast_skus=forecast_skus if forecast_skus else None,
    )
    raw_material_result = persist_raw_material_requirements(db, run, fg_demand_by_sku=total_fg_demand)

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
        "raw_materials": int(raw_material_result.get("rows", 0) or 0),
        "raw_material_snapshot_source": raw_material_result.get("snapshot_source"),
    }
