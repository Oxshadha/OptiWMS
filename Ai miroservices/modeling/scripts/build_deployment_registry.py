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


def main() -> None:
    metrics_path = OUT_DIR / 'reports' / 'all_metrics_combined.csv'
    if not metrics_path.exists():
        raise FileNotFoundError(f'Missing metrics file: {metrics_path}')

    m = pd.read_csv(metrics_path)
    reports_dir = OUT_DIR / 'reports'
    weights = _load_horizon_weights(reports_dir, DEFAULT_HORIZONS)
    weighted = _weighted_wape(m, DEFAULT_HORIZONS, weights)

    test_overall = m[(m['split'] == 'test') & (m['horizon'] == 0)].copy()
    test_overall = test_overall.merge(weighted, on=['dataset', 'model'], how='left')
    if test_overall.empty:
        raise ValueError('No test horizon=0 rows found in all_metrics_combined.csv')

    registry: dict[str, dict] = {}
    for ds, g in test_overall.groupby('dataset'):
        g = g.sort_values(['weighted_wape', 'WAPE', 'RMSE', 'MASE_mean'])
        champion = g.iloc[0]
        fallbacks = g.iloc[1:4]
        registry[str(ds)] = {
            'champion_model': str(champion['model']),
            'fallback_models': [str(x) for x in fallbacks['model'].tolist()],
            'selection_metric': {
                'weighted_WAPE': float(champion['weighted_wape']) if pd.notna(champion['weighted_wape']) else None,
                'WAPE': float(champion['WAPE']),
                'RMSE': float(champion['RMSE']),
                'MASE_mean': float(champion['MASE_mean']) if pd.notna(champion['MASE_mean']) else None,
            },
        }

    out = OUT_DIR / 'reports' / 'deployment_registry.json'
    out.write_text(json.dumps(registry, indent=2), encoding='utf-8')
    print(f'Saved deployment registry: {out}')


if __name__ == '__main__':
    main()

