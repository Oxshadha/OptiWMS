from __future__ import annotations

import json
import logging
import math
import pickle
import re
import statistics
import time
from collections import deque
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


def _load_metadata(path: Path) -> dict[str, Any]:
    meta_path = path / "metadata.json"
    if not meta_path.exists():
        return {}
    return json.loads(meta_path.read_text(encoding="utf-8"))


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
    with model_path.open("rb") as f:
        model = pickle.load(f)
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
    if model_name.upper() == "XGBOOST":
        from xgboost import XGBRegressor
        model_path = path / "model.json"
        if not model_path.exists():
            raise FileNotFoundError(f"Missing artifact: {model_path}")
        reg = XGBRegressor()
        reg.load_model(str(model_path))
        return reg, metadata
    if model_name.upper() == "CATBOOST":
        from catboost import CatBoostRegressor
        model_path = path / "model.cbm"
        if not model_path.exists():
            raise FileNotFoundError(f"Missing artifact: {model_path}")
        reg = CatBoostRegressor()
        reg.load_model(str(model_path))
        return reg, metadata
    if model_name.upper() in {"LIGHTGBM", "RANDOM_FOREST"}:
        model_path = path / "model.pkl"
        if not model_path.exists():
            raise FileNotFoundError(f"Missing artifact: {model_path}")
        with model_path.open("rb") as f:
            reg = pickle.load(f)
        return reg, metadata
    raise ValueError(f"Unsupported boosting model: {model_name}")


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
    if model_name.upper() in {"XGBOOST", "LIGHTGBM", "RANDOM_FOREST"}:
        feature_columns = metadata.get("feature_columns") or []
        x = pd.get_dummies(frame, columns=[c for c in ["fg_code", "fg_category"] if c in frame.columns], drop_first=False)
        x = x.reindex(columns=feature_columns, fill_value=0)
        return reg.predict(x)
    return reg.predict(frame)


def _log_inference_audit(payload: dict[str, Any]) -> None:
    AUDIT_LOGGER.info(json.dumps(payload, default=str))


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


def _build_fallback_item(
    series_payload: dict[str, Any],
    horizon: int,
    reason: str,
    preferred: str = "auto",
) -> dict[str, Any]:
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
    model_name: str,
    horizon: int,
    series: list[Any],
    stage: str = "production",
    clip_negative: bool = True,
) -> dict[str, Any]:
    started = time.perf_counter()
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
                items[idx] = _build_fallback_item(payload, horizon, reason=reason, preferred="auto")
    except Exception as ex:  # noqa: BLE001
        # Global model failure: fallback all series.
        reason = f"model_load_or_metadata_error: {ex}"
        for idx, payload in enumerate(payloads):
            items[idx] = _build_fallback_item(payload, horizon, reason=reason, preferred="auto")
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
                items[idx] = _build_fallback_item(payload, horizon, reason=reason, preferred="auto")

    finalized_items = [it for it in items if it is not None]
    fallback_count = sum(1 for it in finalized_items if it.get("fallback_used"))
    fallback_used = fallback_count > 0
    fallback_reason = None
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
        "metadata": metadata,
    }
