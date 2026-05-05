from __future__ import annotations

import argparse
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX

warnings.filterwarnings("ignore")

FORECAST_HORIZON = 28


def load_m5(m5_dir: Path, max_series: int | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    sales = pd.read_csv(m5_dir / "sales_train_validation.csv")
    sample_submission = pd.read_csv(m5_dir / "sample_submission.csv")

    if max_series is not None:
        sales = sales.iloc[:max_series].copy()

    return sales, sample_submission


def fit_predict(model_name: str, y_train: np.ndarray, steps: int = FORECAST_HORIZON) -> np.ndarray:
    y_train = np.asarray(y_train, dtype=float)
    if len(y_train) == 0:
        return np.zeros(steps, dtype=float)

    if model_name == "SNAIVE7":
        season = y_train[-7:] if len(y_train) >= 7 else np.repeat(y_train[-1], 7)
        pred = np.tile(season, int(np.ceil(steps / len(season))))[:steps]
        return np.clip(pred, 0, None)

    if model_name == "SNAIVE28":
        season = y_train[-28:] if len(y_train) >= 28 else np.repeat(y_train[-1], 28)
        pred = np.tile(season, int(np.ceil(steps / len(season))))[:steps]
        return np.clip(pred, 0, None)

    if model_name == "ETS":
        try:
            m = ExponentialSmoothing(
                y_train,
                trend="add",
                damped_trend=True,
                seasonal="add",
                seasonal_periods=7,
                initialization_method="estimated",
            ).fit(optimized=True)
        except Exception:
            m = ExponentialSmoothing(y_train, trend="add", seasonal=None).fit(optimized=True)
        return np.clip(m.forecast(steps), 0, None)

    if model_name == "ARIMA":
        m = ARIMA(y_train, order=(7, 1, 1), enforce_stationarity=False, enforce_invertibility=False).fit()
        return np.clip(m.forecast(steps), 0, None)

    if model_name == "SARIMA":
        m = SARIMAX(
            y_train,
            order=(1, 1, 1),
            seasonal_order=(1, 1, 0, 7),
            enforce_stationarity=False,
            enforce_invertibility=False,
        ).fit(disp=False)
        return np.clip(m.forecast(steps), 0, None)

    raise ValueError(f"Unknown model: {model_name}")


def build_submission(sales: pd.DataFrame, sample_submission: pd.DataFrame, model_name: str) -> pd.DataFrame:
    day_cols = [c for c in sales.columns if c.startswith("d_")]
    feature_cols = [f"F{i}" for i in range(1, FORECAST_HORIZON + 1)]

    preds: list[np.ndarray] = []
    ids: list[str] = []

    for row in sales.itertuples(index=False):
        history = np.asarray([getattr(row, c) for c in day_cols], dtype=float)
        pred = fit_predict(model_name, history, FORECAST_HORIZON)
        preds.append(pred)
        ids.append(str(row.id))

    validation = pd.DataFrame(preds, columns=feature_cols)
    validation.insert(0, "id", ids)

    # M5 sample submission expects both validation and evaluation rows.
    # With only the public files available, we duplicate the same 28-day forecast
    # for evaluation rows to produce a Kaggle-format CSV.
    evaluation = validation.copy()
    evaluation["id"] = evaluation["id"].str.replace("_validation", "_evaluation", regex=False)

    submission = pd.concat([validation, evaluation], ignore_index=True)
    submission = sample_submission[["id"]].merge(submission, on="id", how="left")
    return submission


def save_submission(submission: pd.DataFrame, out_dir: Path, model_name: str, max_series: int | None) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    file_name = model_name.upper()
    if max_series is not None:
        file_name += f"_SAMPLE{max_series}"
    out_path = out_dir / f"{file_name}.csv"
    submission.to_csv(out_path, index=False)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--m5-dir", type=Path, required=True)
    parser.add_argument("--models", nargs="+", default=["SNAIVE7", "SNAIVE28", "ETS", "ARIMA", "SARIMA"])
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--max-series", type=int, default=None)
    args = parser.parse_args()

    sales, sample_submission = load_m5(args.m5_dir, args.max_series)

    for model_name in args.models:
        submission = build_submission(sales, sample_submission, model_name)
        out_path = save_submission(submission, args.out_dir, model_name, args.max_series)
        print(f"Saved {model_name} submission: {out_path}")


if __name__ == "__main__":
    main()
