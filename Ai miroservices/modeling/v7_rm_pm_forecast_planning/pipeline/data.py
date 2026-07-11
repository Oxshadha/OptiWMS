from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from pipeline.io import V7Config


def engine_for(cfg: V7Config):
    return create_engine(cfg.database_url, future=True, pool_pre_ping=True)


def _material_type_filter(cfg: V7Config) -> tuple[str, dict]:
    keys = [f"mt{i}" for i, _ in enumerate(cfg.material_types)]
    clause = ", ".join(f":{k}" for k in keys)
    return clause, {k: v for k, v in zip(keys, cfg.material_types)}


def read_material_inventory(cfg: V7Config) -> pd.DataFrame:
    clause, params = _material_type_filter(cfg)
    sql = text(
        f"""
        SELECT
            m.id::text AS material_id,
            m.material_code,
            COALESCE(NULLIF(m.description, ''), m.material_code) AS description,
            LOWER(COALESCE(m.material_type, 'unknown')) AS material_type,
            COALESCE(m.storage_type, 'unknown') AS storage_type,
            COALESCE(m.requires_pallet, false) AS requires_pallet,
            COALESCE(m.pallet_spaces, m.units_per_handling_unit, 1)::double precision AS units_per_pallet,
            COALESCE(m.weight_kg, 0)::double precision AS weight_kg,
            COALESCE(m.volume_cm3, 0)::double precision AS volume_cm3,
            SUM(COALESCE(i.quantity, 0))::double precision AS on_hand_qty,
            SUM(COALESCE(i.available_quantity, i.quantity, 0))::double precision AS available_qty,
            AVG(COALESCE(i.min_stock, 0))::double precision AS current_min_stock,
            AVG(COALESCE(i.max_stock, 0))::double precision AS current_max_stock,
            AVG(COALESCE(i.reorder_point, 0))::double precision AS current_reorder_point,
            AVG(COALESCE(i.buffer_stock, 0))::double precision AS current_buffer_stock,
            AVG(COALESCE(i.order_quantity, 0))::double precision AS current_order_qty,
            AVG(COALESCE(i.lead_time_days, 0))::double precision AS inventory_lead_time_days,
            COUNT(i.id)::int AS inventory_rows
        FROM {cfg.schema}.materials m
        LEFT JOIN {cfg.schema}.inventory i ON i.material_id = m.id
        WHERE LOWER(COALESCE(m.material_type, 'unknown')) IN ({clause})
        GROUP BY
            m.id, m.material_code, m.description, m.material_type, m.storage_type,
            m.requires_pallet, m.pallet_spaces, m.units_per_handling_unit, m.weight_kg, m.volume_cm3
        ORDER BY m.material_code
        """
    )
    with engine_for(cfg).connect() as conn:
        return pd.read_sql(sql, conn, params=params)


def read_material_type_counts(cfg: V7Config) -> pd.DataFrame:
    sql = text(
        f"""
        SELECT LOWER(COALESCE(material_type, 'unknown')) AS material_type, COUNT(*)::int AS materials
        FROM {cfg.schema}.materials
        GROUP BY LOWER(COALESCE(material_type, 'unknown'))
        ORDER BY material_type
        """
    )
    with engine_for(cfg).connect() as conn:
        return pd.read_sql(sql, conn)


