#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from load_outbound_history_backfill import run as load_run


@dataclass
class SkuSeed:
    warehouse_id: str
    sku: str
    category: str
    reorder_point: float
    on_hand: float
    target_max: float
    observed_months: int
    observed_mean_demand: float


def _stable_rng_01(key: str) -> float:
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


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


def _season_multiplier(category: str, month: int, phase_shift: float = 0.0) -> float:
    c = (category or "").strip().lower()
    # Seasonality with per-product phase shift to prevent parallel curves.
    base = 1.0 + 0.15 * math.sin((month - 1 + phase_shift) * (2.0 * math.pi / 12.0))
    festive = 0.0
    if month in {4, 12}:  # Sinhala/Tamil new year + December demand spike
        festive += 0.15
    if month == 8:  # Back-to-school / mid-year restocking
        festive += 0.06
    if "soap" in c or "shampoo" in c or "detergent" in c:
        festive += 0.05
    if "diaper" in c or "sanitary" in c:
        festive += 0.04
    if "food" in c or "beverage" in c:
        festive += 0.08 if month in {4, 12} else 0.0
    return max(0.60, min(1.50, base + festive))


def _build_seed_frame(db_url: str, schema: str, warehouse_id: str | None) -> pd.DataFrame:
    engine = create_engine(db_url, future=True, pool_pre_ping=True)
    with engine.connect() as conn:
        wh_sql_filter = "(:warehouse_id IS NULL OR i.warehouse_id::text = :warehouse_id)"
        inventory_sql = text(
            f"""
            SELECT
                i.warehouse_id::text AS warehouse_id,
                m.material_code::text AS sku,
                COALESCE(NULLIF(m.description, ''), 'UNKNOWN')::text AS category,
                AVG(COALESCE(i.reorder_point, 0))::double precision AS reorder_point,
                SUM(COALESCE(i.quantity, 0))::double precision AS on_hand,
                AVG(COALESCE(i.max_stock, 0))::double precision AS target_max
            FROM {schema}.inventory i
            JOIN {schema}.materials m ON m.id = i.material_id
            WHERE LOWER(COALESCE(m.material_type, '')) = 'product'
              AND {wh_sql_filter}
            GROUP BY i.warehouse_id, m.material_code, m.description
            ORDER BY m.material_code
            """
        )
        inv_rows = conn.execute(inventory_sql, {"warehouse_id": warehouse_id}).mappings().all()
        inv = pd.DataFrame(inv_rows)

        history_sql = text(
            f"""
            SELECT
                b.warehouse_id::text AS warehouse_id,
                b.sku::text AS sku,
                COUNT(DISTINCT DATE_TRUNC('month', b.demand_date))::int AS observed_months,
                AVG(COALESCE(b.demand_units, 0))::double precision AS observed_mean_demand
            FROM {schema}.forecast_outbound_history_backfill b
            WHERE (:warehouse_id IS NULL OR b.warehouse_id::text = :warehouse_id)
            GROUP BY b.warehouse_id, b.sku
            """
        )
        hist_rows = conn.execute(history_sql, {"warehouse_id": warehouse_id}).mappings().all()
        hist = pd.DataFrame(hist_rows)

    if inv.empty:
        raise RuntimeError("No product inventory rows found. Cannot synthesize history.")

    merged = inv.merge(hist, on=["warehouse_id", "sku"], how="left")
    merged["observed_months"] = merged["observed_months"].fillna(0).astype(int)
    merged["observed_mean_demand"] = merged["observed_mean_demand"].fillna(0.0).astype(float)
    return merged


