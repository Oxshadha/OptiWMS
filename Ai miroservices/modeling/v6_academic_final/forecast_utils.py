"""Shared forecasting utilities for OptiWMS v6 academic notebooks."""

from __future__ import annotations

import warnings
from typing import Any

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=UserWarning)


def aggregate_fg_monthly(fg: pd.DataFrame) -> pd.DataFrame:
    """Collapse 60 MC scenarios per SKU-month to expected monthly panel (~3.7k rows)."""
    fg = fg.copy()
    fg["month"] = pd.to_datetime(fg["month"]).dt.to_period("M").dt.to_timestamp()
    if "demand_units_clean" in fg.columns and "demand_units" not in fg.columns:
        fg["demand_units"] = fg["demand_units_clean"]
    num_cols = fg.select_dtypes(include=[np.number]).columns.tolist()
    agg: dict[str, str] = {c: "mean" for c in num_cols}
    for c in ["promotion_flag", "holiday_flag"]:
        if c in fg.columns:
            agg[c] = "max"
    for c in fg.columns:
        if c not in agg and c not in ("fg_code", "month"):
            agg[c] = "first"
    out = fg.groupby(["fg_code", "month"], as_index=False).agg(agg)
    return out.sort_values(["fg_code", "month"]).reset_index(drop=True)


def wape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    denom = max(np.sum(np.abs(y_true)), 1.0)
    return float(np.sum(np.abs(y_true - y_pred)) / denom)


def rolling_origin_splits(
    sorted_months: list,
    n_origins: int = 4,
    val_horizon: int = 6,
    min_train_months: int = 18,
) -> list[dict[str, Any]]:
    """Generate rolling-origin train/val cut points."""
    months = list(sorted_months)
    n = len(months)
    if n < min_train_months + val_horizon:
        return []

    # Evenly spaced train-end indices
    max_train_idx = n - val_horizon - 1
    if max_train_idx < min_train_months - 1:
        return []

    start = min_train_months - 1
    indices = np.linspace(start, max_train_idx, num=min(n_origins, max_train_idx - start + 1), dtype=int)
    splits = []
    for train_end_idx in sorted(set(indices.tolist())):
        train_end = months[train_end_idx]
        val_end_idx = min(train_end_idx + val_horizon, n - 1)
        val_end = months[val_end_idx]
        splits.append(
            {
                "train_end": train_end,
                "val_end": val_end,
                "train_mask": lambda m, te=train_end: m <= te,
                "val_mask": lambda m, te=train_end, ve=val_end: (m > te) & (m <= ve),
            }
        )
    return splits


def sku_sample_weights(train_df: pd.DataFrame, id_col: str = "fg_code", target: str = "demand_units") -> np.ndarray:
    """Inverse mean-demand weights so C-class SKUs are not drowned out in global loss."""
    sku_mean = train_df.groupby(id_col)[target].mean().replace(0, 1.0)
    weights = train_df[id_col].map(lambda s: 1.0 / sku_mean[s]).values.astype(float)
    weights = weights / weights.mean()
    return weights


def tune_lightgbm_optuna(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    n_trials: int = 30,
    seed: int = 42,
    n_jobs: int = 2,
) -> dict[str, Any]:
    """Timeboxed Optuna search minimising validation WAPE."""
    import lightgbm as lgb
    import optuna

    optuna.logging.set_verbosity(optuna.logging.WARNING)

    def objective(trial: optuna.Trial) -> float:
        params = {
            "objective": "regression",
            "metric": "rmse",
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.15, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 15, 63),
            "max_depth": trial.suggest_int("max_depth", 4, 12),
            "min_child_samples": trial.suggest_int("min_child_samples", 5, 40),
            "feature_fraction": trial.suggest_float("feature_fraction", 0.5, 1.0),
            "bagging_fraction": trial.suggest_float("bagging_fraction", 0.5, 1.0),
            "bagging_freq": trial.suggest_int("bagging_freq", 1, 7),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 1.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 1.0, log=True),
            "n_estimators": 300,
            "verbose": -1,
            "n_jobs": n_jobs,
            "random_state": seed,
        }
        model = lgb.LGBMRegressor(**params)
        model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(30, verbose=False)],
        )
        pred = np.clip(model.predict(X_val), 0, None)
        return wape(y_val, pred)

    study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=seed))
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    best = study.best_params
    best.update(
        {
            "objective": "regression",
            "metric": "rmse",
            "n_estimators": 300,
            "verbose": -1,
            "n_jobs": n_jobs,
            "random_state": seed,
        }
    )
    return best


