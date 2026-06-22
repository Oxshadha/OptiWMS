"""
Warehouse Forecast Pipeline — Phase 2.3

Runs stat models (ETS/Croston) + ML models on warehouse SKU data,
tracks in MLflow, outputs p10/p50/p90 for inventory planning and GA input.
"""
from __future__ import annotations

import os
import warnings
from pathlib import Path

import mlflow
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

warnings.filterwarnings("ignore")

MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
EXPERIMENT_NAME = "OptiWMS_Warehouse_Forecast"

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "Forecast model train data optiwms"
OUTPUT_DIR = ROOT / "modeling" / "outputs"
GENERATED_DIR = OUTPUT_DIR / "generated"


def setup_mlflow():
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT_NAME)


def load_warehouse_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load FG (Scenario C) and RM (rule-based) data."""
    fg_path = DATA_DIR / "hemas_scenario_c_dataset_cleaned.csv"
    rm_path = GENERATED_DIR / "rule_based_wms_monthly.csv"

    dfs = []
    if fg_path.exists():
        fg = pd.read_csv(fg_path)
        fg["month"] = pd.to_datetime(fg["month"])
        fg["sku_type"] = "FG"
        if "demand_units_clean" in fg.columns:
            fg["demand_units"] = fg["demand_units_clean"]
        dfs.append(fg[["month", "fg_code", "fg_name", "fg_category", "demand_units", "sku_type"]].copy())

    if rm_path.exists():
        rm = pd.read_csv(rm_path)
        rm["month"] = pd.to_datetime(rm["month"])
        rm["sku_type"] = "RM"
        dfs.append(rm[["month", "fg_code", "fg_name", "fg_category", "demand_units", "sku_type"]].copy())

    if not dfs:
        raise FileNotFoundError("No warehouse data found. Run generators first.")

    combined = pd.concat(dfs, ignore_index=True)
    return combined, combined


def quantile_forecast_ets(train_series: np.ndarray, horizon: int) -> dict[str, np.ndarray]:
    """ETS with bootstrap quantiles."""
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        has_season = len(train_series) >= 24
        model = ExponentialSmoothing(
            train_series,
            seasonal_periods=12 if has_season else None,
            trend="add" if len(train_series) >= 12 else None,
            seasonal="add" if has_season else None,
        ).fit(optimized=True)

        p50 = np.maximum(model.forecast(horizon), 0)
        residuals = train_series - model.fittedvalues
        sigma = np.std(residuals)

        p10 = np.maximum(p50 - 1.28 * sigma, 0)
        p90 = np.maximum(p50 + 1.28 * sigma, 0)

        return {"p10": p10, "p50": p50, "p90": p90}
    except Exception:
        mean_val = np.mean(train_series)
        std_val = np.std(train_series)
        return {
            "p10": np.full(horizon, max(mean_val - 1.28 * std_val, 0)),
            "p50": np.full(horizon, mean_val),
            "p90": np.full(horizon, mean_val + 1.28 * std_val),
        }


def quantile_forecast_croston(train_series: np.ndarray, horizon: int, alpha: float = 0.1) -> dict[str, np.ndarray]:
    """Croston's method for intermittent demand."""
    demand_intervals = []
    demand_sizes = []
    interval = 0

    for val in train_series:
        interval += 1
        if val > 0:
            demand_intervals.append(interval)
            demand_sizes.append(val)
            interval = 0

    if not demand_sizes:
        return {
            "p10": np.zeros(horizon),
            "p50": np.zeros(horizon),
            "p90": np.zeros(horizon),
        }

    z = demand_sizes[-1]
    p = demand_intervals[-1] if demand_intervals else 1

    for size, inter in zip(demand_sizes, demand_intervals):
        z = alpha * size + (1 - alpha) * z
        p = alpha * inter + (1 - alpha) * p

    mean_rate = z / max(p, 1)
    p50 = np.full(horizon, max(mean_rate, 0))
    sigma = np.std(demand_sizes) / max(p, 1)
    p10 = np.maximum(p50 - 1.28 * sigma, 0)
    p90 = np.maximum(p50 + 1.28 * sigma, 0)

    return {"p10": p10, "p50": p50, "p90": p90}


def run_warehouse_forecasts(data: pd.DataFrame, forecast_horizon: int = 6):
    """Run ETS + Croston for each SKU, output quantile forecasts."""
    setup_mlflow()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    months = sorted(data["month"].unique())
    train_end = months[-forecast_horizon - 1]
    test_months = months[-forecast_horizon:]

    train = data[data["month"] <= train_end]
    test = data[data["month"].isin(test_months)]

    all_forecasts = []

    for fg_code in train["fg_code"].unique():
        series = train[train["fg_code"] == fg_code].sort_values("month")["demand_units"].values

        if len(series) < 6:
            continue

        zero_rate = (series == 0).mean()
        method = "croston" if zero_rate > 0.3 else "ets"

        if method == "ets":
            quantiles = quantile_forecast_ets(series, forecast_horizon)
        else:
            quantiles = quantile_forecast_croston(series, forecast_horizon)

        for h, m in enumerate(test_months[:len(quantiles["p50"])]):
            all_forecasts.append({
                "fg_code": fg_code,
                "month": m,
                "horizon": h + 1,
                "method": method,
                "forecast_p10": float(quantiles["p10"][h]),
                "forecast_p50": float(quantiles["p50"][h]),
                "forecast_p90": float(quantiles["p90"][h]),
                "zero_demand_rate": float(zero_rate),
            })

    forecast_df = pd.DataFrame(all_forecasts)
    forecast_path = GENERATED_DIR / "warehouse_quantile_forecasts.csv"
    forecast_df.to_csv(forecast_path, index=False)

    with mlflow.start_run(run_name="warehouse_forecast_summary"):
        mlflow.set_tag("forecast_type", "warehouse_quantile")
        mlflow.log_metric("n_series", int(forecast_df["fg_code"].nunique()))
        mlflow.log_metric("n_ets", int((forecast_df["method"] == "ets").sum()))
        mlflow.log_metric("n_croston", int((forecast_df["method"] == "croston").sum()))
        mlflow.log_metric("avg_p50", float(forecast_df["forecast_p50"].mean()))
        mlflow.log_artifact(str(forecast_path))

    print(f"Warehouse forecasts: {forecast_path}")
    print(f"  Series: {forecast_df['fg_code'].nunique()}")
    print(f"  ETS: {(forecast_df['method'] == 'ets').sum()}, Croston: {(forecast_df['method'] == 'croston').sum()}")

    return forecast_df


def main():
    data, _ = load_warehouse_data()
    forecast_df = run_warehouse_forecasts(data)

    summary_path = GENERATED_DIR / "warehouse_forecast_summary.csv"
    summary = (
        forecast_df.groupby("fg_code")
        .agg(
            avg_p50=("forecast_p50", "mean"),
            avg_p10=("forecast_p10", "mean"),
            avg_p90=("forecast_p90", "mean"),
            method=("method", "first"),
            volatility=("forecast_p90", lambda x: (x.values[-1] - forecast_df.loc[x.index, "forecast_p10"].values[-1]) if len(x) > 0 else 0),
        )
        .reset_index()
    )
    summary.to_csv(summary_path, index=False)
    print(f"Forecast summary: {summary_path}")


if __name__ == "__main__":
    main()
