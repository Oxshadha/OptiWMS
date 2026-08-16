"""
Guarded tool menu for the DATA mode of the warehouse AI agent.

The LLM never sees the database schema and never writes SQL for these
questions. It only sees the tool names/descriptions/parameters below and
picks one (see `select_tool` in agent.py). The SQL for each tool is fixed,
hand-written, and reviewed here — the LLM's only influence is which tool
runs and what parameter values it passes in.

Only genuinely novel questions that don't match any tool fall back to the
older free-form SQL generation path (`run_adhoc_query` in agent.py), which
stays SELECT-only and allowlist-checked as before.
"""
from __future__ import annotations

import os

import httpx
import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

FORECAST_SERVICE_BASE = os.getenv("FORECAST_SERVICE_BASE", "http://localhost:8091").rstrip("/")


def get_stock_level(engine: Engine, search: str, limit: int = 15) -> tuple[pd.DataFrame, str]:
    """Current stock levels for materials matching a SKU code, material code, or name."""
    sql = """
        SELECT
            m.sku_id,
            m.material_code,
            m.description,
            w.name AS warehouse,
            SUM(i.quantity) AS on_hand_qty,
            SUM(i.available_quantity) AS available_qty,
            SUM(i.reserved_quantity) AS reserved_qty,
            MAX(i.reorder_point) AS reorder_point,
            MAX(i.min_stock) AS min_stock,
            MAX(i.max_stock) AS max_stock
        FROM materials m
        JOIN inventory i ON i.material_id = m.id
        LEFT JOIN warehouses w ON w.id = i.warehouse_id
        WHERE m.sku_id ILIKE :pattern
           OR m.material_code ILIKE :pattern
           OR m.description ILIKE :pattern
        GROUP BY m.sku_id, m.material_code, m.description, w.name
        ORDER BY on_hand_qty DESC
        LIMIT :limit
    """
    df = pd.read_sql(text(sql), engine, params={"pattern": f"%{search}%", "limit": limit})
    return df, sql


def get_reorder_alerts(engine: Engine, limit: int = 20) -> tuple[pd.DataFrame, str]:
    """Materials whose available stock has fallen below their reorder point."""
    sql = """
        SELECT
            m.sku_id,
            m.material_code,
            m.description,
            SUM(i.available_quantity) AS available_qty,
            MAX(i.reorder_point) AS reorder_point,
            MAX(i.reorder_point) - SUM(i.available_quantity) AS shortfall
        FROM inventory i
        JOIN materials m ON m.id = i.material_id
        WHERE i.reorder_point IS NOT NULL
        GROUP BY m.sku_id, m.material_code, m.description
        HAVING SUM(i.available_quantity) < MAX(i.reorder_point)
        ORDER BY shortfall DESC
        LIMIT :limit
    """
    df = pd.read_sql(text(sql), engine, params={"limit": limit})
    return df, sql


def get_top_movers(engine: Engine, days: int = 90, limit: int = 10) -> tuple[pd.DataFrame, str]:
    """Materials with the highest stock movement volume in the most recent
    `days` of data available (relative to the latest movement on record, not
    the current clock — this is a periodically-refreshed dataset, not a live
    feed, so "now" can be well past the last loaded event)."""
    sql = """
        WITH latest AS (SELECT MAX(created_at) AS ts FROM stock_movements)
        SELECT
            m.sku_id,
            m.material_code,
            m.description,
            COUNT(*) AS movement_count,
            SUM(sm.quantity) AS total_qty_moved
        FROM stock_movements sm
        JOIN materials m ON m.id = sm.material_id
        CROSS JOIN latest
        WHERE sm.created_at >= latest.ts - (:days || ' days')::interval
        GROUP BY m.sku_id, m.material_code, m.description
        ORDER BY total_qty_moved DESC
        LIMIT :limit
    """
    df = pd.read_sql(text(sql), engine, params={"days": days, "limit": limit})
    return df, sql


def get_labour_productivity(engine: Engine, days: int = 90) -> tuple[pd.DataFrame, str]:
    """Labour productivity by operation type: events completed, distinct
    workers, and average duration, over the most recent `days` of data."""
    sql = """
        WITH latest AS (SELECT MAX(completed_at) AS ts FROM operation_events)
        SELECT
            LOWER(oe.operation_type) AS operation_type,
            COUNT(*) AS events_completed,
            COUNT(DISTINCT oe.worker_id) AS workers_involved,
            ROUND(AVG(oe.duration_minutes)::numeric, 1) AS avg_duration_minutes,
            SUM(oe.quantity) AS total_quantity
        FROM operation_events oe
        CROSS JOIN latest
        WHERE oe.completed_at >= latest.ts - (:days || ' days')::interval
          AND oe.status = 'completed'
        GROUP BY LOWER(oe.operation_type)
        ORDER BY events_completed DESC
    """
    df = pd.read_sql(text(sql), engine, params={"days": days})
    return df, sql


