#!/usr/bin/env python3
"""Step 3: Evaluate trained models on the held-out test set.

Loads test split, runs inference through saved artifacts, computes
WAPE/MASE/RMSE/Bias per horizon, compares against seasonal naive baseline,
and generates the report CSVs the forecast service expects.

Output:
  ../outputs/reports/test_metrics_by_horizon.csv
  ../outputs/reports/dashboard_forecast_output.csv
  ../outputs/reports/dashboard_inventory_recommendations.csv
"""
from __future__ import annotations

import json
import math
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


def load_model(model_name: str, horizon: int, cfg: dict):
    """Load a trained model artifact."""
    dataset_tag = cfg["output"]["dataset_tag"]
    artifacts_dir = Path(__file__).parent / cfg["output"]["artifacts_dir"]
    stage_dir = artifacts_dir / dataset_tag / f"{model_name.lower()}_h{horizon}" / "production"

    meta_path = stage_dir / "metadata.json"
    if not meta_path.exists():
        return None, None

    metadata = json.loads(meta_path.read_text(encoding="utf-8"))

    model_name_upper = model_name.upper()
    if model_name_upper == "XGBOOST":
        from xgboost import XGBRegressor
        reg = XGBRegressor()
        reg.load_model(str(stage_dir / "model.json"))
    elif model_name_upper == "CATBOOST":
        from catboost import CatBoostRegressor
        reg = CatBoostRegressor()
        reg.load_model(str(stage_dir / "model.cbm"))
    elif model_name_upper in ("LIGHTGBM", "RANDOM_FOREST"):
        import pickle
        with (stage_dir / "model.pkl").open("rb") as f:
            reg = pickle.load(f)
    else:
        return None, None

    return reg, metadata


# ── Metrics ───────────────────────────────────────────────────────

def compute_wape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sum(np.abs(y_true - y_pred)) / max(np.sum(np.abs(y_true)), 1e-9))


def compute_rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def compute_bias(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(y_true - y_pred))


def compute_mase(y_true: np.ndarray, y_pred: np.ndarray,
                 y_train: np.ndarray, seasonality: int = 12) -> float:
    """Mean Absolute Scaled Error (Hyndman & Koehler, 2006)."""
    mae = np.mean(np.abs(y_true - y_pred))
    if len(y_train) <= seasonality:
        naive_mae = np.mean(np.abs(np.diff(y_train)))
    else:
        naive_mae = np.mean(np.abs(y_train[seasonality:] - y_train[:-seasonality]))
    if naive_mae < 1e-9:
        return float("inf")
    return float(mae / naive_mae)


def compute_under_forecast_rate(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(y_pred < y_true))


# ── Seasonal Naive Baseline ──────────────────────────────────────

