from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any

import pandas as pd

from app.core.config import settings


ARTIFACT_ROOT = Path(settings.artifact_dir)


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
    raise ValueError(f"Unsupported boosting model: {model_name}")


def infer_boosting(dataset: str, model_name: str, horizon: int, rows: list[dict[str, Any]]) -> dict[str, Any]:
    reg, metadata = load_boosting_artifact(dataset, model_name, horizon)
    model_cols = metadata.get("model_cols") or []
    frame = pd.DataFrame(rows)
    for col in model_cols:
        if col not in frame.columns:
            frame[col] = 0
    frame = frame[model_cols].copy()

    if model_name.upper() == "XGBOOST":
        feature_columns = metadata.get("feature_columns") or []
        x = pd.get_dummies(frame, columns=[c for c in ["fg_code", "fg_category"] if c in frame.columns], drop_first=False)
        x = x.reindex(columns=feature_columns, fill_value=0)
        preds = reg.predict(x)
    else:
        preds = reg.predict(frame)

    return {
        "dataset": dataset,
        "model_name": model_name,
        "horizon": horizon,
        "predictions": [float(x) for x in preds],
        "metadata": metadata,
    }