def get_orders_trend(engine: Engine, direction: str = "inbound", days: int = 90) -> tuple[pd.DataFrame, str]:
    """Daily count of inbound or outbound orders over the most recent `days`
    of data available."""
    direction = direction.lower() if direction and direction.lower() in ("inbound", "outbound") else "inbound"
    sql = """
        WITH latest AS (SELECT MAX(order_date) AS d FROM orders WHERE order_type = :direction)
        SELECT
            o.order_date,
            o.status,
            COUNT(*) AS order_count
        FROM orders o
        CROSS JOIN latest
        WHERE o.order_type = :direction
          AND o.order_date >= latest.d - (:days || ' days')::interval
        GROUP BY o.order_date, o.status
        ORDER BY o.order_date
    """
    df = pd.read_sql(text(sql), engine, params={"direction": direction, "days": days})
    return df, sql


def get_forecast(engine: Engine, search: str, limit: int = 12) -> tuple[pd.DataFrame, str]:
    """Recent demand forecast (P10/P50/P90 and actual demand) for a material,
    matched by SKU, material code, or name — fuzzy (ILIKE), not exact, so a
    slightly wrong code like "RM-001" still finds "RM-0001"."""
    sql = """
        SELECT
            m.material_code,
            m.description,
            fr.forecast_period,
            fr.model_name,
            fr.forecast_p10,
            fr.forecast_p50,
            fr.forecast_p90,
            fr.actual_demand,
            fr.decision_eligible
        FROM forecast_results fr
        JOIN materials m ON m.id = fr.material_id
        WHERE m.material_code ILIKE :pattern OR m.description ILIKE :pattern
        ORDER BY fr.forecast_period DESC
        LIMIT :limit
    """
    df = pd.read_sql(text(sql), engine, params={"pattern": f"%{search}%", "limit": limit})
    return df, sql


def get_forecast_explanation(engine: Engine, search: str, horizon: int = 3) -> tuple[pd.DataFrame, str]:
    """Why the forecast model predicted what it did for a material — SHAP
    feature attributions from the forecast-service (the same model-internals
    data the Forecast dashboard's explain widget uses), fetched live rather
    than guessed by the LLM. Falls back to a plain explanatory row (not an
    error) when no mapping or SHAP data exists yet for this material."""
    mapping_sql = """
        SELECT fsm.forecast_sku, fsm.dataset
        FROM forecast_sku_mapping fsm
        JOIN materials m ON m.id = fsm.wms_material_id
        WHERE fsm.is_active = true
          AND (m.material_code ILIKE :pattern OR m.description ILIKE :pattern)
        LIMIT 1
    """
    mapping = pd.read_sql(text(mapping_sql), engine, params={"pattern": f"%{search}%"})
    call_desc = f"-- forecast-service SHAP explanation for '{search}', horizon={horizon} months ahead --"

    if mapping.empty:
        return (
            pd.DataFrame([{"note": f"No active forecast mapping found for '{search}', so no SHAP explanation is available."}]),
            call_desc,
        )

    forecast_sku, dataset = mapping.iloc[0]["forecast_sku"], mapping.iloc[0]["dataset"]
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(
                f"{FORECAST_SERVICE_BASE}/api/v1/shap/explanation",
                params={"sku": forecast_sku, "horizon": horizon, "dataset": dataset},
            )
        if resp.status_code == 404:
            return (
                pd.DataFrame([{"note": f"No SHAP explanation computed yet for {forecast_sku} at a {horizon}-month horizon."}]),
                call_desc,
            )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        return (
            pd.DataFrame([{"note": f"Could not reach the forecast explanation service: {exc}"}]),
            call_desc,
        )

    features = payload.get("top_features") or []
    if not features:
        return pd.DataFrame([{"note": "SHAP data returned but had no feature attributions."}]), call_desc

    df = pd.DataFrame(features)  # feature, label, shap_value, feature_value
    call_desc = (
        f"-- forecast-service SHAP explanation for sku={forecast_sku}, {horizon} months ahead: "
        f"prediction={payload.get('prediction')}, base_value={payload.get('base_value')}, "
        f"model={payload.get('model_name')} --"
    )
    return df, call_desc


