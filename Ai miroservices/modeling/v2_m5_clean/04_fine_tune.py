#!/usr/bin/env python3
"""Step 4: Fine-tune pre-trained model on WMS-specific data.

This script is for Phase 3 (when ≥12 months of real WMS data has accumulated).
It loads the pre-trained M5 model, fine-tunes it on WMS data from the database,
and only promotes the fine-tuned model if it beats the pre-trained baseline.

Usage:
  python 04_fine_tune.py --db-url postgresql://user:pass@host:port/db
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import yaml


def load_config() -> dict:
    cfg_path = Path(__file__).parent / "config.yaml"
    with cfg_path.open() as f:
        return yaml.safe_load(f)


def fetch_wms_history(db_url: str, schema: str = "public",
                      min_months: int = 12) -> pd.DataFrame:
    """Fetch monthly demand history from WMS database."""
    from sqlalchemy import create_engine, text

    engine = create_engine(db_url, future=True, pool_pre_ping=True)
    sql = text(f"""
        WITH combined AS (
            SELECT
                m.material_code AS series_id,
                COALESCE(NULLIF(m.description, ''), 'UNKNOWN') AS category,
                DATE_TRUNC('month', o.order_date)::date AS month,
                SUM(oi.quantity) AS demand
            FROM {schema}.order_items oi
            JOIN {schema}.orders o ON o.id = oi.order_id
            JOIN {schema}.materials m ON m.id = oi.material_id
            WHERE o.order_type = 'outbound'
            GROUP BY m.material_code, m.description, DATE_TRUNC('month', o.order_date)

            UNION ALL

            SELECT
                b.sku AS series_id,
                b.category,
                DATE_TRUNC('month', b.demand_date)::date AS month,
                SUM(b.demand_units) AS demand
            FROM {schema}.forecast_outbound_history_backfill b
            GROUP BY b.sku, b.category, DATE_TRUNC('month', b.demand_date)
        )
        SELECT series_id, category,
               month::text AS month,
               SUM(demand) AS demand
        FROM combined
        GROUP BY series_id, category, month
        ORDER BY series_id, month
    """)

    with engine.connect() as conn:
        df = pd.DataFrame(conn.execute(sql).mappings().all())

    if df.empty:
        raise RuntimeError("No WMS history found in database.")

    df["month"] = pd.to_datetime(df["month"]).dt.to_period("M")

    # Check minimum months per series
    months_per_series = df.groupby("series_id")["month"].nunique()
    eligible = months_per_series[months_per_series >= min_months].index
    df = df[df["series_id"].isin(eligible)].copy()

    if df.empty:
        raise RuntimeError(
            f"No series with ≥{min_months} months of history. "
            f"Max months found: {months_per_series.max()}"
        )

    print(f"[04] WMS history: {len(df):,} rows, {df['series_id'].nunique()} series "
          f"with ≥{min_months} months")
    return df


def main():
    parser = argparse.ArgumentParser(description="Fine-tune pre-trained model on WMS data.")
    parser.add_argument("--db-url", required=True, help="WMS PostgreSQL connection URL")
    parser.add_argument("--schema", default="public")
    parser.add_argument("--min-months", type=int, default=12)
    parser.add_argument("--dry-run", action="store_true", help="Evaluate only, don't promote")
    args = parser.parse_args()

    cfg = load_config()
    print("[04] Fine-tuning is a Phase 3 operation.")
    print("[04] This requires ≥12 months of real WMS data in the database.")
    print(f"[04] Connecting to: {args.db_url.split('@')[1] if '@' in args.db_url else '***'}")

    try:
        wms_data = fetch_wms_history(args.db_url, args.schema, args.min_months)
    except RuntimeError as e:
        print(f"[04] ⚠ {e}")
        print("[04] Fine-tuning not possible yet. Using pre-trained M5 model.")
        return

    # TODO: Implement fine-tuning logic:
    # 1. Load pre-trained model for each horizon
    # 2. Fine-tune with warm_start on WMS data
    # 3. Evaluate fine-tuned vs pre-trained on WMS test split
    # 4. Only promote if fine-tuned model beats pre-trained
    print("[04] Fine-tuning pipeline ready for implementation when data is available.")
    print("[04] For now, the pre-trained M5 model serves as the production baseline.")


if __name__ == "__main__":
    main()
