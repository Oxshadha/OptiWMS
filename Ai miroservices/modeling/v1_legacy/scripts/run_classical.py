from __future__ import annotations

import argparse
import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX

from common import (
    add_series_id,
    assign_time_split,
    build_inventory_recommendations,
    get_split_dates,
    load_dataset,
    save_outputs,
    summarize_metrics,
)

warnings.filterwarnings('ignore')


def fit_predict(model_name: str, y_train: np.ndarray, steps: int) -> np.ndarray:
    if model_name == 'ETS':
        try:
            m = ExponentialSmoothing(
                y_train,
                trend='add',
                damped_trend=True,
                seasonal='add',
                seasonal_periods=12,
                initialization_method='estimated',
            ).fit(optimized=True)
        except Exception:
            m = ExponentialSmoothing(y_train, trend='add', seasonal=None).fit(optimized=True)
        return np.clip(m.forecast(steps), 0, None)

    if model_name == 'ARIMA':
        m = ARIMA(y_train, order=(1, 1, 1), enforce_stationarity=False, enforce_invertibility=False).fit()
        return np.clip(m.forecast(steps), 0, None)

    if model_name == 'SARIMA':
        m = SARIMAX(
            y_train,
            order=(1, 1, 1),
            seasonal_order=(1, 1, 0, 12),
            enforce_stationarity=False,
            enforce_invertibility=False,
        ).fit(disp=False)
        return np.clip(m.forecast(steps), 0, None)

    raise ValueError(f'Unknown model: {model_name}')


def run_dataset(dataset: str, models: list[str], max_series: int | None) -> None:
    df = add_series_id(load_dataset(dataset), dataset)
    split_dates = get_split_dates(df)
    df['split'] = assign_time_split(df, split_dates)

    # Optional cap for runtime control (useful for large C).
    series_ids = df['series_id'].drop_duplicates().sort_values().tolist()
    if max_series is not None:
        series_ids = series_ids[:max_series]
        df = df[df['series_id'].isin(series_ids)].copy()

    y_train_lookup: dict[str, np.ndarray] = {}
    all_forecasts: list[pd.DataFrame] = []
    all_metrics: list[pd.DataFrame] = []

    for model_name in models:
        model_rows = []
        fail_count = 0

        for sid in series_ids:
            g = df[df['series_id'] == sid].sort_values('month')
            y = g['demand_units'].to_numpy(dtype=float)
            if len(y) < 24:
                continue

            train_mask = g['split'].eq('train').to_numpy()
            val_mask = g['split'].eq('val').to_numpy()
            test_mask = g['split'].eq('test').to_numpy()

            y_train = y[train_mask]
            y_train_val = y[train_mask | val_mask]
            y_val = y[val_mask]
            y_test = y[test_mask]

            if len(y_val) == 0 or len(y_test) == 0:
                continue

            y_train_lookup[sid] = y_train

            try:
                pred_val = fit_predict(model_name, y_train, len(y_val))
                pred_test = fit_predict(model_name, y_train_val, len(y_test))
            except Exception:
                fail_count += 1
                continue

            resid_sigma = float(np.std(y_train - np.mean(y_train))) if len(y_train) > 1 else 0.0

            val_months = g.loc[val_mask, 'month'].to_list()
            test_months = g.loc[test_mask, 'month'].to_list()
            fg_code = str(g['fg_code'].iloc[0])
            fg_cat = str(g['fg_category'].iloc[0])

            for i, (m, yt, yp) in enumerate(zip(val_months, y_val, pred_val), start=1):
                model_rows.append(
                    {
                        'dataset': dataset,
                        'model': model_name,
                        'series_id': sid,
                        'fg_code': fg_code,
                        'fg_category': fg_cat,
                        'month': m,
                        'split': 'val',
                        'horizon': i,
                        'y_true': float(yt),
                        'y_pred': float(yp),
                        'p10': float(max(0.0, yp - 1.28 * resid_sigma)),
                        'p90': float(yp + 1.28 * resid_sigma),
                    }
                )

            for i, (m, yt, yp) in enumerate(zip(test_months, y_test, pred_test), start=1):
                model_rows.append(
                    {
                        'dataset': dataset,
                        'model': model_name,
                        'series_id': sid,
                        'fg_code': fg_code,
                        'fg_category': fg_cat,
                        'month': m,
                        'split': 'test',
                        'horizon': i,
                        'y_true': float(yt),
                        'y_pred': float(yp),
                        'p10': float(max(0.0, yp - 1.28 * resid_sigma)),
                        'p90': float(yp + 1.28 * resid_sigma),
                    }
                )

        pred_df = pd.DataFrame(model_rows)
        if pred_df.empty:
            print(f'[WARN] {dataset}/{model_name}: no predictions generated.')
            continue

        all_forecasts.append(pred_df)

        met_val = summarize_metrics(pred_df, 'val', model_name, dataset, y_train_lookup)
        met_test = summarize_metrics(pred_df, 'test', model_name, dataset, y_train_lookup)
        met_df = pd.concat([met_val, met_test], ignore_index=True)
        all_metrics.append(met_df)

        inv_df = build_inventory_recommendations(pred_df, df)
        save_outputs(met_df, pred_df, inv_df, f'classical_{dataset}_{model_name.lower()}')
        print(
            f'[OK] {dataset}/{model_name}: forecasts={len(pred_df)}, '
            f'metrics={len(met_df)}, inventory={len(inv_df)}, failed_series={fail_count}'
        )

    if all_metrics:
        allm = pd.concat(all_metrics, ignore_index=True)
        allf = pd.concat(all_forecasts, ignore_index=True)
        save_outputs(allm, allf, pd.DataFrame(), f'classical_{dataset}_all')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--datasets', nargs='+', default=['A', 'B', 'C'])
    parser.add_argument('--models', nargs='+', default=['ETS', 'ARIMA', 'SARIMA'])
    parser.add_argument('--max-series', type=int, default=None)
    args = parser.parse_args()

    for ds in args.datasets:
        run_dataset(ds, args.models, args.max_series)


if __name__ == '__main__':
    main()
