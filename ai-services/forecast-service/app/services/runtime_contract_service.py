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
