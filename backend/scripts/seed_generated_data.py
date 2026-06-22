"""
DB Seeding Script — Phase 4.3

Loads all generated data (product dimensions, demand history, forecasts,
rack specs, BOM) into the PostgreSQL database.

Usage:
  python seed_generated_data.py --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms
"""
from __future__ import annotations

import argparse
import uuid
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

GENERATED_DIR = Path(__file__).resolve().parent.parent.parent / "Ai miroservices" / "modeling" / "outputs" / "generated"
SCENARIO_C_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "Ai miroservices" / "Forecast model train data optiwms"
    / "hemas_scenario_c_dataset_cleaned.csv"
)

DEFAULT_DB_URL = "postgresql://optiwms:optiwms@localhost:5434/optiwms"
DEFAULT_WAREHOUSE_ID = "00000000-0000-0000-0000-000000000001"


def get_or_create_warehouse(engine, warehouse_id: str) -> str:
    with engine.begin() as conn:
        result = conn.execute(text("SELECT id FROM warehouses WHERE id = :wid"), {"wid": warehouse_id})
        if result.fetchone():
            return warehouse_id
        conn.execute(text("""
            INSERT INTO warehouses (id, name, code, status)
            VALUES (:wid, 'OptiWMS Main Warehouse', 'WH001', 'active')
            ON CONFLICT (id) DO NOTHING
        """), {"wid": warehouse_id})
    return warehouse_id


def seed_product_dimensions(engine, warehouse_id: str):
    """Load product dimensions CSV into materials table."""
    dims_path = GENERATED_DIR / "product_dimensions.csv"
    if not dims_path.exists():
        print(f"SKIP: {dims_path} not found. Run generate_product_dimensions.py first.")
        return

    dims = pd.read_csv(dims_path)
    print(f"Seeding {len(dims)} product dimensions...")

    with engine.begin() as conn:
        for _, row in dims.iterrows():
            mat_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, row["sku_code"]))
            conn.execute(text("""
                INSERT INTO materials (id, material_code, description, material_type, category,
                    storage_type, length_cm, width_cm, height_cm, weight_kg, volume_cm3,
                    units_per_pallet, hazard_class, hazardous)
                VALUES (:id, :code, :name, :type, :cat, :st, :l, :w, :h, :wt, :vol,
                    :upp, :haz, :is_haz)
                ON CONFLICT (material_code) DO UPDATE SET
                    storage_type = EXCLUDED.storage_type,
                    length_cm = EXCLUDED.length_cm,
                    width_cm = EXCLUDED.width_cm,
                    height_cm = EXCLUDED.height_cm,
                    weight_kg = EXCLUDED.weight_kg,
                    volume_cm3 = EXCLUDED.volume_cm3,
                    units_per_pallet = EXCLUDED.units_per_pallet,
                    hazard_class = EXCLUDED.hazard_class
            """), {
                "id": mat_id,
                "code": row["sku_code"],
                "name": row["sku_name"],
                "type": row["sku_type"],
                "cat": row["category"],
                "st": row["storage_type"],
                "l": row["length_cm"],
                "w": row["width_cm"],
                "h": row["height_cm"],
                "wt": row["weight_kg"],
                "vol": row["volume_cm3"],
                "upp": int(row["units_per_pallet"]),
                "haz": row["hazard_class"],
                "is_haz": row["hazard_class"] != "NONE",
            })

    print(f"  Seeded {len(dims)} materials")


def seed_demand_history(engine, warehouse_id: str):
    """Load FG demand history from Scenario C dataset."""
    if not SCENARIO_C_PATH.exists():
        print(f"SKIP: {SCENARIO_C_PATH} not found.")
        return

    df = pd.read_csv(SCENARIO_C_PATH)
    target = "demand_units_clean" if "demand_units_clean" in df.columns else "demand_units"
    print(f"Seeding {len(df)} demand history rows...")

    with engine.begin() as conn:
        batch = []
        for _, row in df.iterrows():
            mat_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, row["fg_code"]))
            batch.append({
                "id": str(uuid.uuid4()),
                "material_id": mat_id,
                "warehouse_id": warehouse_id,
                "period": row["month"],
                "demand_units": float(row[target]),
                "promotion_flag": bool(row.get("promotion_flag", False)),
                "holiday_flag": bool(row.get("holiday_flag", False)),
                "lead_time_days": row.get("lead_time_days"),
                "on_hand_inventory": row.get("on_hand_inventory"),
                "source": "scenario_c",
            })

        if batch:
            conn.execute(text("""
                INSERT INTO demand_history (id, material_id, warehouse_id, period, demand_units,
                    promotion_flag, holiday_flag, lead_time_days, on_hand_inventory, source)
                VALUES (:id, :material_id, :warehouse_id, :period, :demand_units,
                    :promotion_flag, :holiday_flag, :lead_time_days, :on_hand_inventory, :source)
                ON CONFLICT DO NOTHING
            """), batch)

    print(f"  Seeded {len(batch)} demand history rows")