def seasonal_naive_forecast(panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    """Generate seasonal naive forecasts: y_hat(t+h) = y(t+h-12)."""
    frames = []
    for series_id, group in panel.groupby("series_id"):
        g = group.sort_values("month").copy()
        g["snaive_pred"] = g["demand"].shift(12)
        g["target"] = g["demand"].shift(-horizon)
        frames.append(g)
    result = pd.concat(frames, ignore_index=True)
    return result.dropna(subset=["target", "snaive_pred"]).reset_index(drop=True)


# ── Report Generation ────────────────────────────────────────────

def generate_forecast_output(test_df: pd.DataFrame, predictions: np.ndarray,
                             model_name: str, horizon: int, cfg: dict) -> pd.DataFrame:
    """Generate dashboard_forecast_output.csv format rows."""
    rows = []
    for i, (_, row) in enumerate(test_df.iterrows()):
        pred = float(predictions[i])
        actual = float(row["target"]) if "target" in row and pd.notna(row.get("target")) else None
        rows.append({
            "run_id": 1,
            "dataset": cfg["output"]["dataset_tag"],
            "model": model_name.upper(),
            "split": "test",
            "sku": str(row.get("series_id", "")),
            "category": str(row.get("category", "")),
            "month": str(row.get("month", "")),
            "horizon": horizon,
            "p10": round(max(0, pred * 0.85), 2),
            "p50": round(max(0, pred), 2),
            "p90": round(max(0, pred * 1.15), 2),
            "y_true": round(actual, 2) if actual is not None else None,
        })
    return pd.DataFrame(rows)


def generate_inventory_recommendations(forecast_df: pd.DataFrame,
                                       cfg: dict) -> pd.DataFrame:
    """Generate dashboard_inventory_recommendations.csv format rows."""
    # Group by SKU, take average p50 across horizons as demand estimate
    if forecast_df.empty:
        return pd.DataFrame()

    sku_demand = forecast_df.groupby("sku").agg(
        avg_demand=("p50", "mean"),
        category=("category", "first"),
    ).reset_index()

    rows = []
    for _, row in sku_demand.iterrows():
        demand = float(row["avg_demand"])
        safety_stock = round(demand * 0.3, 2)  # 30% of avg demand
        reorder_point = round(demand + safety_stock, 2)
        target_max = round(demand * 2.5, 2)
        rows.append({
            "run_id": 1,
            "dataset": cfg["output"]["dataset_tag"],
            "model": forecast_df["model"].iloc[0] if "model" in forecast_df.columns else "XGBOOST",
            "sku": str(row["sku"]),
            "category": str(row["category"]),
            "safety_stock": safety_stock,
            "reorder_point": reorder_point,
            "target_max": target_max,
            "on_hand_inventory": round(demand * 1.5, 2),  # simulated
            "suggested_order_qty": max(0, round(target_max - demand * 1.5, 2)),
        })
    return pd.DataFrame(rows)


# ── Main ──────────────────────────────────────────────────────────

def main():
    cfg = load_config()
    panel = load_panel(cfg)
    print(f"[03] Loaded panel: {panel.shape[0]:,} rows")

    # Get feature columns
    feat_cfg = cfg["features"]
    feature_cols = []
    for lag in feat_cfg["lags"]:
        col = f"lag_{lag}"
        if col in panel.columns:
            feature_cols.append(col)
    for w in feat_cfg["rolling_means"]:
        col = f"roll_mean_{w}"
        if col in panel.columns:
            feature_cols.append(col)
    for w in feat_cfg["rolling_stds"]:
        col = f"roll_std_{w}"
        if col in panel.columns:
            feature_cols.append(col)
    for cal_feat in feat_cfg["calendar"]:
        if cal_feat in panel.columns:
            feature_cols.append(cal_feat)
    if feat_cfg.get("price") and "sell_price" in panel.columns:
        feature_cols.append("sell_price")

    horizons = cfg["models"]["horizons"]
    models_to_eval = cfg["models"]["compare"]
    reports_dir = Path(__file__).parent / cfg["output"]["reports_dir"]
    reports_dir.mkdir(parents=True, exist_ok=True)

    all_metrics = []
    all_forecasts = []

    for model_name in models_to_eval:
        print(f"\n{'='*60}")
        print(f"[03] Evaluating {model_name}")
        print(f"{'='*60}")

        for h in horizons:
            # Build horizon target
            frames = []
            for series_id, group in panel.groupby("series_id"):
                g = group.sort_values("month").copy()
                g["target"] = g["demand"].shift(-h)
                frames.append(g)
            horizon_panel = pd.concat(frames, ignore_index=True)
            horizon_panel = horizon_panel.dropna(subset=["target"]).reset_index(drop=True)

            test_df = horizon_panel[horizon_panel["split"] == "test"].copy()
            train_df = horizon_panel[horizon_panel["split"] == "train"].copy()

            if test_df.empty:
                print(f"[03] H{h}: No test data, skipping")
                continue

            # Load model
            reg, metadata = load_model(model_name, h, cfg)
            if reg is None:
                print(f"[03] H{h}: No artifact for {model_name}, skipping")
                continue

            # Predict
            X_test = test_df[feature_cols].values
            y_test = test_df["target"].values
            preds = np.clip(reg.predict(X_test), 0, None)

            # Seasonal naive baseline
            snaive_df = seasonal_naive_forecast(panel, h)
            snaive_test = snaive_df[snaive_df["split"] == "test"].copy()
            if not snaive_test.empty:
                y_snaive = snaive_test["target"].values
                snaive_preds = snaive_test["snaive_pred"].values
                naive_wape = compute_wape(y_snaive, snaive_preds)
                naive_rmse = compute_rmse(y_snaive, snaive_preds)
            else:
                naive_wape = None
                naive_rmse = None

            # Compute test metrics
            y_train_all = train_df["demand"].values
            wape = compute_wape(y_test, preds)
            rmse = compute_rmse(y_test, preds)
            bias = compute_bias(y_test, preds)
            mase = compute_mase(y_test, preds, y_train_all)
            ufr = compute_under_forecast_rate(y_test, preds)

            # Compute train metrics (for bias-variance diagnostic)
            X_train = train_df[feature_cols].values
            train_preds = np.clip(reg.predict(X_train), 0, None)
            train_wape = compute_wape(y_train_all, train_preds)
            train_rmse = compute_rmse(y_train_all, train_preds)

            naive_str = f"{naive_wape:.4f}" if naive_wape is not None else "N/A"
            print(f"[03] H{h}: WAPE={wape:.4f} (naive={naive_str}) | "
                  f"TrainWAPE={train_wape:.4f} | RMSE={rmse:.1f} | Bias={bias:.1f}")

            # Collect metrics
            metric_row = {
                "run_id": 1,
                "dataset": cfg["output"]["dataset_tag"],
                "model": model_name.upper(),
                "split": "test",
                "horizon": h,
                "WAPE": round(wape, 6),
                "Train_WAPE": round(train_wape, 6),
                "RMSE": round(rmse, 4),
                "Train_RMSE": round(train_rmse, 4),
                "Bias": round(bias, 4),
                "MASE_mean": round(mase, 6),
                "under_forecast_rate": round(ufr, 6),
                "naive_WAPE": round(naive_wape, 6) if naive_wape is not None else None,
                "naive_RMSE": round(naive_rmse, 4) if naive_rmse is not None else None,
                "beats_naive": wape < naive_wape if naive_wape is not None else None,
            }
            all_metrics.append(metric_row)

            # Collect forecasts
            forecast_df = generate_forecast_output(test_df, preds, model_name, h, cfg)
            all_forecasts.append(forecast_df)

    # ── Save Reports ──────────────────────────────────────────────

    # Metrics report
    metrics_df = pd.DataFrame(all_metrics)
    metrics_path = reports_dir / "test_metrics_by_horizon.csv"
    metrics_df.to_csv(metrics_path, index=False)
    print(f"\n[03] ✓ Saved metrics to {metrics_path}")

    # Forecast output
    if all_forecasts:
        forecast_all = pd.concat(all_forecasts, ignore_index=True)
        forecast_path = reports_dir / "dashboard_forecast_output.csv"
        forecast_all.to_csv(forecast_path, index=False)
        print(f"[03] ✓ Saved forecasts to {forecast_path} ({len(forecast_all):,} rows)")

        # Inventory recommendations (from primary model only)
        primary = cfg["models"]["primary"]
        primary_forecasts = forecast_all[forecast_all["model"] == primary.upper()]
        reco_df = generate_inventory_recommendations(primary_forecasts, cfg)
        reco_path = reports_dir / "dashboard_inventory_recommendations.csv"
        reco_df.to_csv(reco_path, index=False)
        print(f"[03] ✓ Saved inventory recommendations to {reco_path} ({len(reco_df):,} rows)")

    # ── Summary ───────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("[03] EVALUATION SUMMARY")
    print(f"{'='*60}")

    for model_name in models_to_eval:
        model_metrics = metrics_df[metrics_df["model"] == model_name.upper()]
        if model_metrics.empty:
            continue
        avg_wape = model_metrics["WAPE"].mean()
        avg_train_wape = model_metrics["Train_WAPE"].mean()
        avg_rmse = model_metrics["RMSE"].mean()
        avg_bias = model_metrics["Bias"].mean()
        avg_mase = model_metrics["MASE_mean"].mean()
        beats_count = model_metrics["beats_naive"].sum()
        total_horizons = len(model_metrics)
        print(f"\n  {model_name.upper()}")
        print(f"    Avg Test WAPE : {avg_wape:.4f}")
        print(f"    Avg Train WAPE: {avg_train_wape:.4f}")
        print(f"    Avg RMSE: {avg_rmse:.1f}")
        print(f"    Avg Bias: {avg_bias:.1f}")
        print(f"    Avg MASE: {avg_mase:.4f}")
        print(f"    Beats naive: {beats_count}/{total_horizons} horizons")

    naive_metrics = metrics_df[metrics_df["naive_WAPE"].notna()]
    if not naive_metrics.empty:
        avg_naive_wape = naive_metrics["naive_WAPE"].mean()
        print(f"\n  SEASONAL NAIVE BASELINE")
        print(f"    Avg WAPE: {avg_naive_wape:.4f}")

    print(f"\n[03] ✓ Evaluation complete")


if __name__ == "__main__":
    main()