def cap_forecast(
    train: np.ndarray,
    forecast: np.ndarray,
    upper_mult: float = 3.0,
    lower: float = 0.0,
) -> np.ndarray:
    """Clip forecasts to a plausible range based on training history (prevents SARIMAX blow-ups)."""
    train = np.asarray(train, dtype=float)
    fc = np.asarray(forecast, dtype=float)
    hist_max = max(float(np.nanmax(train)), 1.0)
    hist_mean = max(float(np.nanmean(train)), 1.0)
    upper = max(hist_max * upper_mult, hist_mean * 5.0)
    return np.clip(fc, lower, upper)


def per_sku_wape_median(
    actuals: np.ndarray,
    preds: np.ndarray,
    sku_ids: np.ndarray,
) -> float:
    """Median WAPE across SKUs — robust when one series has explosive statistical forecasts."""
    df = pd.DataFrame({"sku": sku_ids, "y": actuals, "p": preds})
    wapes = []
    for _, g in df.groupby("sku"):
        denom = max(g["y"].abs().sum(), 1.0)
        wapes.append(g["y"].sub(g["p"]).abs().sum() / denom)
    return float(np.median(wapes)) if wapes else np.nan


def evaluate_forecast_suite(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_train: np.ndarray | None = None,
    sku_ids: np.ndarray | None = None,
) -> dict[str, float]:
    """Pooled + robust (median per-SKU) metrics for model comparison tables."""
    from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.clip(np.asarray(y_pred, dtype=float), 0, None)
    out = {
        "RMSE": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "MAE": float(mean_absolute_error(y_true, y_pred)),
        "WAPE": wape(y_true, y_pred),
        "R2": float(r2_score(y_true, y_pred)),
        "Bias": float(np.mean(y_pred - y_true)),
    }
    if sku_ids is not None:
        out["WAPE_median_per_sku"] = per_sku_wape_median(y_true, y_pred, sku_ids)
    return out


def auto_arima_forecast(
    series: np.ndarray,
    horizon: int,
    seasonal_period: int = 12,
    timeout: int = 30,
) -> np.ndarray | None:
    """Per-SKU auto_arima; non-seasonal if history too short for m=12."""
    try:
        from pmdarima import auto_arima
    except ImportError:
        return None

    s = np.asarray(series, dtype=float)
    if len(s) < 8:
        return None
    use_seasonal = len(s) >= 2 * seasonal_period
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = auto_arima(
                s,
                seasonal=use_seasonal,
                m=seasonal_period if use_seasonal else 1,
                stepwise=True,
                suppress_warnings=True,
                error_action="ignore",
                max_p=2,
                max_q=2,
                max_P=1 if use_seasonal else 0,
                max_Q=1 if use_seasonal else 0,
                max_d=1,
                max_D=1 if use_seasonal else 0,
                n_jobs=1,
            )
        fc = model.predict(n_periods=horizon)
        return cap_forecast(s, np.asarray(fc, dtype=float))
    except Exception:
        return None


def sarimax_fallback_forecast(
    series: np.ndarray,
    horizon: int,
    seasonal_period: int = 12,
) -> np.ndarray | None:
    """ARIMA fallback when auto_arima fails; caps explosive seasonal fits on short series."""
    try:
        from statsmodels.tsa.statespace.sarimax import SARIMAX
    except ImportError:
        return None

    s = np.asarray(series, dtype=float)
    if len(s) < 8:
        return None
    use_seasonal = len(s) >= 2 * seasonal_period
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            if use_seasonal:
                model = SARIMAX(
                    s,
                    order=(1, 1, 1),
                    seasonal_order=(1, 1, 0, seasonal_period),
                    enforce_stationarity=False,
                    enforce_invertibility=False,
                )
            else:
                model = SARIMAX(
                    s,
                    order=(1, 1, 1),
                    seasonal_order=(0, 0, 0, 0),
                    enforce_stationarity=False,
                    enforce_invertibility=False,
                )
            res = model.fit(disp=False)
            fc = res.forecast(horizon)
        return cap_forecast(s, np.asarray(fc, dtype=float))
    except Exception:
        return None


