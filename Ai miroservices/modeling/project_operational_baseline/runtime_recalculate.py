from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
import psycopg2

from pipeline.forecasting import ForecastConfig, run_forecast_evidence


def refresh_operational_demand(output: Path, database_url: str) -> int:
    contract_path = output / "demand_history.csv.gz"
    contract = pd.read_csv(contract_path)
    with psycopg2.connect(database_url) as connection:
        operational = pd.read_sql_query(
            """
            SELECT m.material_code, d.period AS month, d.demand_units,
                   d.promotion_flag, d.lead_time_days
            FROM demand_history d
            JOIN materials m ON m.id=d.material_id
            WHERE d.source='PROJECT_OPERATIONAL_BASELINE_V1'
            ORDER BY m.material_code,d.period
            """,
            connection,
        )
    operational["month"] = pd.to_datetime(operational.month).dt.strftime("%Y-%m-%d")
    contract["month"] = pd.to_datetime(contract.month).dt.strftime("%Y-%m-%d")
    merged = contract.merge(
        operational,
        on=["material_code", "month"],
        how="left",
        suffixes=("_contract", "_operational"),
        validate="one_to_one",
    )
    if merged.demand_units_operational.isna().any() or len(merged) != len(contract):
        missing = int(merged.demand_units_operational.isna().sum())
        raise RuntimeError(f"PostgreSQL demand coverage does not match the canonical feature contract; missing={missing}")
    merged["demand_units"] = merged.pop("demand_units_operational")
    merged["promotion_flag"] = merged.pop("promotion_flag_operational").astype(int)
    merged["lead_time_days"] = merged.pop("lead_time_days_operational")
    merged = merged.drop(columns=[
        "demand_units_contract", "promotion_flag_contract", "lead_time_days_contract"
    ])
    merged[contract.columns].to_csv(contract_path, index=False, compression="gzip")
    return len(merged)


def main() -> None:
    parser = argparse.ArgumentParser(description="Recalculate canonical RM/PM forecast evidence")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "outputs")
    parser.add_argument("--seed", type=int, default=ForecastConfig.seed)
    parser.add_argument("--db-url", required=True)
    args = parser.parse_args()
    demand_rows = refresh_operational_demand(args.output, args.db_url)
    result = run_forecast_evidence(args.output, ForecastConfig(seed=args.seed))
    result["operational_demand_rows"] = demand_rows
    result["operational_demand_source"] = "PostgreSQL demand_history"
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
