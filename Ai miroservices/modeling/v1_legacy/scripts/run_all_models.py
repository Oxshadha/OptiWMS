from __future__ import annotations

import argparse

from run_boosting import run_dataset as run_boosting_dataset
from run_classical import run_dataset as run_classical_dataset


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--datasets', nargs='+', default=['A', 'B', 'C'])
    parser.add_argument('--classical-models', nargs='+', default=['ETS', 'ARIMA', 'SARIMA'])
    parser.add_argument('--boosting-models', nargs='+', default=['XGBOOST', 'CATBOOST'])
    parser.add_argument('--horizons', type=str, default='1,2,3,4,5,6,7,8,9,10,11,12')
    parser.add_argument('--sample-frac-c', type=float, default=0.5)
    parser.add_argument('--max-series-classical', type=int, default=None)
    args = parser.parse_args()

    horizons = [int(x.strip()) for x in args.horizons.split(',') if x.strip()]

    for ds in args.datasets:
        print(f'[RUN] classical dataset={ds} models={args.classical_models}')
        run_classical_dataset(ds, args.classical_models, args.max_series_classical)

    for ds in args.datasets:
        frac = args.sample_frac_c if ds == 'C' else 1.0
        print(f'[RUN] boosting dataset={ds} models={args.boosting_models} sample_frac={frac}')
        run_boosting_dataset(ds, args.boosting_models, frac, horizons)


if __name__ == '__main__':
    main()

