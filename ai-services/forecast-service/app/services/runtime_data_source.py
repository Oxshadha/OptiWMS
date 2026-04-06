from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import pandas as pd
from sqlalchemy import bindparam, create_engine, text

from app.core.config import settings


@dataclass
class InventorySnapshotRow:
    sku: str
    category: str | None
    on_hand_inventory: float
    reorder_point: float
    target_max: float
    safety_stock: float


def _mode() -> str:
    return (settings.runtime_data_source_mode or "csv").strip().lower()


def _should_try_wms_db() -> bool:
    mode = _mode()
    return mode in {"wms_db", "auto"} and bool(settings.wms_runtime_database_url)


def _outbound_statuses() -> list[str]:
    raw = settings.wms_runtime_outbound_statuses or "shipped,delivered,completed"
    vals = [s.strip().lower() for s in raw.split(",") if s.strip()]
    return vals or ["shipped", "delivered", "completed"]


@lru_cache(maxsize=1)
def _engine():
    if not settings.wms_runtime_database_url:
        raise ValueError("WMS_RUNTIME_DATABASE_URL is not configured.")
    return create_engine(settings.wms_runtime_database_url, future=True, pool_pre_ping=True)


def _normalize_warehouse_id(warehouse_id: str | None) -> str | None:
    if warehouse_id is None:
        return None
    raw = str(warehouse_id).strip()
    if not raw:
        return None
    if raw.lower() in {"all", "all warehouses", "all_warehouses", "*"}:
        return None
    return raw


def fetch_online_history_series_from_wms_db(dataset: str, warehouse_id: str | None, max_series: int = 500) -> list[dict[str, Any]]:
    statuses = _outbound_statuses()
    wh = _normalize_warehouse_id(warehouse_id)
    sql = (
        text(
        """
        WITH monthly_sales AS (
            SELECT
                m.material_code AS fg_code,
                COALESCE(NULLIF(m.description, ''), 'UNKNOWN') AS fg_category,
                DATE_TRUNC('month', o.order_date)::date AS month,
                SUM(COALESCE(oi.quantity, 0))::double precision AS demand_units
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN materials m ON m.id = oi.material_id
            WHERE LOWER(COALESCE(o.order_type, '')) = 'outbound'
              AND LOWER(COALESCE(o.status, '')) IN :statuses
              AND LOWER(COALESCE(m.material_type, '')) = 'product'
              AND (:warehouse_id IS NULL OR o.warehouse_id::text = :warehouse_id)
            GROUP BY m.material_code, m.description, DATE_TRUNC('month', o.order_date)::date
        )
        SELECT fg_code, fg_category, month, demand_units
        FROM monthly_sales
        ORDER BY fg_code, month
        """
    )
        .bindparams(bindparam("statuses", expanding=True))
    )
    with _engine().connect() as conn:
        frame = pd.read_sql(sql, conn, params={"warehouse_id": wh, "statuses": statuses})
    if frame.empty:
        return []

    series_payloads: list[dict[str, Any]] = []
    for fg_code, grp in frame.groupby("fg_code"):
        g = grp.sort_values("month")
        if len(g) < 2:
            continue
        history = [{"month": str(pd.Period(m, freq="M")), "demand_units": float(max(0.0, d))} for m, d in zip(g["month"], g["demand_units"])]
        series_payloads.append(
            {
                "series_id": str(fg_code),
                "fg_code": str(fg_code),
                "fg_category": str(g["fg_category"].iloc[-1]),
                "history": history,
                "static_features": {},
            }
        )
    series_payloads.sort(key=lambda r: r["series_id"])
    return series_payloads[:max_series]


def fetch_inventory_snapshot_from_wms_db(warehouse_id: str | None) -> list[InventorySnapshotRow]:
    wh = _normalize_warehouse_id(warehouse_id)
    sql = text(
        """
        SELECT
            m.material_code AS sku,
            COALESCE(NULLIF(m.description, ''), 'UNKNOWN') AS category,
            SUM(COALESCE(i.quantity, 0))::double precision AS on_hand_inventory,
            AVG(COALESCE(i.reorder_point, 0))::double precision AS reorder_point,
            AVG(COALESCE(i.max_stock, 0))::double precision AS target_max,
            AVG(COALESCE(i.buffer_stock, 0))::double precision AS safety_stock
        FROM inventory i
        JOIN materials m ON m.id = i.material_id
        WHERE LOWER(COALESCE(m.material_type, '')) = 'product'
          AND (:warehouse_id IS NULL OR i.warehouse_id::text = :warehouse_id)
        GROUP BY m.material_code, m.description
        ORDER BY m.material_code
        """
    )
    with _engine().connect() as conn:
        frame = pd.read_sql(sql, conn, params={"warehouse_id": wh})
    out: list[InventorySnapshotRow] = []
    for r in frame.itertuples(index=False):
        out.append(
            InventorySnapshotRow(
                sku=str(r.sku),
                category=str(r.category) if r.category is not None else None,
                on_hand_inventory=float(r.on_hand_inventory or 0.0),
                reorder_point=float(r.reorder_point or 0.0),
                target_max=float(r.target_max or 0.0),
                safety_stock=float(r.safety_stock or 0.0),
            )
        )
    return out


def resolve_online_history_series(
    dataset: str,
    warehouse_id: str | None,
    csv_fallback_loader,
    max_series: int = 500,
) -> tuple[list[dict[str, Any]], str]:
    if _should_try_wms_db():
        rows = fetch_online_history_series_from_wms_db(dataset=dataset, warehouse_id=warehouse_id, max_series=max_series)
        if rows:
            return rows, "wms_db"
        if _mode() == "wms_db":
            return [], "wms_db"
    return csv_fallback_loader(max_series=max_series), "csv"


def resolve_inventory_snapshot(
    warehouse_id: str | None,
) -> tuple[list[InventorySnapshotRow], str]:
    if _should_try_wms_db():
        rows = fetch_inventory_snapshot_from_wms_db(warehouse_id=warehouse_id)
        if rows:
            return rows, "wms_db"
        if _mode() == "wms_db":
            return [], "wms_db"
    return [], "none"
