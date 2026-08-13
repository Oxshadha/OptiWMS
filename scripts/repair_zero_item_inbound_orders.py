#!/usr/bin/env python3
"""Dry-run/apply cleanup for zero-item inbound demo order shells.

Default mode is non-destructive. Use --apply only after reviewing the printed
counts. The script intentionally preserves outbound orders and outbound items.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import textwrap


DEFAULT_DATABASE_URL = "postgresql://optiwms:optiwms@localhost:5434/optiwms"


TARGET_CTE = """
WITH target_orders AS (
    SELECT o.id
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE lower(o.order_type) = 'inbound'
    GROUP BY o.id
    HAVING count(oi.id) = 0
)
"""


DRY_RUN_SQL = TARGET_CTE + """
SELECT 'target_zero_item_inbound_orders' AS check_name, count(*)::text AS value FROM target_orders
UNION ALL
SELECT 'dependent_order_number_aliases', count(*)::text
FROM order_number_aliases WHERE order_id IN (SELECT id FROM target_orders)
UNION ALL
SELECT 'dependent_tasks', count(*)::text
FROM tasks WHERE reference_type = 'order' AND reference_id IN (SELECT id FROM target_orders)
UNION ALL
SELECT 'dependent_operation_events', count(*)::text
FROM operation_events WHERE order_id IN (SELECT id FROM target_orders)
UNION ALL
SELECT 'dependent_returns', count(*)::text
FROM returns WHERE original_order_id IN (SELECT id FROM target_orders)
UNION ALL
SELECT 'dependent_dock_appointments', count(*)::text
FROM dock_appointments WHERE inbound_order_id IN (SELECT id FROM target_orders)
UNION ALL
SELECT 'dependent_yard_trailers', count(*)::text
FROM yard_trailers WHERE inbound_order_id IN (SELECT id FROM target_orders)
UNION ALL
SELECT 'dependent_shipments', count(*)::text
FROM shipments WHERE order_id IN (SELECT id FROM target_orders)
UNION ALL
SELECT 'dependent_packing_records', count(*)::text
FROM packing_records WHERE order_id IN (SELECT id FROM target_orders)
UNION ALL
SELECT 'outbound_orders_preserved', count(*)::text
FROM orders WHERE lower(order_type) = 'outbound'
UNION ALL
SELECT 'zero_item_orders_after_cleanup_expected', count(*)::text
FROM (
    SELECT o.id
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE lower(o.order_type) <> 'inbound'
    GROUP BY o.id
    HAVING count(oi.id) = 0
) zero_item_non_inbound
LIMIT 50;
"""


APPLY_SQL = TARGET_CTE + """
, delete_aliases AS (
    DELETE FROM order_number_aliases WHERE order_id IN (SELECT id FROM target_orders) RETURNING id
), delete_tasks AS (
    DELETE FROM tasks WHERE reference_type = 'order' AND reference_id IN (SELECT id FROM target_orders) RETURNING id
), delete_events AS (
    DELETE FROM operation_events WHERE order_id IN (SELECT id FROM target_orders) RETURNING id
), delete_returns AS (
    DELETE FROM returns WHERE original_order_id IN (SELECT id FROM target_orders) RETURNING id
), clear_dock_doors AS (
    UPDATE dock_doors
    SET current_appointment_id = NULL
    WHERE current_appointment_id IN (
        SELECT id FROM dock_appointments WHERE inbound_order_id IN (SELECT id FROM target_orders)
    )
    RETURNING id
), delete_dock_appointments AS (
    DELETE FROM dock_appointments WHERE inbound_order_id IN (SELECT id FROM target_orders) RETURNING id
), clear_yard_trailers AS (
    UPDATE yard_trailers
    SET inbound_order_id = NULL
    WHERE inbound_order_id IN (SELECT id FROM target_orders)
    RETURNING id
), delete_shipments AS (
    DELETE FROM shipments WHERE order_id IN (SELECT id FROM target_orders) RETURNING id
), delete_packing_records AS (
    DELETE FROM packing_records WHERE order_id IN (SELECT id FROM target_orders) RETURNING id
), delete_order_items AS (
    DELETE FROM order_items WHERE order_id IN (SELECT id FROM target_orders) RETURNING id
), delete_orders AS (
    DELETE FROM orders WHERE id IN (SELECT id FROM target_orders) RETURNING id
)
SELECT 'deleted_orders' AS action, count(*)::text AS value FROM delete_orders
UNION ALL SELECT 'deleted_aliases', count(*)::text FROM delete_aliases
UNION ALL SELECT 'deleted_tasks', count(*)::text FROM delete_tasks
UNION ALL SELECT 'deleted_operation_events', count(*)::text FROM delete_events
UNION ALL SELECT 'deleted_returns', count(*)::text FROM delete_returns
UNION ALL SELECT 'deleted_dock_appointments', count(*)::text FROM delete_dock_appointments
UNION ALL SELECT 'cleared_yard_trailers', count(*)::text FROM clear_yard_trailers
UNION ALL SELECT 'deleted_shipments', count(*)::text FROM delete_shipments
UNION ALL SELECT 'deleted_packing_records', count(*)::text FROM delete_packing_records
UNION ALL SELECT 'deleted_order_items', count(*)::text FROM delete_order_items;
"""


POST_CLEANUP_SQL = """
WITH order_item_counts AS (
    SELECT o.id, o.order_number, o.order_type, o.supplier_id, o.warehouse_id, count(oi.id) AS item_count
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id
),
missing_refs AS (
    SELECT o.id
    FROM orders o
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    LEFT JOIN warehouses w ON w.id = o.warehouse_id
    WHERE (lower(o.order_type) = 'inbound' AND o.supplier_id IS NULL)
       OR (o.supplier_id IS NOT NULL AND s.id IS NULL)
       OR o.warehouse_id IS NULL
       OR w.id IS NULL
),
empty_supplier_rules AS (
    SELECT sm.id
    FROM supplier_materials sm
    WHERE sm.minimum_order_quantity IS NULL
       OR sm.order_multiple IS NULL
       OR sm.units_per_handling_unit IS NULL
       OR sm.lead_time_days IS NULL
),
orphan_order_refs AS (
    SELECT 'tasks' AS table_name, count(*) AS rows
    FROM tasks t LEFT JOIN orders o ON o.id = t.reference_id
    WHERE t.reference_type = 'order' AND o.id IS NULL
    UNION ALL
    SELECT 'operation_events', count(*)
    FROM operation_events e LEFT JOIN orders o ON o.id = e.order_id
    WHERE e.order_id IS NOT NULL AND o.id IS NULL
    UNION ALL
    SELECT 'returns', count(*)
    FROM returns r LEFT JOIN orders o ON o.id = r.original_order_id
    WHERE r.original_order_id IS NOT NULL AND o.id IS NULL
)
SELECT 'zero_item_orders_remaining' AS check_name, count(*)::text AS value
FROM order_item_counts WHERE item_count = 0
UNION ALL
SELECT 'missing_supplier_or_warehouse', count(*)::text FROM missing_refs
UNION ALL
SELECT 'supplier_material_links_with_empty_rules', count(*)::text FROM empty_supplier_rules
UNION ALL
SELECT 'orders_outside_current_month', count(*)::text
FROM orders
WHERE order_date IS NOT NULL
  AND date_trunc('month', order_date::timestamp) <> date_trunc('month', current_date::timestamp)
