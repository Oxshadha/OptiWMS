from __future__ import annotations

import argparse
from dataclasses import dataclass

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX
from xgboost import XGBRegressor

from common import OUT_DIR, add_series_id, load_dataset, wape, rmse, bias
from run_boosting import get_feature_tiers, make_features


@dataclass
class CvFold:
    fold: int
    train_end: pd.Timestamp
    val_start: pd.Timestamp
    val_end: pd.Timestamp


def make_folds(months: np.ndarray, initial_train_months: int, val_window: int, n_folds: int) -> list[CvFold]:
    folds: list[CvFold] = []
    min_idx = initial_train_months
    max_start = len(months) - val_window
    for i in range(n_folds):
        start_idx = min_idx + i
        if start_idx > max_start:
            break
        train_end = pd.Timestamp(months[start_idx - 1])
        val_start = pd.Timestamp(months[start_idx])
        val_end = pd.Timestamp(months[start_idx + val_window - 1])
        folds.append(CvFold(fold=i + 1, train_end=train_end, val_start=val_start, val_end=val_end))
    return folds


def eval_classical(df: pd.DataFrame, dataset: str, model_name: str, folds: list[CvFold]) -> pd.DataFrame:
    rows: list[dict] = []
    for fold in folds:
        for sid, g in df.groupby('series_id'):
            g = g.sort_values('month')
            if dataset == 'C':
                g = g[g['scenario_split'] == 'train']
            tr = g[g['month'] <= fold.train_end]
            va = g[(g['month'] >= fold.val_start) & (g['month'] <= fold.val_end)]
            if len(tr) < 18 or va.empty:
                continue

            y_train = tr['demand_units'].to_numpy(dtype=float)
            y_val = va['demand_units'].to_numpy(dtype=float)
            steps = len(y_val)

            try:
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
                    pred = np.clip(m.forecast(steps), 0, None)
                elif model_name == 'ARIMA':
                    m = ARIMA(y_train, order=(1, 1, 1), enforce_stationarity=False, enforce_invertibility=False).fit()
                    pred = np.clip(m.forecast(steps), 0, None)
                elif model_name == 'SARIMA':
                    m = SARIMAX(
                        y_train,
                        order=(1, 1, 1),
                        seasonal_order=(1, 1, 0, 12),
                        enforce_stationarity=False,
                        enforce_invertibility=False,
                    ).fit(disp=False)
                    pred = np.clip(m.forecast(steps), 0, None)
                else:
                    raise ValueError(f'Unknown model={model_name}')
            except Exception:
                continue

            for h, (yt, yp) in enumerate(zip(y_val, pred), start=1):
                rows.append(
                    {
                        'dataset': dataset,
                        'model': model_name,
                        'fold': fold.fold,
                        'horizon': h,
                        'series_id': sid,
                        'y_true': float(yt),
                        'y_pred': float(yp),
                    }
                )

    return pd.DataFrame(rows)


def eval_boosting(df: pd.DataFrame, dataset: str, model_name: str, folds: list[CvFold], horizons: list[int]) -> pd.DataFrame:
    rows: list[dict] = []
    for fold in folds:
        for h in horizons:
            dfh = make_features(df, horizon=h)
            tiers = get_feature_tiers(dfh)
            trained = False
            for model_cols in tiers:
                keep = ['series_id', 'fg_code', 'fg_category', 'target', 'target_month', 'scenario_split'] + model_cols
                d = dfh[keep].dropna(subset=['target']).dropna(subset=model_cols).copy()

                if dataset == 'C':
                    d = d[d['scenario_split'] == 'train']

                train_mask = d['target_month'] <= fold.train_end
                val_mask = (d['target_month'] >= fold.val_start) & (d['target_month'] <= fold.val_end)
                tr = d[train_mask]
                va = d[val_mask]
                if tr.empty or va.empty:
                    continue

                try:
                    if model_name == 'XGBOOST':
                        x_tr = pd.get_dummies(tr[model_cols], columns=['fg_code', 'fg_category'], drop_first=False)
                        x_va = pd.get_dummies(va[model_cols], columns=['fg_code', 'fg_category'], drop_first=False)
                        cols = sorted(set(x_tr.columns) | set(x_va.columns))
                        x_tr = x_tr.reindex(columns=cols, fill_value=0)
                        x_va = x_va.reindex(columns=cols, fill_value=0)
                        reg = XGBRegressor(
                            n_estimators=400,
                            learning_rate=0.05,
                            max_depth=6,
                            subsample=0.85,
                            colsample_bytree=0.85,
                            objective='reg:squarederror',
                            random_state=42,
                            n_jobs=1,
                        )
                        reg.fit(x_tr, tr['target'].to_numpy(), eval_set=[(x_va, va['target'].to_numpy())], verbose=False)
                        pred = np.clip(reg.predict(x_va), 0, None)
                    elif model_name == 'CATBOOST':
                        reg = CatBoostRegressor(
                            loss_function='RMSE',
                            iterations=600,
                            learning_rate=0.05,
                            depth=7,
                            random_seed=42,
                            thread_count=1,
                            verbose=False,
                        )
                        cat_cols = ['fg_code', 'fg_category']
                        reg.fit(
                            tr[model_cols],
                            tr['target'],
                            cat_features=[model_cols.index(c) for c in cat_cols if c in model_cols],
                            eval_set=(va[model_cols], va['target']),
                            use_best_model=True,
                            verbose=False,
                        )
                        pred = np.clip(reg.predict(va[model_cols]), 0, None)
                    else:
                        raise ValueError(f'Unknown model={model_name}')
                except Exception:
                    continue

                for row, yp in zip(va.itertuples(index=False), pred):
                    rows.append(
                        {
                            'dataset': dataset,
                            'model': model_name,
                            'fold': fold.fold,
                            'horizon': h,
                            'series_id': row.series_id,
                            'y_true': float(row.target),
                            'y_pred': float(yp),
                        }
                    )
                trained = True
                break

            if not trained:
                continue

    return pd.DataFrame(rows)


