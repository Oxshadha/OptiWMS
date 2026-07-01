#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable

import psycopg2
import psycopg2.extras


DATASET_VERSION = "HEMAS_SYNTHETIC_WMS_V6"
FORECAST_MODEL = "RM_GROSS_REQ_V6"
BASELINE_MODEL = "CANONICAL_BASELINE_V6"
DEMAND_SOURCE = "canonical_v6"


@dataclass
class LoadStats:
    source_file: str
    source_hash: str
    rows_seen: int = 0
    rows_mapped: int = 0
    rows_upserted: int = 0
    rows_unmapped: int = 0


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def dec(value: object, default: Decimal | None = None) -> Decimal | None:
    if value is None:
        return default
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return default
    try:
        return Decimal(text)
    except InvalidOperation:
        return default


def int_or_none(value: object) -> int | None:
    value_dec = dec(value)
    if value_dec is None:
        return None
    return int(value_dec.to_integral_value(rounding="ROUND_HALF_UP"))


def normalize_material_code(value: object) -> str:
    text = str(value or "").strip().upper()
    text = re.sub(r"^RM[_-]?", "", text)
    return text


def first_day_next_month(value: date) -> date:
    year = value.year + (1 if value.month == 12 else 0)
    month = 1 if value.month == 12 else value.month + 1
    return date(year, month, 1)


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def read_csv(path: Path) -> Iterable[dict[str, str]]:
    with path.open(newline="", errors="ignore") as f:
        yield from csv.DictReader(f)


