from __future__ import annotations

import argparse
import warnings

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from xgboost import XGBRegressor

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


EXOG_COLS = [
    'on_hand_inventory',
    'stockout_days',
    'promotion_flag',
    'price_or_discount',
    'lead_time_days',
    'supplier_otif',
    'inbound_po_qty',
    'open_sales_orders',
    'returns_qty',
    'holiday_flag',
]

FEATURE_PROFILES = [
    "full",
    "lags_only",
    "lags_roll",
    "lags_roll_seasonal",
    "lags_roll_seasonal_category",
]


def make_features(df: pd.DataFrame, horizon: int) -> pd.DataFrame:
    out = df.copy().sort_values(['series_id', 'month'])
    out['month_num'] = out['month'].dt.month
    out['quarter'] = out['month'].dt.quarter
    out['year'] = out['month'].dt.year
    out['month_sin'] = np.sin(2 * np.pi * out['month_num'] / 12.0)
    out['month_cos'] = np.cos(2 * np.pi * out['month_num'] / 12.0)

    for lag in [1, 2, 3, 6, 12]:
        out[f'lag_{lag}'] = out.groupby('series_id')['demand_units'].shift(lag)

    for w in [3, 6, 12]:
        out[f'roll_mean_{w}'] = out.groupby('series_id')['demand_units'].transform(
            lambda s: s.shift(1).rolling(w).mean()
        )
        out[f'roll_std_{w}'] = out.groupby('series_id')['demand_units'].transform(
            lambda s: s.shift(1).rolling(w).std()
        )

    for c in EXOG_COLS:
        if c in out.columns:
            out[f'{c}_lag1'] = out.groupby('series_id')[c].shift(1)

    out['target'] = out.groupby('series_id')['demand_units'].shift(-horizon)
    out['target_month'] = out.groupby('series_id')['month'].shift(-horizon)
    return out


def split_masks(dfh: pd.DataFrame, dataset: str, split_dates) -> tuple[pd.Series, pd.Series, pd.Series]:
    tmp = dfh[['target_month']].copy().rename(columns={'target_month': 'month'})
    target_split = assign_time_split(tmp, split_dates)
    target_split = pd.Series(target_split, index=dfh.index)

    if dataset == 'C':
        train_mask = (dfh['scenario_split'] == 'train') & (target_split == 'train')
        val_mask = (dfh['scenario_split'] == 'train') & (target_split == 'val')
        test_mask = (dfh['scenario_split'] == 'test') & (target_split == 'test')
    else:
        train_mask = target_split == 'train'
        val_mask = target_split == 'val'
        test_mask = target_split == 'test'

    return train_mask, val_mask, test_mask


def prepare_train_lookup(df: pd.DataFrame, split_dates) -> dict[str, np.ndarray]:
    tmp = df.copy()
    tmp['split'] = assign_time_split(tmp, split_dates)
    lookup = {}
    for sid, g in tmp.groupby('series_id'):
        lookup[sid] = g[g['split'] == 'train']['demand_units'].to_numpy(dtype=float)
    return lookup


def get_feature_tiers(dfh: pd.DataFrame, feature_profile: str = "full") -> list[list[str]]:
    base = ['fg_code', 'fg_category', 'month_num', 'quarter', 'year', 'month_sin', 'month_cos']
    lag12 = ['lag_12', 'roll_mean_12', 'roll_std_12']
    lag6 = ['lag_6', 'roll_mean_6', 'roll_std_6']
    lag3 = ['lag_3', 'roll_mean_3', 'roll_std_3']
    lag2 = ['lag_2']
    lag1 = ['lag_1']

    exog_lag = [f'{c}_lag1' for c in EXOG_COLS if f'{c}_lag1' in dfh.columns]

    if feature_profile == "lags_only":
        return [lag1 + lag2 + ['lag_3', 'lag_6', 'lag_12']]
    if feature_profile == "lags_roll":
        return [lag1 + lag2 + lag3 + lag6 + lag12]
    if feature_profile == "lags_roll_seasonal":
        return [['month_num', 'quarter', 'year', 'month_sin', 'month_cos'] + lag1 + lag2 + lag3 + lag6 + lag12]
    if feature_profile == "lags_roll_seasonal_category":
        return [base + lag1 + lag2 + lag3 + lag6 + lag12]
    if feature_profile != "full":
        raise ValueError(f"Unsupported feature profile: {feature_profile}")

    tiers = [
        base + lag1 + lag2 + lag3 + lag6 + lag12 + exog_lag,
        base + lag1 + lag2 + lag3 + lag6 + exog_lag,
        base + lag1 + lag2 + lag3 + exog_lag,
        base + lag1 + lag2 + exog_lag,
        base + lag1 + exog_lag,
        base + lag1,
    ]
    return [list(dict.fromkeys(t)) for t in tiers]


