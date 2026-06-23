#!/usr/bin/env python3
"""Train v6 LightGBM horizon models with MLflow tracking."""

from __future__ import annotations

import argparse
import json
import os
import pickle
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
import yaml

_V6_ROOT = Path(__file__).resolve().parents[1]
if str(_V6_ROOT) not in sys.path:
    sys.path.insert(0, str(_V6_ROOT))
from forecast_utils import evaluate_forecast_suite, sku_sample_weights, tune_lightgbm_optuna  # noqa: E402

from pipeline.data_loader import load_raw_fg, wms_data_ready  # noqa: E402
from pipeline.evaluate import beats_seasonal_naive  # noqa: E402
from pipeline.feature_engineering import (  # noqa: E402
    add_horizon_target,
    engineer_features,
    temporal_split,
)

try:
    import mlflow
    import mlflow.lightgbm

    HAS_MLFLOW = True
except ImportError:
    HAS_MLFLOW = False


def _git_sha() -> str:
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=_V6_ROOT.parent.parent)
            .decode()
            .strip()
        )
    except Exception:
        return "unknown"


def _load_config(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _resolve(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else (_V6_ROOT / p).resolve()


def _mlflow_log_model(model, artifact_path: str) -> None:
    if not HAS_MLFLOW:
        return
    try:
        mlflow.lightgbm.log_model(model, artifact_path)
    except Exception as exc:
        print(f"  MLflow model artifact skipped: {exc}")


DEFAULT_LGB_PARAMS: dict = {
    "objective": "regression",
    "metric": "rmse",
    "learning_rate": 0.05,
    "num_leaves": 31,
    "max_depth": 8,
    "min_child_samples": 20,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 1,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "n_estimators": 300,
    "verbose": -1,
    "n_jobs": 2,
    "random_state": 42,
}


def train_horizon_model(
    fg: pd.DataFrame,
    train_end: pd.Timestamp,
    val_end: pd.Timestamp,
    feature_cols: list[str],
    horizon: int,
    cfg: dict,
    lgb_params: dict | None = None,
) -> tuple[lgb.LGBMRegressor, dict, dict]:
    use_log = bool(cfg.get("use_log_target", True))
    seed = int(cfg.get("seed", 42))
    target = f"target_h{horizon}"

    labeled = add_horizon_target(fg, horizon)
    train_l = labeled[labeled["month"] <= train_end]
    val_l = labeled[(labeled["month"] > train_end) & (labeled["month"] <= val_end)]
    test_l = labeled[labeled["month"] > val_end]
    fit_df = pd.concat([train_l, val_l], ignore_index=True)
    eval_df = test_l if not test_l.empty else val_l
    if eval_df.empty:
        eval_df = train_l.tail(min(len(train_l), max(50, len(labeled) // 10)))

    Xtr, ytr = fit_df[feature_cols].values, fit_df[target].values
    Xva, yva = eval_df[feature_cols].values, eval_df[target].values
    ytr_fit = np.log1p(ytr) if use_log else ytr

    if lgb_params is None:
        yva_fit = np.log1p(yva) if use_log else yva
        try:
            lgb_params = tune_lightgbm_optuna(
                Xtr, ytr_fit, Xva, yva_fit, n_trials=int(cfg.get("optuna_trials", 20)), seed=seed
            )
        except Exception as exc:
            print(f"Optuna tuning skipped ({exc}); using default LightGBM params")
            lgb_params = dict(DEFAULT_LGB_PARAMS)
            lgb_params["random_state"] = seed

    weights = sku_sample_weights(fit_df, "fg_code", target)
    model = lgb.LGBMRegressor(**lgb_params)
    model.fit(Xtr, ytr_fit, sample_weight=weights)

    pred = model.predict(Xva)
    if use_log:
        pred = np.expm1(pred)
    pred = np.clip(pred, 0, None)
    metrics = evaluate_forecast_suite(yva, pred, sku_ids=eval_df["fg_code"].values)
    return model, metrics, lgb_params


def train_quantile_model(
    fg: pd.DataFrame,
    train_end: pd.Timestamp,
    val_end: pd.Timestamp,
    feature_cols: list[str],
    horizon: int,
    alpha: float,
    base_params: dict,
) -> lgb.LGBMRegressor:
    target = f"target_h{horizon}"
    labeled = add_horizon_target(fg, horizon)
    fit_df = labeled[labeled["month"] <= val_end]
    Xtr, ytr = fit_df[feature_cols].values, fit_df[target].values
    params = dict(base_params)
    params.update({"objective": "quantile", "alpha": alpha, "metric": "quantile"})
    model = lgb.LGBMRegressor(**params)
    model.fit(Xtr, np.log1p(ytr))
    return model


def run_training(data_source: str, register: bool, cfg: dict) -> dict:
    if data_source == "wms":
        ready, info = wms_data_ready(cfg)
        if not ready:
            raise RuntimeError(f"WMS data not ready for training: {info}")

    eng_path = _resolve(cfg["paths"]["engineered_csv"])
    fg_raw = load_raw_fg(data_source, cfg)
    fg, feature_cols, encoders = engineer_features(fg_raw, save_path=eng_path)
    train_df, val_df, test_df, train_end, val_end = temporal_split(fg)

    if HAS_MLFLOW:
        tracking = os.getenv("MLFLOW_TRACKING_URI", f"sqlite:///{_V6_ROOT / 'mlruns' / 'mlflow.db'}")
        os.environ.setdefault("MLFLOW_ALLOW_FILE_STORE", "true")
        mlflow.set_tracking_uri(tracking)
        mlflow.set_experiment(cfg.get("experiment_name", "OptiWMS_v6_FG"))

    horizons = [int(h) for h in cfg.get("horizons", list(range(1, 13)))]
    quantiles = [float(q) for q in cfg.get("quantile_alphas", [0.1, 0.5, 0.9])]
    run_dir = _V6_ROOT / "pipeline" / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir.mkdir(parents=True, exist_ok=True)

    shared_params: dict | None = None
    horizon_results: list[dict] = []
    mlflow_run_id: str | None = None

    ctx = mlflow.start_run(run_name=f"v6_{data_source}") if HAS_MLFLOW else _null_context()
    with ctx:
        if HAS_MLFLOW:
            mlflow_run_id = mlflow.active_run().info.run_id
            mlflow.set_tags(
                {
                    "data_source": data_source,
                    "git_sha": _git_sha(),
                    "sku_count": str(fg["fg_code"].nunique()),
                    "training_cutoff": str(train_end.date()),
                }
            )
            mlflow.log_param("horizons", ",".join(str(h) for h in horizons))
            mlflow.log_param("use_log_target", cfg.get("use_log_target", True))

        for h in horizons:
            model, metrics, shared_params = train_horizon_model(
                fg, train_end, val_end, feature_cols, h, cfg, lgb_params=shared_params
            )
            beats, naive_wape = beats_seasonal_naive(fg, metrics["WAPE"])
            horizon_results.append({"horizon": h, **metrics, "beats_naive": beats, "naive_wape": naive_wape})

            hdir = run_dir / f"h{h}"
            hdir.mkdir(parents=True, exist_ok=True)
            with (hdir / "model.pkl").open("wb") as f:
                pickle.dump(model, f)
            model.booster_.save_model(str(hdir / "model.txt"))

            meta = {
                "model_name": cfg.get("model_name", "LIGHTGBM"),
                "dataset": cfg.get("dataset", "P"),
                "horizon": h,
                "model_cols": feature_cols,
                "feature_columns": feature_cols,
                "use_log_target": bool(cfg.get("use_log_target", True)),
                "training_source": data_source,
                "mlflow_run_id": mlflow_run_id,
                "encoders": encoders,
                "training_metrics": metrics,
                "data_cutoff": {"train_end": str(train_end.date()), "val_end": str(val_end.date())},
            }
            (hdir / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

            if HAS_MLFLOW:
                mlflow.log_metrics({f"h{h}_WAPE": metrics["WAPE"], f"h{h}_RMSE": metrics["RMSE"]})
                _mlflow_log_model(model, f"lightgbm_h{h}")

            for alpha in quantiles:
                if alpha == 0.5:
                    continue
                q_model = train_quantile_model(fg, train_end, val_end, feature_cols, h, alpha, shared_params or {})
                q_path = hdir / f"model_q{int(alpha * 100)}.pkl"
                with q_path.open("wb") as f:
                    pickle.dump(q_model, f)

        results_df = pd.DataFrame(horizon_results)
        results_path = run_dir / "horizon_metrics.json"
        results_path.write_text(results_df.to_json(orient="records", indent=2), encoding="utf-8")
        eng_dir = _V6_ROOT / "data" / "engineered"
        eng_dir.mkdir(parents=True, exist_ok=True)
        results_df.to_csv(eng_dir / "model_comparison_results.csv", index=False)

        if HAS_MLFLOW and register:
            reg_name = cfg.get("registered_model_name", "optiwms-forecast-lightgbm")
            try:
                mlflow.register_model(f"runs:/{mlflow_run_id}/lightgbm_h1", reg_name)
            except Exception as exc:
                print(f"MLflow register skipped: {exc}")

    summary = {
        "run_dir": str(run_dir),
        "mlflow_run_id": mlflow_run_id,
        "data_source": data_source,
        "sku_count": int(fg["fg_code"].nunique()),
        "horizons_trained": horizons,
        "mean_wape": float(results_df["WAPE"].mean()) if not results_df.empty else None,
    }
    (run_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


class _null_context:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Train v6 LightGBM horizon models")
    parser.add_argument("--config", default=str(_V6_ROOT / "pipeline" / "config.yaml"))
    parser.add_argument("--data-source", default=None, choices=["bootstrap", "engineered", "wms", "auto"])
    parser.add_argument("--register", action="store_true", help="Register champion in MLflow Model Registry")
    args = parser.parse_args()

    cfg = _load_config(Path(args.config))
    data_source = args.data_source or os.getenv("TRAINING_DATA_SOURCE", "bootstrap")
    if data_source == "auto":
        ready, _ = wms_data_ready(cfg)
        data_source = "wms" if ready else "bootstrap"

    summary = run_training(data_source=data_source, register=args.register, cfg=cfg)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
