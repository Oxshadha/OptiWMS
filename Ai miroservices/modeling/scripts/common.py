from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

ROOT = Path('/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices')
DATA_DIR = ROOT / 'Forecast model train data optiwms'
OUT_DIR = ROOT / 'modeling' / 'outputs'

DATASETS = {
    'A': {
        'path': DATA_DIR / 'hemas_synthetic_forecasting_dataset_monthly_36m.xlsx',
        'sheet': 'FG_Demand_Long',
        'target_col': 'demand_units',
    },
    'B': {
        'path': DATA_DIR / 'hemas_monthly_augmented_wms_features.xlsx',
        'sheet': 'FG_Demand_Long_Augmented',
        'target_col': 'demand_units',
    },
    'C': {
        'path': DATA_DIR / 'hemas_scenario_c_dataset_cleaned.csv',
        'sheet': None,
        'target_col': 'demand_units_clean',
    },
    'P': {
        'path': OUT_DIR / 'generated' / 'rule_based_portable_monthly.csv',
        'sheet': None,
        'target_col': 'demand_units',
    },
    'W': {
        'path': OUT_DIR / 'generated' / 'rule_based_wms_monthly.csv',
        'sheet': None,
        'target_col': 'demand_units',
    },
}


@dataclass
class SplitDates:
    train_end: pd.Timestamp
    val_end: pd.Timestamp


def ensure_output_dirs() -> None:
    for p in [
        OUT_DIR / 'metrics',
        OUT_DIR / 'forecasts',
        OUT_DIR / 'inventory',
        OUT_DIR / 'reports',
    ]:
        p.mkdir(parents=True, exist_ok=True)


def load_dataset(dataset: str) -> pd.DataFrame:
    cfg = DATASETS[dataset]
    path = cfg['path']
    if str(path).endswith('.csv'):
        df = pd.read_csv(path)
    else:
        df = pd.read_excel(path, sheet_name=cfg['sheet'])

    df['month'] = pd.to_datetime(df['month'])
    df = df.sort_values(['month', 'fg_code']).reset_index(drop=True)

    target_col = cfg['target_col']
    if target_col != 'demand_units':
        df['demand_units'] = df[target_col]

    if 'scenario_id' not in df.columns:
        df['scenario_id'] = -1
    if 'scenario_split' not in df.columns:
        df['scenario_split'] = 'all'

    # Ensure required columns exist for downstream joins.
    for col, default in [('fg_name', ''), ('fg_category', 'UNKNOWN')]:
        if col not in df.columns:
            df[col] = default

    return df


def get_split_dates(df: pd.DataFrame) -> SplitDates:
    months = np.sort(df['month'].dropna().unique())
    # For 36-month data, use 18/6/12 split so H+12 evaluation is possible.
    val_months = 6
    test_months = 12
    min_required = val_months + test_months + 1
    if len(months) < min_required:
        raise ValueError(f'Need at least {min_required} months for train/val/test split.')
    train_end = pd.Timestamp(months[-(val_months + test_months + 1)])
    val_end = pd.Timestamp(months[-(test_months + 1)])
    return SplitDates(train_end=train_end, val_end=val_end)


def assign_time_split(df: pd.DataFrame, split_dates: SplitDates) -> pd.Series:
    m = pd.to_datetime(df['month'])
    return np.where(
        m <= split_dates.train_end,
        'train',
        np.where(m <= split_dates.val_end, 'val', 'test'),
    )


def mase(y_true: np.ndarray, y_pred: np.ndarray, y_train: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    y_train = np.asarray(y_train, dtype=float)
    if len(y_train) < 2:
        return float('nan')
    scale = np.mean(np.abs(np.diff(y_train)))
    if scale == 0:
        return float('nan')
    return float(np.mean(np.abs(y_true - y_pred)) / scale)


def wape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    denom = np.sum(np.abs(y_true))
    if denom == 0:
        return float('nan')
    return float(np.sum(np.abs(y_true - y_pred)) / denom)


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((np.asarray(y_true) - np.asarray(y_pred)) ** 2)))


def bias(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.asarray(y_pred) - np.asarray(y_true)))


def pinball_loss(y_true: np.ndarray, y_pred_q: np.ndarray, q: float) -> float:
    e = np.asarray(y_true) - np.asarray(y_pred_q)
    return float(np.mean(np.maximum(q * e, (q - 1) * e)))


