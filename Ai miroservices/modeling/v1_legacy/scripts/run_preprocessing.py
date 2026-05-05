from __future__ import annotations

import argparse

from preprocessing import CleaningConfig, run_preprocessing_for_all


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cap-outliers-for-ab", action="store_true")
    parser.add_argument("--outlier-iqr-k", type=float, default=3.0)
    args = parser.parse_args()

    results = run_preprocessing_for_all(
        CleaningConfig(
            cap_outliers_for_ab=args.cap_outliers_for_ab,
            outlier_iqr_k=args.outlier_iqr_k,
        )
    )
    for dataset, paths in results.items():
        print(f"[OK] dataset={dataset}")
        for key, value in paths.items():
            print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
