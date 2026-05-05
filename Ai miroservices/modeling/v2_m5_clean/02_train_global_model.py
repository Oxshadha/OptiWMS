#!/usr/bin/env python3
"""Step 2: Train global XGBoost (+ optional CatBoost/LightGBM) on M5 data.

Trains one model per horizon (H1..H12) using direct multi-step forecasting.
Saves artifacts in the format expected by the forecast service's artifact_service.py.

Output: ../outputs/artifacts/P/xgboost_h{1..12}/production/model.json + metadata.json
"""
from __future__ import annotations

import json
import math
import time
from pathlib import Path

import numpy as np
import pandas as pd
import yaml


def load_config() -> dict:
    cfg_path = Path(__file__).parent / "config.yaml"
    with cfg_path.open() as f:
        return yaml.safe_load(f)


def load_panel(cfg: dict) -> pd.DataFrame:
    data_dir = Path(__file__).parent / cfg["output"]["data_dir"]
    path = data_dir / "m5_monthly_panel.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Run 01_prepare_m5.py first. Missing: {path}")
    return pd.read_parquet(path)


# ── Feature / Target Setup ────────────────────────────────────────

def get_feature_columns(panel: pd.DataFrame, cfg: dict) -> list[str]:
    """Return the list of feature columns used for training."""
    feat_cfg = cfg["features"]
    cols = []

    # Lag features
    for lag in feat_cfg["lags"]:
        col = f"lag_{lag}"
        if col in panel.columns:
            cols.append(col)

    # Rolling features
    for w in feat_cfg["rolling_means"]:
        col = f"roll_mean_{w}"
        if col in panel.columns:
            cols.append(col)
    for w in feat_cfg["rolling_stds"]:
        col = f"roll_std_{w}"
        if col in panel.columns:
            cols.append(col)

    # Calendar
    for cal_feat in feat_cfg["calendar"]:
        if cal_feat in panel.columns:
            cols.append(cal_feat)

    # Price
    if feat_cfg.get("price") and "sell_price" in panel.columns:
        cols.append("sell_price")

    return cols


def build_horizon_target(panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    """Create target column: demand at t+horizon for each series."""
    frames = []
    for series_id, group in panel.groupby("series_id"):
        g = group.sort_values("month").copy()
        g["target"] = g["demand"].shift(-horizon)
        frames.append(g)
    result = pd.concat(frames, ignore_index=True)
    return result.dropna(subset=["target"]).reset_index(drop=True)


# ── Model Training ────────────────────────────────────────────────

def train_xgboost(X_train, y_train, X_val, y_val, cfg: dict):
    from xgboost import XGBRegressor
    params = dict(cfg.get("xgboost_params", {}))
    params.setdefault("n_estimators", 500)
    params.setdefault("random_state", 42)

    reg = XGBRegressor(**params)
    reg.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    return reg


def train_catboost(X_train, y_train, X_val, y_val, cfg: dict):
    from catboost import CatBoostRegressor
    params = dict(cfg.get("catboost_params", {}))
    params.setdefault("iterations", 500)
    params.setdefault("random_seed", 42)
    params.setdefault("verbose", 0)

    reg = CatBoostRegressor(**params)
    reg.fit(X_train, y_train, eval_set=(X_val, y_val))
    return reg


def train_lightgbm(X_train, y_train, X_val, y_val, cfg: dict):
    from lightgbm import LGBMRegressor
    params = dict(cfg.get("lightgbm_params", {}))
    params.setdefault("n_estimators", 500)
    params.setdefault("random_state", 42)
    params.setdefault("verbose", -1)

    reg = LGBMRegressor(**params)
    reg.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
    )
    return reg


