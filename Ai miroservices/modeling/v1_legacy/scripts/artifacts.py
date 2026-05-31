from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any

from common import OUT_DIR


ARTIFACT_DIR = OUT_DIR / "artifacts"


def ensure_artifact_dir() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def model_dir(dataset: str, model_name: str, stage: str = "production") -> Path:
    ensure_artifact_dir()
    return ARTIFACT_DIR / dataset / model_name.lower() / stage


def save_metadata(path: Path, metadata: dict[str, Any]) -> None:
    path.mkdir(parents=True, exist_ok=True)
    (path / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def save_pickle_model(model: Any, dataset: str, model_name: str, stage: str, metadata: dict[str, Any]) -> Path:
    path = model_dir(dataset, model_name, stage)
    path.mkdir(parents=True, exist_ok=True)
    model_path = path / "model.pkl"
    with model_path.open("wb") as f:
        pickle.dump(model, f)
    save_metadata(path, metadata)
    return model_path


def save_xgboost_model(model: Any, dataset: str, model_name: str, stage: str, metadata: dict[str, Any]) -> Path:
    path = model_dir(dataset, model_name, stage)
    path.mkdir(parents=True, exist_ok=True)
    model_path = path / "model.json"
    model.save_model(str(model_path))
    save_metadata(path, metadata)
    return model_path


def save_catboost_model(model: Any, dataset: str, model_name: str, stage: str, metadata: dict[str, Any]) -> Path:
    path = model_dir(dataset, model_name, stage)
    path.mkdir(parents=True, exist_ok=True)
    model_path = path / "model.cbm"
    model.save_model(str(model_path))
    save_metadata(path, metadata)
    return model_path