def resolve_warehouse(cur, warehouse_id: str | None) -> str:
    if warehouse_id:
        cur.execute("SELECT id::text FROM warehouses WHERE id = %s", (warehouse_id,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"warehouse_id not found: {warehouse_id}")
        return row[0]
    cur.execute(
        """
        SELECT id::text
        FROM warehouses
        ORDER BY CASE WHEN name ILIKE 'Colombo%%' THEN 0 ELSE 1 END, name
        LIMIT 1
        """
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError("No warehouses found")
    return row[0]


def load_material_index(cur) -> dict[str, str]:
    cur.execute("SELECT id::text, material_code FROM materials")
    return {str(code).upper(): material_id for material_id, code in cur.fetchall()}


def audit_start(cur, dataset_version: str, source_file: Path, source_hash: str, warehouse_id: str, row_count: int) -> str:
    cur.execute(
        """
        INSERT INTO forecast_backfill_load_audit(
            dataset_version, source_file, source_file_sha256, warehouse_id, row_count, status, notes
        )
        VALUES (%s, %s, %s, %s, %s, 'running', 'canonical V6 load started')
        RETURNING id::text
        """,
        (dataset_version, str(source_file.resolve()), source_hash, warehouse_id, row_count),
    )
    return cur.fetchone()[0]


def audit_finish(cur, audit_id: str, stats: LoadStats, notes: str) -> None:
    cur.execute(
        """
        UPDATE forecast_backfill_load_audit
        SET inserted_rows = %s,
            updated_rows = %s,
            status = 'ok',
            notes = %s,
            finished_at = now()
        WHERE id = %s
        """,
        (stats.rows_upserted, 0, notes, audit_id),
    )


def load_rm_master(cur, material_index: dict[str, str], path: Path, warehouse_id: str) -> LoadStats:
    rows = list(read_csv(path))
    stats = LoadStats(str(path), sha256_file(path), rows_seen=len(rows))
    audit_id = audit_start(cur, DATASET_VERSION, path, stats.source_hash, warehouse_id, len(rows))
    unmapped: set[str] = set()
    for row in rows:
        code = normalize_material_code(row.get("rm_code"))
        material_id = material_index.get(code)
        if not material_id:
            stats.rows_unmapped += 1
            unmapped.add(code)
            continue
        stats.rows_mapped += 1
        cur.execute(
            """
            UPDATE materials
            SET material_type = 'raw_material',
                min_order_quantity = COALESCE(%s, min_order_quantity),
                order_delivery_days = COALESCE(%s, order_delivery_days),
                future_average = COALESCE(%s, future_average),
                variance_demand = COALESCE(%s, variance_demand),
                safety_stock_level = COALESCE(%s, safety_stock_level),
                order_quantity = COALESCE(%s, order_quantity),
                updated_at = now()
            WHERE id = %s
            """,
            (
                dec(row.get("moq")),
                int_or_none(row.get("lead_time_days")),
                dec(row.get("future_average")),
                dec(row.get("demand_variance")),
                dec(row.get("buffer_stock")),
                dec(row.get("maximum_stock")),
                material_id,
            ),
        )
        stats.rows_upserted += cur.rowcount
    audit_finish(cur, audit_id, stats, f"RM master fields loaded; unmapped={len(unmapped)}")
    return stats


def load_rm_policy(cur, material_index: dict[str, str], path: Path, warehouse_id: str) -> LoadStats:
    rows = list(read_csv(path))
    stats = LoadStats(str(path), sha256_file(path), rows_seen=len(rows))
    audit_id = audit_start(cur, DATASET_VERSION, path, stats.source_hash, warehouse_id, len(rows))
    unmapped: set[str] = set()
    for row in rows:
        code = normalize_material_code(row.get("rm_code"))
        material_id = material_index.get(code)
        if not material_id:
            stats.rows_unmapped += 1
            unmapped.add(code)
            continue
        stats.rows_mapped += 1
        cur.execute(
            """
            UPDATE materials
            SET safety_stock_level = COALESCE(%s, safety_stock_level),
                static_min_stock = COALESCE(%s, static_min_stock),
                ai_min_stock = COALESCE(%s, ai_min_stock),
                order_quantity = COALESCE(%s, order_quantity),
                forecast_p50 = COALESCE(%s, forecast_p50),
                forecast_p90 = COALESCE(%s, forecast_p90),
                forecast_p10 = COALESCE(forecast_p10, %s),
                forecast_updated_at = now(),
                updated_at = now()
            WHERE id = %s
            """,
            (
                dec(row.get("safety_stock")),
                dec(row.get("reorder_point")),
                dec(row.get("safety_stock")),
                dec(row.get("suggested_order_qty")),
                dec(row.get("avg_monthly_req_p50")),
                dec(row.get("avg_monthly_req_p90")),
                dec(row.get("avg_monthly_req_p50"), Decimal("0")) * Decimal("0.8"),
                material_id,
            ),
        )
        stats.rows_upserted += cur.rowcount
    audit_finish(cur, audit_id, stats, f"RM inventory policy loaded; unmapped={len(unmapped)}")
    return stats


def backfill_materials_from_inventory(cur) -> int:
    cur.execute(
        """
        WITH inv AS (
            SELECT material_id,
                   max(moq) FILTER (WHERE moq IS NOT NULL AND moq > 0) AS moq,
                   max(lead_time_days) FILTER (WHERE lead_time_days IS NOT NULL AND lead_time_days > 0) AS lead_time_days
            FROM inventory
            GROUP BY material_id
        )
        UPDATE materials m
        SET min_order_quantity = COALESCE(m.min_order_quantity, inv.moq),
            order_delivery_days = COALESCE(m.order_delivery_days, inv.lead_time_days),
            updated_at = now()
        FROM inv
        WHERE m.id = inv.material_id
          AND (m.min_order_quantity IS NULL OR m.min_order_quantity <= 0 OR m.order_delivery_days IS NULL OR m.order_delivery_days <= 0)
        """
    )
    return cur.rowcount


def load_demand_history(cur, material_index: dict[str, str], path: Path, warehouse_id: str) -> LoadStats:
    rows = list(read_csv(path))
    stats = LoadStats(str(path), sha256_file(path), rows_seen=len(rows))
    audit_id = audit_start(cur, DATASET_VERSION, path, stats.source_hash, warehouse_id, len(rows))
    unmapped: set[str] = set()
    for row in rows:
        code = normalize_material_code(row.get("fg_code"))
        material_id = material_index.get(code)
        demand = dec(row.get("demand_units"))
        period = row.get("month")
        if not material_id or demand is None or not period:
            stats.rows_unmapped += 1
            if code:
                unmapped.add(code)
            continue
        stats.rows_mapped += 1
        cur.execute(
            """
            UPDATE demand_history
            SET demand_units = %s,
                promotion_flag = COALESCE(%s, promotion_flag),
                holiday_flag = COALESCE(%s, holiday_flag),
                lead_time_days = COALESCE(%s, lead_time_days),
                on_hand_inventory = COALESCE(%s, on_hand_inventory),
                source = %s
            WHERE material_id = %s
              AND warehouse_id = %s
              AND period = %s::date
            """,
            (
                demand,
                str(row.get("promotion_flag", "0")).strip() in {"1", "true", "TRUE"},
                str(row.get("holiday_flag", "0")).strip() in {"1", "true", "TRUE"},
                dec(row.get("lead_time_days")),
                dec(row.get("on_hand_inventory")),
                DEMAND_SOURCE,
                material_id,
                warehouse_id,
                period,
            ),
        )
        if cur.rowcount == 0:
            cur.execute(
                """
                INSERT INTO demand_history(
                    material_id, warehouse_id, period, demand_units, promotion_flag, holiday_flag,
                    lead_time_days, on_hand_inventory, source
                )
                VALUES (%s, %s, %s::date, %s, %s, %s, %s, %s, %s)
                """,
                (
                    material_id,
                    warehouse_id,
                    period,
                    demand,
                    str(row.get("promotion_flag", "0")).strip() in {"1", "true", "TRUE"},
                    str(row.get("holiday_flag", "0")).strip() in {"1", "true", "TRUE"},
                    dec(row.get("lead_time_days")),
                    dec(row.get("on_hand_inventory")),
                    DEMAND_SOURCE,
                ),
            )
        stats.rows_upserted += 1
    audit_finish(cur, audit_id, stats, f"Demand history loaded; unmapped_codes={len(unmapped)}")
    return stats


def load_forecast_results(cur, material_index: dict[str, str], path: Path, warehouse_id: str, current_date: date) -> LoadStats:
    rows = list(read_csv(path))
    stats = LoadStats(str(path), sha256_file(path), rows_seen=len(rows))
    audit_id = audit_start(cur, DATASET_VERSION, path, stats.source_hash, warehouse_id, len(rows))
    unmapped: set[str] = set()
    source_periods = [
        datetime.strptime(row["month"], "%Y-%m-%d").date()
        for row in rows
        if row.get("month")
    ]
    anchor_start = first_day_next_month(current_date) if source_periods and max(source_periods) < current_date else None
    for row in rows:
        code = normalize_material_code(row.get("rm_code"))
        material_id = material_index.get(code)
        p50 = dec(row.get("gross_req_p50"))
        horizon = int_or_none(row.get("horizon")) or 1
        period = add_months(anchor_start, horizon - 1).isoformat() if anchor_start else row.get("month")
        if not material_id or p50 is None or not period:
            stats.rows_unmapped += 1
            if code:
                unmapped.add(code)
            continue
        stats.rows_mapped += 1
        cur.execute(
            """
            INSERT INTO forecast_results(
                material_id, warehouse_id, forecast_period, horizon, model_name,
                forecast_p10, forecast_p50, forecast_p90, method
            )
            VALUES (%s, %s, %s::date, %s, %s, %s, %s, %s, 'canonical_v6')
            ON CONFLICT (material_id, forecast_period, horizon, model_name)
            DO UPDATE SET
                warehouse_id = EXCLUDED.warehouse_id,
                forecast_p10 = EXCLUDED.forecast_p10,
                forecast_p50 = EXCLUDED.forecast_p50,
                forecast_p90 = EXCLUDED.forecast_p90,
                method = EXCLUDED.method
            """,
            (
                material_id,
                warehouse_id,
                period,
                horizon,
                FORECAST_MODEL,
                dec(row.get("gross_req_p10")),
                p50,
                dec(row.get("gross_req_p90")),
            ),
        )
        stats.rows_upserted += 1
    anchor_note = f"; anchored_start={anchor_start.isoformat()}" if anchor_start else ""
    audit_finish(cur, audit_id, stats, f"Forecast results loaded; unmapped_codes={len(unmapped)}{anchor_note}")
    return stats


def refresh_rollups(cur, warehouse_id: str) -> int:
    cur.execute(
        """
        WITH max_period AS (
            SELECT max(period) AS max_p
            FROM demand_history
            WHERE warehouse_id = %s AND source = %s
        ),
        hist AS (
            SELECT dh.material_id,
                   sum(dh.demand_units)::bigint AS issue_volume_12m,
                   count(*) FILTER (WHERE dh.demand_units > 0) AS issue_count_12m
            FROM demand_history dh, max_period mp
            WHERE dh.warehouse_id = %s
              AND dh.source = %s
              AND dh.period > mp.max_p - interval '12 months'
            GROUP BY dh.material_id
        ),
        ranked AS (
            SELECT h.*,
                   percent_rank() OVER (ORDER BY h.issue_volume_12m DESC) AS volume_rank
            FROM hist h
        )
        INSERT INTO material_issue_stats_rollup(
            material_id, warehouse_id, issue_volume_12m, issue_count_12m,
            abc_class, fms_class, amalgamated_class, last_refreshed_at
        )
        SELECT material_id,
               %s::uuid,
               issue_volume_12m,
               issue_count_12m,
               CASE WHEN volume_rank <= 0.20 THEN 'A'
                    WHEN volume_rank <= 0.50 THEN 'B'
                    ELSE 'C' END AS abc_class,
               CASE WHEN issue_count_12m >= 10 THEN 'F'
                    WHEN issue_count_12m >= 4 THEN 'M'
                    ELSE 'S' END AS fms_class,
               (CASE WHEN volume_rank <= 0.20 THEN 'A'
                     WHEN volume_rank <= 0.50 THEN 'B'
                     ELSE 'C' END ||
                CASE WHEN issue_count_12m >= 10 THEN 'F'
                     WHEN issue_count_12m >= 4 THEN 'M'
                     ELSE 'S' END) AS amalgamated_class,
               now()
        FROM ranked
        ON CONFLICT (material_id, warehouse_id)
        DO UPDATE SET
            issue_volume_12m = EXCLUDED.issue_volume_12m,
            issue_count_12m = EXCLUDED.issue_count_12m,
            abc_class = EXCLUDED.abc_class,
            fms_class = EXCLUDED.fms_class,
            amalgamated_class = EXCLUDED.amalgamated_class,
            last_refreshed_at = now()
        """,
        (warehouse_id, DEMAND_SOURCE, warehouse_id, DEMAND_SOURCE, warehouse_id),
    )
    return cur.rowcount


def load_baseline_forecasts_from_history(cur, warehouse_id: str, current_date: date) -> int:
    anchor_start = first_day_next_month(current_date)
    rows_inserted = 0
    for horizon in range(1, 7):
        period = add_months(anchor_start, horizon - 1)
        cur.execute(
            """
            WITH existing AS (
                SELECT DISTINCT material_id
                FROM forecast_results
                WHERE warehouse_id = %s
                  AND forecast_period >= CURRENT_DATE
                  AND model_name = %s
            ),
            max_period AS (
                SELECT max(period) AS max_p
                FROM demand_history
                WHERE warehouse_id = %s
                  AND source = %s
            ),
            hist AS (
                SELECT dh.material_id,
                       avg(dh.demand_units) AS avg_demand,
                       stddev_pop(dh.demand_units) AS demand_std
                FROM demand_history dh, max_period mp
                WHERE dh.warehouse_id = %s
                  AND dh.source = %s
                  AND dh.period > mp.max_p - interval '6 months'
                  AND NOT EXISTS (SELECT 1 FROM existing e WHERE e.material_id = dh.material_id)
                GROUP BY dh.material_id
            )
            INSERT INTO forecast_results(
                material_id, warehouse_id, forecast_period, horizon, model_name,
                forecast_p10, forecast_p50, forecast_p90, method
            )
            SELECT material_id,
                   %s::uuid,
                   %s::date,
                   %s,
                   %s,
                   greatest(avg_demand - COALESCE(demand_std, 0), 0),
                   avg_demand,
                   avg_demand + COALESCE(demand_std, avg_demand * 0.20),
                   'canonical_history_baseline'
            FROM hist
            WHERE avg_demand > 0
            ON CONFLICT (material_id, forecast_period, horizon, model_name)
            DO UPDATE SET
                forecast_p10 = EXCLUDED.forecast_p10,
                forecast_p50 = EXCLUDED.forecast_p50,
                forecast_p90 = EXCLUDED.forecast_p90,
                method = EXCLUDED.method
            """,
            (
                warehouse_id,
                FORECAST_MODEL,
                warehouse_id,
                DEMAND_SOURCE,
                warehouse_id,
                DEMAND_SOURCE,
                warehouse_id,
                period,
                horizon,
                BASELINE_MODEL,
            ),
        )
        rows_inserted += cur.rowcount
    return rows_inserted


def validation(cur, warehouse_id: str) -> dict[str, int]:
    cur.execute(
        """
        SELECT
          (SELECT count(*) FROM materials) AS materials,
          (SELECT count(*) FROM materials WHERE min_order_quantity IS NOT NULL AND min_order_quantity > 0) AS material_moq_ready,
          (SELECT count(*) FROM materials WHERE order_delivery_days IS NOT NULL AND order_delivery_days > 0) AS material_lead_ready,
          (SELECT count(*) FROM demand_history WHERE warehouse_id = %s AND source = %s) AS demand_rows,
          (SELECT count(DISTINCT material_id) FROM demand_history WHERE warehouse_id = %s AND source = %s) AS demand_materials,
          (SELECT count(*) FROM forecast_results WHERE warehouse_id = %s AND model_name IN (%s, %s)) AS forecast_rows,
          (SELECT count(DISTINCT material_id) FROM forecast_results WHERE warehouse_id = %s AND model_name IN (%s, %s)) AS forecast_materials,
          (SELECT count(*) FROM forecast_results WHERE warehouse_id = %s AND model_name IN (%s, %s) AND forecast_period >= CURRENT_DATE) AS future_forecast_rows,
          (SELECT count(DISTINCT material_id) FROM forecast_results WHERE warehouse_id = %s AND model_name IN (%s, %s) AND forecast_period >= CURRENT_DATE) AS future_forecast_materials,
          (SELECT count(*) FROM material_issue_stats_rollup WHERE warehouse_id = %s AND issue_volume_12m > 0) AS rollups_with_issue_volume
        """,
        (
            warehouse_id,
            DEMAND_SOURCE,
            warehouse_id,
            DEMAND_SOURCE,
            warehouse_id,
            FORECAST_MODEL,
            BASELINE_MODEL,
            warehouse_id,
            FORECAST_MODEL,
            BASELINE_MODEL,
            warehouse_id,
            FORECAST_MODEL,
            BASELINE_MODEL,
            warehouse_id,
            FORECAST_MODEL,
            BASELINE_MODEL,
            warehouse_id,
        ),
    )
    row = cur.fetchone()
    keys = [
        "materials",
        "material_moq_ready",
        "material_lead_ready",
        "demand_rows",
        "demand_materials",
        "forecast_rows",
        "forecast_materials",
        "future_forecast_rows",
        "future_forecast_materials",
        "rollups_with_issue_volume",
    ]
    return dict(zip(keys, row))


def run(db_url: str, warehouse_id: str | None, dry_run: bool) -> dict[str, object]:
    root = repo_root()
    files = {
        "rm_master": root / "Ai miroservices/modeling/outputs/generated/fg_rm_foundation_rm_master.csv",
        "rm_policy": root / "Ai miroservices/modeling/outputs/generated/rm_inventory_policy.csv",
        "demand": root / "Ai miroservices/modeling/outputs/generated/rule_based_wms_monthly.csv",
        "forecast": root / "Ai miroservices/modeling/outputs/generated/rm_gross_requirements.csv",
    }
    missing = [str(p) for p in files.values() if not p.exists()]
    if missing:
        raise RuntimeError(f"Missing canonical source files: {missing}")

    conn = psycopg2.connect(db_url)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            resolved_warehouse = resolve_warehouse(cur, warehouse_id)
            cur.execute("SELECT CURRENT_DATE")
            current_date = cur.fetchone()[0]
            material_index = load_material_index(cur)
            stats = [
                load_rm_master(cur, material_index, files["rm_master"], resolved_warehouse),
                load_rm_policy(cur, material_index, files["rm_policy"], resolved_warehouse),
            ]
            inventory_backfill_rows = backfill_materials_from_inventory(cur)
            stats.append(load_demand_history(cur, material_index, files["demand"], resolved_warehouse))
            stats.append(load_forecast_results(cur, material_index, files["forecast"], resolved_warehouse, current_date))
            baseline_forecast_rows = load_baseline_forecasts_from_history(cur, resolved_warehouse, current_date)
            rollup_rows = refresh_rollups(cur, resolved_warehouse)
            result = {
                "status": "dry_run" if dry_run else "ok",
                "dataset_version": DATASET_VERSION,
                "warehouse_id": resolved_warehouse,
                "inventory_backfill_rows": inventory_backfill_rows,
                "baseline_forecast_rows": baseline_forecast_rows,
                "rollup_rows": rollup_rows,
                "loads": [s.__dict__ for s in stats],
                "validation": validation(cur, resolved_warehouse),
            }
        if dry_run:
            conn.rollback()
        else:
            conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Load canonical HEMAS_SYNTHETIC_WMS_V6 data into OptiWMS operational tables.")
    parser.add_argument("--db-url", default="postgresql://optiwms:optiwms@localhost:5434/optiwms")
    parser.add_argument("--warehouse-id", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    result = run(args.db_url, args.warehouse_id, args.dry_run)
    print(json.dumps(result, indent=2, sort_keys=True, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