def save_artifact(reg, model_name: str, horizon: int, feature_cols: list[str],
                  train_metrics: dict, cfg: dict) -> Path:
    """Save model + metadata in the format artifact_service.py expects."""
    dataset_tag = cfg["output"]["dataset_tag"]
    artifacts_dir = Path(__file__).parent / cfg["output"]["artifacts_dir"]
    stage_dir = artifacts_dir / dataset_tag / f"{model_name.lower()}_h{horizon}" / "production"
    stage_dir.mkdir(parents=True, exist_ok=True)

    # Save model
    model_name_upper = model_name.upper()
    if model_name_upper == "XGBOOST":
        model_file = stage_dir / "model.json"
        reg.save_model(str(model_file))
    elif model_name_upper == "CATBOOST":
        model_file = stage_dir / "model.cbm"
        reg.save_model(str(model_file))
    elif model_name_upper in ("LIGHTGBM", "RANDOM_FOREST"):
        import pickle
        model_file = stage_dir / "model.pkl"
        with model_file.open("wb") as f:
            pickle.dump(reg, f)
    else:
        raise ValueError(f"Unsupported model: {model_name}")

    # Feature columns: artifact_service expects these in metadata
    # model_cols = columns used to build feature rows (including fg_code, fg_category for dummies)
    # feature_columns = columns after pd.get_dummies (what model actually sees)
    model_cols = list(feature_cols)

    # For boosting models, get actual feature names from the model
    if hasattr(reg, "feature_names_in_"):
        actual_features = list(reg.feature_names_in_)
    elif hasattr(reg, "get_feature_names"):
        actual_features = reg.get_feature_names()
    else:
        actual_features = model_cols

    # Save metadata
    metadata = {
        "model_name": model_name_upper,
        "dataset": dataset_tag,
        "horizon": horizon,
        "model_cols": model_cols,
        "feature_columns": actual_features,
        "training_source": "M5_Forecasting_Accuracy",
        "aggregation_level": cfg["aggregation"]["level"],
        "training_metrics": train_metrics,
        "feature_config": {
            "lags": cfg["features"]["lags"],
            "rolling_means": cfg["features"]["rolling_means"],
            "rolling_stds": cfg["features"]["rolling_stds"],
            "calendar": cfg["features"]["calendar"],
        },
    }

    meta_path = stage_dir / "metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2, default=str), encoding="utf-8")

    return stage_dir


# ── Main ──────────────────────────────────────────────────────────

def main():
    cfg = load_config()
    panel = load_panel(cfg)
    print(f"[02] Loaded panel: {panel.shape[0]:,} rows, {panel['series_id'].nunique()} series")

    feature_cols = get_feature_columns(panel, cfg)
    print(f"[02] Feature columns ({len(feature_cols)}): {feature_cols}")

    horizons = cfg["models"]["horizons"]
    models_to_train = cfg["models"]["compare"]
    primary_model = cfg["models"]["primary"]

    total_start = time.time()

    for model_name in models_to_train:
        print(f"\n{'='*60}")
        print(f"[02] Training {model_name} for horizons {horizons[0]}..{horizons[-1]}")
        print(f"{'='*60}")

        for h in horizons:
            h_start = time.time()
            print(f"\n[02] --- Horizon H{h} ---")

            # Build target
            horizon_panel = build_horizon_target(panel, h)

            # Split
            train_df = horizon_panel[horizon_panel["split"] == "train"]
            val_df = horizon_panel[horizon_panel["split"] == "validation"]

            X_train = train_df[feature_cols].values
            y_train = train_df["target"].values
            X_val = val_df[feature_cols].values
            y_val = val_df["target"].values

            print(f"[02] Train: {len(X_train):,} rows | Val: {len(X_val):,} rows")

            # Train
            if model_name.upper() == "XGBOOST":
                reg = train_xgboost(X_train, y_train, X_val, y_val, cfg)
            elif model_name.upper() == "CATBOOST":
                reg = train_catboost(X_train, y_train, X_val, y_val, cfg)
            elif model_name.upper() == "LIGHTGBM":
                reg = train_lightgbm(X_train, y_train, X_val, y_val, cfg)
            else:
                print(f"[02] WARNING: Unknown model {model_name}, skipping")
                continue

            # Validation metrics
            val_preds = reg.predict(X_val)
            val_preds = np.clip(val_preds, 0, None)
            residuals = y_val - val_preds

            rmse = float(np.sqrt(np.mean(residuals ** 2)))
            wape = float(np.sum(np.abs(residuals)) / max(np.sum(np.abs(y_val)), 1e-9))
            bias = float(np.mean(residuals))
            mae = float(np.mean(np.abs(residuals)))

            metrics = {"RMSE": rmse, "WAPE": wape, "Bias": bias, "MAE": mae}
            elapsed = time.time() - h_start

            print(f"[02] Val metrics: WAPE={wape:.4f} | RMSE={rmse:.1f} | Bias={bias:.1f} | Time={elapsed:.1f}s")

            # Save artifact
            save_path = save_artifact(reg, model_name, h, feature_cols, metrics, cfg)
            print(f"[02] ✓ Saved to {save_path}")

            # Feature importance (top 10)
            if hasattr(reg, "feature_importances_"):
                importance = sorted(
                    zip(feature_cols, reg.feature_importances_),
                    key=lambda x: x[1], reverse=True
                )[:10]
                print(f"[02] Top features: {[(f, round(v, 4)) for f, v in importance]}")

    total_elapsed = time.time() - total_start
    n_artifacts = len(models_to_train) * len(horizons)
    print(f"\n[02] ✓ Training complete: {n_artifacts} artifacts in {total_elapsed:.0f}s")


if __name__ == "__main__":
    main()