def get_policy_recommendation(engine: Engine, search: str, limit: int = 10) -> tuple[pd.DataFrame, str]:
    """The latest MILP-generated min/max/reorder-point policy recommendation
    for a material, including the engine's own written rationale for the
    change — the same numbers shown in the Inventory Intelligence policy
    modal."""
    sql = """
        SELECT DISTINCT ON (l.material_id)
            l.material_code,
            l.current_min_stock, l.proposed_min_stock,
            l.current_max_stock, l.proposed_max_stock,
            l.current_reorder_point, l.proposed_reorder_point,
            l.stock_delta, l.pallet_positions_delta,
            l.stockout_risk_score, l.expiry_risk_score, l.confidence_score,
            l.recommendation_status, l.rationale, l.created_at
        FROM inventory_policy_recommendation_lines l
        JOIN materials m ON m.id = l.material_id
        WHERE m.material_code ILIKE :pattern OR m.description ILIKE :pattern
        ORDER BY l.material_id, l.created_at DESC
        LIMIT :limit
    """
    df = pd.read_sql(text(sql), engine, params={"pattern": f"%{search}%", "limit": limit})
    return df, sql


def get_slotting_recommendation(engine: Engine, search: str, limit: int = 10) -> tuple[pd.DataFrame, str]:
    """The latest MILP slotting/relocation recommendation for a material —
    current vs. recommended bin location, the engine's move reason, and the
    estimated travel-distance savings."""
    sql = """
        SELECT DISTINCT ON (sl.material_id)
            sl.material_code,
            sl.current_primary_location_code,
            sl.recommended_primary_location_code,
            sl.distance_saved_meters,
            sl.zone_upgrade,
            sl.move_reason,
            sl.gain_score,
            sl.status,
            sl.created_at
        FROM slotting_plan_lines sl
        JOIN materials m ON m.id = sl.material_id
        WHERE m.material_code ILIKE :pattern OR m.description ILIKE :pattern
        ORDER BY sl.material_id, sl.created_at DESC
        LIMIT :limit
    """
    df = pd.read_sql(text(sql), engine, params={"pattern": f"%{search}%", "limit": limit})
    return df, sql


# ── Tool registry ──────────────────────────────────────────────────────────
# Only name, description, and params are ever shown to the LLM.
TOOL_REGISTRY = {
    "stock_level": {
        "description": "Look up current stock/inventory levels for a specific SKU, material code, or product name.",
        "params": {"search": "string, required — SKU code, material code, or product name keyword", "limit": "integer, optional, default 15"},
        "fn": get_stock_level,
    },
    "reorder_alerts": {
        "description": "List materials whose available stock has fallen below their reorder point.",
        "params": {"limit": "integer, optional, default 20"},
        "fn": get_reorder_alerts,
    },
    "top_movers": {
        "description": "Show the materials with the highest stock movement volume (picks, receipts, transfers) over a recent period.",
        "params": {"days": "integer, optional, default 90", "limit": "integer, optional, default 10"},
        "fn": get_top_movers,
    },
    "labour_productivity": {
        "description": "Summarize warehouse labour productivity — events completed, workers involved, and average duration — per operation type (picking, packing, putaway, receiving, cycle count) over a recent period.",
        "params": {"days": "integer, optional, default 90"},
        "fn": get_labour_productivity,
    },
    "orders_trend": {
        "description": "Show the daily trend of inbound or outbound orders over a recent period.",
        "params": {"direction": "'inbound' or 'outbound', optional, default 'inbound'", "days": "integer, optional, default 90"},
        "fn": get_orders_trend,
    },
    "forecast": {
        "description": "Look up the demand forecast (P10/P50/P90 and actual demand by period) for a specific SKU, material code, or product name.",
        "params": {"search": "string, required — SKU code, material code, or product name keyword", "limit": "integer, optional, default 12"},
        "fn": get_forecast,
    },
    "forecast_explanation": {
        "description": "Explain WHY the forecast model predicted what it did for a material — SHAP feature attributions (which factors pushed the forecast up or down). Use this for 'why is the forecast high/low' or 'what are the SHAP values' questions, not for the forecast numbers themselves.",
        "params": {"search": "string, required — SKU code, material code, or product name keyword", "horizon": "integer, optional, default 3 — months ahead"},
        "fn": get_forecast_explanation,
    },
    "policy_recommendation": {
        "description": "Show the latest MILP-generated inventory policy recommendation (proposed min/max stock, reorder point) for a material, with the engine's rationale for the change.",
        "params": {"search": "string, required — SKU code, material code, or product name keyword", "limit": "integer, optional, default 10"},
        "fn": get_policy_recommendation,
    },
    "slotting_recommendation": {
        "description": "Show the latest MILP slotting/relocation recommendation for a material — current vs. recommended bin location and why.",
        "params": {"search": "string, required — SKU code, material code, or product name keyword", "limit": "integer, optional, default 10"},
        "fn": get_slotting_recommendation,
    },
}


def tool_menu_description() -> str:
    """Render the tool registry as text for the tool-selection prompt. This
    — not the database schema — is all the LLM ever sees of what data
    exists."""
    lines = []
    for name, spec in TOOL_REGISTRY.items():
        params = ", ".join(f"{k} ({v})" for k, v in spec["params"].items()) or "none"
        lines.append(f"- {name}: {spec['description']}\n  Parameters: {params}")
    return "\n".join(lines)
