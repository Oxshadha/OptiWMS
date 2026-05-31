#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

from load_outbound_history_backfill import run as load_run


ACTIVE_STOCK_SHEET = "Active stock"
COMPONENT_TYPES = {"raw_material", "packaging_material", "packaging"}
MONTH_COLUMNS = {
    "Supply Plan": "supply_plan_jul",
    "Unnamed: 4": "supply_plan_aug",
    "Unnamed: 5": "supply_plan_sep",
    "Unnamed: 6": "supply_plan_oct",
    "Unnamed: 7": "supply_plan_nov",
}
BASE_COLUMNS = {
    "Material Code": "material_code",
    "Description": "description",
    "future average": "future_average",
    "variance (demand)": "demand_variance",
}


@dataclass
class BomRow:
    fg_sku: str
    component_sku: str
    component_type: str
    qty_per_fg_unit: float
    scrap_rate: float
    lead_time_days: int


def _category_profile_from_name(name: str) -> dict[str, float]:
    n = (name or "").lower()
    if any(k in n for k in ("soap", "detergent", "powder", "wash")):
        return {"season_amp": 0.13, "promo_prob": 0.14, "promo_lift": 0.18}
    if any(k in n for k in ("shampoo", "hair", "care", "perfume", "fragrance")):
        return {"season_amp": 0.10, "promo_prob": 0.11, "promo_lift": 0.16}
    if any(k in n for k in ("sanitary", "napkin", "baby", "diaper")):
        return {"season_amp": 0.08, "promo_prob": 0.09, "promo_lift": 0.12}
    return {"season_amp": 0.07, "promo_prob": 0.08, "promo_lift": 0.10}


def _build_regime_factor(seed_key: str, idx: int, n_months: int) -> float:
    if n_months < 18:
        return 1.0
    cp1 = max(4, int((_stable_u01(f"{seed_key}|cp1") * 0.45 + 0.25) * n_months))
    cp2 = max(cp1 + 3, int((_stable_u01(f"{seed_key}|cp2") * 0.25 + 0.60) * n_months))
    cp2 = min(cp2, n_months - 1)
    reg1 = 1.0 + (_stable_u01(f"{seed_key}|reg1") - 0.5) * 0.24
    reg2 = 1.0 + (_stable_u01(f"{seed_key}|reg2") - 0.5) * 0.30
    if idx < cp1:
        return 1.0
    if idx < cp2:
        return float(np.clip(reg1, 0.80, 1.25))
    return float(np.clip(reg2, 0.72, 1.35))


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _month_range(end_month: date, months: int) -> list[date]:
    out: list[date] = []
    y, m = end_month.year, end_month.month
    for _ in range(months):
        out.append(date(y, m, 1))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    out.reverse()
    return out


def _stable_u01(key: str) -> float:
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _to_float(v: object, default: float = 0.0) -> float:
    if v is None:
        return float(default)
    try:
        if pd.isna(v):
            return float(default)
        return float(v)
    except Exception:
        return float(default)


def _clean_text(v: object) -> str:
    if v is None or pd.isna(v):
        return ""
    return " ".join(str(v).strip().split())


def _load_active_stock_anchor(excel_path: Path) -> pd.DataFrame:
    raw = pd.read_excel(excel_path, sheet_name=ACTIVE_STOCK_SHEET)
    data = raw.iloc[1:].copy()
    data = data.rename(columns={**BASE_COLUMNS, **MONTH_COLUMNS})
    keep = [
        "material_code",
        "description",
        "future_average",
        "demand_variance",
        "supply_plan_jul",
        "supply_plan_aug",
        "supply_plan_sep",
        "supply_plan_oct",
        "supply_plan_nov",
    ]
    keep = [c for c in keep if c in data.columns]
    out = data[keep].copy()
    out["material_code"] = pd.to_numeric(out["material_code"], errors="coerce")
    out = out[out["material_code"].notna()].copy()
    out["material_code"] = out["material_code"].astype(int).astype(str)
    out["description"] = out["description"].map(_clean_text)
    for c in out.columns:
        if c not in {"material_code", "description"}:
            out[c] = pd.to_numeric(out[c], errors="coerce")
    return out.drop_duplicates(subset=["material_code"]).reset_index(drop=True)


