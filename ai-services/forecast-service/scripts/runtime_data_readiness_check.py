#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict, dataclass
from typing import Any

from sqlalchemy import bindparam, create_engine, text


@dataclass
class ReadinessChecks:
    history_rows: int
    inventory_skus: int
    inventory_nonzero_on_hand_skus: int
    inventory_distinct_warehouses: int
    orders_count: int
    order_items_count: int
    product_materials_count: int
    inventory_rows_count: int


def _normalize_warehouse_id(warehouse_id: str | None) -> str | None:
    if warehouse_id is None:
        return None
    raw = str(warehouse_id).strip()
    if not raw:
        return None
    if raw.lower() in {"all", "all warehouses", "all_warehouses", "*"}:
        return None
    return raw


def _outbound_statuses(raw: str | None) -> list[str]:
    val = raw or "shipped,delivered,completed"
    out = [s.strip().lower() for s in val.split(",") if s.strip()]
    return out or ["shipped", "delivered", "completed"]


def evaluate(
    db_url: str,
    schema: str,
    warehouse_id: str | None,
    outbound_statuses: list[str],
) -> dict[str, Any]:
    wh = _normalize_warehouse_id(warehouse_id)
    engine = create_engine(db_url, future=True, pool_pre_ping=True)

    with engine.connect() as conn:
        contract_stmt = (
            text(
                """
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = :schema
                  AND table_name IN :table_names
                """
            )
            .bindparams(bindparam("table_names", expanding=True))
        )
        required: dict[str, set[str]] = {
            "orders": {"id", "order_date", "order_type", "status", "warehouse_id"},
            "order_items": {"order_id", "material_id", "quantity"},
            "materials": {"id", "material_code", "description", "material_type"},
            "inventory": {"material_id", "warehouse_id", "quantity", "reorder_point", "max_stock", "buffer_stock"},
        }
        rows = conn.execute(
            contract_stmt,
            {"schema": schema, "table_names": list(required.keys())},
        ).fetchall()
        found_cols: dict[str, set[str]] = {}
        for tbl, col in rows:
            found_cols.setdefault(str(tbl).lower(), set()).add(str(col).lower())

        missing_tables: list[str] = []
        missing_columns: dict[str, list[str]] = {}
        for tbl, cols in required.items():
            present = found_cols.get(tbl, set())
            if not present:
                missing_tables.append(tbl)
                continue
            miss = sorted(c for c in cols if c.lower() not in present)
            if miss:
                missing_columns[tbl] = miss

        base_counts_stmt = text(
            """
            SELECT
                (SELECT COUNT(*)::bigint FROM orders) AS orders_count,
                (SELECT COUNT(*)::bigint FROM order_items) AS order_items_count,
                (SELECT COUNT(*)::bigint FROM materials WHERE LOWER(COALESCE(material_type,'')) = 'product') AS product_materials_count,
                (SELECT COUNT(*)::bigint FROM inventory) AS inventory_rows_count
            """
        )
        base = conn.execute(base_counts_stmt).mappings().first() or {}

        sales_stmt = (
            text(
                """
                SELECT COUNT(*)::bigint
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                JOIN materials m ON m.id = oi.material_id
                WHERE LOWER(COALESCE(o.order_type, '')) = 'outbound'
                  AND LOWER(COALESCE(o.status, '')) IN :statuses
                  AND LOWER(COALESCE(m.material_type, '')) = 'product'
                  AND (:warehouse_id IS NULL OR o.warehouse_id::text = :warehouse_id)
                """
            )
            .bindparams(bindparam("statuses", expanding=True))
        )
        history_rows = int(conn.execute(sales_stmt, {"statuses": outbound_statuses, "warehouse_id": wh}).scalar_one() or 0)

        inv_stmt = text(
            """
            SELECT
                COUNT(DISTINCT m.material_code)::bigint AS inventory_skus,
                COUNT(DISTINCT CASE WHEN COALESCE(i.quantity, 0) > 0 THEN m.material_code END)::bigint AS inventory_nonzero_on_hand_skus,
                COUNT(DISTINCT i.warehouse_id)::bigint AS inventory_distinct_warehouses
            FROM inventory i
            JOIN materials m ON m.id = i.material_id
            WHERE LOWER(COALESCE(m.material_type, '')) = 'product'
              AND (:warehouse_id IS NULL OR i.warehouse_id::text = :warehouse_id)
            """
        )
        inv = conn.execute(inv_stmt, {"warehouse_id": wh}).mappings().first() or {}

        checks = ReadinessChecks(
            history_rows=history_rows,
            inventory_skus=int(inv.get("inventory_skus") or 0),
            inventory_nonzero_on_hand_skus=int(inv.get("inventory_nonzero_on_hand_skus") or 0),
            inventory_distinct_warehouses=int(inv.get("inventory_distinct_warehouses") or 0),
            orders_count=int(base.get("orders_count") or 0),
            order_items_count=int(base.get("order_items_count") or 0),
            product_materials_count=int(base.get("product_materials_count") or 0),
            inventory_rows_count=int(base.get("inventory_rows_count") or 0),
        )

        statuses_stmt = text(
            """
            SELECT LOWER(COALESCE(o.status, '')) AS status, COUNT(*)::bigint AS cnt
            FROM orders o
            GROUP BY 1
            ORDER BY cnt DESC, status ASC
            LIMIT 20
            """
        )
        order_status_profile = [
            {"status": str(r.status), "count": int(r.cnt)}
            for r in conn.execute(statuses_stmt).mappings().all()
        ]

        material_type_stmt = text(
            """
            SELECT LOWER(COALESCE(m.material_type, '')) AS material_type, COUNT(*)::bigint AS cnt
            FROM materials m
            GROUP BY 1
            ORDER BY cnt DESC, material_type ASC
            LIMIT 20
            """
        )
        material_type_profile = [
            {"material_type": str(r.material_type), "count": int(r.cnt)}
            for r in conn.execute(material_type_stmt).mappings().all()
        ]

    healthy = (
        checks.history_rows > 0
        and checks.inventory_skus > 0
        and checks.inventory_nonzero_on_hand_skus > 0
        and not missing_tables
        and not missing_columns
    )

    reason = "live_runtime_data_verified"
    if missing_tables or missing_columns:
        reason = "schema_contract_mismatch"
    elif checks.order_items_count == 0:
        reason = "no_order_items_rows"
    elif checks.product_materials_count == 0:
        reason = "no_product_materials"
    elif checks.inventory_skus == 0:
        reason = "no_product_inventory_rows"
    elif checks.inventory_nonzero_on_hand_skus == 0:
        reason = "no_nonzero_on_hand_product_inventory"
    elif checks.history_rows == 0:
        reason = "no_outbound_product_history_rows"

    return {
        "status": "ok" if healthy else "error",
        "reason": reason,
        "schema": schema,
        "warehouse_id": wh,
        "outbound_statuses": outbound_statuses,
        "missing_tables": missing_tables,
        "missing_columns": missing_columns,
        "checks": asdict(checks),
        "profiles": {
            "order_statuses": order_status_profile,
            "material_types": material_type_profile,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Enterprise runtime data-readiness audit for forecast serving.")
    parser.add_argument(
        "--db-url",
        default=os.getenv("WMS_RUNTIME_DATABASE_URL", "").strip(),
        help="PostgreSQL URL. Defaults to WMS_RUNTIME_DATABASE_URL.",
    )
    parser.add_argument("--schema", default=os.getenv("WMS_RUNTIME_SCHEMA", "public"))
    parser.add_argument("--warehouse-id", default=None)
    parser.add_argument(
        "--outbound-statuses",
        default=os.getenv("WMS_RUNTIME_OUTBOUND_STATUSES", "shipped,delivered,completed"),
        help="Comma-separated statuses used to count historical outbound demand.",
    )
    parser.add_argument("--output-json", default=None, help="Optional file path to save audit JSON.")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit non-zero when status is not ok.",
    )
    args = parser.parse_args()

    if not args.db_url:
        print("ERROR: missing --db-url and WMS_RUNTIME_DATABASE_URL", file=sys.stderr)
        return 2

    result = evaluate(
        db_url=args.db_url,
        schema=args.schema,
        warehouse_id=args.warehouse_id,
        outbound_statuses=_outbound_statuses(args.outbound_statuses),
    )

    blob = json.dumps(result, indent=2, sort_keys=True)
    print(blob)
    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as f:
            f.write(blob)
            f.write("\n")

    if args.strict and result.get("status") != "ok":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