def summarize_metrics(
    df_pred: pd.DataFrame,
    split: str,
    model_name: str,
    dataset: str,
    y_train_lookup: dict[str, np.ndarray],
) -> pd.DataFrame:
    rows: list[dict] = []
    sdf = df_pred[df_pred['split'] == split].copy()
    if sdf.empty:
        return pd.DataFrame()

    for h in sorted(sdf['horizon'].unique()):
        hdf = sdf[sdf['horizon'] == h]
        y = hdf['y_true'].to_numpy(dtype=float)
        p = hdf['y_pred'].to_numpy(dtype=float)

        mase_vals = []
        for sid, g in hdf.groupby('series_id'):
            y_train = y_train_lookup.get(sid)
            if y_train is None:
                continue
            mase_vals.append(mase(g['y_true'].to_numpy(), g['y_pred'].to_numpy(), y_train))

        rows.append(
            {
                'dataset': dataset,
                'model': model_name,
                'split': split,
                'horizon': int(h),
                'n_obs': int(len(hdf)),
                'WAPE': wape(y, p),
                'RMSE': rmse(y, p),
                'Bias': bias(y, p),
                'MASE_mean': float(np.nanmean(mase_vals)) if mase_vals else float('nan'),
                'wQL50': pinball_loss(y, p, 0.5),
                'under_forecast_rate': float(np.mean(p < y)),
            }
        )

    # Overall row.
    y = sdf['y_true'].to_numpy(dtype=float)
    p = sdf['y_pred'].to_numpy(dtype=float)
    mase_vals = []
    for sid, g in sdf.groupby('series_id'):
        y_train = y_train_lookup.get(sid)
        if y_train is None:
            continue
        mase_vals.append(mase(g['y_true'].to_numpy(), g['y_pred'].to_numpy(), y_train))

    rows.append(
        {
            'dataset': dataset,
            'model': model_name,
            'split': split,
            'horizon': 0,
            'n_obs': int(len(sdf)),
            'WAPE': wape(y, p),
            'RMSE': rmse(y, p),
            'Bias': bias(y, p),
            'MASE_mean': float(np.nanmean(mase_vals)) if mase_vals else float('nan'),
            'wQL50': pinball_loss(y, p, 0.5),
            'under_forecast_rate': float(np.mean(p < y)),
        }
    )
    return pd.DataFrame(rows)


def build_inventory_recommendations(
    df_forecast: pd.DataFrame,
    df_source: pd.DataFrame,
    service_level_z: float = 1.65,
) -> pd.DataFrame:
    # Use test split only for candidate operational decisions.
    f = df_forecast[df_forecast['split'] == 'test'].copy()
    if f.empty:
        return pd.DataFrame()

    # Use only H1-H3 for planning.
    f = f[f['horizon'].isin([1, 2, 3])]

    # Estimate per-series uncertainty from residuals in val+test.
    residual_std = (
        df_forecast[df_forecast['split'].isin(['val', 'test'])]
        .groupby('series_id')
        .apply(lambda g: float(np.std(g['y_true'] - g['y_pred'])))
        .rename('sigma')
        .reset_index()
    )

    monthly = (
        f.groupby(['dataset', 'model', 'series_id', 'fg_code', 'fg_category'], as_index=False)
        .agg(forecast_p50=('y_pred', 'mean'))
    )
    monthly = monthly.merge(residual_std, on='series_id', how='left')
    monthly['sigma'] = monthly['sigma'].fillna(0.0)

    if 'lead_time_days' in df_source.columns:
        latest = (
            df_source.sort_values('month')
            .groupby(['series_id', 'fg_code'], as_index=False)
            .tail(1)[['series_id', 'fg_code', 'lead_time_days', 'on_hand_inventory']]
        )
        monthly = monthly.merge(latest, on=['series_id', 'fg_code'], how='left')
    else:
        monthly['lead_time_days'] = np.nan
        monthly['on_hand_inventory'] = np.nan

    monthly['lead_time_months'] = (monthly['lead_time_days'].fillna(30) / 30.0).clip(0.2, 4.0)
    monthly['safety_stock'] = np.round(service_level_z * monthly['sigma'] * np.sqrt(monthly['lead_time_months']))
    monthly['reorder_point'] = np.round(monthly['forecast_p50'] * monthly['lead_time_months'] + monthly['safety_stock'])
    monthly['target_max'] = np.round(monthly['reorder_point'] + monthly['forecast_p50'])
    monthly['suggested_order_qty'] = np.round(
        np.maximum(monthly['target_max'] - monthly['on_hand_inventory'].fillna(0), 0)
    )

    return monthly[
        [
            'dataset',
            'model',
            'series_id',
            'fg_code',
            'fg_category',
            'forecast_p50',
            'safety_stock',
            'reorder_point',
            'target_max',
            'on_hand_inventory',
            'suggested_order_qty',
        ]
    ]


def add_series_id(df: pd.DataFrame, dataset: str) -> pd.DataFrame:
    out = df.copy()
    if dataset == 'C':
        out['series_id'] = out['scenario_id'].astype(str) + '__' + out['fg_code'].astype(str)
    else:
        out['series_id'] = out['fg_code'].astype(str)
    return out


def save_outputs(metrics_df: pd.DataFrame, forecast_df: pd.DataFrame, inv_df: pd.DataFrame, tag: str) -> None:
    ensure_output_dirs()
    if not metrics_df.empty:
        metrics_df.to_csv(OUT_DIR / 'metrics' / f'metrics_{tag}.csv', index=False)
    if not forecast_df.empty:
        forecast_df.to_csv(OUT_DIR / 'forecasts' / f'forecast_{tag}.csv', index=False)
    if not inv_df.empty:
        inv_df.to_csv(OUT_DIR / 'inventory' / f'inventory_{tag}.csv', index=False)