UNION ALL
SELECT 'orphan_order_references', coalesce(sum(rows), 0)::text FROM orphan_order_refs;
"""


def run_sql(database_url: str, sql: str) -> int:
    command = ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-c", sql]
    completed = subprocess.run(command, text=True)
    return completed.returncode


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Clean zero-item inbound demo order shells and report data quality.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """\
            Examples:
              python3 scripts/repair_zero_item_inbound_orders.py --dry-run
              python3 scripts/repair_zero_item_inbound_orders.py --apply
            """
        ),
    )
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL))
    parser.add_argument("--dry-run", action="store_true", help="Print counts only. This is the default.")
    parser.add_argument("--apply", action="store_true", help="Delete zero-item inbound shells and dependencies.")
    args = parser.parse_args()

    if args.apply and args.dry_run:
        parser.error("Use either --dry-run or --apply, not both.")

    if not args.apply:
        print("Dry-run: no rows will be deleted.")
        code = run_sql(args.database_url, DRY_RUN_SQL)
        if code != 0:
            return code
        print("\nPost-cleanup report query against current DB state:")
        return run_sql(args.database_url, POST_CLEANUP_SQL)

    print("Apply mode: deleting zero-item inbound order shells and listed dependencies.")
    code = run_sql(args.database_url, "BEGIN;" + APPLY_SQL + "COMMIT;")
    if code != 0:
        return code
    print("\nPost-cleanup data quality report:")
    return run_sql(args.database_url, POST_CLEANUP_SQL)


if __name__ == "__main__":
    sys.exit(main())
