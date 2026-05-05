from __future__ import annotations

import json
import os
from pathlib import Path

import pandas as pd

from common import OUT_DIR

DEFAULT_HORIZONS = list(range(1, 13))


def _load_horizon_weights(reports_dir: Path, horizons: list[int]) -> dict[int, float]:
    env = os.getenv("FORECAST_HORIZON_WEIGHTS", "").strip()
    if env:
        parsed: dict[int, float] = {}
        for chunk in env.split(","):
            if not chunk.strip():
                continue
            k, v = chunk.split(":", 1)
            parsed[int(k.strip())] = float(v.strip())
        return parsed

    weights_path = reports_dir / "horizon_weights.json"
    if weights_path.exists():
        try:
            payload = json.loads(weights_path.read_text(encoding="utf-8"))
            return {int(k): float(v) for k, v in payload.items()}
        except Exception:
            return {h: 1.0 for h in horizons}

    return {h: 1.0 for h in horizons}


def _weighted_wape(metrics: pd.DataFrame, horizons: list[int], weights: dict[int, float]) -> pd.DataFrame:
    subset = metrics[(metrics["split"] == "test") & (metrics["horizon"].isin(horizons))].copy()
    if subset.empty:
        return pd.DataFrame(columns=["dataset", "model", "weighted_wape", "weight_sum"])

    subset["weight"] = subset["horizon"].map(weights).fillna(1.0)
    grouped = subset.groupby(["dataset", "model"], as_index=False)
    out = grouped.apply(lambda g: pd.Series({
        "weighted_wape": float((g["WAPE"] * g["weight"]).sum() / g["weight"].sum()),
        "weight_sum": float(g["weight"].sum()),
    }))
    return out.reset_index(drop=True)


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

    expected_models = ['ETS', 'ARIMA', 'SARIMA', 'XGBOOST', 'CATBOOST']
    expected_datasets = ['A', 'B', 'C']

    test_available = metrics[(metrics['split'] == 'test') & (metrics['horizon'] == 0)][['dataset', 'model']].drop_duplicates()
    expected_rows = pd.MultiIndex.from_product([expected_datasets, expected_models], names=['dataset', 'model']).to_frame(index=False)
    coverage = expected_rows.merge(test_available.assign(status='available'), on=['dataset', 'model'], how='left')
    coverage['status'] = coverage['status'].fillna('missing')

    weights = _load_horizon_weights(reports_dir, DEFAULT_HORIZONS)
    weighted = _weighted_wape(metrics, DEFAULT_HORIZONS, weights)

    # Keep best (lowest weighted WAPE) per dataset on test horizon 1..12.
    test_overall = metrics[(metrics['split'] == 'test') & (metrics['horizon'] == 0)].copy()
    test_overall = test_overall.merge(weighted, on=['dataset', 'model'], how='left')
    leaderboard = (
        test_overall.sort_values(['dataset', 'weighted_wape', 'WAPE', 'MASE_mean', 'RMSE'])
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
    coverage.to_csv(reports_dir / 'model_coverage_matrix.csv', index=False)

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
    print('Coverage available rows:', int((coverage['status'] == 'available').sum()))


if __name__ == '__main__':
    main()
