from __future__ import annotations

import time
from typing import Any

from sqlalchemy import bindparam, text

from app.core.config import settings
from app.services.runtime_data_source import get_wms_engine

_CACHE: dict[str, Any] = {"ts": 0.0, "result": None}

_REQUIRED_TABLE_COLUMNS: dict[str, set[str]] = {
    "orders": {"id", "order_date", "order_type", "status", "warehouse_id"},
    "order_items": {"order_id", "material_id", "quantity"},
    "materials": {"id", "material_code", "description", "material_type"},
    "inventory": {"material_id", "warehouse_id", "quantity", "reorder_point", "max_stock", "buffer_stock"},
}


def _mode() -> str:
    return (settings.runtime_data_source_mode or "csv").strip().lower()


def _normalize_warehouse_id(warehouse_id: str | None) -> str | None:
    if warehouse_id is None:
        return None
    raw = str(warehouse_id).strip()
    if not raw:
        return None
    if raw.lower() in {"all", "all warehouses", "all_warehouses", "*"}:
        return None
    return raw


def _outbound_statuses() -> list[str]:
    raw = settings.wms_runtime_outbound_statuses or "shipped,delivered,completed"
    vals = [s.strip().lower() for s in raw.split(",") if s.strip()]
    return vals or ["shipped", "delivered", "completed"]


def _empty_ok_result(reason: str) -> dict[str, Any]:
    return {
        "status": "ok",
        "mode": _mode(),
        "reason": reason,
        "schema": settings.wms_runtime_schema,
        "missing_tables": [],
        "missing_columns": {},
    }