def _generate_rows(seed: SkuSeed, months: list[date], dataset_version: str) -> list[dict]:
    rows: list[dict] = []
    base_from_inventory = max(seed.reorder_point * 0.42, seed.target_max * 0.20, 25.0)
    base = seed.observed_mean_demand if seed.observed_mean_demand > 0 else base_from_inventory
    trend_anchor = 1.0 + (_stable_rng_01(f"{seed.sku}|trend") - 0.5) * 0.25
    jitter_anchor = _stable_rng_01(f"{seed.sku}|jitter")
    n = len(months)

    # Per-product volatility class: high/medium/low based on hash
    vol_class = _stable_rng_01(f"{seed.sku}|volatility")
    if vol_class < 0.20:
        noise_amplitude = 0.35  # High volatility product (20% of products)
    elif vol_class < 0.60:
        noise_amplitude = 0.22  # Medium volatility (40%)
    else:
        noise_amplitude = 0.12  # Low/stable volatility (40%)

    # Per-product seasonality phase shift (0 to 6 months) to prevent parallel curves
    phase_shift = _stable_rng_01(f"{seed.sku}|phase") * 6.0

    # Is this a slow mover? (bottom 25% by base demand → intermittent)
    is_slow_mover = base < 50.0 or _stable_rng_01(f"{seed.sku}|slow") < 0.20

    # Promotional spike schedule: 1-3 spikes per year, deterministic per SKU
    spike_months_per_year = int(1 + _stable_rng_01(f"{seed.sku}|spikes") * 3)
    spike_month_offsets = set()
    for s in range(spike_months_per_year):
        offset = int(_stable_rng_01(f"{seed.sku}|spike_{s}") * 12)
        spike_month_offsets.add(offset)

    # Stockout months: ~5-8% of months, deterministic per SKU
    stockout_rate = 0.05 + _stable_rng_01(f"{seed.sku}|stockout_rate") * 0.03

    # Regime change: some products have a demand level shift mid-history
    regime_change_idx = int(_stable_rng_01(f"{seed.sku}|regime_pos") * n) if _stable_rng_01(f"{seed.sku}|has_regime") < 0.25 else -1
    regime_multiplier = 0.6 + _stable_rng_01(f"{seed.sku}|regime_mult") * 0.8  # 0.6x to 1.4x

    for i, m in enumerate(months):
        progress = (i / max(n - 1, 1)) - 0.5
        trend = 1.0 + progress * (trend_anchor - 1.0)
        season = _season_multiplier(seed.category, m.month, phase_shift)

        # Noise with per-product amplitude
        noise_val = (((jitter_anchor * (i + 3) * 7.0) % 1.0) - 0.5) * 2.0
        noise = 1.0 + noise_val * noise_amplitude

        demand = base * trend * season * noise

        # Regime change
        if 0 <= regime_change_idx <= i:
            demand *= regime_multiplier

        # Promotional spike (1.4x to 2.2x demand)
        if (m.month - 1) in spike_month_offsets and _stable_rng_01(f"{seed.sku}|spike_fire_{i}") < 0.7:
            spike_mult = 1.4 + _stable_rng_01(f"{seed.sku}|spike_size_{i}") * 0.8
            demand *= spike_mult

        # Intermittent demand for slow movers (random zero months)
        if is_slow_mover and _stable_rng_01(f"{seed.sku}|zero_{i}") < 0.25:
            demand = 0.0

        # Stockout censoring (demand drops to near zero)
        if _stable_rng_01(f"{seed.sku}|stockout_{i}") < stockout_rate:
            demand = max(0.0, demand * 0.05)  # ~95% suppression

        demand = max(0.0, demand)
        rows.append(
            {
                "warehouse_id": seed.warehouse_id,
                "sku": seed.sku,
                "category": seed.category,
                "demand_date": m.isoformat(),
                "demand_units": round(float(demand), 3),
                "dataset_version": dataset_version,
                "source_tag": "synthetic_runtime_history",
            }
        )
    return rows


def run(
    db_url: str,
    out_csv: Path,
    schema: str = "public",
    warehouse_id: str | None = None,
    months: int = 36,
) -> dict:
    now = datetime.now(timezone.utc).date()
    end_month = _month_start(now.replace(day=1))
    months_list = _month_range(end_month=end_month, months=months)

    seed_frame = _build_seed_frame(db_url=db_url, schema=schema, warehouse_id=warehouse_id)
    dataset_fingerprint = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "warehouse_id": warehouse_id,
        "months": months,
        "sku_count": int(seed_frame["sku"].nunique()),
    }
    dataset_version = hashlib.sha256(
        json.dumps(dataset_fingerprint, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:16]

    generated: list[dict] = []
    for row in seed_frame.itertuples(index=False):
        seed = SkuSeed(
            warehouse_id=str(row.warehouse_id),
            sku=str(row.sku),
            category=str(row.category),
            reorder_point=float(row.reorder_point or 0.0),
            on_hand=float(row.on_hand or 0.0),
            target_max=float(row.target_max or 0.0),
            observed_months=int(row.observed_months or 0),
            observed_mean_demand=float(row.observed_mean_demand or 0.0),
        )
        generated.extend(_generate_rows(seed=seed, months=months_list, dataset_version=dataset_version))

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(generated).to_csv(out_csv, index=False)

    load_result = load_run(
        db_url=db_url,
        input_csv=out_csv,
        dataset_version=dataset_version,
        source_tag="synthetic_runtime_history",
        warehouse_id_override=warehouse_id,
    )
    result = {
        "status": "ok",
        "dataset_version": dataset_version,
        "out_csv": str(out_csv.resolve()),
        "sku_count": int(seed_frame["sku"].nunique()),
        "months_per_sku": int(months),
        "rows_generated": int(len(generated)),
        "load_result": load_result,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate controlled synthetic monthly outbound history for runtime coverage and load idempotently."
    )
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--schema", default="public")
    parser.add_argument("--warehouse-id", default=None)
    parser.add_argument("--months", type=int, default=36)
    parser.add_argument(
        "--out-csv",
        default="ai-services/forecast-service/artifacts/backfill/synthetic_runtime_history.csv",
    )
    args = parser.parse_args()

    run(
        db_url=args.db_url,
        out_csv=Path(args.out_csv),
        schema=args.schema,
        warehouse_id=args.warehouse_id,
        months=max(13, int(args.months)),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
