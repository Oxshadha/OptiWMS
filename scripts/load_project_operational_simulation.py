#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import Json, execute_values

from project_ops_catalog import apply_catalog_names


DATASET_VERSION = "PROJECT_OPERATIONAL_SIMULATION_V8"
QUALITY_TIER = "PROJECT_OPERATIONAL_SIMULATION"
FORECAST_MODEL = "PROJECT_OPS_EXTRA_TREES_CAUSAL"
FORECAST_DATASET = "PROJECT_OPS_RM_PM"
DEMAND_SOURCE = "project_ops_v8"
BOM_VERSION = "PROJECT_OPS_V8"

OPERATIONAL_APRON_COORDINATES = {
    "QTN-01": (-31.0, -12.0),
    "RCV-01": (-7.0, -12.0),
    "STG-01": (17.0, -12.0),
    "PACK-01": (41.0, -12.0),
    "DSP-01": (65.0, -12.0),
    "DOOR-01": (17.0, -24.0),
}


def root() -> Path:
    return Path(__file__).resolve().parents[1]


def source_dir() -> Path:
    return root() / "Ai miroservices/modeling/v8_controlled_synthetic_validation/outputs"


def dataset_hash(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def lineage(table: str, digest: str) -> dict:
    return {
        "dataset_version": DATASET_VERSION,
        "data_quality_tier": QUALITY_TIER,
        "synthetic_ratio": 1.0,
        "source_table": table,
        "dataset_hash": digest,
        "use_case": "integrated project WMS operations and evaluator demonstration",
    }


def resolve_warehouse(cur, warehouse_code: str) -> str:
    cur.execute("SELECT id::text FROM warehouses WHERE code = %s", (warehouse_code,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        """
        INSERT INTO warehouses(code, name, city, country, status)
        VALUES (%s, 'Colombo Project Operations Warehouse', 'Colombo', 'Sri Lanka', 'active')
        RETURNING id::text
        """,
        (warehouse_code,),
    )
    return cur.fetchone()[0]


def align_operational_apron(locations: pd.DataFrame) -> pd.DataFrame:
    """Normalize operational points into a readable, realistic apron."""
    aligned = locations.copy()
    for location_code, (coordinate_x, coordinate_y) in OPERATIONAL_APRON_COORDINATES.items():
        location_mask = aligned["location_code"].eq(location_code)
        aligned.loc[location_mask, ["coordinate_x", "coordinate_y"]] = (
            coordinate_x,
            coordinate_y,
        )
    return aligned


def align_velocity_zones_to_doors(locations: pd.DataFrame) -> pd.DataFrame:
    """Normalize physical rack F/M/S suffixes by nearest-door travel depth."""
    aligned = locations.copy()
    storage_mask = aligned["zone_type"].isin(["PICK_FACE", "RESERVE"])
    storage = aligned.loc[storage_mask].copy()
    doors = aligned.loc[aligned["zone_type"].eq("DOOR"), ["coordinate_x", "coordinate_y"]]
    if storage.empty or doors.empty:
        return aligned

    rack_keys = ["area", "row_number", "bay_number"]
    racks = (
        storage.groupby(rack_keys, as_index=False)
        .agg(coordinate_x=("coordinate_x", "mean"), coordinate_y=("coordinate_y", "mean"))
    )
    door_points = doors[["coordinate_x", "coordinate_y"]].to_numpy(dtype=float)
    rack_points = racks[["coordinate_x", "coordinate_y"]].to_numpy(dtype=float)
    racks["door_distance"] = abs(
        rack_points[:, None, :] - door_points[None, :, :]
    ).sum(axis=2).min(axis=1)
    racks = racks.sort_values(["door_distance", *rack_keys]).reset_index(drop=True)
    fast_max = racks.iloc[(len(racks) - 1) // 3]["door_distance"]
    medium_max = racks.iloc[(len(racks) * 2 - 1) // 3]["door_distance"]
    racks["velocity_class"] = [
        "F" if distance <= fast_max else "M" if distance <= medium_max else "S"
        for distance in racks["door_distance"]
    ]
    velocity_by_rack = racks.set_index(rack_keys)["velocity_class"]
    storage_index = pd.MultiIndex.from_frame(aligned.loc[storage_mask, rack_keys])
    suffixes = velocity_by_rack.reindex(storage_index).to_numpy()
    prefixes = aligned.loc[storage_mask, "physical_class"].astype("string").str[0].str.upper()
    valid_prefix = prefixes.isin(["A", "B", "C"])
    aligned.loc[storage_mask, "physical_class"] = [
        prefix + suffix if valid else original
        for prefix, suffix, valid, original in zip(
            prefixes.fillna("C"),
            suffixes,
            valid_prefix,
            aligned.loc[storage_mask, "physical_class"],
        )
    ]
    return aligned


def load_materials(cur, physical: pd.DataFrame, digest: str) -> dict[str, str]:
    current_codes = physical["material_code"].tolist()
    cur.execute("""
        UPDATE materials
        SET data_quality_tier='ARCHIVED_GENERATED_BASELINE', decision_eligible=FALSE, updated_at=now()
        WHERE data_quality_tier IN (%s, 'GENERATED_OPERATIONAL_BASELINE')
          AND NOT (material_code = ANY(%s))
    """, (QUALITY_TIER, current_codes))
    cur.execute("""
        UPDATE inventory
        SET data_quality_tier='ARCHIVED_GENERATED_BASELINE', updated_at=now()
        WHERE warehouse_id IS NOT NULL
          AND data_quality_tier='GENERATED_OPERATIONAL_BASELINE'
          AND material_id IN (
              SELECT id FROM materials WHERE data_quality_tier='ARCHIVED_GENERATED_BASELINE'
          )
    """)
    rows = []
    for row in physical.itertuples(index=False):
        rows.append((
            row.material_code, row.description, row.unit_type, row.storage_type,
            row.material_type, row.category, row.handling_unit_type,
            float(row.units_per_handling_unit), float(row.order_multiple),
            float(row.min_order_quantity), int(row.lead_time_days),
            float(row.length_cm), float(row.width_cm), float(row.height_cm),
            float(row.weight_kg), float(row.volume_cm3), float(row.units_per_pallet),
            float(row.pallet_spaces), bool(row.stackable), float(row.pallet_weight_kg),
            int(row.max_stack_height), bool(row.temperature_controlled),
            bool(row.hazardous), bool(row.fragile), int(row.shelf_life_days),
            float(row.unit_cost),
            True, QUALITY_TIER, 1.0, True, Json({
                **lineage("materials", digest),
                "display_catalog": "PROJECT_OPS_HOUSEHOLD_CARE_V2",
            }),
        ))
    execute_values(
        cur,
        """
        INSERT INTO materials(
            material_code, description, unit_type, storage_type, material_type, category,
            handling_unit_type, units_per_handling_unit, order_multiple, min_order_quantity,
            order_delivery_days, length_cm, width_cm, height_cm, weight_kg, volume_cm3,
            units_per_pallet, pallet_spaces, stackable, max_pallet_weight_kg,
            max_stack_height, temperature_controlled, hazardous, fragile, shelf_life_days,
            unit_cost_standard, requires_pallet,
            data_quality_tier, synthetic_ratio, decision_eligible, source_lineage
        ) VALUES %s
        ON CONFLICT (material_code) DO UPDATE SET
            description = EXCLUDED.description,
            unit_type = EXCLUDED.unit_type,
            storage_type = EXCLUDED.storage_type,
            material_type = EXCLUDED.material_type,
            category = EXCLUDED.category,
            handling_unit_type = EXCLUDED.handling_unit_type,
            units_per_handling_unit = EXCLUDED.units_per_handling_unit,
            min_order_quantity = EXCLUDED.min_order_quantity,
            order_multiple = EXCLUDED.order_multiple,
            order_delivery_days = EXCLUDED.order_delivery_days,
            length_cm = EXCLUDED.length_cm,
            width_cm = EXCLUDED.width_cm,
            height_cm = EXCLUDED.height_cm,
            weight_kg = EXCLUDED.weight_kg,
            volume_cm3 = EXCLUDED.volume_cm3,
            units_per_pallet = EXCLUDED.units_per_pallet,
            pallet_spaces = EXCLUDED.pallet_spaces,
            stackable = EXCLUDED.stackable,
            max_pallet_weight_kg = EXCLUDED.max_pallet_weight_kg,
            max_stack_height = EXCLUDED.max_stack_height,
            temperature_controlled = EXCLUDED.temperature_controlled,
            hazardous = EXCLUDED.hazardous,
            fragile = EXCLUDED.fragile,
            shelf_life_days = EXCLUDED.shelf_life_days,
            unit_cost_standard = EXCLUDED.unit_cost_standard,
            requires_pallet = EXCLUDED.requires_pallet,
            data_quality_tier = EXCLUDED.data_quality_tier,
            synthetic_ratio = EXCLUDED.synthetic_ratio,
            decision_eligible = EXCLUDED.decision_eligible,
            source_lineage = EXCLUDED.source_lineage,
            updated_at = now()
        """,
        rows,
        page_size=500,
    )
    codes = [row[0] for row in rows]
    cur.execute("SELECT material_code, id::text FROM materials WHERE material_code = ANY(%s)", (codes,))
    return dict(cur.fetchall())


def load_locations(cur, locations: pd.DataFrame, warehouse_id: str, digest: str) -> int:
    locations = align_operational_apron(locations)
    locations = align_velocity_zones_to_doors(locations)
    rows = [(
        row.location_id, warehouse_id, row.location_code, row.area,
        str(row.row_number).zfill(2), str(row.bay_number).zfill(2),
        int(row.level_number), row.bin_position, row.location_type, row.zone_type,
        float(row.capacity), True, int(row.accessibility_rating),
        float(row.coordinate_x), float(row.coordinate_y), float(row.coordinate_z),
        int(row.max_pallet_capacity), 0, float(row.max_weight_kg),
        float(row.max_volume_cm3), row.temperature_zone, bool(row.hazard_allowed),
        None if pd.isna(row.physical_class) else row.physical_class,
        DATASET_VERSION, Json({
            **lineage("physical_layout", digest),
            "operational_apron_method": "separated_function_lanes_v1",
            "velocity_zone_method": "nearest_door_manhattan_tercile_v1",
        }),
    ) for row in locations.itertuples(index=False)]
    execute_values(cur, """
        INSERT INTO locations(
            id,warehouse_id,location_code,area,row_number,bay_number,level_number,
            bin_position,location_type,zone_type,capacity,is_active,accessibility_rating,
            coordinate_x,coordinate_y,coordinate_z,max_pallet_capacity,current_pallet_count,
            max_weight_kg,max_volume_cm3,temperature_zone,hazard_allowed,amalgamated_class,
            dataset_version,source_lineage
        ) VALUES %s
        ON CONFLICT(location_code) DO UPDATE SET
            warehouse_id=EXCLUDED.warehouse_id,area=EXCLUDED.area,
            row_number=EXCLUDED.row_number,bay_number=EXCLUDED.bay_number,
            level_number=EXCLUDED.level_number,bin_position=EXCLUDED.bin_position,
            location_type=EXCLUDED.location_type,zone_type=EXCLUDED.zone_type,
            capacity=EXCLUDED.capacity,is_active=TRUE,
            accessibility_rating=EXCLUDED.accessibility_rating,
            coordinate_x=EXCLUDED.coordinate_x,coordinate_y=EXCLUDED.coordinate_y,
            coordinate_z=EXCLUDED.coordinate_z,max_pallet_capacity=EXCLUDED.max_pallet_capacity,
            max_weight_kg=EXCLUDED.max_weight_kg,max_volume_cm3=EXCLUDED.max_volume_cm3,
            temperature_zone=EXCLUDED.temperature_zone,
            hazard_allowed=EXCLUDED.hazard_allowed,
            amalgamated_class=EXCLUDED.amalgamated_class,
            dataset_version=EXCLUDED.dataset_version,source_lineage=EXCLUDED.source_lineage
    """, rows, page_size=1000)
    current_codes = locations["location_code"].tolist()
    # Locations have no data-quality-tier column. Historical generators left a
    # large null-lineage population active, so the only safe operational scope
    # is the exact immutable v8 layout. Rows are archived, never deleted.
    cur.execute("""
        UPDATE locations
        SET is_active=FALSE, dataset_version='ARCHIVED_PRE_V8_LAYOUT'
        WHERE warehouse_id=%s
          AND NOT (location_code=ANY(%s))
    """, (warehouse_id, current_codes))
    cur.execute(
        "UPDATE warehouses SET dataset_version=%s, updated_at=now() WHERE id=%s",
        (DATASET_VERSION, warehouse_id),
    )
    return len(rows)


def load_suppliers(cur, materials: pd.DataFrame, material_ids: dict[str, str], digest: str) -> int:
    supplier_rows = []
    for idx in range(1, 13):
        supplier_rows.append((
            f"PRJ-SUP-{idx:03d}", f"Project Operations Supplier {idx:03d}",
            f"supplier{idx:03d}@project.invalid", "+94-11-555-%04d" % idx,
            int(7 + (idx * 3) % 35), 4.0 + (idx % 5) * 0.2, "active",
            QUALITY_TIER, Json(lineage("suppliers", digest)),
        ))
    execute_values(cur, """
        INSERT INTO suppliers(code, name, email, phone, lead_time_days, rating, status, data_quality_tier, source_lineage)
        VALUES %s
        ON CONFLICT (code) DO UPDATE SET
            name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone,
            lead_time_days=EXCLUDED.lead_time_days, rating=EXCLUDED.rating,
            status=EXCLUDED.status, data_quality_tier=EXCLUDED.data_quality_tier,
            source_lineage=EXCLUDED.source_lineage
        """, supplier_rows)
    cur.execute("SELECT code, id::text FROM suppliers WHERE code LIKE 'PRJ-SUP-%'")
    supplier_ids = dict(cur.fetchall())
    cur.execute(
        "DELETE FROM supplier_materials WHERE material_id = ANY(%s::uuid[])",
        (list(material_ids.values()),),
    )
    links = []
    for idx, row in enumerate(materials.itertuples(index=False)):
        supplier_code = f"PRJ-SUP-{idx % 12 + 1:03d}"
        links.append((supplier_ids[supplier_code], material_ids[row.material_code]))
    execute_values(cur, """
        INSERT INTO supplier_materials(supplier_id, material_id) VALUES %s
        ON CONFLICT (supplier_id, material_id) DO NOTHING
        """, links)
    return len(supplier_rows)


def load_bom(cur, bom: pd.DataFrame, finished_goods: pd.DataFrame, material_ids: dict[str, str], warehouse_id: str, digest: str) -> int:
    fg_map = dict(zip(finished_goods["fg_id"], finished_goods["fg_code"]))
    # Source material IDs are resolved through the generated material table below.
    source_materials = pd.read_csv(source_dir() / "data/materials.csv")
    source_code_map = dict(zip(source_materials["material_id"], source_materials["material_code"]))
    cur.execute("DELETE FROM bom_headers WHERE version = %s AND warehouse_id = %s", (BOM_VERSION, warehouse_id))
    inserted = 0
    for fg_id, group in bom.groupby("fg_id"):
        parent_code = fg_map[int(fg_id)]
        cur.execute(
            """
            INSERT INTO bom_headers(
                parent_material_id, warehouse_id, version, status, effective_from, notes,
                data_quality_tier, synthetic_ratio, decision_eligible, source_lineage
            ) VALUES (%s, %s, %s, 'active', %s, %s, %s, 1.0, TRUE, %s)
            RETURNING id::text
            """,
            (
                material_ids[parent_code], warehouse_id, BOM_VERSION,
                str(group.iloc[0]["effective_from"]),
                "Complete project-operational simulation BOM",
                QUALITY_TIER, Json(lineage("bom_headers", digest)),
            ),
        )
        header_id = cur.fetchone()[0]
        component_rows = []
        for row in group.itertuples(index=False):
            code = source_code_map[int(row.material_id)]
            component_rows.append((
                header_id, material_ids[code],
                "packaging_material" if code.startswith("PM-") else "raw_material",
                float(row.quantity_per_fg), float(row.scrap_rate),
                int(source_materials.loc[source_materials.material_id.eq(row.material_id), "lead_time_days"].iloc[0]),
                "EA" if code.startswith("PM-") else "KG",
            ))
        execute_values(cur, """
            INSERT INTO bom_components(
                bom_header_id, component_material_id, component_type,
                qty_per_parent, scrap_rate, lead_time_days, uom
            ) VALUES %s
            """, component_rows)
        inserted += len(component_rows)
    return inserted


def load_demand(
    cur,
    demand: pd.DataFrame,
    production: pd.DataFrame,
    finished_goods: pd.DataFrame,
    material_ids: dict[str, str],
    warehouse_id: str,
    digest: str,
) -> int:
    cur.execute("DELETE FROM demand_history WHERE warehouse_id = %s AND source = %s", (warehouse_id, DEMAND_SOURCE))
    rows = [(
        material_ids[row.material_code], warehouse_id, str(pd.Timestamp(row.month).date()),
        float(row.demand_units), bool(row.promotion_flag), bool(row.holiday_flag),
        float(row.lead_time_days), None, DEMAND_SOURCE, QUALITY_TIER, 1.0, True,
        Json(lineage("demand_history", digest)),
    ) for row in demand.itertuples(index=False)]
    fg_codes = dict(zip(finished_goods["fg_id"], finished_goods["fg_code"]))
    rows.extend((
        material_ids[fg_codes[int(row.fg_id)]], warehouse_id,
        str(pd.Timestamp(row.month).date()), float(row.actual_fg_units),
        bool(row.promotion_flag), bool(row.holiday_flag), 1.0, None,
        DEMAND_SOURCE, QUALITY_TIER, 1.0, True,
        Json(lineage("finished_good_demand_history", digest)),
    ) for row in production.itertuples(index=False))
    execute_values(cur, """
        INSERT INTO demand_history(
            material_id, warehouse_id, period, demand_units, promotion_flag, holiday_flag,
            lead_time_days, on_hand_inventory, source, data_quality_tier,
            synthetic_ratio, decision_eligible, source_lineage
        ) VALUES %s
        """, rows, page_size=2000)
    return len(rows)


def load_inventory(
    cur,
    inventory: pd.DataFrame,
    physical: pd.DataFrame,
    material_ids: dict[str, str],
    warehouse_id: str,
    digest: str,
) -> int:
    actual_ids = list(material_ids.values())
    cur.execute("""
        DELETE FROM inventory
        WHERE warehouse_id=%s
          AND material_id=ANY(%s::uuid[])
          AND data_quality_tier IN (%s, 'GENERATED_OPERATIONAL_BASELINE')
    """, (warehouse_id, actual_ids, QUALITY_TIER))
    physical_index = physical.set_index("material_code")
    rows = []
    for row in inventory.itertuples(index=False):
        material = physical_index.loc[row.material_code]
        expiry = (
            pd.Timestamp("2025-12-31") + pd.Timedelta(days=int(material.shelf_life_days))
        ).date().isoformat()
        rows.append((
            row.inventory_key, material_ids[row.material_code], warehouse_id,
            row.location_code, int(round(row.quantity)), int(round(row.available_quantity)),
            int(round(row.reserved_quantity)), float(row.buffer_stock), float(row.max_stock),
            float(row.min_stock), float(row.reorder_point),
            float(material.min_order_quantity), int(material.lead_time_days),
            f"V8-{row.material_code}-{row.location_code}", expiry,
            int(material.lead_time_days), float(row.order_quantity),
            float(row.pallet_requirement), int(row.stacking_quantity), row.status,
            row.material_type, QUALITY_TIER, Json(lineage("physical_inventory", digest)),
        ))
    execute_values(cur, """
        INSERT INTO inventory(
            id,material_id,warehouse_id,location_code,quantity,available_quantity,
            reserved_quantity,buffer_stock,max_stock,min_stock,reorder_point,moq,
            lead_time_days,batch_number,expiry_date,order_delivery_days,order_quantity,
            pallet_requirement,stacking_quantity,status,material_type,data_quality_tier,
            source_lineage
        ) VALUES %s
        ON CONFLICT(id) DO UPDATE SET
            material_id=EXCLUDED.material_id,warehouse_id=EXCLUDED.warehouse_id,
            location_code=EXCLUDED.location_code,quantity=EXCLUDED.quantity,
            available_quantity=EXCLUDED.available_quantity,
            reserved_quantity=EXCLUDED.reserved_quantity,
            buffer_stock=EXCLUDED.buffer_stock,max_stock=EXCLUDED.max_stock,
            min_stock=EXCLUDED.min_stock,reorder_point=EXCLUDED.reorder_point,
            moq=EXCLUDED.moq,lead_time_days=EXCLUDED.lead_time_days,
            batch_number=EXCLUDED.batch_number,expiry_date=EXCLUDED.expiry_date,
            order_delivery_days=EXCLUDED.order_delivery_days,
            order_quantity=EXCLUDED.order_quantity,
            pallet_requirement=EXCLUDED.pallet_requirement,
            stacking_quantity=EXCLUDED.stacking_quantity,status=EXCLUDED.status,
            material_type=EXCLUDED.material_type,
            data_quality_tier=EXCLUDED.data_quality_tier,
            source_lineage=EXCLUDED.source_lineage,updated_at=now()
    """, rows, page_size=1000)
    cur.execute("UPDATE locations SET current_pallet_count=0 WHERE warehouse_id=%s", (warehouse_id,))
    cur.execute("""
        UPDATE locations l SET current_pallet_count=x.cnt
        FROM (
            SELECT location_code,COUNT(*)::int cnt
            FROM inventory
            WHERE warehouse_id=%s AND data_quality_tier=%s
            GROUP BY location_code
        ) x
        WHERE l.warehouse_id=%s AND l.location_code=x.location_code
    """, (warehouse_id, QUALITY_TIER, warehouse_id))
    return len(rows)


def load_location_assignments(
    cur,
    assignments: pd.DataFrame,
    material_ids: dict[str, str],
    warehouse_id: str,
) -> int:
    actual_ids = list(material_ids.values())
    cur.execute(
        "DELETE FROM material_default_locations "
        "WHERE warehouse_id=%s AND material_id=ANY(%s::uuid[])",
        (warehouse_id, actual_ids),
    )
    rows = [(
        material_ids[row.material_code], warehouse_id, row.location_code,
        int(row.priority), row.material_type,
        (
            "PROJECT_OPS_V8 PRIMARY_PICK_FACE: forecast and ABC/FMS access slot"
            if row.assignment_role == "PRIMARY_PICK_FACE"
            else "PROJECT_OPS_V8 RESERVE: policy-capacity pallet position"
        ),
    ) for row in assignments.itertuples(index=False)]
    execute_values(cur, """
        INSERT INTO material_default_locations(
            material_id,warehouse_id,location_code,priority,material_type,notes
        ) VALUES %s
        ON CONFLICT(material_id,warehouse_id,location_code) DO UPDATE SET
            priority=EXCLUDED.priority,material_type=EXCLUDED.material_type,
            notes=EXCLUDED.notes,updated_at=now()
    """, rows, page_size=1000)
    return len(rows)


def load_forecasts(cur, forecasts: pd.DataFrame, material_ids: dict[str, str], warehouse_id: str, digest: str) -> int:
    """Publish actual future H1-H12 forecasts, never relabel backtest origins."""
    forecasts = forecasts.copy()
    cur.execute("DELETE FROM forecast_results WHERE warehouse_id = %s AND model_name = %s", (warehouse_id, FORECAST_MODEL))
    rows = []
    for row in forecasts.itertuples(index=False):
        rows.append((
            material_ids[row.material_code], warehouse_id, row.forecast_period, int(row.horizon),
            FORECAST_MODEL, float(row.p10), float(row.p50), float(row.p90),
            "extra_trees_causal_recursive", "v8-operational", "project_ops_v8",
            QUALITY_TIER, 1.0, True, Json(lineage("forecast_results", digest)),
        ))
    execute_values(cur, """
        INSERT INTO forecast_results(
            material_id, warehouse_id, forecast_period, horizon, model_name,
            forecast_p10, forecast_p50, forecast_p90, method, mlflow_run_id,
            training_source, data_quality_tier, synthetic_ratio, decision_eligible, source_lineage
        ) VALUES %s
        """, rows, page_size=2000)
    return len(rows)


def load_backtests(cur, backtests: pd.DataFrame, material_ids: dict[str, str], warehouse_id: str, digest: str) -> int:
    """Publish the promoted model's untouched test rows for dashboard evidence."""
    champion = backtests.loc[backtests["model"].eq("extra_trees_causal")].copy()
    if champion.empty:
        raise RuntimeError("Champion test backtest rows are missing")
    champion["origin_month"] = pd.to_datetime(champion["origin_month"])
    first_test_month = champion["origin_month"].min()
    champion["horizon"] = (
        (champion["origin_month"].dt.year - first_test_month.year) * 12
        + champion["origin_month"].dt.month
        - first_test_month.month
        + 1
    )
    if champion["horizon"].min() != 1 or champion["horizon"].max() != 12:
        raise RuntimeError("Champion test evidence must span horizons 1-12")

    cur.execute(
        "DELETE FROM forecast_backtest_rows "
        "WHERE dataset=%s AND model_name=%s AND warehouse_id=%s AND split='test'",
        (FORECAST_DATASET, FORECAST_MODEL, warehouse_id),
    )
    rows = [(
        FORECAST_DATASET,
        FORECAST_MODEL,
        "test",
        warehouse_id,
        material_ids[row.material_code],
        str(first_test_month.date()),
        int(row.horizon),
        float(row.actual),
        float(row.p05),
        float(row.prediction),
        float(row.p95),
        float(row.error),
        float(row.abs_error),
        bool(row.covered),
        Json(lineage("forecast_backtest_rows_test", digest)),
    ) for row in champion.itertuples(index=False)]
    execute_values(cur, """
        INSERT INTO forecast_backtest_rows(
            dataset, model_name, split, warehouse_id, material_id, origin_month,
            horizon, y_true, forecast_p05, forecast_p50, forecast_p95,
            residual, absolute_error, interval_covered, source_lineage
        ) VALUES %s
    """, rows, page_size=2000)
    return len(rows)


def load_model_evidence(cur, digest: str, warehouse_id: str) -> int:
    """Load locked selection, rolling test, and served-recursive test evidence."""
    summary = json.loads((source_dir() / "run_summary.json").read_text())
    selection = summary["selection_champion_metrics"]
    test = summary["test_champion_metrics"]
    calibration = summary["interval_calibration"]
    recursive = pd.read_csv(source_dir() / "operational_backtest_metrics.csv")
    cur.execute(
        "DELETE FROM forecast_model_evidence WHERE dataset=%s AND model_name=%s AND warehouse_id=%s",
        (FORECAST_DATASET, FORECAST_MODEL, warehouse_id),
    )
    rows = [
        (
            FORECAST_DATASET, FORECAST_MODEL, warehouse_id, "selection", 0,
            int(selection["rows"]), int(selection["materials"]), float(selection["WAPE"]),
            float(selection["MAE"]), float(selection["RMSE"]), float(selection["Bias"]),
            float(selection["under_forecast_rate"]), None, None,
            QUALITY_TIER, 1.0, True, Json(lineage("forecast_model_evidence_selection", digest)),
        ),
        (
            FORECAST_DATASET, FORECAST_MODEL, warehouse_id, "test", 0,
            int(test["rows"]), int(test["materials"]), float(test["WAPE"]),
            float(test["MAE"]), float(test["RMSE"]), float(test["Bias"]),
            float(test["under_forecast_rate"]), float(calibration["nominal_coverage"]),
            float(calibration["empirical_coverage"]), QUALITY_TIER, 1.0, True,
            Json(lineage("forecast_model_evidence_test", digest)),
        ),
    ]
    for item in recursive.itertuples(index=False):
        rows.append(
            (
                FORECAST_DATASET, FORECAST_MODEL, warehouse_id, "recursive_test",
                int(item.horizon), int(item.rows), int(summary["materials"]),
                float(item.WAPE), float(item.MAE), float(item.RMSE), float(item.Bias),
                float(item.under_forecast_rate), None, None,
                QUALITY_TIER, 1.0, True,
                Json(lineage("forecast_model_evidence_recursive_test", digest)),
            )
        )
    execute_values(cur, """
        INSERT INTO forecast_model_evidence(
            dataset, model_name, warehouse_id, split, horizon, evaluation_rows, material_count,
            wape, mae, rmse, bias, under_forecast_rate, interval_nominal_coverage,
            interval_empirical_coverage, data_quality_tier, synthetic_ratio, decision_eligible,
            source_lineage
        ) VALUES %s
    """, rows)
    promotion_gate = {
        "decision": "RETAIN_EXTRA_TREES",
        "decision_scope": "PROJECT_OPERATIONAL_SYNTHETIC_BASELINE",
        "recursive_wape": float(
            recursive.loc[recursive["horizon"].eq(0), "WAPE"].iloc[0]
        ),
        "external_population_validity": "UNVERIFIED",
        "storage_slotting_population_ready": True,
    }
    cur.execute("""
        INSERT INTO forecast_model_registry(
            dataset,model_name,display_name,algorithm,version,status,
            promotion_eligible,promotion_gate,promoted_by,promoted_at,source_lineage
        ) VALUES (%s,%s,%s,%s,%s,'PROMOTED',TRUE,%s,%s,now(),%s)
        ON CONFLICT(dataset,model_name,version) DO UPDATE SET
            display_name=EXCLUDED.display_name,algorithm=EXCLUDED.algorithm,
            status='PROMOTED',promotion_eligible=TRUE,
            promotion_gate=EXCLUDED.promotion_gate,promoted_by=EXCLUDED.promoted_by,
            promoted_at=now(),source_lineage=EXCLUDED.source_lineage,updated_at=now()
    """, (
        FORECAST_DATASET, FORECAST_MODEL, "v8 Project Operations Extra Trees",
        "ExtraTreesRegressor causal recursive H1-H12", DATASET_VERSION,
        Json(promotion_gate), "SYSTEM_V8_EVIDENCE_GATE",
        Json(lineage("forecast_model_registry", digest)),
    ))
    return len(rows)


def refresh_issue_stats(
    cur,
    warehouse_id: str,
    classifications: pd.DataFrame,
    material_ids: dict[str, str],
) -> int:
    cur.execute("""
        DELETE FROM material_issue_stats_rollup mir
        USING materials m
        WHERE mir.material_id = m.id
          AND mir.warehouse_id = %s
          AND m.data_quality_tier = %s
    """, (warehouse_id, QUALITY_TIER))
    cur.execute("""
        DELETE FROM material_issue_stats mis
        USING materials m
        WHERE mis.material_id = m.id
          AND mis.warehouse_id = %s
          AND m.data_quality_tier = %s
    """, (warehouse_id, QUALITY_TIER))
    cur.execute("""
        INSERT INTO material_issue_stats(material_id, warehouse_id, period_month, issue_volume, issue_count)
        SELECT material_id, warehouse_id, period,
               ROUND(demand_units)::bigint,
               CASE WHEN demand_units > 0 THEN 1 ELSE 0 END
        FROM demand_history
        WHERE warehouse_id = %s AND source = %s
    """, (warehouse_id, DEMAND_SOURCE))
    inserted = cur.rowcount
    rollups = [(
        material_ids[row.material_code], warehouse_id,
        int(round(row.issue_volume_12m)), int(row.issue_count_12m),
        row.abc_class, row.fms_class, row.amalgamated_class,
    ) for row in classifications.itertuples(index=False)]
    execute_values(cur, """
        INSERT INTO material_issue_stats_rollup(
            material_id, warehouse_id, issue_volume_12m, issue_count_12m,
            abc_class, fms_class, amalgamated_class, last_refreshed_at
        )
        VALUES %s
        ON CONFLICT (material_id, warehouse_id) DO UPDATE SET
            issue_volume_12m=EXCLUDED.issue_volume_12m,
            issue_count_12m=EXCLUDED.issue_count_12m,
            abc_class=EXCLUDED.abc_class,
            fms_class=EXCLUDED.fms_class,
            amalgamated_class=EXCLUDED.amalgamated_class,
            last_refreshed_at=now()
    """, rollups, template="(%s,%s,%s,%s,%s,%s,%s,now())")
    return inserted


def validate(cur, warehouse_id: str) -> dict:
    cur.execute("""
        SELECT
          (SELECT COUNT(*) FROM materials WHERE data_quality_tier=%s),
          (SELECT COUNT(*) FROM inventory WHERE warehouse_id=%s AND data_quality_tier=%s),
          (SELECT COUNT(*) FROM locations WHERE warehouse_id=%s AND dataset_version=%s AND is_active=TRUE),
          (SELECT COUNT(*) FROM material_default_locations mdl JOIN materials m ON m.id=mdl.material_id
             WHERE mdl.warehouse_id=%s AND m.data_quality_tier=%s),
          (SELECT COUNT(DISTINCT mdl.material_id) FROM material_default_locations mdl JOIN materials m ON m.id=mdl.material_id
             WHERE mdl.warehouse_id=%s AND m.data_quality_tier=%s),
          (SELECT COUNT(*) FROM materials WHERE data_quality_tier=%s AND
             (length_cm IS NULL OR length_cm<=0 OR width_cm IS NULL OR width_cm<=0 OR
              height_cm IS NULL OR height_cm<=0 OR weight_kg IS NULL OR weight_kg<=0 OR
              volume_cm3 IS NULL OR volume_cm3<=0 OR pallet_spaces IS NULL OR pallet_spaces<=0)),
          (SELECT COUNT(*) FROM bom_headers WHERE warehouse_id=%s AND version=%s),
          (SELECT COUNT(*) FROM bom_components bc JOIN bom_headers bh ON bh.id=bc.bom_header_id WHERE bh.warehouse_id=%s AND bh.version=%s),
          (SELECT COUNT(*) FROM demand_history WHERE warehouse_id=%s AND source=%s),
          (SELECT COUNT(*) FROM forecast_results WHERE warehouse_id=%s AND model_name=%s),
          (SELECT COUNT(*) FROM forecast_backtest_rows WHERE warehouse_id=%s AND dataset=%s
             AND model_name=%s AND split='test'),
          (SELECT COUNT(*) FROM forecast_model_evidence WHERE warehouse_id=%s AND dataset=%s AND model_name=%s AND decision_eligible=TRUE),
          (SELECT COUNT(*) FROM forecast_model_registry WHERE dataset=%s AND model_name=%s
             AND version=%s AND status='PROMOTED' AND promotion_eligible=TRUE),
          (SELECT COUNT(*) FROM supplier_materials sm JOIN materials m ON m.id=sm.material_id WHERE m.data_quality_tier=%s),
          (SELECT COUNT(*) FROM material_issue_stats_rollup mir JOIN materials m ON m.id=mir.material_id WHERE mir.warehouse_id=%s AND m.data_quality_tier=%s),
          (SELECT COUNT(*) FROM inventory i JOIN materials m ON m.id=i.material_id JOIN locations l
             ON l.warehouse_id=i.warehouse_id AND l.location_code=i.location_code
             WHERE i.warehouse_id=%s AND i.data_quality_tier=%s AND
               (m.max_pallet_weight_kg>l.max_weight_kg OR
                m.volume_cm3*m.units_per_pallet>l.max_volume_cm3)),
          (SELECT COUNT(*) FROM material_default_locations mdl
             JOIN materials m ON m.id=mdl.material_id
             JOIN locations l ON l.warehouse_id=mdl.warehouse_id AND l.location_code=mdl.location_code
             JOIN material_issue_stats_rollup mir ON mir.material_id=mdl.material_id AND mir.warehouse_id=mdl.warehouse_id
             WHERE mdl.warehouse_id=%s AND m.data_quality_tier=%s
               AND LEFT(mir.amalgamated_class,1)<>LEFT(l.amalgamated_class,1))
    """, (
        QUALITY_TIER, warehouse_id, QUALITY_TIER,
        warehouse_id, DATASET_VERSION,
        warehouse_id, QUALITY_TIER, warehouse_id, QUALITY_TIER,
        QUALITY_TIER, warehouse_id, BOM_VERSION,
        warehouse_id, BOM_VERSION, warehouse_id, DEMAND_SOURCE,
        warehouse_id, FORECAST_MODEL,
        warehouse_id, FORECAST_DATASET, FORECAST_MODEL,
        warehouse_id, FORECAST_DATASET, FORECAST_MODEL,
        FORECAST_DATASET, FORECAST_MODEL, DATASET_VERSION,
        QUALITY_TIER, warehouse_id, QUALITY_TIER,
        warehouse_id, QUALITY_TIER, warehouse_id, QUALITY_TIER,
    ))
    keys = [
        "materials", "inventory", "locations", "location_assignments",
        "assigned_materials", "materials_missing_physical_attributes",
        "bom_headers", "bom_components", "demand_rows", "forecast_rows", "backtest_rows",
        "model_evidence_rows", "promoted_model_rows", "supplier_links", "issue_rollups",
        "inventory_capacity_violations", "assignment_class_violations",
    ]
    results = dict(zip(keys, cur.fetchone()))
    results["passed"] = bool(
        results["materials"] == 144
        and results["locations"] == 4206
        and results["assigned_materials"] == 144
        and results["location_assignments"] == 3257
        and results["materials_missing_physical_attributes"] == 0
        and results["inventory_capacity_violations"] == 0
        and results["assignment_class_violations"] == 0
        and results["demand_rows"] == 10368
        and results["forecast_rows"] == 1440
        and results["backtest_rows"] == 1440
        and results["promoted_model_rows"] == 1
        and results["issue_rollups"] == 144
    )
    return results


def run(db_url: str, warehouse_code: str, dry_run: bool) -> dict:
    out = source_dir()
    files = {
        "materials": out / "data/materials.csv",
        "fg": out / "data/finished_goods.csv",
        "bom": out / "data/bom_components.csv",
        "demand": out / "data/material_demand.csv",
        "production": out / "data/production_plan_actuals.csv",
        "initial": out / "data/initial_inventory.csv",
        "policy": out / "inventory_policy_simulation.csv",
        "forecasts": out / "operational_forecasts.csv",
        "backtests": out / "champion_prediction_intervals.csv",
        "operational_metrics": out / "operational_backtest_metrics.csv",
        "physical": out / "physical_materials.csv",
        "classifications": out / "physical_classifications.csv",
        "layout": out / "physical_layout.csv.gz",
        "assignments": out / "location_assignments.csv.gz",
        "physical_inventory": out / "physical_inventory.csv.gz",
        "slotting_validation": out / "storage_slotting_validation.csv",
    }
    missing = [str(path) for path in files.values() if not path.exists()]
    if missing:
        raise RuntimeError(f"missing v8 artifacts: {missing}")
    digest = dataset_hash(list(files.values()))
    frames = {name: pd.read_csv(path) for name, path in files.items()}
    # Keep display names stable even when loading older statistical artifacts
    # whose immutable codes still carry the original synthetic descriptions.
    frames["physical"] = apply_catalog_names(frames["physical"])
    conn = psycopg2.connect(db_url)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            warehouse_id = resolve_warehouse(cur, warehouse_code)
            cur.execute("""
                INSERT INTO project_dataset_load_audit(dataset_version, dataset_hash, warehouse_id, status, notes)
                VALUES (%s,%s,%s,'running','project operational simulation load') RETURNING id::text
            """, (DATASET_VERSION, digest, warehouse_id))
            audit_id = cur.fetchone()[0]
            material_ids = load_materials(cur, frames["physical"], digest)
            counts = {
                "materials": len(material_ids),
                "locations": load_locations(cur, frames["layout"], warehouse_id, digest),
                "suppliers": load_suppliers(cur, frames["materials"], material_ids, digest),
                "bom_components": load_bom(cur, frames["bom"], frames["fg"], material_ids, warehouse_id, digest),
                "demand_rows": load_demand(
                    cur, frames["demand"], frames["production"], frames["fg"],
                    material_ids, warehouse_id, digest,
                ),
                "inventory_rows": load_inventory(
                    cur, frames["physical_inventory"], frames["physical"],
                    material_ids, warehouse_id, digest,
                ),
                "location_assignments": load_location_assignments(
                    cur, frames["assignments"], material_ids, warehouse_id,
                ),
                "forecast_rows": load_forecasts(cur, frames["forecasts"], material_ids, warehouse_id, digest),
                "backtest_rows": load_backtests(cur, frames["backtests"], material_ids, warehouse_id, digest),
                "model_evidence_rows": load_model_evidence(cur, digest, warehouse_id),
                "issue_stats": refresh_issue_stats(
                    cur, warehouse_id, frames["classifications"], material_ids,
                ),
            }
            validation = validate(cur, warehouse_id)
            if not validation["passed"]:
                raise RuntimeError(f"v8 PostgreSQL validation failed: {validation}")
            cur.execute("""
                UPDATE project_dataset_load_audit
                SET status=%s, row_counts=%s, validation=%s, finished_at=now()
                WHERE id=%s
            """, ("dry_run" if dry_run else "ok", Json(counts), Json(validation), audit_id))
        if dry_run:
            conn.rollback()
        else:
            conn.commit()
        return {
            "status": "dry_run" if dry_run else "ok",
            "dataset_version": DATASET_VERSION,
            "dataset_hash": digest,
            "warehouse_code": warehouse_code,
            "counts": counts,
            "validation": validation,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def run_evidence_only(db_url: str, warehouse_code: str, dry_run: bool) -> dict:
    """Refresh only promoted forecast evidence without rebuilding WMS operations."""
    evidence_files = [
        source_dir() / "champion_prediction_intervals.csv",
        source_dir() / "operational_backtest_metrics.csv",
        source_dir() / "run_summary.json",
    ]
    missing = [str(path) for path in evidence_files if not path.exists()]
    if missing:
        raise RuntimeError(f"missing v8 evidence artifacts: {missing}")
    digest = dataset_hash(evidence_files)
    backtests = pd.read_csv(evidence_files[0])

    conn = psycopg2.connect(db_url)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            warehouse_id = resolve_warehouse(cur, warehouse_code)
            codes = sorted(backtests.loc[backtests["model"].eq("extra_trees_causal"), "material_code"].unique())
            cur.execute(
                "SELECT material_code, id::text FROM materials WHERE material_code=ANY(%s)",
                (codes,),
            )
            material_ids = dict(cur.fetchall())
            missing_codes = sorted(set(codes) - set(material_ids))
            if missing_codes:
                raise RuntimeError(f"forecast evidence materials are missing: {missing_codes[:10]}")
            counts = {
                "backtest_rows": load_backtests(cur, backtests, material_ids, warehouse_id, digest),
                "model_evidence_rows": load_model_evidence(cur, digest, warehouse_id),
            }
        if dry_run:
            conn.rollback()
        else:
            conn.commit()
        return {
            "status": "dry_run" if dry_run else "ok",
            "dataset_version": DATASET_VERSION,
            "warehouse_code": warehouse_code,
            "counts": counts,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Load the coherent project-operational simulation into OptiWMS PostgreSQL.")
    parser.add_argument("--db-url", default="postgresql://optiwms:optiwms@localhost:5434/optiwms")
    parser.add_argument("--warehouse-code", default="WH-001")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--evidence-only",
        action="store_true",
        help="Refresh promoted model metrics/backtests without rebuilding operational data",
    )
    args = parser.parse_args()
    action = run_evidence_only if args.evidence_only else run
    print(json.dumps(action(args.db_url, args.warehouse_code, args.dry_run), indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
