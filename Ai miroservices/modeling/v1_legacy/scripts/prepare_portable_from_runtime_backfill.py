#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


DEFAULT_IN = Path(
    "/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/synthetic_bom_dependent_history.csv"
)
DEFAULT_OUT = Path(
    "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/rule_based_portable_monthly.csv"
)


def run(input_csv: Path, output_csv: Path, report_json: Path | None = None) -> dict:
    if not input_csv.exists():
        raise FileNotFoundError(f"Input file not found: {input_csv}")

    raw = pd.read_csv(input_csv)
    required = {"sku", "demand_date", "demand_units"}
    missing = sorted(required - set(raw.columns))
    if missing:
        raise ValueError(f"Input missing required columns: {missing}")

    frame = raw.copy()
    frame["fg_code"] = frame["sku"].astype(str).str.strip()
    frame["month"] = pd.to_datetime(frame["demand_date"], errors="coerce").dt.to_period("M").dt.to_timestamp()
    frame["demand_units"] = pd.to_numeric(frame["demand_units"], errors="coerce").fillna(0.0)

    if "category" in frame.columns:
        frame["fg_name"] = frame["category"].astype(str).str.strip().replace("", "UNKNOWN")
    else:
        frame["fg_name"] = "UNKNOWN"
    frame["fg_category"] = "RM_PACKING"

    monthly = (
        frame.groupby(["month", "fg_code", "fg_name", "fg_category"], as_index=False)["demand_units"]
        .sum()
        .sort_values(["month", "fg_code"])
        .reset_index(drop=True)
    )
    monthly["month"] = monthly["month"].dt.strftime("%Y-%m-%d")
    monthly["demand_units"] = monthly["demand_units"].round(3)

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    monthly.to_csv(output_csv, index=False)

    report = {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_csv": str(input_csv.resolve()),
        "output_csv": str(output_csv.resolve()),
        "rows_in": int(len(raw)),
        "rows_out": int(len(monthly)),
        "sku_count": int(monthly["fg_code"].nunique()) if not monthly.empty else 0,
        "month_count": int(monthly["month"].nunique()) if not monthly.empty else 0,
        "demand_sum": float(monthly["demand_units"].sum()) if not monthly.empty else 0.0,
        "date_min": str(monthly["month"].min()) if not monthly.empty else None,
        "date_max": str(monthly["month"].max()) if not monthly.empty else None,
    }
    if report_json:
        report_json.parent.mkdir(parents=True, exist_ok=True)
        report_json.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert runtime/backfill synthetic history to notebook-compatible portable monthly dataset."
    )
    parser.add_argument("--input-csv", default=str(DEFAULT_IN))
    parser.add_argument("--output-csv", default=str(DEFAULT_OUT))
    parser.add_argument(
        "--report-json",
        default="/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/p_runtime_refresh_report.json",
    )
    args = parser.parse_args()

    run(
        input_csv=Path(args.input_csv),
        output_csv=Path(args.output_csv),
        report_json=Path(args.report_json) if args.report_json else None,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

