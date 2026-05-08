#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from export_outbound_history_and_dq import _statuses, run as export_run
from generate_synthetic_history_for_runtime import run as synth_run
from load_outbound_history_backfill import run as load_run


def main() -> int:
    parser = argparse.ArgumentParser(
        description="End-to-end outbound history backfill pipeline: export + DQ + lineage + idempotent load."
    )
    parser.add_argument("--db-url", required=True, help="PostgreSQL SQLAlchemy URL")
    parser.add_argument("--schema", default="public")
    parser.add_argument("--warehouse-id", default=None, help="Optional warehouse UUID filter for export/load scope")
    parser.add_argument("--outbound-statuses", default="shipped,delivered,completed")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD")
    parser.add_argument(
        "--out-dir",
        default="ai-services/forecast-service/artifacts/backfill",
        help="Output root for generated artifacts",
    )
    parser.add_argument("--source-tag", default="pipeline_backfill")
    parser.add_argument(
        "--augment-runtime-history",
        action="store_true",
        help="After export+load, generate and load synthetic monthly history to ensure lag depth coverage.",
    )
    parser.add_argument(
        "--augment-months",
        type=int,
        default=36,
        help="Months per SKU for synthetic runtime augmentation when --augment-runtime-history is enabled.",
    )
    parser.add_argument(
        "--augment-out-csv",
        default="ai-services/forecast-service/artifacts/backfill/synthetic_runtime_history.csv",
        help="Output CSV path used by synthetic runtime augmentation stage.",
    )
    args = parser.parse_args()

    export_result = export_run(
        db_url=args.db_url,
        out_dir=Path(args.out_dir),
        schema=args.schema,
        outbound_statuses=_statuses(args.outbound_statuses),
        warehouse_id=args.warehouse_id,
        start_date=args.start_date,
        end_date=args.end_date,
    )
    if export_result.get("status") == "error":
        combined = {
            "status": "error",
            "stage": "export",
            "export_result": export_result,
        }
        print(json.dumps(combined, indent=2, sort_keys=True))
        return 1

    output_dir = Path(str(export_result["output_dir"]))
    dataset_version = str(export_result["dataset_version"])
    daily_csv = output_dir / "outbound_demand_daily.csv"
    if not daily_csv.exists():
        combined = {
            "status": "error",
            "stage": "load",
            "reason": f"missing_daily_csv:{daily_csv}",
            "export_result": export_result,
        }
        print(json.dumps(combined, indent=2, sort_keys=True))
        return 1

    load_result = load_run(
        db_url=args.db_url,
        input_csv=daily_csv,
        dataset_version=dataset_version,
        source_tag=args.source_tag,
        warehouse_id_override=args.warehouse_id,
    )

    combined = {
        "status": "ok",
        "export_result": export_result,
        "load_result": load_result,
    }
    if args.augment_runtime_history:
        augment_result = synth_run(
            db_url=args.db_url,
            out_csv=Path(args.augment_out_csv),
            schema=args.schema,
            warehouse_id=args.warehouse_id,
            months=max(13, int(args.augment_months)),
        )
        combined["augmentation_result"] = augment_result
    print(json.dumps(combined, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