def read_demand_history(cfg: V7Config) -> pd.DataFrame:
    clause, params = _material_type_filter(cfg)
    sql = text(
        f"""
        SELECT
            dh.material_id::text AS material_id,
            m.material_code,
            COALESCE(NULLIF(m.description, ''), m.material_code) AS description,
            LOWER(COALESCE(m.material_type, 'unknown')) AS material_type,
            dh.warehouse_id::text AS warehouse_id,
            w.code AS warehouse_code,
            DATE_TRUNC('month', dh.period)::date AS month,
            SUM(COALESCE(dh.demand_units, 0))::double precision AS demand_units,
            BOOL_OR(COALESCE(dh.promotion_flag, false)) AS promotion_flag,
            BOOL_OR(COALESCE(dh.holiday_flag, false)) AS holiday_flag,
            MAX(COALESCE(dh.source, 'unknown')) AS source
        FROM {cfg.schema}.demand_history dh
        JOIN {cfg.schema}.materials m ON m.id = dh.material_id
        LEFT JOIN {cfg.schema}.warehouses w ON w.id = dh.warehouse_id
        WHERE LOWER(COALESCE(m.material_type, 'unknown')) IN ({clause})
          AND (:warehouse_code IS NULL OR w.code = :warehouse_code OR dh.warehouse_id IS NULL)
        GROUP BY dh.material_id, m.material_code, m.description, m.material_type, dh.warehouse_id, w.code, DATE_TRUNC('month', dh.period)::date
        ORDER BY m.material_code, month
        """
    )
    params = {**params, "warehouse_code": cfg.warehouse_code}
    with engine_for(cfg).connect() as conn:
        return pd.read_sql(sql, conn, params=params)


def read_forecast_results(cfg: V7Config) -> pd.DataFrame:
    clause, params = _material_type_filter(cfg)
    sql = text(
        f"""
        SELECT
            fr.id::text AS forecast_id,
            fr.material_id::text AS material_id,
            m.material_code,
            LOWER(COALESCE(m.material_type, 'unknown')) AS material_type,
            fr.warehouse_id::text AS warehouse_id,
            w.code AS warehouse_code,
            fr.forecast_period,
            fr.horizon,
            fr.model_name,
            fr.forecast_p10::double precision AS p10,
            fr.forecast_p50::double precision AS p50,
            fr.forecast_p90::double precision AS p90,
            fr.actual_demand::double precision AS actual_demand,
            fr.wape::double precision AS wape,
            fr.method,
            fr.created_at
        FROM {cfg.schema}.forecast_results fr
        JOIN {cfg.schema}.materials m ON m.id = fr.material_id
        LEFT JOIN {cfg.schema}.warehouses w ON w.id = fr.warehouse_id
        WHERE LOWER(COALESCE(m.material_type, 'unknown')) IN ({clause})
        ORDER BY fr.model_name, m.material_code, fr.forecast_period, fr.horizon
        """
    )
    with engine_for(cfg).connect() as conn:
        return pd.read_sql(sql, conn, params=params)


def read_bom_audit(cfg: V7Config) -> pd.DataFrame:
    sql = text(
        f"""
        SELECT
            h.id::text AS bom_header_id,
            h.version,
            h.status,
            h.warehouse_id::text AS warehouse_id,
            pm.material_code AS parent_material_code,
            LOWER(COALESCE(pm.material_type, 'unknown')) AS parent_material_type,
            cm.material_code AS component_material_code,
            LOWER(COALESCE(cm.material_type, 'unknown')) AS component_material_type,
            c.component_type,
            c.qty_per_parent::double precision AS qty_per_parent,
            c.scrap_rate::double precision AS scrap_rate,
            c.lead_time_days
        FROM {cfg.schema}.bom_headers h
        JOIN {cfg.schema}.materials pm ON pm.id = h.parent_material_id
        LEFT JOIN {cfg.schema}.bom_components c ON c.bom_header_id = h.id
        LEFT JOIN {cfg.schema}.materials cm ON cm.id = c.component_material_id
        ORDER BY pm.material_code, cm.material_code
        """
    )
    with engine_for(cfg).connect() as conn:
        return pd.read_sql(sql, conn)


