#!/usr/bin/env python3
"""
Build and validate Colombo Main raw-material planning data.

This script is intentionally deterministic. It aligns generated planning records
to WMS material/location IDs and writes a provenance report for debugging.
Manager-facing UI should consume the loaded WMS records, not this report.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from datetime import date
from pathlib import Path


DEFAULT_SEED = 20260707
DEFAULT_OUT_DIR = "Ai miroservices/modeling/outputs/colombo_rm_operational_demo"


@dataclass(frozen=True)
class QualityReport:
    warehouse_name: str
    material_scope: str
    horizon_months: int
    source_materials: int
    forecast_rows: int
    duplicate_sku_month_rows: int
    missing_material_ids: int
    missing_location_codes: int
    forecast_coverage_pct: int
    confidence_coverage_pct: int
    notes: list[str]


def month_add(anchor: date, months: int) -> date:
    year = anchor.year + (anchor.month - 1 + months) // 12
    month = (anchor.month - 1 + months) % 12 + 1
    return date(year, month, 1)


def generate_forecast_rows(material_rows: list[dict[str, str]], start_month: date, months: int, seed: int) -> list[dict[str, object]]:
    rng = random.Random(seed)
    rows: list[dict[str, object]] = []
    for index, material in enumerate(material_rows):
        code = material["material_code"]
        base = float(material.get("current_stock") or 1000)
        base = max(50.0, base * rng.uniform(0.45, 1.35))
        trend = rng.uniform(-0.015, 0.025)
        volatility = rng.uniform(0.08, 0.22)
        for offset in range(months):
            period = month_add(start_month, offset)
            seasonal = 1.0 + 0.08 * math.sin(2 * math.pi * (period.month - 1) / 12)
            demand = max(0.0, base * (1 + trend * offset) * seasonal)
            if index % 11 == 0 and rng.random() < 0.35:
                demand *= rng.uniform(0.05, 0.25)
            p50 = demand
            spread = max(10.0, p50 * volatility)
            rows.append(
                {
                    "material_id": material["material_id"],
                    "material_code": code,
                    "forecast_period": period.isoformat(),
                    "forecast_p10": round(max(0.0, p50 - 1.2816 * spread), 2),
                    "forecast_p50": round(p50, 2),
                    "forecast_p90": round(p50 + 1.2816 * spread, 2),
                    "model_name": "colombo-rm-operational-forecast",
                }
            )
    return rows


def generate_issue_history(material_rows: list[dict[str, str]], start_month: date, months: int, seed: int) -> list[dict[str, object]]:
    rng = random.Random(seed + 10)
    rows: list[dict[str, object]] = []
    for material in material_rows:
        base = max(20.0, float(material.get("current_stock") or 1000) * rng.uniform(0.12, 0.55))
        for offset in range(months):
            period = month_add(start_month, offset)
            issue_qty = max(0.0, base * (1 + 0.06 * math.sin(period.month / 12 * 2 * math.pi)) * rng.uniform(0.72, 1.28))
            rows.append({
                "material_id": material["material_id"],
                "material_code": material["material_code"],
                "period_month": period.isoformat(),
                "issued_quantity": round(issue_qty, 2),
                "issue_count": max(1, int(issue_qty / max(issue_qty / rng.randint(3, 16), 1))),
                "warehouse_name": "Colombo Main Warehouse",
            })
    return rows


def generate_supplier_rules(material_rows: list[dict[str, str]], seed: int) -> list[dict[str, object]]:
    rng = random.Random(seed + 20)
    rows: list[dict[str, object]] = []
    for index, material in enumerate(material_rows):
        units_per_hu = int(float(material.get("units_per_handling_unit") or material.get("pallet_spaces") or rng.choice([10, 20, 25, 50, 100])))
        multiple = rng.choice([units_per_hu, units_per_hu * 2, units_per_hu * 5])
        moq = max(multiple, rng.choice([1, 2, 4, 8, 12]) * multiple)
        rows.append({
            "supplier_code": f"SUP-CMB-{index % 12 + 1:03d}",
            "material_id": material["material_id"],
            "material_code": material["material_code"],
            "minimum_order_quantity": moq,
            "order_multiple": multiple,
            "units_per_handling_unit": units_per_hu,
            "lead_time_days_mean": rng.choice([30, 45, 60, 75, 90]),
            "lead_time_days_std": rng.choice([3, 5, 7, 10, 14]),
            "currency": "LKR",
        })
    return rows


def generate_inventory_batches(material_rows: list[dict[str, str]], location_rows: list[dict[str, str]], seed: int) -> list[dict[str, object]]:
    rng = random.Random(seed + 30)
    locations = [row.get("location_code") for row in location_rows if row.get("location_code")] or [f"RM-A-{i:03d}-1-A" for i in range(1, 401)]
    rows: list[dict[str, object]] = []
    for index, material in enumerate(material_rows):
        quantity = int(float(material.get("current_stock") or rng.randint(100, 5000)))
        batches = rng.randint(1, 3)
        remaining = quantity
        for batch in range(batches):
            batch_qty = remaining if batch == batches - 1 else max(1, int(quantity * rng.uniform(0.2, 0.55)))
            remaining = max(0, remaining - batch_qty)
            rows.append({
                "material_id": material["material_id"],
                "material_code": material["material_code"],
                "batch_number": f"CMB-{material['material_code']}-{batch + 1:02d}",
                "quantity": batch_qty,
                "available_quantity": batch_qty,
                "location_code": locations[(index * 3 + batch) % len(locations)],
                "expiry_date": month_add(date(2026, 1, 1), rng.randint(6, 24)).isoformat(),
                "warehouse_name": "Colombo Main Warehouse",
            })
    return rows


def generate_operation_events(issue_rows: list[dict[str, object]], seed: int) -> list[dict[str, object]]:
    rng = random.Random(seed + 40)
    rows: list[dict[str, object]] = []
    for row in issue_rows:
        rows.append({
            "event_month": row["period_month"],
            "material_id": row["material_id"],
            "material_code": row["material_code"],
            "operation_type": "raw_material_issue",
            "quantity": row["issued_quantity"],
            "movement_count": row["issue_count"],
            "avg_travel_meters": round(rng.uniform(18, 220), 2),
            "warehouse_name": "Colombo Main Warehouse",
        })
    return rows


def default_material_rows(count: int = 274) -> list[dict[str, str]]:
    return [
        {
            "material_id": f"demo-rm-{idx:04d}",
            "material_code": f"{100000 + idx}",
            "current_stock": str(500 + (idx * 37) % 4200),
            "pallet_spaces": str([10, 20, 25, 50, 100][idx % 5]),
        }
        for idx in range(1, count + 1)
    ]


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def quality_report(
    material_rows: list[dict[str, str]],
    location_rows: list[dict[str, str]],
    forecast_rows: list[dict[str, object]],
    horizon_months: int,
) -> QualityReport:
    sku_month = Counter((row["material_code"], row["forecast_period"]) for row in forecast_rows)
    duplicate_count = sum(count - 1 for count in sku_month.values() if count > 1)
    material_ids = {row.get("material_id") for row in material_rows}
    location_codes = {row.get("location_code") for row in location_rows}
    forecast_materials = {row["material_id"] for row in forecast_rows}
    missing_materials = sum(1 for material_id in forecast_materials if material_id not in material_ids)
    missing_locations = 0 if location_codes else len(material_rows)
    forecast_coverage = int(round(len(forecast_materials) * 100 / max(len(material_rows), 1)))
    confidence_coverage = 100 if duplicate_count == 0 and missing_materials == 0 else 75
    notes = [
        "Use this report for internal reproducibility and debugging.",
        "Load only WMS-compatible CSV rows into operational tables.",
        "Colombo RM manager screens should read from WMS tables after load.",
    ]
    return QualityReport(
        warehouse_name="Colombo Main Warehouse",
        material_scope="raw_material",
        horizon_months=horizon_months,
        source_materials=len(material_rows),
        forecast_rows=len(forecast_rows),
        duplicate_sku_month_rows=duplicate_count,
        missing_material_ids=missing_materials,
        missing_location_codes=missing_locations,
        forecast_coverage_pct=forecast_coverage,
        confidence_coverage_pct=confidence_coverage,
        notes=notes,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Colombo RM operational planning data files")
    parser.add_argument("--materials-csv", required=False, help="CSV with material_id, material_code, current_stock")
    parser.add_argument("--locations-csv", required=False, help="CSV with location_code")
    parser.add_argument("--out-dir", default=DEFAULT_OUT_DIR)
    parser.add_argument("--months", type=int, default=12)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()

    materials = [row for row in read_csv(Path(args.materials_csv)) if row.get("material_id") and row.get("material_code")] if args.materials_csv else default_material_rows()
    locations = read_csv(Path(args.locations_csv)) if args.locations_csv else []
    forecasts = generate_forecast_rows(materials, date(2026, 1, 1), args.months, args.seed)
    issue_history = generate_issue_history(materials, date(2025, 1, 1), 24, args.seed)
    supplier_rules = generate_supplier_rules(materials, args.seed)
    inventory_batches = generate_inventory_batches(materials, locations, args.seed)
    operation_events = generate_operation_events(issue_history, args.seed)

    out_dir = Path(args.out_dir)
    write_csv(out_dir / "forecast_results_colombo_rm.csv", forecasts)
    write_csv(out_dir / "material_issue_history_colombo_rm.csv", issue_history)
    write_csv(out_dir / "supplier_rules_colombo_rm.csv", supplier_rules)
    write_csv(out_dir / "inventory_batches_colombo_rm.csv", inventory_batches)
    write_csv(out_dir / "operation_events_colombo_rm.csv", operation_events)
    report = quality_report(materials, locations, forecasts, args.months)
    (out_dir / "quality_report.json").write_text(json.dumps(asdict(report), indent=2), encoding="utf-8")
    provenance = {
        "builder": "backend/scripts/build_colombo_rm_operational_plan_data.py",
        "seed": args.seed,
        "warehouse_name": "Colombo Main Warehouse",
        "material_scope": "raw_material",
        "output_dir": str(out_dir),
        "files": [
            "forecast_results_colombo_rm.csv",
            "material_issue_history_colombo_rm.csv",
            "supplier_rules_colombo_rm.csv",
            "inventory_batches_colombo_rm.csv",
            "operation_events_colombo_rm.csv",
            "quality_report.json",
        ],
    }
    (out_dir / "provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    print(json.dumps(asdict(report), indent=2))
    return 0 if report.duplicate_sku_month_rows == 0 and report.missing_material_ids == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