def summarize_cv(df_pred: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict] = []
    if df_pred.empty:
        return pd.DataFrame()

    group_keys = ['dataset', 'model', 'fold', 'horizon']
    for keys, g in df_pred.groupby(group_keys):
        y = g['y_true'].to_numpy(dtype=float)
        p = g['y_pred'].to_numpy(dtype=float)
        rows.append(
            {
                'dataset': keys[0],
                'model': keys[1],
                'fold': int(keys[2]),
                'horizon': int(keys[3]),
                'n_obs': int(len(g)),
                'WAPE': wape(y, p),
                'RMSE': rmse(y, p),
                'Bias': bias(y, p),
            }
        )

    out = pd.DataFrame(rows)
    agg = (
        out.groupby(['dataset', 'model', 'horizon'], as_index=False)[['WAPE', 'RMSE', 'Bias', 'n_obs']]
        .mean()
        .rename(columns={'WAPE': 'WAPE_cv_mean', 'RMSE': 'RMSE_cv_mean', 'Bias': 'Bias_cv_mean'})
    )
    return out, agg


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--datasets', nargs='+', default=['A', 'B', 'C'])
    parser.add_argument('--initial-train-months', type=int, default=18)
    parser.add_argument('--val-window', type=int, default=3)
    parser.add_argument('--n-folds', type=int, default=4)
    parser.add_argument('--horizons', type=str, default='1,2,3,6,12')
    parser.add_argument('--sample-frac-c', type=float, default=0.3)
    args = parser.parse_args()

    horizons = [int(x.strip()) for x in args.horizons.split(',') if x.strip()]
    all_preds = []

    for ds in args.datasets:
        df = add_series_id(load_dataset(ds), ds)
        if ds == 'C' and args.sample_frac_c < 1.0:
            keep_ids = df[['series_id']].drop_duplicates().sample(frac=args.sample_frac_c, random_state=42)['series_id']
            df = df[df['series_id'].isin(keep_ids)].copy()

        months = np.sort(df['month'].dropna().unique())
        folds = make_folds(months, args.initial_train_months, args.val_window, args.n_folds)
        if not folds:
            continue

        for m in ['ETS', 'ARIMA', 'SARIMA']:
            all_preds.append(eval_classical(df, ds, m, folds))
        for m in ['XGBOOST', 'CATBOOST']:
            all_preds.append(eval_boosting(df, ds, m, folds, horizons))

    non_empty = [d for d in all_preds if not d.empty]
    pred_df = pd.concat(non_empty, ignore_index=True) if non_empty else pd.DataFrame()
    if pred_df.empty:
        print('No CV predictions generated.')
        return

    fold_metrics, agg_metrics = summarize_cv(pred_df)
    reports = OUT_DIR / 'reports'
    reports.mkdir(parents=True, exist_ok=True)
    fold_metrics.to_csv(reports / 'rolling_cv_metrics_by_fold.csv', index=False)
    agg_metrics.to_csv(reports / 'rolling_cv_metrics_summary.csv', index=False)
    print('Saved:', reports / 'rolling_cv_metrics_by_fold.csv')
    print('Saved:', reports / 'rolling_cv_metrics_summary.csv')


if __name__ == '__main__':
    main()
