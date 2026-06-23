from __future__ import annotations

import json
import logging
import math
import pickle
import re
import statistics
import time
from collections import deque
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from app.core.config import settings


ARTIFACT_ROOT = Path(settings.artifact_dir)
EXOG_COLS = [
    "on_hand_inventory",
    "stockout_days",
    "promotion_flag",
    "price_or_discount",
    "lead_time_days",
    "supplier_otif",
    "inbound_po_qty",
    "open_sales_orders",
    "returns_qty",
    "holiday_flag",
]
AUDIT_LOGGER = logging.getLogger("forecast.inference.audit")
if not AUDIT_LOGGER.handlers:
    AUDIT_LOGGER.setLevel(logging.INFO)
    audit_path = Path(settings.inference_audit_log_file)
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(audit_path, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(message)s"))
    AUDIT_LOGGER.addHandler(file_handler)
_AUDIT_WRITE_COUNT = 0


def _load_metadata(path: Path) -> dict[str, Any]:
    meta_path = path / "metadata.json"
    if not meta_path.exists():
        return {}
    mtime_ns = meta_path.stat().st_mtime_ns
    return _load_metadata_cached(str(meta_path), mtime_ns)


@lru_cache(maxsize=512)
def _load_metadata_cached(meta_path: str, _mtime_ns: int) -> dict[str, Any]:
    return json.loads(Path(meta_path).read_text(encoding="utf-8"))


@lru_cache(maxsize=256)
def _load_pickle_model_cached(model_path: str, _mtime_ns: int):
    with Path(model_path).open("rb") as f:
        return pickle.load(f)


@lru_cache(maxsize=128)
def _load_boosting_model_cached(model_name: str, model_path: str, _mtime_ns: int):
    model_name = model_name.upper()
    p = Path(model_path)
    if model_name == "XGBOOST":
        from xgboost import XGBRegressor

        reg = XGBRegressor()
        reg.load_model(str(p))
        return reg
    if model_name == "CATBOOST":
        from catboost import CatBoostRegressor

        reg = CatBoostRegressor()
        reg.load_model(str(p))
        return reg
    if model_name in {"LIGHTGBM", "RANDOM_FOREST"}:
        p = Path(model_path)
        if p.suffix == ".txt":
            import lightgbm as lgb

            booster = lgb.Booster(model_file=str(p))
            return booster
        return _load_pickle_model_cached(model_path, _mtime_ns)
    raise ValueError(f"Unsupported boosting model: {model_name}")


def list_artifacts(dataset: str | None = None, model: str | None = None) -> list[dict[str, Any]]:
    if not ARTIFACT_ROOT.exists():
        return []

    rows: list[dict[str, Any]] = []
    for dataset_dir in sorted(p for p in ARTIFACT_ROOT.iterdir() if p.is_dir()):
        if dataset and dataset_dir.name.lower() != dataset.lower():
            continue
        for model_dir in sorted(p for p in dataset_dir.iterdir() if p.is_dir()):
            if model and not model_dir.name.lower().startswith(model.lower()):
                continue
            for stage_dir in sorted(p for p in model_dir.iterdir() if p.is_dir()):
                metadata = _load_metadata(stage_dir)
                model_file = next((p.name for p in stage_dir.iterdir() if p.name.startswith("model.")), None)
                rows.append(
                    {
                        "dataset": dataset_dir.name,
                        "artifact_name": model_dir.name,
                        "stage": stage_dir.name,
                        "model_file": model_file,
                        "path": str(stage_dir),
                        "metadata": metadata,
                    }
                )
    return rows


def _artifact_stage_path(dataset: str, artifact_name: str, stage: str = "production") -> Path:
    return ARTIFACT_ROOT / dataset / artifact_name.lower() / stage


def load_classical_artifact(dataset: str, model_name: str, series_id: str, stage: str = "production"):
    path = _artifact_stage_path(dataset, f"{model_name}_{series_id}", stage)
    model_path = path / "model.pkl"
    if not model_path.exists():
        raise FileNotFoundError(f"Missing artifact: {model_path}")
    model = _load_pickle_model_cached(str(model_path), model_path.stat().st_mtime_ns)
    return model, _load_metadata(path)


def infer_classical(dataset: str, model_name: str, series_id: str, steps: int = 12) -> dict[str, Any]:
    model, metadata = load_classical_artifact(dataset, model_name, series_id)
    forecast = model.forecast(steps)
    return {
        "dataset": dataset,
        "model_name": model_name,
        "series_id": series_id,
        "steps": steps,
        "forecast": [float(x) for x in forecast],
        "metadata": metadata,
    }


def load_boosting_artifact(dataset: str, model_name: str, horizon: int, stage: str = "production"):
    path = _artifact_stage_path(dataset, f"{model_name}_h{horizon}", stage)
    metadata = _load_metadata(path)
    model_upper = model_name.upper()
    if model_upper == "XGBOOST":
        model_path = path / "model.json"
    elif model_upper == "CATBOOST":
        model_path = path / "model.cbm"
    elif model_upper in {"LIGHTGBM", "RANDOM_FOREST"}:
        pkl_path = path / "model.pkl"
        txt_path = path / "model.txt"
        if pkl_path.exists():
            model_path = pkl_path
        elif txt_path.exists():
            model_path = txt_path
        else:
            raise FileNotFoundError(f"Missing artifact: {pkl_path} or {txt_path}")
    else:
        raise ValueError(f"Unsupported boosting model: {model_name}")
    if not model_path.exists():
        raise FileNotFoundError(f"Missing artifact: {model_path}")
    mtime_ns = model_path.stat().st_mtime_ns
    reg = _load_boosting_model_cached(model_upper, str(model_path), mtime_ns)
    return reg, metadata


def infer_boosting(dataset: str, model_name: str, horizon: int, rows: list[dict[str, Any]]) -> dict[str, Any]:
    reg, metadata = load_boosting_artifact(dataset, model_name, horizon)
    frame = _align_model_columns(pd.DataFrame(rows), metadata.get("model_cols") or [])
    preds = _predict_boosting_from_frame(reg, metadata, model_name, frame)

    return {
        "dataset": dataset,
        "model_name": model_name,
        "horizon": horizon,
        "predictions": [float(x) for x in preds],
        "metadata": metadata,
    }


def _align_model_columns(frame: pd.DataFrame, model_cols: list[str]) -> pd.DataFrame:
    for col in model_cols:
        if col not in frame.columns:
            frame[col] = 0
    return frame[model_cols].copy()


def _predict_boosting_from_frame(reg, metadata: dict[str, Any], model_name: str, frame: pd.DataFrame):
    model_upper = model_name.upper()
    if model_upper in {"XGBOOST", "LIGHTGBM", "RANDOM_FOREST"}:
        feature_columns = metadata.get("feature_columns") or metadata.get("model_cols") or []
        if feature_columns and any(c.startswith("fg_code_") or c.startswith("fg_category_") for c in feature_columns):
            x = pd.get_dummies(frame, columns=[c for c in ["fg_code", "fg_category"] if c in frame.columns], drop_first=False)
            x = x.reindex(columns=feature_columns, fill_value=0)
            preds = reg.predict(x)
        elif hasattr(reg, "predict"):
            preds = reg.predict(frame)
        else:
            preds = reg.predict(frame.values)
        if metadata.get("use_log_target"):
            import numpy as np

            preds = np.expm1(preds)
        return preds
    return reg.predict(frame)


def _log_inference_audit(payload: dict[str, Any]) -> None:
    global _AUDIT_WRITE_COUNT
    AUDIT_LOGGER.info(json.dumps(payload, default=str))
    _AUDIT_WRITE_COUNT += 1
    if _AUDIT_WRITE_COUNT % 100 == 0:
        _trim_audit_file()


def _trim_audit_file() -> None:
    max_lines = max(1000, int(settings.inference_audit_max_lines or 10000))
    audit_path = Path(settings.inference_audit_log_file)
    if not audit_path.exists():
        return
    try:
        lines = audit_path.read_text(encoding="utf-8").splitlines()
        if len(lines) <= max_lines:
            return
        keep = lines[-max_lines:]
        audit_path.write_text("\n".join(keep) + "\n", encoding="utf-8")
    except Exception:
        return


def list_inference_audit(
    limit: int = 100,
    dataset: str | None = None,
    model_name: str | None = None,
) -> dict[str, Any]:
    limit = max(1, min(limit, 1000))
    audit_path = Path(settings.inference_audit_log_file)
    if not audit_path.exists():
        return {
            "summary": {
                "count": 0,
                "fallback_rate": 0.0,
                "total_errors": 0,
                "avg_latency_ms": 0.0,
                "p95_latency_ms": 0.0,
            },
            "items": [],
        }

    records: deque[dict[str, Any]] = deque(maxlen=limit)
    with audit_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if dataset and str(rec.get("dataset", "")).lower() != dataset.lower():
                continue
            if model_name and str(rec.get("model_name", "")).lower() != model_name.lower():
                continue
            records.append(rec)

    items = list(records)
    count = len(items)
    fallback_count = sum(1 for r in items if bool(r.get("fallback_used")))
    total_errors = sum(int(r.get("errors_count", 0) or 0) for r in items)
    latencies = sorted(float(r.get("latency_ms", 0.0) or 0.0) for r in items)
    avg_latency = (sum(latencies) / count) if count else 0.0
    p95_latency = latencies[min(len(latencies) - 1, int(math.ceil(0.95 * len(latencies))) - 1)] if latencies else 0.0

    return {
        "summary": {
            "count": count,
            "fallback_rate": (fallback_count / count) if count else 0.0,
            "total_errors": total_errors,
            "avg_latency_ms": round(avg_latency, 3),
            "p95_latency_ms": round(p95_latency, 3),
        },
        "items": items,
    }


def evaluate_inference_alerts(
    limit: int = 200,
    dataset: str | None = None,
    model_name: str | None = None,
) -> dict[str, Any]:
    audit = list_inference_audit(limit=limit, dataset=dataset, model_name=model_name)
    summary = audit["summary"]
    rules: list[dict[str, Any]] = []

    fallback_rate = float(summary.get("fallback_rate", 0.0) or 0.0)
    total_errors = int(summary.get("total_errors", 0) or 0)
    p95_latency_ms = float(summary.get("p95_latency_ms", 0.0) or 0.0)

    if fallback_rate > settings.alert_fallback_rate_threshold:
        rules.append(
            {
                "rule": "fallback_rate",
                "status": "warn",
                "threshold": settings.alert_fallback_rate_threshold,
                "value": fallback_rate,
                "message": "Fallback usage rate above threshold.",
            }
        )
    if total_errors > settings.alert_errors_threshold:
        rules.append(
            {
                "rule": "errors_count",
                "status": "critical",
                "threshold": settings.alert_errors_threshold,
                "value": total_errors,
                "message": "Inference error count above threshold.",
            }
        )
    if p95_latency_ms > settings.alert_p95_latency_ms_threshold:
        rules.append(
            {
                "rule": "p95_latency_ms",
                "status": "warn",
                "threshold": settings.alert_p95_latency_ms_threshold,
                "value": p95_latency_ms,
                "message": "P95 latency above threshold.",
            }
        )

    status = "ok"
    if any(r["status"] == "critical" for r in rules):
        status = "critical"
    elif rules:
        status = "warn"

    return {
        "status": status,
        "summary": summary,
        "rules_triggered": rules,
        "window_size": limit,
        "dataset": dataset,
        "model_name": model_name,
    }


def evaluate_acceptance_gate(
    dataset: str | None = None,
    model_name: str | None = None,
    split: str = "test",
    inference_window: int = 500,
) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []

    quality_summary: dict[str, float | None] = {
        "WAPE": None,
        "Bias_abs": None,
        "Bias_abs_pct": None,
        "under_forecast_rate": None,
        "MASE_mean": None,
    }

    def _resolve_gate_metrics_path(ds: str | None, model: str | None) -> Path | None:
        configured = Path(f"{settings.reports_dir}/{settings.metrics_report_file}")
        reports_dir = Path(settings.reports_dir)

        def _matches(path: Path) -> bool:
            try:
                frame = pd.read_csv(path, nrows=4000)
            except Exception:
                return False
            if "dataset" in frame.columns and ds:
                frame = frame[frame["dataset"].astype(str).str.upper() == ds.upper()]
            if "model" in frame.columns and model:
                frame = frame[frame["model"].astype(str).str.upper() == model.upper()]
            if "split" in frame.columns:
                frame = frame[frame["split"].astype(str).str.lower() == split.lower()]
            return not frame.empty

        if configured.exists() and _matches(configured):
            return configured

        if not reports_dir.exists():
            return configured if configured.exists() else None

        candidates: list[Path] = []
        for pattern in ("*_metrics.csv", "*leaderboard*.csv"):
            candidates.extend(list(reports_dir.glob(pattern)))
        candidates = sorted(candidates, key=lambda p: p.stat().st_mtime, reverse=True)
        for candidate in candidates:
            if _matches(candidate):
                return candidate

        return configured if configured.exists() else None

    metric_path = _resolve_gate_metrics_path(dataset, model_name)
    if metric_path.exists():
        metric_df = pd.read_csv(metric_path)
        if "dataset" in metric_df.columns and dataset:
            metric_df = metric_df[metric_df["dataset"].astype(str).str.upper() == dataset.upper()]
        if "model" in metric_df.columns and model_name:
            metric_df = metric_df[metric_df["model"].astype(str).str.upper() == model_name.upper()]
        if "split" in metric_df.columns:
            metric_df = metric_df[metric_df["split"].astype(str).str.lower() == split.lower()]

        def _mean_col(df: pd.DataFrame, col: str) -> float | None:
            if col not in df.columns:
                return None
            series = pd.to_numeric(df[col], errors="coerce").dropna()
            if series.empty:
                return None
            return float(series.mean())

        quality_summary["WAPE"] = _mean_col(metric_df, "WAPE")
        bias_val = _mean_col(metric_df, "Bias")
        quality_summary["Bias_abs"] = abs(bias_val) if bias_val is not None else None
        quality_summary["under_forecast_rate"] = _mean_col(metric_df, "under_forecast_rate")
        quality_summary["MASE_mean"] = _mean_col(metric_df, "MASE_mean")

        # Normalize bias by average demand to keep gate in percentage space.
        avg_demand: float | None = None

        def _resolve_gate_forecast_path(ds: str | None, model: str | None) -> Path | None:
            configured = Path(f"{settings.reports_dir}/{settings.forecast_report_file}")
            reports_dir = Path(settings.reports_dir)

            def _matches(path: Path) -> bool:
                try:
                    frame = pd.read_csv(path, nrows=4000)
                except Exception:
                    return False
                if "dataset" in frame.columns and ds:
                    frame = frame[frame["dataset"].astype(str).str.upper() == ds.upper()]
                if "model" in frame.columns and model:
                    frame = frame[frame["model"].astype(str).str.upper() == model.upper()]
                if "split" in frame.columns:
                    frame = frame[frame["split"].astype(str).str.lower() == split.lower()]
                return not frame.empty

            if configured.exists() and _matches(configured):
                return configured
            if not reports_dir.exists():
                return configured if configured.exists() else None

            candidates = sorted(reports_dir.glob("*_forecasts.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
            for candidate in candidates:
                if _matches(candidate):
                    return candidate
            return configured if configured.exists() else None

        forecast_path = _resolve_gate_forecast_path(dataset, model_name)
        if forecast_path and forecast_path.exists():
            try:
                fdf = pd.read_csv(forecast_path)
                if "dataset" in fdf.columns and dataset:
                    fdf = fdf[fdf["dataset"].astype(str).str.upper() == dataset.upper()]
                if "model" in fdf.columns and model_name:
                    fdf = fdf[fdf["model"].astype(str).str.upper() == model_name.upper()]
                if "split" in fdf.columns:
                    fdf = fdf[fdf["split"].astype(str).str.lower() == split.lower()]
                demand_col = "y_true" if "y_true" in fdf.columns else ("forecast_p50" if "forecast_p50" in fdf.columns else None)
                if demand_col:
                    d = pd.to_numeric(fdf[demand_col], errors="coerce").abs().dropna()
                    if not d.empty:
                        avg_demand = float(d.mean())
            except Exception:
                avg_demand = None
        if quality_summary["Bias_abs"] is not None and avg_demand and avg_demand > 0:
            quality_summary["Bias_abs_pct"] = float(quality_summary["Bias_abs"] / avg_demand)

    checks.append(
        {
            "name": "wape",
            "value": quality_summary["WAPE"],
            "threshold": settings.gate_max_wape,
            "comparator": "<=",
            "pass": quality_summary["WAPE"] is not None and quality_summary["WAPE"] <= settings.gate_max_wape,
        }
    )
    checks.append(
        {
            "name": "bias_abs",
            "value": quality_summary["Bias_abs_pct"],
            "threshold": settings.gate_max_abs_bias,
            "comparator": "<=",
            "pass": quality_summary["Bias_abs_pct"] is not None
            and quality_summary["Bias_abs_pct"] <= settings.gate_max_abs_bias,
        }
    )
    checks.append(
        {
            "name": "under_forecast_rate",
            "value": quality_summary["under_forecast_rate"],
            "threshold": settings.gate_max_under_forecast_rate,
            "comparator": "<=",
            "pass": quality_summary["under_forecast_rate"] is not None
            and quality_summary["under_forecast_rate"] <= settings.gate_max_under_forecast_rate,
        }
    )
    checks.append(
        {
            "name": "mase_mean",
            "value": quality_summary["MASE_mean"],
            "threshold": settings.gate_max_mase_mean,
            "comparator": "<=",
            "pass": quality_summary["MASE_mean"] is not None and quality_summary["MASE_mean"] <= settings.gate_max_mase_mean,
        }
    )

    serving = list_inference_audit(limit=inference_window, dataset=dataset, model_name=model_name).get("summary", {})
    count = int(serving.get("count", 0) or 0)
    fallback_rate = float(serving.get("fallback_rate", 0.0) or 0.0)
    total_errors = int(serving.get("total_errors", 0) or 0)
    error_rate = (total_errors / count) if count else 0.0
    p95_latency = float(serving.get("p95_latency_ms", 0.0) or 0.0)

    checks.append(
        {
            "name": "serving_window_count",
            "value": count,
            "threshold": 1,
            "comparator": ">=",
            "pass": count >= 1,
        }
    )

    checks.append(
        {
            "name": "fallback_rate",
            "value": fallback_rate,
            "threshold": settings.gate_max_fallback_rate,
            "comparator": "<=",
            "pass": fallback_rate <= settings.gate_max_fallback_rate,
        }
    )
    checks.append(
        {
            "name": "hard_error_rate",
            "value": error_rate,
            "threshold": settings.gate_max_hard_error_rate,
            "comparator": "<=",
            "pass": error_rate <= settings.gate_max_hard_error_rate,
        }
    )
    checks.append(
        {
            "name": "p95_latency_ms",
            "value": p95_latency,
            "threshold": settings.gate_max_p95_latency_ms,
            "comparator": "<=",
            "pass": p95_latency <= settings.gate_max_p95_latency_ms,
        }
    )

    required_quality_checks = {"wape", "bias_abs", "under_forecast_rate", "mase_mean"}
    quality_checks = [c for c in checks if c.get("name") in required_quality_checks]
    quality_present = all(c.get("value") is not None for c in quality_checks)
    quality_pass = all(bool(c.get("pass")) for c in quality_checks)

    serving_checks = [c for c in checks if c.get("name") not in required_quality_checks]
    serving_pass = all(bool(c.get("pass")) for c in serving_checks)

    gate_passed = bool(quality_checks) and quality_present and quality_pass and serving_pass

    return {
        "ready": gate_passed,
        "dataset": dataset,
        "model_name": model_name,
        "split": split,
        "inference_window": inference_window,
        "checks": checks,
        "quality_summary": quality_summary,
        "serving_summary": {
            "count": count,
            "fallback_rate": fallback_rate,
            "hard_error_rate": error_rate,
            "p95_latency_ms": p95_latency,
        },
    }


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def resolve_champion_model(dataset: str, horizon: int, requested_model: str | None) -> str:
    if requested_model and requested_model.strip():
        return requested_model.strip()

    try:
        raw = settings.champion_models_json or "{}"
        cfg = json.loads(raw)
    except json.JSONDecodeError:
        cfg = {}

    dataset_key = (dataset or "").upper()
    bucket = cfg.get(dataset_key) or {}

    specific = bucket.get(str(horizon))
    if specific and isinstance(specific, str):
        return specific

    default_model = bucket.get("default")
    if default_model and isinstance(default_model, str):
        return default_model

    # Safe global default when no champion config is provided.
    return "XGBOOST"


def _fallback_value_from_history(history: list[dict[str, Any]], horizon: int, preferred: str = "auto") -> tuple[float, str]:
    demands: list[float] = []
    for row in history:
        try:
            val = float(row.get("demand_units", 0.0))
        except (TypeError, ValueError):
            val = 0.0
        demands.append(max(0.0, val))

    if not demands:
        return 0.0, "last_value"

    if preferred == "last_value":
        return demands[-1], "last_value"
    if preferred == "snaive12":
        if len(demands) >= 12:
            season = demands[-12:]
            return season[(horizon - 1) % 12], "snaive12"
        return demands[-1], "last_value"

    # auto: use seasonal naive when enough history, else last-value.
    if len(demands) >= 12:
        season = demands[-12:]
        return season[(horizon - 1) % 12], "snaive12"
    return demands[-1], "last_value"


def _fallback_from_classical_artifact(dataset: str, series_id: str, horizon: int) -> tuple[float, str] | None:
    model_name = (settings.fallback_classical_model or "ARIMA").strip().upper()
    if not model_name:
        return None
    try:
        out = infer_classical(dataset=dataset, model_name=model_name, series_id=series_id, steps=max(1, int(horizon)))
        forecast = out.get("forecast") or []
        if not forecast:
            return None
        pred = float(forecast[-1])
        if not math.isfinite(pred):
            return None
        return max(0.0, pred), model_name.lower()
    except Exception:
        return None


def _build_fallback_item(
    dataset: str,
    series_payload: dict[str, Any],
    horizon: int,
    reason: str,
    preferred: str = "auto",
) -> dict[str, Any]:
    prediction = 0.0
    method = "last_value"
    series_id = str(series_payload.get("series_id") or "")
    artifact_fallback = _fallback_from_classical_artifact(dataset=dataset, series_id=series_id, horizon=horizon) if series_id else None
    if artifact_fallback is not None:
        prediction, method = artifact_fallback
    else:
        prediction, method = _fallback_value_from_history(series_payload.get("history") or [], horizon, preferred)
    return {
        "series_id": series_payload.get("series_id"),
        "fg_code": series_payload.get("fg_code"),
        "fg_category": series_payload.get("fg_category"),
        "prediction": float(prediction),
        "horizon": horizon,
        "fallback_used": True,
        "fallback_reason": reason,
        "baseline_method": method,
    }


def _normalize_history(history: list[dict[str, Any]]) -> pd.DataFrame:
    frame = pd.DataFrame(history)
    if frame.empty:
        raise ValueError("Series history cannot be empty.")
    if "month" not in frame.columns or "demand_units" not in frame.columns:
        raise ValueError("Each history item must include 'month' and 'demand_units'.")

    frame["month"] = pd.to_datetime(frame["month"], errors="coerce").dt.to_period("M")
    if frame["month"].isna().any():
        bad_rows = frame[frame["month"].isna()].index.tolist()
        raise ValueError(f"Invalid month format in history rows: {bad_rows}. Use YYYY-MM or date strings.")

    frame["demand_units"] = pd.to_numeric(frame["demand_units"], errors="coerce")
    if frame["demand_units"].isna().any():
        bad_rows = frame[frame["demand_units"].isna()].index.tolist()
        raise ValueError(f"Invalid demand_units in history rows: {bad_rows}.")

    for col in EXOG_COLS:
        if col in frame.columns:
            frame[col] = pd.to_numeric(frame[col], errors="coerce")

    agg: dict[str, str] = {"demand_units": "sum"}
    for col in EXOG_COLS:
        if col in frame.columns:
            agg[col] = "last"
    frame = frame.groupby("month", as_index=False).agg(agg).sort_values("month")

    full_months = pd.period_range(frame["month"].min(), frame["month"].max(), freq="M")
    frame = frame.set_index("month").reindex(full_months).rename_axis("month").reset_index()
    frame["demand_units"] = frame["demand_units"].fillna(0.0)
    for col in EXOG_COLS:
        if col not in frame.columns:
            frame[col] = 0.0
        frame[col] = frame[col].fillna(0.0)
    return frame


def _build_online_feature_row(
    series_payload: dict[str, Any],
    model_cols: list[str],
) -> dict[str, Any]:
    history = _normalize_history(series_payload["history"])
    if len(history) < 2:
        raise ValueError(f"Series {series_payload.get('series_id')} has fewer than 2 monthly observations.")

    t_idx = len(history) - 1
    anchor_month = history.iloc[t_idx]["month"]
    demand = history["demand_units"].to_numpy(dtype=float)
    exog = {col: history[col].to_numpy(dtype=float) for col in EXOG_COLS}

    row: dict[str, Any] = {
        "fg_code": series_payload.get("fg_code"),
        "fg_category": series_payload.get("fg_category"),
        "month_num": int(anchor_month.month),
        "quarter": int(anchor_month.quarter),
        "year": int(anchor_month.year),
        "month_sin": float(math.sin(2 * math.pi * int(anchor_month.month) / 12.0)),
        "month_cos": float(math.cos(2 * math.pi * int(anchor_month.month) / 12.0)),
    }

    static_features = series_payload.get("static_features") or {}

    for col in model_cols:
        if col in row:
            continue

        lag_match = re.fullmatch(r"lag_(\d+)", col)
        if lag_match:
            lag = int(lag_match.group(1))
            idx = t_idx - lag
            if idx < 0:
                raise ValueError(
                    f"Series {series_payload.get('series_id')} missing required lag_{lag} history "
                    f"(have {len(history)} months)."
                )
            row[col] = float(demand[idx])
            continue

        roll_mean_match = re.fullmatch(r"roll_mean_(\d+)", col)
        if roll_mean_match:
            window = int(roll_mean_match.group(1))
            start = t_idx - window
            if start < 0:
                raise ValueError(
                    f"Series {series_payload.get('series_id')} missing required roll_mean_{window} history "
                    f"(have {len(history)} months)."
                )
            row[col] = float(demand[start:t_idx].mean())
            continue

        roll_std_match = re.fullmatch(r"roll_std_(\d+)", col)
        if roll_std_match:
            window = int(roll_std_match.group(1))
            start = t_idx - window
            if start < 0:
                raise ValueError(
                    f"Series {series_payload.get('series_id')} missing required roll_std_{window} history "
                    f"(have {len(history)} months)."
                )
            row[col] = float(statistics.stdev(demand[start:t_idx]))
            continue

        exog_lag_match = re.fullmatch(r"([a-z_]+)_lag1", col)
        if exog_lag_match and exog_lag_match.group(1) in EXOG_COLS:
            source_col = exog_lag_match.group(1)
            idx = t_idx - 1
            if idx < 0:
                raise ValueError(
                    f"Series {series_payload.get('series_id')} missing required {source_col}_lag1 history."
                )
            row[col] = float(exog[source_col][idx])
            continue

        row[col] = static_features.get(col, 0)

    return row


def infer_boosting_online(
    dataset: str,
    model_name: str | None,
    horizon: int,
    series: list[Any],
    stage: str = "production",
    clip_negative: bool = True,
) -> dict[str, Any]:
    started = time.perf_counter()
    model_name = resolve_champion_model(dataset=dataset, horizon=horizon, requested_model=model_name)
    metadata: dict[str, Any] = {}
    errors: list[dict[str, str]] = []
    payloads = [s.model_dump() if hasattr(s, "model_dump") else s for s in series]

    items: list[dict[str, Any] | None] = [None] * len(payloads)
    model_queue: list[tuple[int, dict[str, Any]]] = []
    model_cols: list[str] = []

    try:
        reg, metadata = load_boosting_artifact(dataset, model_name, horizon, stage=stage)
        model_cols = metadata.get("model_cols") or []
        if not model_cols:
            raise ValueError("Artifact metadata has no model_cols; cannot build online feature rows.")
        for idx, payload in enumerate(payloads):
            try:
                row = _build_online_feature_row(payload, model_cols)
                model_queue.append((idx, row))
            except Exception as ex:  # noqa: BLE001
                reason = f"feature_build_error: {ex}"
                errors.append({"series_id": str(payload.get("series_id")), "error": reason})
                items[idx] = _build_fallback_item(dataset, payload, horizon, reason=reason, preferred="auto")
    except Exception as ex:  # noqa: BLE001
        # Global model failure: fallback all series.
        reason = f"model_load_or_metadata_error: {ex}"
        for idx, payload in enumerate(payloads):
            items[idx] = _build_fallback_item(dataset, payload, horizon, reason=reason, preferred="auto")
        errors.append({"series_id": "*", "error": reason})
        model_queue = []

    if model_queue:
        try:
            frame = _align_model_columns(pd.DataFrame([row for _, row in model_queue]), model_cols)
            preds = [float(x) for x in _predict_boosting_from_frame(reg, metadata, model_name, frame)]
            if clip_negative:
                preds = [max(0.0, x) for x in preds]
            for (idx, _), pred in zip(model_queue, preds):
                payload = payloads[idx]
                items[idx] = {
                    "series_id": payload.get("series_id"),
                    "fg_code": payload.get("fg_code"),
                    "fg_category": payload.get("fg_category"),
                    "prediction": float(pred),
                    "horizon": horizon,
                    "fallback_used": False,
                    "fallback_reason": None,
                    "baseline_method": None,
                }
        except Exception as ex:  # noqa: BLE001
            reason = f"inference_error: {ex}"
            errors.append({"series_id": "*", "error": reason})
            for idx, _ in model_queue:
                payload = payloads[idx]
                items[idx] = _build_fallback_item(dataset, payload, horizon, reason=reason, preferred="auto")

    finalized_items = [it for it in items if it is not None]
    fallback_count = sum(1 for it in finalized_items if it.get("fallback_used"))
    fallback_used = fallback_count > 0
    fallback_reason = None
    fallback_methods = sorted(
        {
            str(it.get("baseline_method")).strip().lower()
            for it in finalized_items
            if it.get("fallback_used") and it.get("baseline_method")
        }
    )
    if fallback_used:
        fallback_reason = "; ".join({it.get("fallback_reason") for it in finalized_items if it.get("fallback_reason")})

    elapsed_ms = round((time.perf_counter() - started) * 1000.0, 3)
    _log_inference_audit(
        {
            "event": "infer_boosting_online",
            "dataset": dataset,
            "model_name": model_name,
            "horizon": horizon,
            "stage": stage,
            "series_count": len(payloads),
            "response_count": len(finalized_items),
            "errors_count": len(errors),
            "fallback_count": fallback_count,
            "fallback_used": fallback_used,
            "fallback_methods": fallback_methods,
            "latency_ms": elapsed_ms,
        }
    )

    return {
        "dataset": dataset,
        "model_name": model_name,
        "horizon": horizon,
        "stage": stage,
        "count": len(finalized_items),
        "items": finalized_items,
        "errors": errors,
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
        "fallback_count": fallback_count,
        "fallback_methods": fallback_methods,
        "metadata": metadata,
    }