def seed_forecasts(engine, warehouse_id: str):
    """Load quantile forecasts."""
    forecast_path = GENERATED_DIR / "warehouse_quantile_forecasts.csv"
    if not forecast_path.exists():
        print(f"SKIP: {forecast_path} not found. Run warehouse_forecast_pipeline.py first.")
        return

    df = pd.read_csv(forecast_path)
    print(f"Seeding {len(df)} forecast rows...")

    with engine.begin() as conn:
        for fg_code in df["fg_code"].unique():
            mat_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, fg_code))
            fg_df = df[df["fg_code"] == fg_code]
            latest = fg_df[fg_df["horizon"] == 1].iloc[0] if len(fg_df[fg_df["horizon"] == 1]) > 0 else fg_df.iloc[0]
            conn.execute(text("""
                UPDATE materials SET
                    forecast_p50 = :p50, forecast_p10 = :p10, forecast_p90 = :p90,
                    forecast_updated_at = NOW()
                WHERE material_code = :code OR id = :mat_id
            """), {
                "p50": float(latest["forecast_p50"]),
                "p10": float(latest["forecast_p10"]),
                "p90": float(latest["forecast_p90"]),
                "code": fg_code,
                "mat_id": mat_id,
            })

    print(f"  Updated forecasts for {df['fg_code'].nunique()} SKUs")


def seed_rack_locations(engine, warehouse_id: str):
    """Load rack location specifications."""
    loc_path = GENERATED_DIR / "rack_locations.csv"
    if not loc_path.exists():
        print(f"SKIP: {loc_path} not found. Run generate_rack_specs.py first.")
        return

    df = pd.read_csv(loc_path)
    print(f"Seeding {len(df)} rack locations...")

    with engine.begin() as conn:
        for _, row in df.iterrows():
            loc_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, row["location_code"]))
            conn.execute(text("""
                INSERT INTO locations (id, warehouse_id, location_code, zone_type,
                    max_weight_kg, capacity, coordinate_x, coordinate_y, is_active)
                VALUES (:id, :wid, :code, :zone, :weight, :cap, :x, :y, true)
                ON CONFLICT (location_code) DO UPDATE SET
                    max_weight_kg = EXCLUDED.max_weight_kg,
                    capacity = EXCLUDED.capacity
            """), {
                "id": loc_id,
                "wid": warehouse_id,
                "code": row["location_code"],
                "zone": row["zone"],
                "weight": float(row["weight_capacity_kg"]),
                "cap": float(row["height_cm"]) * 100 * 200 / 1000,  # rough volume estimate
                "x": float(row["coordinate_x"]),
                "y": float(row["coordinate_y"]),
            })

    print(f"  Seeded {len(df)} locations")


def main():
    parser = argparse.ArgumentParser(description="Seed OptiWMS database with generated data")
    parser.add_argument("--db-url", default=DEFAULT_DB_URL)
    parser.add_argument("--warehouse-id", default=DEFAULT_WAREHOUSE_ID)
    args = parser.parse_args()

    engine = create_engine(args.db_url, future=True)
    print(f"Connected to: {args.db_url}")

    warehouse_id = get_or_create_warehouse(engine, args.warehouse_id)
    seed_product_dimensions(engine, warehouse_id)
    seed_demand_history(engine, warehouse_id)
    seed_forecasts(engine, warehouse_id)
    seed_rack_locations(engine, warehouse_id)

    print("\nSeeding complete!")


if __name__ == "__main__":
    main()