def _fetch_bom_rows(db_url: str, schema: str, warehouse_id: str | None) -> list[BomRow]:
    engine = create_engine(db_url, future=True, pool_pre_ping=True)
    sql = text(
        f"""
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
            FROM {schema}.bom_headers h
            WHERE LOWER(COALESCE(h.status, '')) = 'active'
              AND (h.effective_from IS NULL OR h.effective_from <= CURRENT_DATE)
              AND (h.effective_to IS NULL OR h.effective_to >= CURRENT_DATE)
              AND (:warehouse_id IS NULL OR h.warehouse_id::text = :warehouse_id OR h.warehouse_id IS NULL)
        ),
        selected_headers AS (
            SELECT id, parent_material_id
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
            cm.material_code AS component_sku,
            LOWER(COALESCE(NULLIF(c.component_type, ''), COALESCE(cm.material_type, 'raw_material'))) AS component_type,
            COALESCE(c.qty_per_parent, 0)::double precision AS qty_per_fg_unit,
            COALESCE(c.scrap_rate, 0)::double precision AS scrap_rate,
            COALESCE(c.lead_time_days, 0)::int AS lead_time_days
        FROM selected_headers sh
        JOIN {schema}.bom_components c ON c.bom_header_id = sh.id
        JOIN {schema}.materials pm ON pm.id = sh.parent_material_id
        JOIN {schema}.materials cm ON cm.id = c.component_material_id
        WHERE COALESCE(c.qty_per_parent, 0) > 0
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(sql, {"warehouse_id": warehouse_id}).mappings().all()
    frame = pd.DataFrame(rows)
    out: list[BomRow] = []
    for r in frame.itertuples(index=False):
        ctype = str(r.component_type or "").lower().strip()
        if ctype not in COMPONENT_TYPES:
            continue
        out.append(
            BomRow(
                fg_sku=str(r.fg_sku),
                component_sku=str(r.component_sku),
                component_type=ctype,
                qty_per_fg_unit=max(float(r.qty_per_fg_unit or 0.0), 0.0),
                scrap_rate=max(float(r.scrap_rate or 0.0), 0.0),
                lead_time_days=max(int(r.lead_time_days or 0), 0),
            )
        )
    return out


def _fetch_fg_inventory_seed(db_url: str, schema: str, warehouse_id: str | None) -> pd.DataFrame:
    engine = create_engine(db_url, future=True, pool_pre_ping=True)
    sql = text(
        f"""
        SELECT
            i.warehouse_id::text AS warehouse_id,
            m.material_code::text AS fg_sku,
            COALESCE(NULLIF(m.description, ''), m.material_code)::text AS fg_name,
            AVG(COALESCE(i.reorder_point, 0))::double precision AS reorder_point,
            SUM(COALESCE(i.quantity, 0))::double precision AS on_hand,
            AVG(COALESCE(i.max_stock, 0))::double precision AS target_max
        FROM {schema}.inventory i
        JOIN {schema}.materials m ON m.id = i.material_id
        WHERE LOWER(COALESCE(m.material_type, '')) = 'product'
          AND (:warehouse_id IS NULL OR i.warehouse_id::text = :warehouse_id)
        GROUP BY i.warehouse_id, m.material_code, m.description
        ORDER BY m.material_code
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(sql, {"warehouse_id": warehouse_id}).mappings().all()
    return pd.DataFrame(rows)


def _fetch_component_descriptions(db_url: str, schema: str) -> dict[str, str]:
    engine = create_engine(db_url, future=True, pool_pre_ping=True)
    sql = text(
        f"""
        SELECT material_code::text AS sku, COALESCE(NULLIF(description, ''), material_code)::text AS description
        FROM {schema}.materials
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(sql).mappings().all()
    frame = pd.DataFrame(rows)
    return {str(r.sku): str(r.description) for r in frame.itertuples(index=False)}


def _month_factor_from_anchor(anchor_row: pd.Series, month_num: int) -> float:
    vals = {
        7: _to_float(anchor_row.get("supply_plan_jul"), float("nan")),
        8: _to_float(anchor_row.get("supply_plan_aug"), float("nan")),
        9: _to_float(anchor_row.get("supply_plan_sep"), float("nan")),
        10: _to_float(anchor_row.get("supply_plan_oct"), float("nan")),
        11: _to_float(anchor_row.get("supply_plan_nov"), float("nan")),
    }
    obs = [v for v in vals.values() if not math.isnan(v) and v > 0]
    if not obs:
        return 1.0
    mean_obs = max(float(np.mean(obs)), 1e-6)
    if month_num in vals and not math.isnan(vals[month_num]) and vals[month_num] > 0:
        return float(np.clip(vals[month_num] / mean_obs, 0.55, 1.85))
    phase = 2.0 * math.pi * (month_num - 1) / 12.0
    return float(np.clip(1.0 + 0.06 * math.sin(phase), 0.85, 1.18))


def _generate_fg_monthly_demand(
    fg_frame: pd.DataFrame,
    months: list[date],
    seed: int,
) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    if fg_frame.empty:
        return pd.DataFrame(columns=["warehouse_id", "fg_sku", "month", "fg_demand_units"])
    for r in fg_frame.itertuples(index=False):
        wh = str(r.warehouse_id) if getattr(r, "warehouse_id") is not None else ""
        fg_sku = str(r.fg_sku)
        fg_name = str(getattr(r, "fg_name", "") or "")
        profile = _category_profile_from_name(fg_name)
        base = max(
            _to_float(getattr(r, "reorder_point", 0.0)) * 0.40,
            _to_float(getattr(r, "target_max", 0.0)) * 0.22,
            _to_float(getattr(r, "on_hand", 0.0)) * 0.16,
            8.0,
        )
        on_hand = _to_float(getattr(r, "on_hand", 0.0))
        reorder_point = _to_float(getattr(r, "reorder_point", 0.0))
        stock_stress = reorder_point > 0 and on_hand < 0.35 * reorder_point
        u = _stable_u01(f"{seed}|{fg_sku}|trend")
        trend_slope = (u - 0.5) * 0.14
        promo_prob = profile["promo_prob"] + 0.03 * _stable_u01(f"{seed}|{fg_sku}|promo")
        zero_prob = 0.03 + 0.06 * _stable_u01(f"{seed}|{fg_sku}|zero")
        sparse_series = _stable_u01(f"{seed}|{fg_sku}|sparse") < 0.22
        for idx, m in enumerate(months):
            progress = (idx / max(len(months) - 1, 1)) - 0.5
            trend = 1.0 + trend_slope * progress
            seasonal = 1.0 + profile["season_amp"] * math.sin((m.month - 1) * (2.0 * math.pi / 12.0))
            if m.month in {4, 12}:
                seasonal *= 1.05
            regime = _build_regime_factor(f"{seed}|{fg_sku}", idx, len(months))
            jitter = 1.0 + (((_stable_u01(f"{seed}|{fg_sku}|{m.isoformat()}") * 997) % 1.0) - 0.5) * 0.10
            promo = 1.0
            if _stable_u01(f"{seed}|{fg_sku}|promo|{m.isoformat()}") < promo_prob:
                promo += 0.05 + profile["promo_lift"] * _stable_u01(f"{seed}|{fg_sku}|promo_lift|{m.isoformat()}")
            stockout_adj = 1.0
            if stock_stress and idx < 4:
                stockout_adj = 0.58 + 0.18 * _stable_u01(f"{seed}|{fg_sku}|stock_suppress|{idx}")
            elif stock_stress and idx in {4, 5, 6}:
                stockout_adj = 1.08 + 0.10 * _stable_u01(f"{seed}|{fg_sku}|stock_rebound|{idx}")
            units = max(0.0, base * trend * seasonal * regime * jitter * promo * stockout_adj)
            if sparse_series and _stable_u01(f"{seed}|{fg_sku}|zero_hit|{m.isoformat()}") < zero_prob:
                units *= 0.10 * _stable_u01(f"{seed}|{fg_sku}|zero_scale|{m.isoformat()}")
            units = max(1.0, units)
            rows.append(
                {
                    "warehouse_id": wh,
                    "fg_sku": fg_sku,
                    "month": m.isoformat(),
                    "fg_demand_units": float(round(units, 3)),
                }
            )
    return pd.DataFrame(rows)


def _explode_to_components(
    fg_monthly: pd.DataFrame,
    bom_rows: list[BomRow],
    months: list[date],
) -> pd.DataFrame:
    if fg_monthly.empty or not bom_rows:
        return pd.DataFrame(columns=["warehouse_id", "sku", "month", "demand_units", "component_type"])

    month_index = {m.isoformat(): i for i, m in enumerate(months)}
    acc: dict[tuple[str, str, str, str], float] = {}
    by_fg: dict[str, list[BomRow]] = {}
    for b in bom_rows:
        by_fg.setdefault(b.fg_sku, []).append(b)

    for r in fg_monthly.itertuples(index=False):
        fg_sku = str(r.fg_sku)
        if fg_sku not in by_fg:
            continue
        wh = str(r.warehouse_id or "")
        m = str(r.month)
        fg_units = _to_float(getattr(r, "fg_demand_units"), 0.0)
        src_idx = month_index.get(m)
        if src_idx is None:
            continue
        for b in by_fg[fg_sku]:
            lead_months = int(math.ceil(max(b.lead_time_days, 0) / 30.0))
            if b.component_type == "packaging":
                lead_months += int(_stable_u01(f"{wh}|{b.component_sku}|{m}|lead_var") < 0.30)
            else:
                lead_months += int(_stable_u01(f"{wh}|{b.component_sku}|{m}|lead_var") < 0.15)
            target_idx = max(src_idx - lead_months, 0)
            target_month = months[target_idx].isoformat()
            scrap_dyn = b.scrap_rate
            if _stable_u01(f"{wh}|{b.component_sku}|{m}|scrap_spike") < 0.08:
                scrap_dyn += 0.01 + 0.04 * _stable_u01(f"{wh}|{b.component_sku}|{m}|scrap_lift")
            qty = fg_units * b.qty_per_fg_unit * (1.0 + scrap_dyn)
            key = (wh, b.component_sku, target_month, b.component_type)
            acc[key] = acc.get(key, 0.0) + float(qty)

    rows = [
        {
            "warehouse_id": k[0] if k[0] != "" else None,
            "sku": k[1],
            "month": k[2],
            "component_type": k[3],
            "demand_units": round(v, 3),
        }
        for k, v in acc.items()
    ]
    return pd.DataFrame(rows)


def _apply_anchor_constraints(component_monthly: pd.DataFrame, anchor: pd.DataFrame, seed: int) -> tuple[pd.DataFrame, dict]:
    if component_monthly.empty:
        return component_monthly, {"anchor_matches": 0, "anchor_unmatched": 0, "range_clamp_events": 0}
    if anchor.empty:
        component_monthly["demand_units"] = component_monthly["demand_units"].clip(lower=0.0).round(3)
        return component_monthly, {"anchor_matches": 0, "anchor_unmatched": int(component_monthly["sku"].nunique()), "range_clamp_events": 0}

    anchor_map = {str(r.material_code): r for r in anchor.itertuples(index=False)}
    clamp_events = 0
    matched_skus: set[str] = set()

    def _adjust(row: pd.Series) -> float:
        nonlocal clamp_events
        sku = str(row["sku"])
        demand = _to_float(row["demand_units"], 0.0)
        month_num = int(str(row["month"])[5:7])
        if sku not in anchor_map:
            return float(round(max(demand, 0.0), 3))
        matched_skus.add(sku)
        a = anchor_map[sku]
        avg_anchor = _to_float(getattr(a, "future_average", None), float("nan"))
        if math.isnan(avg_anchor) or avg_anchor <= 0:
            plan_vals = [
                _to_float(getattr(a, "supply_plan_jul", None), float("nan")),
                _to_float(getattr(a, "supply_plan_aug", None), float("nan")),
                _to_float(getattr(a, "supply_plan_sep", None), float("nan")),
                _to_float(getattr(a, "supply_plan_oct", None), float("nan")),
                _to_float(getattr(a, "supply_plan_nov", None), float("nan")),
            ]
            plan_vals = [v for v in plan_vals if not math.isnan(v) and v > 0]
            avg_anchor = float(np.mean(plan_vals)) if plan_vals else max(demand, 1.0)
        month_factor = _month_factor_from_anchor(pd.Series(a._asdict()), month_num)
        target_anchor = avg_anchor * month_factor
        blend = 0.65 * demand + 0.35 * target_anchor
        variance = _to_float(getattr(a, "demand_variance", None), avg_anchor * 0.25)
        cv = float(np.clip(math.sqrt(max(variance, 0.0)) / max(avg_anchor, 1.0), 0.08, 1.2))
        jitter = 1.0 + (((_stable_u01(f"{seed}|{sku}|{row['month']}|anchor_jitter") * 541) % 1.0) - 0.5) * min(0.18, cv * 0.4)
        blended = max(0.0, blend * jitter)

        sp = [
            _to_float(getattr(a, "supply_plan_jul", None), float("nan")),
            _to_float(getattr(a, "supply_plan_aug", None), float("nan")),
            _to_float(getattr(a, "supply_plan_sep", None), float("nan")),
            _to_float(getattr(a, "supply_plan_oct", None), float("nan")),
            _to_float(getattr(a, "supply_plan_nov", None), float("nan")),
        ]
        sp_obs = [v for v in sp if not math.isnan(v) and v > 0]
        if sp_obs:
            high = max(max(sp_obs) * 1.9, avg_anchor * 2.6, 4.0)
        else:
            high = max(avg_anchor * 2.6, 4.0)
        low = max(0.0, avg_anchor * 0.30)
        clipped = float(np.clip(blended, low, high))
        if abs(clipped - blended) > 1e-6:
            clamp_events += 1
        return round(clipped, 3)

    adjusted = component_monthly.copy()
    adjusted["demand_units"] = adjusted.apply(_adjust, axis=1)
    stats = {
        "anchor_matches": int(len(matched_skus)),
        "anchor_unmatched": int(adjusted["sku"].nunique() - len(matched_skus)),
        "range_clamp_events": int(clamp_events),
    }
    return adjusted, stats


def _add_independent_component_tail(
    component_monthly: pd.DataFrame,
    anchor: pd.DataFrame,
    months: list[date],
    warehouse_id: str | None,
    seed: int,
    top_n: int = 40,
) -> pd.DataFrame:
    if anchor.empty:
        return component_monthly
    existing_skus = set(component_monthly["sku"].astype(str).unique()) if not component_monthly.empty else set()
    candidates = anchor.copy()
    candidates["future_average"] = pd.to_numeric(candidates.get("future_average"), errors="coerce")
    candidates = candidates[candidates["future_average"].fillna(0) > 0].copy()
    candidates = candidates.sort_values("future_average", ascending=False).head(max(5, int(top_n)))
    rows: list[dict[str, object]] = []
    for r in candidates.itertuples(index=False):
        sku = str(r.material_code)
        if sku in existing_skus:
            continue
        avg = max(_to_float(r.future_average, 0.0), 1.0)
        profile = _category_profile_from_name(str(getattr(r, "description", "") or ""))
        sparse_series = _stable_u01(f"{seed}|tail|{sku}|sparse") < 0.28
        zero_prob = 0.04 + 0.05 * _stable_u01(f"{seed}|tail|{sku}|zero")
        for m in months:
            idx = months.index(m)
            seasonal = _month_factor_from_anchor(pd.Series(r._asdict()), m.month)
            seasonal *= 1.0 + profile["season_amp"] * 0.35 * math.sin((m.month - 1) * (2.0 * math.pi / 12.0))
            regime = _build_regime_factor(f"{seed}|tail|{sku}", idx, len(months))
            jitter = 1.0 + (((_stable_u01(f"{seed}|tail|{sku}|{m.isoformat()}") * 431) % 1.0) - 0.5) * 0.14
            promo = 1.0
            if _stable_u01(f"{seed}|tail|{sku}|promo|{m.isoformat()}") < profile["promo_prob"] * 0.7:
                promo += 0.04 + profile["promo_lift"] * 0.8 * _stable_u01(f"{seed}|tail|{sku}|promo_lift|{m.isoformat()}")
            units = max(0.0, avg * seasonal * regime * jitter * promo)
            if sparse_series and _stable_u01(f"{seed}|tail|{sku}|zero_hit|{m.isoformat()}") < zero_prob:
                units *= 0.08 * _stable_u01(f"{seed}|tail|{sku}|zero_scale|{m.isoformat()}")
            rows.append(
                {
                    "warehouse_id": warehouse_id,
                    "sku": sku,
                    "month": m.isoformat(),
                    "component_type": "raw_material",
                    "demand_units": round(float(units), 3),
                }
            )
    if not rows:
        return component_monthly
    tail = pd.DataFrame(rows)
    if component_monthly.empty:
        return tail
    all_rows = pd.concat([component_monthly, tail], ignore_index=True)
    return (
        all_rows.groupby(["warehouse_id", "sku", "month", "component_type"], dropna=False, as_index=False)["demand_units"]
        .sum()
        .sort_values(["warehouse_id", "sku", "month"])
        .reset_index(drop=True)
    )


def _compute_anchor_realism_checks(daily: pd.DataFrame, anchor: pd.DataFrame) -> dict[str, float | int]:
    if daily.empty or anchor.empty:
        return {
            "anchor_sku_count": int(len(anchor)) if not anchor.empty else 0,
            "matched_sku_count": 0,
            "anchor_coverage_pct": 0.0,
            "weighted_abs_anchor_pct_err": float("nan"),
            "median_ratio_gen_to_anchor": float("nan"),
            "p10_ratio_gen_to_anchor": float("nan"),
            "p90_ratio_gen_to_anchor": float("nan"),
        }

    anchor_view = anchor.copy()
    anchor_view["anchor_avg"] = pd.to_numeric(anchor_view.get("future_average"), errors="coerce")
    supply_cols = [c for c in ("supply_plan_jul", "supply_plan_aug", "supply_plan_sep", "supply_plan_oct", "supply_plan_nov") if c in anchor_view.columns]
    if supply_cols:
        supply_mean = anchor_view[supply_cols].apply(pd.to_numeric, errors="coerce").mean(axis=1, skipna=True)
        anchor_view["anchor_avg"] = anchor_view["anchor_avg"].fillna(supply_mean)
    anchor_view["anchor_avg"] = anchor_view["anchor_avg"].fillna(0.0)
    anchor_view["material_code"] = anchor_view["material_code"].astype(str)
    anchor_view = anchor_view[["material_code", "anchor_avg"]].drop_duplicates(subset=["material_code"])

    gen = (
        daily.groupby("sku", as_index=False)["demand_units"]
        .mean()
        .rename(columns={"sku": "material_code", "demand_units": "gen_avg"})
    )
    merged = anchor_view.merge(gen, on="material_code", how="left")
    matched = merged[merged["gen_avg"].notna()].copy()
    matched_nonzero = matched[matched["anchor_avg"] > 0].copy()

    anchor_sku_count = int(len(anchor_view))
    matched_sku_count = int(len(matched))
    coverage = float(matched_sku_count / anchor_sku_count) if anchor_sku_count > 0 else 0.0

    if matched_nonzero.empty:
        return {
            "anchor_sku_count": anchor_sku_count,
            "matched_sku_count": matched_sku_count,
            "anchor_coverage_pct": round(coverage, 6),
            "weighted_abs_anchor_pct_err": float("nan"),
            "median_ratio_gen_to_anchor": float("nan"),
            "p10_ratio_gen_to_anchor": float("nan"),
            "p90_ratio_gen_to_anchor": float("nan"),
        }

    err_num = (matched_nonzero["gen_avg"] - matched_nonzero["anchor_avg"]).abs().sum()
    err_den = matched_nonzero["anchor_avg"].sum()
    weighted_abs_pct_err = float(err_num / err_den) if err_den > 0 else float("nan")

    ratios = (matched_nonzero["gen_avg"] / matched_nonzero["anchor_avg"]).replace([np.inf, -np.inf], np.nan).dropna()
    if ratios.empty:
        median_ratio = float("nan")
        p10_ratio = float("nan")
        p90_ratio = float("nan")
    else:
        median_ratio = float(ratios.median())
        p10_ratio = float(ratios.quantile(0.10))
        p90_ratio = float(ratios.quantile(0.90))

    return {
        "anchor_sku_count": anchor_sku_count,
        "matched_sku_count": matched_sku_count,
        "anchor_coverage_pct": round(coverage, 6),
        "weighted_abs_anchor_pct_err": round(weighted_abs_pct_err, 6) if not math.isnan(weighted_abs_pct_err) else float("nan"),
        "median_ratio_gen_to_anchor": round(median_ratio, 6) if not math.isnan(median_ratio) else float("nan"),
        "p10_ratio_gen_to_anchor": round(p10_ratio, 6) if not math.isnan(p10_ratio) else float("nan"),
        "p90_ratio_gen_to_anchor": round(p90_ratio, 6) if not math.isnan(p90_ratio) else float("nan"),
    }


def _evaluate_realism_gate(
    checks: dict,
    realism_checks: dict[str, float | int],
    min_anchor_coverage: float,
    max_weighted_anchor_ape: float,
    min_matched_skus: int,
) -> dict[str, object]:
    coverage = float(realism_checks.get("anchor_coverage_pct") or 0.0)
    matched_skus = int(realism_checks.get("matched_sku_count") or 0)
    ape = float(realism_checks.get("weighted_abs_anchor_pct_err")) if realism_checks.get("weighted_abs_anchor_pct_err") is not None else float("nan")

    conditions = [
        ("rows_daily>0", int(checks.get("rows_daily", 0)) > 0),
        ("months_min>=13", int(checks.get("months_min", 0)) >= 13),
        ("anchor_coverage>=min_anchor_coverage", coverage >= float(min_anchor_coverage)),
        ("matched_skus>=min_matched_skus", matched_skus >= int(min_matched_skus)),
        (
            "weighted_abs_anchor_pct_err<=max_weighted_anchor_ape",
            (not math.isnan(ape)) and ape <= float(max_weighted_anchor_ape),
        ),
    ]
    failed = [name for name, ok in conditions if not ok]
    return {
        "pass": len(failed) == 0,
        "failed_conditions": failed,
        "thresholds": {
            "min_anchor_coverage": float(min_anchor_coverage),
            "max_weighted_anchor_ape": float(max_weighted_anchor_ape),
            "min_matched_skus": int(min_matched_skus),
        },
    }


def _monthly_to_daily(monthly: pd.DataFrame) -> pd.DataFrame:
    if monthly.empty:
        return pd.DataFrame(columns=["warehouse_id", "sku", "category", "demand_date", "demand_units"])
    out_rows: list[dict[str, object]] = []
    for r in monthly.itertuples(index=False):
        m = datetime.strptime(str(r.month), "%Y-%m-%d").date()
        out_rows.append(
            {
                "warehouse_id": r.warehouse_id,
                "sku": str(r.sku),
                "component_type": str(r.component_type),
                "demand_date": m.isoformat(),
                "demand_units": round(float(r.demand_units), 3),
            }
        )
    return pd.DataFrame(out_rows)


def _build_dataset_version(meta: dict) -> str:
    payload = json.dumps(meta, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:16]


def run(
    db_url: str,
    excel_path: Path,
    out_csv: Path,
    schema: str = "public",
    warehouse_id: str | None = None,
    months: int = 36,
    seed: int = 42,
    source_tag: str = "excel_bom_dependent_synth",
    add_independent_tail: bool = True,
    independent_tail_top_n: int = 40,
    strict_realism: bool = False,
    min_anchor_coverage: float = 0.70,
    max_weighted_anchor_ape: float = 0.40,
    min_matched_skus: int = 40,
    do_load: bool = True,
) -> dict:
    now = datetime.now(timezone.utc).date()
    end_month = _month_start(now.replace(day=1))
    months_list = _month_range(end_month=end_month, months=max(13, int(months)))

    anchor = _load_active_stock_anchor(excel_path=excel_path)
    bom_rows = _fetch_bom_rows(db_url=db_url, schema=schema, warehouse_id=warehouse_id)
    fg_seed = _fetch_fg_inventory_seed(db_url=db_url, schema=schema, warehouse_id=warehouse_id)
    component_desc = _fetch_component_descriptions(db_url=db_url, schema=schema)

    fg_skus_with_bom = {b.fg_sku for b in bom_rows}
    fg_seed = fg_seed[fg_seed["fg_sku"].astype(str).isin(fg_skus_with_bom)].copy()

    fg_monthly = _generate_fg_monthly_demand(fg_frame=fg_seed, months=months_list, seed=seed)
    component_monthly = _explode_to_components(fg_monthly=fg_monthly, bom_rows=bom_rows, months=months_list)
    component_monthly, anchor_stats = _apply_anchor_constraints(component_monthly=component_monthly, anchor=anchor, seed=seed)
    if add_independent_tail:
        component_monthly = _add_independent_component_tail(
            component_monthly=component_monthly,
            anchor=anchor,
            months=months_list,
            warehouse_id=warehouse_id,
            seed=seed,
            top_n=independent_tail_top_n,
        )
    daily = _monthly_to_daily(component_monthly)
    if not daily.empty:
        daily["category"] = daily["sku"].map(component_desc).fillna("UNKNOWN")

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "warehouse_id": warehouse_id,
        "months": len(months_list),
        "seed": seed,
        "source_tag": source_tag,
        "anchor_rows": int(len(anchor)),
        "fg_seed_rows": int(len(fg_seed)),
        "bom_rows": int(len(bom_rows)),
        "component_skus": int(daily["sku"].nunique()) if not daily.empty else 0,
    }
    dataset_version = _build_dataset_version(meta)
    daily["dataset_version"] = dataset_version
    daily["source_tag"] = source_tag

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    daily.to_csv(out_csv, index=False)

    sku_months = (
        daily.groupby("sku", as_index=False)["demand_date"].nunique().rename(columns={"demand_date": "n_months"})
        if not daily.empty
        else pd.DataFrame(columns=["sku", "n_months"])
    )
    checks = {
        "rows_daily": int(len(daily)),
        "sku_count": int(daily["sku"].nunique()) if not daily.empty else 0,
        "months_min": int(sku_months["n_months"].min()) if not sku_months.empty else 0,
        "months_p50": float(sku_months["n_months"].median()) if not sku_months.empty else 0.0,
        "months_max": int(sku_months["n_months"].max()) if not sku_months.empty else 0,
        "non_negative": bool((daily["demand_units"] >= 0).all()) if not daily.empty else True,
        "anchor_matches": int(anchor_stats.get("anchor_matches", 0)),
        "anchor_unmatched": int(anchor_stats.get("anchor_unmatched", 0)),
        "range_clamp_events": int(anchor_stats.get("range_clamp_events", 0)),
        "fg_skus_used": int(fg_monthly["fg_sku"].nunique()) if not fg_monthly.empty else 0,
        "component_types": sorted(daily["component_type"].dropna().astype(str).unique().tolist()) if not daily.empty else [],
    }
    realism_checks = _compute_anchor_realism_checks(daily=daily, anchor=anchor)
    realism_gate = _evaluate_realism_gate(
        checks=checks,
        realism_checks=realism_checks,
        min_anchor_coverage=float(min_anchor_coverage),
        max_weighted_anchor_ape=float(max_weighted_anchor_ape),
        min_matched_skus=int(min_matched_skus),
    )
    checks.update(realism_checks)
    checks["realism_gate_pass"] = bool(realism_gate["pass"])

    report_path = out_csv.with_suffix(".report.json")
    report = {
        "status": "ok" if checks["rows_daily"] > 0 else "error",
        "reason": "ok" if checks["rows_daily"] > 0 else "no_generated_rows",
        "dataset_version": dataset_version,
        "source": "excel_constrained_bom_dependent_generation",
        "excel_path": str(excel_path.resolve()),
        "out_csv": str(out_csv.resolve()),
        "checks": checks,
        "realism_gate": realism_gate,
        "meta": meta,
    }
    if checks["rows_daily"] > 0 and strict_realism and not realism_gate["pass"]:
        report["status"] = "error"
        report["reason"] = "realism_gate_failed"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")

    load_result = None
    if do_load and checks["rows_daily"] > 0 and report["status"] == "ok":
        load_result = load_run(
            db_url=db_url,
            input_csv=out_csv,
            dataset_version=dataset_version,
            source_tag=source_tag,
            warehouse_id_override=warehouse_id,
        )

    result = {
        "status": report["status"],
        "reason": report["reason"],
        "dataset_version": dataset_version,
        "out_csv": str(out_csv.resolve()),
        "report_json": str(report_path.resolve()),
        "checks": checks,
        "load_result": load_result,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate realistic raw/packing demand history using Excel constraints + BOM dependent-demand explosion."
    )
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--excel-path", required=True)
    parser.add_argument("--schema", default="public")
    parser.add_argument("--warehouse-id", default=None)
    parser.add_argument("--months", type=int, default=36)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--source-tag", default="excel_bom_dependent_synth")
    parser.add_argument(
        "--out-csv",
        default="ai-services/forecast-service/artifacts/backfill/synthetic_bom_dependent_history.csv",
    )
    parser.add_argument(
        "--no-load",
        action="store_true",
        help="Generate file/report only; skip DB load.",
    )
    parser.add_argument(
        "--no-independent-tail",
        action="store_true",
        help="Skip direct synthetic tail for anchor SKUs not covered by active BOM components.",
    )
    parser.add_argument("--independent-tail-top-n", type=int, default=40)
    parser.add_argument(
        "--strict-realism",
        action="store_true",
        help="Fail generation if realism gate checks fail (coverage + anchor error thresholds).",
    )
    parser.add_argument("--min-anchor-coverage", type=float, default=0.70)
    parser.add_argument("--max-weighted-anchor-ape", type=float, default=0.40)
    parser.add_argument("--min-matched-skus", type=int, default=40)
    args = parser.parse_args()

    result = run(
        db_url=args.db_url,
        excel_path=Path(args.excel_path),
        out_csv=Path(args.out_csv),
        schema=args.schema,
        warehouse_id=args.warehouse_id,
        months=max(13, int(args.months)),
        seed=int(args.seed),
        source_tag=args.source_tag,
        add_independent_tail=not bool(args.no_independent_tail),
        independent_tail_top_n=max(0, int(args.independent_tail_top_n)),
        strict_realism=bool(args.strict_realism),
        min_anchor_coverage=float(args.min_anchor_coverage),
        max_weighted_anchor_ape=float(args.max_weighted_anchor_ape),
        min_matched_skus=max(1, int(args.min_matched_skus)),
        do_load=not bool(args.no_load),
    )
    return 0 if result["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
