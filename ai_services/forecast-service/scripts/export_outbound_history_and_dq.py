#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text


def _statuses(raw: str) -> list[str]:
    vals = [s.strip().lower() for s in (raw or "").split(",") if s.strip()]
    return vals or ["shipped", "delivered", "completed"]


@dataclass
class DqReport:
    status: str
    reason: str
    checks: dict
    lineage: dict


def _query_base(schema: str) -> str:
    return f"""
    SELECT
        o.id::text AS order_id,
        o.order_date::date AS order_date,
        o.warehouse_id::text AS warehouse_id,
        LOWER(COALESCE(o.status, '')) AS order_status,
        m.id::text AS material_id,
        m.material_code::text AS sku,
        COALESCE(NULLIF(m.description, ''), 'UNKNOWN')::text AS category,
        LOWER(COALESCE(m.material_type, '')) AS material_type,
        COALESCE(oi.quantity, 0)::double precision AS quantity
    FROM {schema}.order_items oi
    JOIN {schema}.orders o ON o.id = oi.order_id
    JOIN {schema}.materials m ON m.id = oi.material_id
    WHERE LOWER(COALESCE(o.order_type, '')) = 'outbound'
      AND LOWER(COALESCE(o.status, '')) = ANY(:statuses)
      AND LOWER(COALESCE(m.material_type, '')) = 'product'
      AND (:warehouse_id IS NULL OR o.warehouse_id::text = :warehouse_id)
      AND (:start_date IS NULL OR o.order_date::date >= CAST(:start_date AS date))
      AND (:end_date IS NULL OR o.order_date::date <= CAST(:end_date AS date))
    """


def _dataset_version(meta: dict) -> str:
    payload = json.dumps(meta, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:16]


def _write_csv(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False, quoting=csv.QUOTE_MINIMAL)


def _compute_missing_months(monthly: pd.DataFrame) -> tuple[int, float]:
    if monthly.empty:
        return 0, 0.0
    total_missing = 0
    total_expected = 0
    grouped = monthly.groupby(["warehouse_id", "sku"], dropna=False)
    for _, g in grouped:
        months = pd.to_datetime(g["month"]).dt.to_period("M").sort_values().unique()
        if len(months) == 0:
            continue
        start, end = months.min(), months.max()
        expected = len(pd.period_range(start, end, freq="M"))
        observed = len(months)
        total_expected += expected
        total_missing += max(expected - observed, 0)
    rate = (total_missing / total_expected) if total_expected else 0.0
    return int(total_missing), float(rate)