def validate_runtime_contract(force: bool = False) -> dict[str, Any]:
    now = time.time()
    ttl = max(0.0, float(settings.runtime_contract_check_cache_seconds or 60.0))
    cached = _CACHE.get("result")
    if not force and cached is not None and (now - float(_CACHE.get("ts") or 0.0)) <= ttl:
        return cached

    mode = _mode()
    if mode == "csv":
        result = _empty_ok_result("csv_mode")
        _CACHE.update({"ts": now, "result": result})
        return result

    if not settings.wms_runtime_database_url:
        status = "error" if mode == "wms_db" else "warn"
        result = {
            "status": status,
            "mode": mode,
            "reason": "missing_wms_runtime_database_url",
            "schema": settings.wms_runtime_schema,
            "missing_tables": sorted(_REQUIRED_TABLE_COLUMNS.keys()),
            "missing_columns": {},
        }
        _CACHE.update({"ts": now, "result": result})
        return result

    missing_tables: list[str] = []
    missing_columns: dict[str, list[str]] = {}

    try:
        with get_wms_engine().connect() as conn:
            tbl_stmt = (
                text(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = :schema
                      AND table_name IN :table_names
                    """
                )
                .bindparams(bindparam("table_names", expanding=True))
            )
            table_names = list(_REQUIRED_TABLE_COLUMNS.keys())
            rows = conn.execute(tbl_stmt, {"schema": settings.wms_runtime_schema, "table_names": table_names}).fetchall()
            available_tables = {str(r[0]).lower() for r in rows}

            for table_name in table_names:
                if table_name.lower() not in available_tables:
                    missing_tables.append(table_name)

            if not missing_tables:
                col_stmt = (
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
                col_rows = conn.execute(
                    col_stmt,
                    {"schema": settings.wms_runtime_schema, "table_names": table_names},
                ).fetchall()
                by_table: dict[str, set[str]] = {}
                for t, c in col_rows:
                    by_table.setdefault(str(t).lower(), set()).add(str(c).lower())

                for table_name, required_cols in _REQUIRED_TABLE_COLUMNS.items():
                    present = by_table.get(table_name.lower(), set())
                    miss = sorted(c for c in required_cols if c.lower() not in present)
                    if miss:
                        missing_columns[table_name] = miss

        if missing_tables or missing_columns:
            status = "error" if mode == "wms_db" else "warn"
            result = {
                "status": status,
                "mode": mode,
                "reason": "schema_contract_mismatch",
                "schema": settings.wms_runtime_schema,
                "missing_tables": missing_tables,
                "missing_columns": missing_columns,
            }
        else:
            result = {
                "status": "ok",
                "mode": mode,
                "reason": "validated",
                "schema": settings.wms_runtime_schema,
                "missing_tables": [],
                "missing_columns": {},
            }
    except Exception as ex:
        status = "error" if mode == "wms_db" else "warn"
        result = {
            "status": status,
            "mode": mode,
            "reason": f"validation_error:{ex}",
            "schema": settings.wms_runtime_schema,
            "missing_tables": sorted(_REQUIRED_TABLE_COLUMNS.keys()),
            "missing_columns": {},
        }

    _CACHE.update({"ts": now, "result": result})
    return result


def assert_runtime_contract_on_startup() -> dict[str, Any]:
    result = validate_runtime_contract(force=True)
    if _mode() == "wms_db" and result.get("status") != "ok":
        raise RuntimeError(f"WMS runtime contract check failed: {result}")
    return result


def validate_runtime_data_readiness(warehouse_id: str | None = None) -> dict[str, Any]:
    mode = _mode()
    wh = _normalize_warehouse_id(warehouse_id)
    statuses = _outbound_statuses()

    if mode == "csv":
        return {
            "status": "warn",
            "mode": mode,
            "reason": "csv_mode_not_live_wms",
            "warehouse_id": wh,
            "checks": {
                "history_rows": 0,
                "inventory_skus": 0,
                "inventory_nonzero_on_hand_skus": 0,
                "inventory_distinct_warehouses": 0,
            },
        }

    if not settings.wms_runtime_database_url:
        status = "error" if mode == "wms_db" else "warn"
        return {
            "status": status,
            "mode": mode,
            "reason": "missing_wms_runtime_database_url",
            "warehouse_id": wh,
            "checks": {
                "history_rows": 0,
                "inventory_skus": 0,
                "inventory_nonzero_on_hand_skus": 0,
                "inventory_distinct_warehouses": 0,
            },
        }

    try:
        with get_wms_engine().connect() as conn:
            base_counts_stmt = text(
                """
                SELECT
                    (SELECT COUNT(*)::bigint FROM orders) AS orders_count,
                    (SELECT COUNT(*)::bigint FROM order_items) AS order_items_count,
                    (SELECT COUNT(*)::bigint FROM materials WHERE LOWER(COALESCE(material_type,'')) = 'product') AS product_materials_count,
                    (SELECT COUNT(*)::bigint FROM inventory) AS inventory_rows_count
                """
            )
            base_counts = conn.execute(base_counts_stmt).mappings().first() or {}

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
            history_rows = int(
                conn.execute(sales_stmt, {"statuses": statuses, "warehouse_id": wh}).scalar_one() or 0
            )

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
            inv_row = conn.execute(inv_stmt, {"warehouse_id": wh}).mappings().first()
            inventory_skus = int((inv_row or {}).get("inventory_skus") or 0)
            inventory_nonzero_on_hand_skus = int((inv_row or {}).get("inventory_nonzero_on_hand_skus") or 0)
            inventory_distinct_warehouses = int((inv_row or {}).get("inventory_distinct_warehouses") or 0)

        checks = {
            "history_rows": history_rows,
            "inventory_skus": inventory_skus,
            "inventory_nonzero_on_hand_skus": inventory_nonzero_on_hand_skus,
            "inventory_distinct_warehouses": inventory_distinct_warehouses,
            "orders_count": int(base_counts.get("orders_count") or 0),
            "order_items_count": int(base_counts.get("order_items_count") or 0),
            "product_materials_count": int(base_counts.get("product_materials_count") or 0),
            "inventory_rows_count": int(base_counts.get("inventory_rows_count") or 0),
        }

        healthy = history_rows > 0 and inventory_skus > 0 and inventory_nonzero_on_hand_skus > 0
        if healthy:
            status = "ok"
            reason = "live_runtime_data_verified"
        else:
            status = "error" if mode == "wms_db" else "warn"
            if checks["order_items_count"] == 0:
                reason = "no_order_items_rows"
            elif checks["product_materials_count"] == 0:
                reason = "no_product_materials"
            elif inventory_skus == 0:
                reason = "no_product_inventory_rows"
            elif inventory_nonzero_on_hand_skus == 0:
                reason = "no_nonzero_on_hand_product_inventory"
            elif history_rows == 0:
                reason = "no_outbound_product_history_rows"
            else:
                reason = "live_runtime_data_incomplete"

        return {
            "status": status,
            "mode": mode,
            "reason": reason,
            "warehouse_id": wh,
            "checks": checks,
        }
    except Exception as ex:
        status = "error" if mode == "wms_db" else "warn"
        return {
            "status": status,
            "mode": mode,
            "reason": f"runtime_data_check_error:{ex}",
            "warehouse_id": wh,
            "checks": {
                "history_rows": 0,
                "inventory_skus": 0,
                "inventory_nonzero_on_hand_skus": 0,
                "inventory_distinct_warehouses": 0,
                "orders_count": 0,
                "order_items_count": 0,
                "product_materials_count": 0,
                "inventory_rows_count": 0,
            },
        }