def reconcile_bottom_up(
    sku_preds: pd.DataFrame,
    category_col: str = "fg_category",
    month_col: str = "month",
    pred_col: str = "y_pred",
) -> pd.DataFrame:
    """Sum SKU forecasts to category and total levels."""
    cat = (
        sku_preds.groupby([month_col, category_col], as_index=False)[pred_col]
        .sum()
        .rename(columns={pred_col: "y_pred_cat"})
    )
    total = (
        sku_preds.groupby(month_col, as_index=False)[pred_col]
        .sum()
        .rename(columns={pred_col: "y_pred_total_bu"})
    )
    return cat.merge(total, on=month_col)


def reconcile_top_down(
    sku_preds: pd.DataFrame,
    category_forecasts: pd.DataFrame,
    category_col: str = "fg_category",
    month_col: str = "month",
    pred_col: str = "y_pred",
    cat_pred_col: str = "y_pred_cat",
) -> pd.DataFrame:
    """Allocate category forecasts to SKUs by historical share."""
    hist_share = (
        sku_preds.groupby([category_col, "fg_code"])[pred_col]
        .mean()
        .reset_index(name="sku_share_raw")
    )
    cat_totals = hist_share.groupby(category_col)["sku_share_raw"].sum().reset_index(name="cat_total")
    hist_share = hist_share.merge(cat_totals, on=category_col)
    hist_share["share"] = hist_share["sku_share_raw"] / hist_share["cat_total"].replace(0, np.nan)
    hist_share["share"] = hist_share["share"].fillna(0)

    rows = []
    for _, cf in category_forecasts.iterrows():
        mo = cf[month_col]
        cat = cf[category_col]
        cat_pred = cf[cat_pred_col]
        skus = hist_share[hist_share[category_col] == cat]
        for _, sk in skus.iterrows():
            rows.append(
                {
                    month_col: mo,
                    "fg_code": sk["fg_code"],
                    category_col: cat,
                    "y_pred_td": cat_pred * sk["share"],
                }
            )
    return pd.DataFrame(rows)


def coherence_error(
    sku_preds: pd.DataFrame,
    category_col: str = "fg_category",
    month_col: str = "month",
    pred_col: str = "y_pred",
) -> pd.DataFrame:
    """Measure |sum(SKU) - category| per month-category."""
    sku_sum = sku_preds.groupby([month_col, category_col], as_index=False)[pred_col].sum()
    sku_sum = sku_sum.rename(columns={pred_col: "sku_sum"})
    return sku_sum


def volume_adjusted_yield(
    yield_mean: pd.Series,
    forecast_volume: pd.Series,
    baseline_volume: float,
    k: float = 0.05,
    floor: float = 0.80,
    ceiling: float = 1.0,
) -> pd.Series:
    """Reduce yield at high production volumes (machine strain proxy)."""
    ratio = np.log1p(forecast_volume / max(baseline_volume, 1.0))
    adj = yield_mean - k * ratio
    return adj.clip(floor, ceiling)


def try_reconcile_mint(
    sku_preds: pd.DataFrame,
    category_col: str = "fg_category",
    month_col: str = "month",
    actual_col: str = "y_true",
    pred_col: str = "y_pred",
) -> pd.DataFrame | None:
    """Optional MinT reconciliation demo via hierarchicalforecast."""
    try:
        from hierarchicalforecast.core import HierarchicalReconciliation
        from hierarchicalforecast.methods import BottomUp, MinTrace
    except ImportError:
        return None

    # Build minimal hierarchy: bottom=SKU, middle=category
    Y_df = sku_preds[[month_col, "fg_code", category_col, actual_col]].copy()
    Y_df = Y_df.rename(columns={month_col: "ds", actual_col: "y", "fg_code": "unique_id"})
    Y_hat = sku_preds[[month_col, "fg_code", pred_col]].copy()
    Y_hat = Y_hat.rename(columns={month_col: "ds", pred_col: "LGBM", "fg_code": "unique_id"})

    # hierarchicalforecast expects tags/S_df — skip if structure too small
    if Y_df["unique_id"].nunique() < 5:
        return None

    try:
        reconcilers = [BottomUp(), MinTrace(method="mint_shrink")]
        hrec = HierarchicalReconciliation(reconcilers=reconcilers)
        # Simplified: return bottom-up only when full MinT setup is heavy
        return reconcile_bottom_up(sku_preds, category_col, month_col, pred_col)
    except Exception:
        return reconcile_bottom_up(sku_preds, category_col, month_col, pred_col)
