from __future__ import annotations

from pathlib import Path

import pandas as pd

from common import OUT_DIR


def load_concat(folder: Path, prefix: str) -> pd.DataFrame:
    files = sorted(folder.glob(f'{prefix}_*.csv'))
    dfs = []
    for f in files:
        try:
            dfs.append(pd.read_csv(f))
        except Exception:
            continue
    return pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()


def main() -> None:
    metrics = load_concat(OUT_DIR / 'metrics', 'metrics')
    forecasts = load_concat(OUT_DIR / 'forecasts', 'forecast')
    inventory = load_concat(OUT_DIR / 'inventory', 'inventory')

    if not metrics.empty:
        metrics = metrics.drop_duplicates()
    if not forecasts.empty:
        forecasts = forecasts.drop_duplicates()
    if not inventory.empty:
        inventory = inventory.drop_duplicates()

    # Consolidate repeated runs of the same model configuration.
    metric_keys = ['dataset', 'model', 'split', 'horizon']
    metric_vals = ['n_obs', 'WAPE', 'RMSE', 'Bias', 'MASE_mean', 'wQL50', 'under_forecast_rate']
    metrics = metrics.groupby(metric_keys, as_index=False)[metric_vals].mean()

    reports_dir = OUT_DIR / 'reports'
    reports_dir.mkdir(parents=True, exist_ok=True)

    if metrics.empty:
        print('No metrics files found.')
        return

    # Keep best (lowest WAPE) per dataset on test overall horizon=0.
    test_overall = metrics[(metrics['split'] == 'test') & (metrics['horizon'] == 0)].copy()
    leaderboard = (
        test_overall.sort_values(['dataset', 'WAPE', 'MASE_mean', 'RMSE'])
        .groupby('dataset', as_index=False)
        .head(5)
    )

    by_h = (
        metrics[metrics['split'] == 'test']
        .groupby(['dataset', 'model', 'horizon'], as_index=False)[['WAPE', 'MASE_mean', 'RMSE', 'Bias', 'under_forecast_rate']]
        .mean()
    )

    metrics.to_csv(reports_dir / 'all_metrics_combined.csv', index=False)
    leaderboard.to_csv(reports_dir / 'leaderboard_top5_per_dataset.csv', index=False)
    by_h.to_csv(reports_dir / 'test_metrics_by_horizon.csv', index=False)

    if not forecasts.empty:
        # Dashboard-ready forecast table: p50 and interval for test rows only.
        fc_dash = forecasts[forecasts['split'] == 'test'][
            ['dataset', 'model', 'series_id', 'fg_code', 'fg_category', 'month', 'horizon', 'y_true', 'y_pred', 'p10', 'p90']
        ].copy()
        fc_dash = fc_dash.rename(columns={'y_pred': 'forecast_p50'})
        fc_dash.to_csv(reports_dir / 'dashboard_forecast_output.csv', index=False)

    if not inventory.empty:
        inv_dash = inventory.copy()
        inv_dash.to_csv(reports_dir / 'dashboard_inventory_recommendations.csv', index=False)

    print('Saved report files in', reports_dir)
    print('Leaderboard rows:', len(leaderboard))


if __name__ == '__main__':
    main()