def run_dataset(dataset: str, models: list[str], sample_frac: float, horizons: list[int], feature_profile: str = "full") -> None:
    df = add_series_id(load_dataset(dataset), dataset)
    split_dates = get_split_dates(df)

    # Optional row sampling for large C runtime control.
    if dataset == 'C' and sample_frac < 1.0:
        keep_ids = (
            df[['series_id']]
            .drop_duplicates()
            .sample(frac=sample_frac, random_state=42)['series_id']
            .tolist()
        )
        df = df[df['series_id'].isin(keep_ids)].copy()

    y_train_lookup = prepare_train_lookup(df, split_dates)

    feature_base = [
        'series_id',
        'fg_code',
        'fg_category',
        'month',
        'target_month',
        'target',
        'scenario_split',
    ]

    all_forecasts = []
    all_metrics = []

    for model_name in models:
        model_rows = []

        for h in horizons:
            dfh = make_features(df, horizon=h)
            # Adaptive feature tiers keep long horizons trainable on short histories.
            chosen_cols = None
            train_df = val_df = test_df = None

            for model_cols in get_feature_tiers(dfh, feature_profile=feature_profile):
                keep_cols = list(dict.fromkeys(feature_base + model_cols))
                d = dfh[keep_cols].dropna(subset=['target']).dropna(subset=model_cols)
                train_mask, val_mask, test_mask = split_masks(d, dataset, split_dates)
                tr = d[train_mask].copy()
                va = d[val_mask].copy()
                te = d[test_mask].copy()
                if not tr.empty and not va.empty and not te.empty:
                    chosen_cols = model_cols
                    train_df, val_df, test_df = tr, va, te
                    break

            if chosen_cols is None:
                continue
            model_cols = chosen_cols

            if model_name == 'XGBOOST':
                X_train = pd.get_dummies(train_df[model_cols], columns=['fg_code', 'fg_category'], drop_first=False)
                X_val = pd.get_dummies(val_df[model_cols], columns=['fg_code', 'fg_category'], drop_first=False)
                X_test = pd.get_dummies(test_df[model_cols], columns=['fg_code', 'fg_category'], drop_first=False)

                cols = sorted(set(X_train.columns) | set(X_val.columns) | set(X_test.columns))
                X_train = X_train.reindex(columns=cols, fill_value=0)
                X_val = X_val.reindex(columns=cols, fill_value=0)
                X_test = X_test.reindex(columns=cols, fill_value=0)

                reg = XGBRegressor(
                    n_estimators=500,
                    learning_rate=0.05,
                    max_depth=6,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    reg_alpha=0.0,
                    reg_lambda=1.0,
                    objective='reg:squarederror',
                    random_state=42,
                    n_jobs=1,
                )
                reg.fit(
                    X_train,
                    train_df['target'].to_numpy(),
                    eval_set=[(X_val, val_df['target'].to_numpy())],
                    verbose=False,
                )
                p_val = np.clip(reg.predict(X_val), 0, None)
                p_test = np.clip(reg.predict(X_test), 0, None)

            elif model_name == 'CATBOOST':
                cat_cols = ['fg_code', 'fg_category']
                reg = CatBoostRegressor(
                    loss_function='RMSE',
                    iterations=700,
                    learning_rate=0.05,
                    depth=7,
                    random_seed=42,
                    thread_count=1,
                    verbose=False,
                )

                reg.fit(
                    train_df[model_cols],
                    train_df['target'],
                    cat_features=[model_cols.index(c) for c in cat_cols if c in model_cols],
                    eval_set=(val_df[model_cols], val_df['target']),
                    use_best_model=True,
                    verbose=False,
                )
                p_val = np.clip(reg.predict(val_df[model_cols]), 0, None)
                p_test = np.clip(reg.predict(test_df[model_cols]), 0, None)

            else:
                raise ValueError(f'Unknown model {model_name}')

            # residual scale from validation set
            sigma = float(np.std(val_df['target'].to_numpy() - p_val))

            for part, part_df, part_pred in [
                ('val', val_df, p_val),
                ('test', test_df, p_test),
            ]:
                for row, yp in zip(part_df.itertuples(index=False), part_pred):
                    model_rows.append(
                        {
                            'dataset': dataset,
                            'model': model_name,
                            'series_id': row.series_id,
                            'fg_code': row.fg_code,
                            'fg_category': row.fg_category,
                            'month': row.target_month,
                            'split': part,
                            'horizon': h,
                            'y_true': float(row.target),
                            'y_pred': float(yp),
                            'p10': float(max(0.0, yp - 1.28 * sigma)),
                            'p90': float(yp + 1.28 * sigma),
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
        save_outputs(met_df, pred_df, inv_df, f'boosting_{dataset}_{model_name.lower()}')
        print(f'[OK] {dataset}/{model_name}: forecasts={len(pred_df)}, metrics={len(met_df)}, inventory={len(inv_df)}')

    if all_metrics:
        allm = pd.concat(all_metrics, ignore_index=True)
        allf = pd.concat(all_forecasts, ignore_index=True)
        save_outputs(allm, allf, pd.DataFrame(), f'boosting_{dataset}_all')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--datasets', nargs='+', default=['A', 'B', 'C'])
    parser.add_argument('--models', nargs='+', default=['XGBOOST', 'CATBOOST'])
    parser.add_argument('--sample-frac-c', type=float, default=0.5)
    parser.add_argument('--horizons', type=str, default='1,2,3,4,5,6,7,8,9,10,11,12')
    args = parser.parse_args()
    horizons = [int(x.strip()) for x in args.horizons.split(',') if x.strip()]

    for ds in args.datasets:
        frac = args.sample_frac_c if ds == 'C' else 1.0
        run_dataset(ds, args.models, frac, horizons)


if __name__ == '__main__':
    main()
