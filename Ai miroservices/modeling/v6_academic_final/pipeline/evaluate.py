"""Rolling-origin evaluation for v6 pipeline."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

_V6_ROOT = Path(__file__).resolve().parents[1]
if str(_V6_ROOT) not in sys.path:
    sys.path.insert(0, str(_V6_ROOT))
from forecast_utils import evaluate_forecast_suite, rolling_origin_splits, sku_sample_weights, tune_lightgbm_optuna  # noqa: E402

import lightgbm as lgb  # noqa: E402


def evaluate_rolling_origin(
    fg: pd.DataFrame,
    feature_cols: list[str],
    cfg: dict,
) -> pd.DataFrame:
    months = sorted(fg["month"].unique())
    origins = rolling_origin_splits(
        months,
        n_origins=4,
        val_horizon=int(cfg.get("val_horizon_months", 6)),
        min_train_months=int(cfg.get("min_train_months", 18)),
    )
    rows: list[dict] = []
    use_log = bool(cfg.get("use_log_target", True))
    seed = int(cfg.get("seed", 42))
    trials = int(cfg.get("optuna_trials", 20))

    for split in origins:
        tr = fg[fg["month"].apply(split["train_mask"])].copy()
        va = fg[fg["month"].apply(split["val_mask"])].copy()
        if tr.empty or va.empty:
            continue

        Xtr, ytr = tr[feature_cols].values, tr["demand_units"].values
        Xva, yva = va[feature_cols].values, va["demand_units"].values
        ytr_fit = np.log1p(ytr) if use_log else ytr
        w = sku_sample_weights(tr, "fg_code", "demand_units")

        params = tune_lightgbm_optuna(Xtr, ytr_fit, Xva, yva if not use_log else np.log1p(yva), n_trials=trials, seed=seed)
        model = lgb.LGBMRegressor(**params)
        model.fit(Xtr, ytr_fit, sample_weight=w)
        pred = model.predict(Xva)
        if use_log:
            pred = np.expm1(pred)
        pred = np.clip(pred, 0, None)

        metrics = evaluate_forecast_suite(yva, pred, sku_ids=va["fg_code"].values)
        metrics["origin_train_end"] = str(split["train_end"])
        rows.append(metrics)

    return pd.DataFrame(rows)


def beats_seasonal_naive(fg: pd.DataFrame, wape: float) -> tuple[bool, float]:
    """Seasonal naive WAPE on validation months for gate check."""
    months = sorted(fg["month"].unique())
    if len(months) < 14:
        return True, wape
    train_end = months[min(23, len(months) - 7)]
    val = fg[fg["month"] > train_end].copy()
    preds, actuals = [], []
    for sku, g in val.groupby("fg_code"):
        g = g.sort_values("month")
        hist = fg[(fg["fg_code"] == sku) & (fg["month"] <= train_end)].sort_values("month")
        if len(hist) < 13:
            continue
        for _, row in g.iterrows():
            lag12 = hist[hist["month"] == row["month"] - pd.DateOffset(months=12)]
            if lag12.empty:
                naive = hist["demand_units"].iloc[-1]
            else:
                naive = float(lag12["demand_units"].iloc[0])
            preds.append(naive)
            actuals.append(float(row["demand_units"]))
    if not actuals:
        return True, wape
    naive_wape = float(np.sum(np.abs(np.array(actuals) - np.array(preds))) / max(np.sum(np.abs(actuals)), 1.0))
    return wape < naive_wape * 0.95, naive_wape