def complete_monthly_panel(demand: pd.DataFrame) -> pd.DataFrame:
    if demand.empty:
        return demand.copy()
    out: list[pd.DataFrame] = []
    demand = demand.copy()
    demand["month"] = pd.to_datetime(demand["month"]).dt.to_period("M").dt.to_timestamp()
    min_month = demand["month"].min()
    max_month = demand["month"].max()
    month_index = pd.period_range(min_month, max_month, freq="M").to_timestamp()
    meta_cols = ["material_id", "material_code", "description", "material_type", "warehouse_id", "warehouse_code", "source"]
    for material_id, group in demand.groupby("material_id"):
        g = group.sort_values("month")
        meta = g.iloc[-1][meta_cols].to_dict()
        reindexed = g.set_index("month").reindex(month_index)
        for k, v in meta.items():
            reindexed[k] = v
        reindexed["month"] = month_index
        reindexed["demand_units"] = reindexed["demand_units"].fillna(0.0)
        reindexed["promotion_flag"] = reindexed["promotion_flag"].fillna(False)
        reindexed["holiday_flag"] = reindexed["holiday_flag"].fillna(False)
        out.append(reindexed.reset_index(drop=True))
    return pd.concat(out, ignore_index=True)


def build_lineage_summary(
    cfg: V7Config,
    material_inventory: pd.DataFrame,
    material_type_counts: pd.DataFrame,
    demand_panel: pd.DataFrame,
    forecasts: pd.DataFrame,
    bom: pd.DataFrame,
) -> dict:
    demand_sources = (
        demand_panel.groupby("source").size().sort_values(ascending=False).to_dict()
        if "source" in demand_panel.columns and not demand_panel.empty
        else {}
    )
    forecast_coverage = {}
    if not forecasts.empty:
        forecast_coverage = (
            forecasts.groupby(["model_name", "material_type"])
            .agg(rows=("forecast_id", "count"), materials=("material_id", "nunique"), min_period=("forecast_period", "min"), max_period=("forecast_period", "max"))
            .reset_index()
            .to_dict(orient="records")
        )

    active_bom = bom[bom["status"].astype(str).str.lower().eq("active")] if not bom.empty else bom
    component_rows = active_bom[active_bom["component_material_code"].notna()] if not active_bom.empty else active_bom
    product_rows = material_type_counts[material_type_counts["material_type"].eq("product")]
    product_count = int(product_rows["materials"].iloc[0]) if not product_rows.empty else 0

    return {
        "config": {**asdict(cfg), "output_dir": str(cfg.output_dir)},
        "all_material_type_counts": dict(zip(material_type_counts["material_type"], material_type_counts["materials"])) if not material_type_counts.empty else {},
        "material_counts": material_inventory.groupby("material_type").size().to_dict() if not material_inventory.empty else {},
        "inventory_rows": int(material_inventory["inventory_rows"].sum()) if "inventory_rows" in material_inventory else 0,
        "demand_rows": int(len(demand_panel)),
        "demand_materials": int(demand_panel["material_id"].nunique()) if not demand_panel.empty else 0,
        "demand_min_month": str(demand_panel["month"].min().date()) if not demand_panel.empty else None,
        "demand_max_month": str(demand_panel["month"].max().date()) if not demand_panel.empty else None,
        "demand_sources": demand_sources,
        "forecast_rows": int(len(forecasts)),
        "forecast_materials": int(forecasts["material_id"].nunique()) if not forecasts.empty else 0,
        "forecast_coverage": forecast_coverage,
        "bom_headers": int(bom["bom_header_id"].nunique()) if not bom.empty else 0,
        "bom_component_rows": int(len(component_rows)) if not component_rows.empty else 0,
        "bom_parent_materials": int(active_bom["parent_material_code"].nunique()) if not active_bom.empty else 0,
        "bom_product_parent_materials": int(active_bom[active_bom["parent_material_type"].eq("product")]["parent_material_code"].nunique()) if not active_bom.empty else 0,
        "bom_product_parent_coverage_pct": 0.0 if product_count == 0 else round(100.0 * int(active_bom[active_bom["parent_material_type"].eq("product")]["parent_material_code"].nunique()) / product_count, 2),
        "lineage_position": "Direct RM/PM forecasting is primary. BOM explosion is blocked until BOM parent/product coverage is validated.",
    }


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
