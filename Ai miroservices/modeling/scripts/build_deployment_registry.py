from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from common import OUT_DIR


def main() -> None:
    metrics_path = OUT_DIR / 'reports' / 'all_metrics_combined.csv'
    if not metrics_path.exists():
        raise FileNotFoundError(f'Missing metrics file: {metrics_path}')

    m = pd.read_csv(metrics_path)
    test_overall = m[(m['split'] == 'test') & (m['horizon'] == 0)].copy()
    if test_overall.empty:
        raise ValueError('No test horizon=0 rows found in all_metrics_combined.csv')

    registry: dict[str, dict] = {}
    for ds, g in test_overall.groupby('dataset'):
        g = g.sort_values(['WAPE', 'RMSE', 'MASE_mean'])
        champion = g.iloc[0]
        fallbacks = g.iloc[1:4]
        registry[str(ds)] = {
            'champion_model': str(champion['model']),
            'fallback_models': [str(x) for x in fallbacks['model'].tolist()],
            'selection_metric': {
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

