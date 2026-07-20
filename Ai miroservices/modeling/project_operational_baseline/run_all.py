from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline.generate_baseline import BaselineConfig, generate_baseline
from pipeline.forecasting import ForecastConfig, run_forecast_evidence
from pipeline.notebook_factory import build_notebooks


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the canonical OptiWMS operational baseline")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "outputs")
    parser.add_argument("--seed", type=int, default=BaselineConfig.seed)
    parser.add_argument("--small", action="store_true", help="Fast contract profile for tests only")
    args = parser.parse_args()
    cfg = BaselineConfig(seed=args.seed)
    if args.small:
        cfg = BaselineConfig(
            seed=args.seed, history_months=36, operational_months=6, fg_count=8,
            rm_count=24, pm_count=16, location_count=360, supplier_count=8,
            customer_count=24, worker_count=12, order_count=250,
            order_line_count=1000, stock_movement_count=1250, task_count=1250,
        )
    manifest = generate_baseline(args.output, cfg)
    forecast_cfg = ForecastConfig(
        selection_months=6 if args.small else 12,
        test_months=6 if args.small else 12,
        minimum_history=12 if args.small else 24,
        trees=30 if args.small else 120,
        seed=args.seed,
    )
    evidence = run_forecast_evidence(args.output, forecast_cfg)
    build_notebooks()
    print(json.dumps({"manifest": manifest, "forecast_evidence": evidence}, indent=2))


if __name__ == "__main__":
    main()
