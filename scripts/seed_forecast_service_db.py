#!/usr/bin/env python3
"""Rebuild forecast-service's SQLite database from tracked pipeline artifacts.

The database itself is deliberately not in git -- it is derived data, and a
binary blob in version control goes stale silently. Everything it holds is
reproducible from CSVs that *are* tracked, so a fresh clone can rebuild it
byte-for-byte deterministically:

    outputs/operational_forecasts.csv        -> forecast_predictions
    outputs/operational_backtest_metrics.csv -> forecast_metrics
    outputs/inventory_policy_simulation.csv  -> inventory_recommendations
    outputs/operational_shap.csv             -> forecast_shap_explanations

This calls the same _publish_service_snapshot() the live /v8/recalculate
endpoint uses, rather than reimplementing the load. A seeder that drifts from
the production path is worse than no seeder, because it hides the drift.

Usage:
    python scripts/seed_forecast_service_db.py [--warehouse WH-001] [--force]
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SERVICE_DIR = REPO_ROOT / "ai_services" / "forecast-service"
PIPELINE_OUTPUT = (
    REPO_ROOT / "Ai miroservices" / "modeling"
    / "v8_controlled_synthetic_validation" / "outputs"
)

REQUIRED = [
    "operational_forecasts.csv",
    "operational_backtest_metrics.csv",
    "inventory_policy_simulation.csv",
    "data/initial_inventory.csv",
]
OPTIONAL = ["operational_shap.csv"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--warehouse", default="WH-001")
    parser.add_argument("--output-dir", type=Path, default=PIPELINE_OUTPUT)
    parser.add_argument(
        "--force", action="store_true",
        help="replace an existing database instead of refusing",
    )
    args = parser.parse_args()

    missing = [name for name in REQUIRED if not (args.output_dir / name).exists()]
    if missing:
        print(f"error: missing pipeline artifacts in {args.output_dir}:", file=sys.stderr)
        for name in missing:
            print(f"  - {name}", file=sys.stderr)
        print("\nRun the modelling pipeline first:\n"
              "  cd 'Ai miroservices/modeling/v8_controlled_synthetic_validation'\n"
              "  PYTHONPATH=. python -m pipeline.operational_forecast", file=sys.stderr)
        return 1

    for name in OPTIONAL:
        if not (args.output_dir / name).exists():
            print(f"note: {name} absent -- seeding without SHAP explanations. "
                  "Re-run the modelling pipeline to generate them.")

    db_path = SERVICE_DIR / "forecast_service.db"
    if db_path.exists() and db_path.stat().st_size > 0 and not args.force:
        print(f"error: {db_path} already exists. Pass --force to replace it.", file=sys.stderr)
        return 1
    if db_path.exists():
        db_path.unlink()

    sys.path.insert(0, str(SERVICE_DIR))
    os.chdir(SERVICE_DIR)  # the service resolves its SQLite path relative to CWD

    from app.db.database import engine, get_db  # noqa: E402
    from app.db.models import Base  # noqa: E402
    from app.api.v1.routes.v8_operational import _publish_service_snapshot  # noqa: E402

    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        result = _publish_service_snapshot(db, args.output_dir, args.warehouse)
    finally:
        db.close()

    print(f"seeded {db_path}")
    for key, value in result.items():
        print(f"  {key}: {value}")
    if not result.get("shap_explanations"):
        print("  warning: no SHAP explanations loaded -- 'why is demand low' "
              "questions will fall back to a generic answer.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
