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


@dataclass
class RawMaterialSnapshotRow:
    rm_sku: str
    rm_category: str | None
    on_hand_inventory: float
    reorder_point: float
    safety_stock: float


@dataclass
class BomMappingSnapshotRow:
    fg_sku: str
    rm_sku: str
    component_type: str | None
    qty_per_fg_unit: float
    scrap_rate: float
    lead_time_days: int | None
    source: str
    notes: str | None


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


def get_wms_engine():
    return _engine()


def _normalize_warehouse_id(warehouse_id: str | None) -> str | None:
    if warehouse_id is None:
        return None
    raw = str(warehouse_id).strip()
    if not raw:
        return None
    if raw.lower() in {"all", "all warehouses", "all_warehouses", "*"}:
        return None
    return raw


@lru_cache(maxsize=32)
def _table_exists(table_name: str, schema: str | None = None) -> bool:
    if not _should_try_wms_db():
        return False
    schema_name = (schema or settings.wms_runtime_schema or "public").strip()
    sql = text(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = :schema
          AND table_name = :table_name
        LIMIT 1
        """
    )
    with get_wms_engine().connect() as conn:
        row = conn.execute(sql, {"schema": schema_name, "table_name": table_name}).first()
    return row is not None


def fetch_online_history_series_from_wms_db(dataset: str, warehouse_id: str | None, max_series: int = 500) -> list[dict[str, Any]]:
    statuses = _outbound_statuses()
    wh = _normalize_warehouse_id(warehouse_id)
    has_backfill = _table_exists("forecast_outbound_history_backfill")
    sql = (
        text(
            f"""
            WITH sales_from_orders AS (
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
            ),
            sales_from_backfill AS (
                SELECT
                    b.sku::text AS fg_code,
                    COALESCE(NULLIF(b.category, ''), 'UNKNOWN') AS fg_category,
                    DATE_TRUNC('month', b.demand_date)::date AS month,
                    SUM(COALESCE(b.demand_units, 0))::double precision AS demand_units
                FROM {(settings.wms_runtime_schema or "public")}.forecast_outbound_history_backfill b
                WHERE {('TRUE' if has_backfill else 'FALSE')}
                  AND (:warehouse_id IS NULL OR b.warehouse_id::text = :warehouse_id)
                GROUP BY b.sku, b.category, DATE_TRUNC('month', b.demand_date)::date
            ),
            monthly_sales AS (
                SELECT fg_code, fg_category, month, SUM(demand_units)::double precision AS demand_units
                FROM (
                    SELECT * FROM sales_from_orders
                    UNION ALL
                    SELECT * FROM sales_from_backfill
                ) s
                GROUP BY fg_code, fg_category, month
            )
            SELECT fg_code, fg_category, month, demand_units
            FROM monthly_sales
            ORDER BY fg_code, month
            """
        ).bindparams(bindparam("statuses", expanding=True))
    )
    with get_wms_engine().connect() as conn:
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
    with get_wms_engine().connect() as conn:
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


def fetch_raw_material_snapshot_from_wms_db(warehouse_id: str | None) -> list[RawMaterialSnapshotRow]:
    wh = _normalize_warehouse_id(warehouse_id)
    sql = text(
        """
        SELECT
            m.material_code AS rm_sku,
            COALESCE(NULLIF(m.description, ''), 'UNKNOWN') AS rm_category,
            SUM(COALESCE(i.quantity, 0))::double precision AS on_hand_inventory,
            AVG(COALESCE(i.reorder_point, 0))::double precision AS reorder_point,
            AVG(COALESCE(i.buffer_stock, 0))::double precision AS safety_stock
        FROM inventory i
        JOIN materials m ON m.id = i.material_id
        WHERE LOWER(COALESCE(m.material_type, '')) IN ('raw_material', 'packaging_material', 'packaging')
          AND (:warehouse_id IS NULL OR i.warehouse_id::text = :warehouse_id)
        GROUP BY m.material_code, m.description
        ORDER BY m.material_code
        """
    )
    with get_wms_engine().connect() as conn:
        frame = pd.read_sql(sql, conn, params={"warehouse_id": wh})
    out: list[RawMaterialSnapshotRow] = []
    for r in frame.itertuples(index=False):
        out.append(
            RawMaterialSnapshotRow(
                rm_sku=str(r.rm_sku),
                rm_category=str(r.rm_category) if r.rm_category is not None else None,
                on_hand_inventory=float(r.on_hand_inventory or 0.0),
                reorder_point=float(r.reorder_point or 0.0),
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


def resolve_raw_material_snapshot(
    warehouse_id: str | None,
) -> tuple[list[RawMaterialSnapshotRow], str]:
    if _should_try_wms_db():
        rows = fetch_raw_material_snapshot_from_wms_db(warehouse_id=warehouse_id)
        if rows:
            return rows, "wms_db"
        if _mode() == "wms_db":
            return [], "wms_db"
    return [], "none"


def fetch_bom_mappings_from_wms_db(warehouse_id: str | None) -> list[BomMappingSnapshotRow]:
    if not _table_exists("bom_headers") or not _table_exists("bom_components") or not _table_exists("materials"):
        return []

    wh = _normalize_warehouse_id(warehouse_id)
    sql = text(
        """
        WITH candidate_headers AS (
            SELECT
                h.id,
                h.parent_material_id,
                h.warehouse_id,
                h.version,
                h.effective_from,
                h.updated_at,
                CASE
                    WHEN :warehouse_id IS NOT NULL AND h.warehouse_id::text = :warehouse_id THEN 0
                    WHEN h.warehouse_id IS NULL THEN 1
                    ELSE 2
                END AS scope_rank
            FROM bom_headers h
            WHERE LOWER(COALESCE(h.status, '')) = 'active'
              AND (h.effective_from IS NULL OR h.effective_from <= CURRENT_DATE)
              AND (h.effective_to IS NULL OR h.effective_to >= CURRENT_DATE)
              AND (:warehouse_id IS NULL OR h.warehouse_id::text = :warehouse_id OR h.warehouse_id IS NULL)
        ),
        selected_headers AS (
            SELECT id, parent_material_id, version
            FROM (
                SELECT
                    c.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY c.parent_material_id
                        ORDER BY c.scope_rank ASC, c.effective_from DESC NULLS LAST, c.updated_at DESC NULLS LAST
                    ) AS rn
                FROM candidate_headers c
                WHERE c.scope_rank < 2
            ) ranked
            WHERE rn = 1
        )
        SELECT
            pm.material_code AS fg_sku,
            cm.material_code AS rm_sku,
            LOWER(COALESCE(NULLIF(c.component_type, ''), COALESCE(cm.material_type, 'raw_material'))) AS component_type,
            COALESCE(c.qty_per_parent, 0)::double precision AS qty_per_fg_unit,
            COALESCE(c.scrap_rate, 0)::double precision AS scrap_rate,
            c.lead_time_days AS lead_time_days,
            sh.version AS version
        FROM selected_headers sh
        JOIN bom_components c ON c.bom_header_id = sh.id
        JOIN materials pm ON pm.id = sh.parent_material_id
        JOIN materials cm ON cm.id = c.component_material_id
        WHERE COALESCE(c.qty_per_parent, 0) > 0
          AND LOWER(COALESCE(NULLIF(c.component_type, ''), COALESCE(cm.material_type, 'raw_material'))) IN (
              'raw_material', 'packaging_material', 'packaging'
          )
        ORDER BY pm.material_code, cm.material_code
        """
    )
    with get_wms_engine().connect() as conn:
        frame = pd.read_sql(sql, conn, params={"warehouse_id": wh})

    out: list[BomMappingSnapshotRow] = []
    for r in frame.itertuples(index=False):
        lead_days = None
        if getattr(r, "lead_time_days", None) is not None and pd.notna(r.lead_time_days):
            lead_days = int(r.lead_time_days)
        out.append(
            BomMappingSnapshotRow(
                fg_sku=str(r.fg_sku),
                rm_sku=str(r.rm_sku),
                component_type=str(r.component_type) if r.component_type is not None else None,
                qty_per_fg_unit=float(r.qty_per_fg_unit or 0.0),
                scrap_rate=float(r.scrap_rate or 0.0),
                lead_time_days=lead_days,
                source="wms_bom_master",
                notes=f"version={r.version}" if getattr(r, "version", None) else None,
            )
        )
    return out


def resolve_bom_mappings(
    warehouse_id: str | None,
) -> tuple[list[BomMappingSnapshotRow], str]:
    if _should_try_wms_db():
        rows = fetch_bom_mappings_from_wms_db(warehouse_id=warehouse_id)
        if rows:
            return rows, "wms_db"
        if _mode() == "wms_db":
            return [], "wms_db"
    return [], "none"