def run(
    db_url: str,
    out_dir: Path,
    schema: str,
    outbound_statuses: list[str],
    warehouse_id: str | None,
    start_date: str | None,
    end_date: str | None,
) -> dict:
    engine = create_engine(db_url, future=True, pool_pre_ping=True)
    sql = text(_query_base(schema))
    params = {
        "statuses": outbound_statuses,
        "warehouse_id": warehouse_id or None,
        "start_date": start_date,
        "end_date": end_date,
    }
    with engine.connect() as conn:
        rows = conn.execute(sql, params).mappings().all()
    base = pd.DataFrame(rows)

    if not base.empty:
        base["order_date"] = pd.to_datetime(base["order_date"]).dt.date

    daily = (
        base.groupby(["warehouse_id", "sku", "category", "order_date"], dropna=False, as_index=False)["quantity"]
        .sum()
        .rename(columns={"quantity": "demand_units", "order_date": "date"})
        .sort_values(["warehouse_id", "sku", "date"])
    )
    monthly = (
        base.assign(month=pd.to_datetime(base["order_date"]).dt.to_period("M").astype(str))
        .groupby(["warehouse_id", "sku", "category", "month"], dropna=False, as_index=False)["quantity"]
        .sum()
        .rename(columns={"quantity": "demand_units"})
        .sort_values(["warehouse_id", "sku", "month"])
    )

    duplicate_line_groups = 0
    if not base.empty:
        duplicate_line_groups = int(
            base.groupby(["order_id", "material_id"], dropna=False).size().gt(1).sum()
        )

    missing_months_total, missing_months_rate = _compute_missing_months(monthly)

    checks = {
        "base_rows": int(len(base)),
        "daily_rows": int(len(daily)),
        "monthly_rows": int(len(monthly)),
        "distinct_orders": int(base["order_id"].nunique()) if not base.empty else 0,
        "distinct_skus": int(base["sku"].nunique()) if not base.empty else 0,
        "negative_qty_rows": int((base["quantity"] < 0).sum()) if not base.empty else 0,
        "zero_qty_rows": int((base["quantity"] == 0).sum()) if not base.empty else 0,
        "null_sku_rows": int(base["sku"].isna().sum()) if not base.empty else 0,
        "duplicate_order_material_groups": duplicate_line_groups,
        "missing_months_total": missing_months_total,
        "missing_months_rate": round(missing_months_rate, 6),
    }

    reason = "ok"
    status = "ok"
    if checks["base_rows"] == 0:
        status = "error"
        reason = "no_outbound_rows"
    elif checks["negative_qty_rows"] > 0:
        status = "warn"
        reason = "negative_quantities_present"
    elif checks["null_sku_rows"] > 0:
        status = "warn"
        reason = "null_sku_present"
    elif checks["missing_months_rate"] > 0.3:
        status = "warn"
        reason = "high_missing_month_rate"

    meta = {
        "schema": schema,
        "warehouse_id": warehouse_id,
        "outbound_statuses": outbound_statuses,
        "start_date": start_date,
        "end_date": end_date,
        "generated_at": datetime.now(UTC).isoformat(),
        "checks": checks,
    }
    dataset_version = _dataset_version(meta)
    ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    run_dir = out_dir / f"{ts}_{dataset_version}"
    run_dir.mkdir(parents=True, exist_ok=True)

    _write_csv(run_dir / "outbound_demand_daily.csv", daily)
    _write_csv(run_dir / "outbound_demand_monthly.csv", monthly)

    lineage = {
        "dataset_version": dataset_version,
        "source": "wms_db_outbound_orders",
        "schema": schema,
        "warehouse_id": warehouse_id,
        "outbound_statuses": outbound_statuses,
        "start_date": start_date,
        "end_date": end_date,
        "generated_at": meta["generated_at"],
        "row_counts": {
            "base_rows": checks["base_rows"],
            "daily_rows": checks["daily_rows"],
            "monthly_rows": checks["monthly_rows"],
        },
        "artifacts": {
            "daily_csv": str((run_dir / "outbound_demand_daily.csv").resolve()),
            "monthly_csv": str((run_dir / "outbound_demand_monthly.csv").resolve()),
            "dq_report": str((run_dir / "dq_report.json").resolve()),
            "lineage_report": str((run_dir / "lineage.json").resolve()),
        },
    }
    dq_report = DqReport(status=status, reason=reason, checks=checks, lineage=lineage)

    with (run_dir / "dq_report.json").open("w", encoding="utf-8") as f:
        json.dump(asdict(dq_report), f, indent=2, sort_keys=True)
    with (run_dir / "lineage.json").open("w", encoding="utf-8") as f:
        json.dump(lineage, f, indent=2, sort_keys=True)

    result = {
        "status": status,
        "reason": reason,
        "dataset_version": dataset_version,
        "output_dir": str(run_dir.resolve()),
        "checks": checks,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Export outbound demand history and generate DQ/lineage artifacts.")
    parser.add_argument("--db-url", required=True, help="PostgreSQL SQLAlchemy URL")
    parser.add_argument("--schema", default="public")
    parser.add_argument("--warehouse-id", default=None)
    parser.add_argument("--outbound-statuses", default="shipped,delivered,completed")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD")
    parser.add_argument(
        "--out-dir",
        default="ai-services/forecast-service/artifacts/backfill",
        help="Output folder for generated artifacts",
    )
    args = parser.parse_args()

    result = run(
        db_url=args.db_url,
        out_dir=Path(args.out_dir),
        schema=args.schema,
        outbound_statuses=_statuses(args.outbound_statuses),
        warehouse_id=args.warehouse_id,
        start_date=args.start_date,
        end_date=args.end_date,
    )
    return 0 if result["status"] in {"ok", "warn"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
