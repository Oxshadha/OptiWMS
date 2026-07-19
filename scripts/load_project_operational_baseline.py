#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import uuid
from pathlib import Path
from typing import Iterable

import pandas as pd
import numpy as np
import psycopg2
from psycopg2.extras import Json, execute_values


DATASET_VERSION = "PROJECT_OPERATIONAL_BASELINE_V3"
ARCHIVE_DATASET_VERSION = f"{DATASET_VERSION}_ARCHIVE"
QUALITY_TIER = "GENERATED_OPERATIONAL_BASELINE"
FORECAST_DATASET = "PROJECT_OPERATIONAL_BASELINE_RM_PM"
BOM_VERSION = "PROJECT_OPERATIONAL_BASELINE_V3"
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "Ai miroservices/modeling/project_operational_baseline/outputs"


def read(source: Path, name: str) -> pd.DataFrame:
    path = source / f"{name}.csv.gz"
    if not path.exists():
        raise RuntimeError(f"Missing baseline artifact: {path}")
    return pd.read_csv(path)


def value(raw):
    if raw is None or (isinstance(raw, float) and math.isnan(raw)) or raw == "":
        return None
    if isinstance(raw, (np_bool := type(pd.Series([True]).iloc[0]),)):
        return bool(raw)
    if hasattr(raw, "item"):
        return raw.item()
    return raw


def lineage(manifest: dict, table: str) -> Json:
    return Json({
        "dataset_version": DATASET_VERSION,
        "quality_tier": QUALITY_TIER,
        "dataset_hash": manifest["dataset_hash"],
        "source_table": table,
        "seed": manifest["seed"],
        "source_type": "generated_operational_baseline",
    })


def batches(rows: list[tuple], size: int = 2000) -> Iterable[list[tuple]]:
    for start in range(0, len(rows), size):
        yield rows[start:start + size]


def execute_batched(cur, sql: str, rows: list[tuple], page_size: int = 2000) -> None:
    for batch in batches(rows, page_size):
        execute_values(cur, sql, batch, page_size=page_size)


def require_contract(cur) -> None:
    required = [
        "material_classification_runs", "forecast_backtest_rows", "forecast_model_registry",
        "forecast_jobs", "inventory_policy_simulation_evidence",
    ]
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY(%s)", (required,))
    found = {row[0] for row in cur.fetchall()}
    missing = sorted(set(required) - found)
    if missing:
        raise RuntimeError(f"Database contract V73 is not applied; missing tables: {missing}")


def resolve_warehouse(cur, warehouse: pd.Series, manifest: dict) -> str:
    cur.execute("SELECT id::text FROM warehouses WHERE code=%s", (warehouse.code,))
    row = cur.fetchone()
    if row:
        warehouse_id = row[0]
        cur.execute(
            "UPDATE warehouses SET name=%s, city=%s, country=%s, status=%s, dataset_version=%s, source_lineage=%s, updated_at=now() WHERE id=%s",
            (warehouse["name"], warehouse.city, warehouse.country, warehouse.status, DATASET_VERSION, lineage(manifest, "warehouses"), warehouse_id),
        )
        return warehouse_id
    cur.execute(
        "INSERT INTO warehouses(id,code,name,city,country,status,dataset_version,source_lineage) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id::text",
        (warehouse.warehouse_id, warehouse.code, warehouse["name"], warehouse.city, warehouse.country, warehouse.status, DATASET_VERSION, lineage(manifest, "warehouses")),
    )
    return cur.fetchone()[0]


def load_materials(cur, source: Path, manifest: dict) -> tuple[dict[str, str], dict[str, str]]:
    materials = read(source, "materials")
    fg = read(source, "finished_goods")
    combined = pd.concat([materials, fg], ignore_index=True, sort=False)
    current_codes = combined.material_code.tolist()
    cur.execute("""
        UPDATE materials
        SET data_quality_tier='ARCHIVED_GENERATED_BASELINE',updated_at=now()
        WHERE data_quality_tier=%s
          AND NOT (material_code=ANY(%s))
    """, (QUALITY_TIER, current_codes))
    rows = []
    for item in combined.itertuples(index=False):
        rows.append((
            item.material_id, item.material_code, item.description, item.unit_type, item.storage_type,
            item.material_type, item.category, item.handling_unit_type, float(item.units_per_handling_unit),
            float(item.order_multiple), float(item.min_order_quantity), int(item.lead_time_days),
            float(item.length_cm), float(item.width_cm), float(item.height_cm), float(item.weight_kg),
            float(item.volume_cm3), float(item.units_per_pallet), float(item.pallet_spaces), bool(item.stackable),
            float(item.max_pallet_weight_kg), int(item.max_stack_height), bool(item.temperature_controlled), bool(item.hazardous), bool(item.fragile),
            int(item.shelf_life_days), float(item.unit_cost), True, QUALITY_TIER, 1.0, True,
            lineage(manifest, "materials"),
        ))
    execute_batched(cur, """
        INSERT INTO materials(
            id,material_code,description,unit_type,storage_type,material_type,category,
            handling_unit_type,units_per_handling_unit,order_multiple,min_order_quantity,
            order_delivery_days,length_cm,width_cm,height_cm,weight_kg,volume_cm3,units_per_pallet,
            pallet_spaces,stackable,max_pallet_weight_kg,max_stack_height,temperature_controlled,hazardous,fragile,
            shelf_life_days,unit_cost_standard,requires_pallet,data_quality_tier,synthetic_ratio,
            decision_eligible,source_lineage
        ) VALUES %s
        ON CONFLICT(material_code) DO UPDATE SET
            description=EXCLUDED.description,unit_type=EXCLUDED.unit_type,storage_type=EXCLUDED.storage_type,
            material_type=EXCLUDED.material_type,category=EXCLUDED.category,
            handling_unit_type=EXCLUDED.handling_unit_type,units_per_handling_unit=EXCLUDED.units_per_handling_unit,
            order_multiple=EXCLUDED.order_multiple,min_order_quantity=EXCLUDED.min_order_quantity,
            order_delivery_days=EXCLUDED.order_delivery_days,length_cm=EXCLUDED.length_cm,width_cm=EXCLUDED.width_cm,
            height_cm=EXCLUDED.height_cm,weight_kg=EXCLUDED.weight_kg,volume_cm3=EXCLUDED.volume_cm3,
            units_per_pallet=EXCLUDED.units_per_pallet,pallet_spaces=EXCLUDED.pallet_spaces,
            stackable=EXCLUDED.stackable,max_pallet_weight_kg=EXCLUDED.max_pallet_weight_kg,
            max_stack_height=EXCLUDED.max_stack_height,
            temperature_controlled=EXCLUDED.temperature_controlled,hazardous=EXCLUDED.hazardous,
            fragile=EXCLUDED.fragile,shelf_life_days=EXCLUDED.shelf_life_days,
            unit_cost_standard=EXCLUDED.unit_cost_standard,requires_pallet=EXCLUDED.requires_pallet,
            data_quality_tier=EXCLUDED.data_quality_tier,synthetic_ratio=EXCLUDED.synthetic_ratio,
            decision_eligible=EXCLUDED.decision_eligible,source_lineage=EXCLUDED.source_lineage,updated_at=now()
    """, rows)
    codes = current_codes
    cur.execute("SELECT material_code,id::text FROM materials WHERE material_code=ANY(%s)", (codes,))
    code_to_id = dict(cur.fetchall())
    generated_to_actual = dict(zip(combined.material_id, combined.material_code.map(code_to_id)))
    return code_to_id, generated_to_actual


def load_locations(cur, source: Path, manifest: dict, warehouse_id: str) -> int:
    frame = read(source, "locations")
    frame["amalgamated_class"] = frame.get("physical_class")
    rows = [(
        row.location_id, warehouse_id, row.location_code, row.area, str(row.row_number).zfill(2),
        str(row.bay_number).zfill(2), int(row.level_number), row.bin_position, row.location_type,
        row.zone_type, float(row.capacity), True, int(row.accessibility_rating), float(row.coordinate_x),
        float(row.coordinate_y), float(row.coordinate_z), int(row.max_pallet_capacity), 0,
        float(row.max_weight_kg), float(row.max_volume_cm3), row.temperature_zone,
        bool(row.hazard_allowed), value(row.amalgamated_class), DATASET_VERSION, lineage(manifest, "locations"),
    ) for row in frame.itertuples(index=False)]
    execute_batched(cur, """
        INSERT INTO locations(
            id,warehouse_id,location_code,area,row_number,bay_number,level_number,bin_position,
            location_type,zone_type,capacity,is_active,accessibility_rating,coordinate_x,coordinate_y,
            coordinate_z,max_pallet_capacity,current_pallet_count,max_weight_kg,max_volume_cm3,
            temperature_zone,hazard_allowed,amalgamated_class,dataset_version,source_lineage
        ) VALUES %s
        ON CONFLICT(location_code) DO UPDATE SET
            warehouse_id=EXCLUDED.warehouse_id,area=EXCLUDED.area,row_number=EXCLUDED.row_number,
            bay_number=EXCLUDED.bay_number,level_number=EXCLUDED.level_number,bin_position=EXCLUDED.bin_position,
            location_type=EXCLUDED.location_type,zone_type=EXCLUDED.zone_type,capacity=EXCLUDED.capacity,
            is_active=EXCLUDED.is_active,accessibility_rating=EXCLUDED.accessibility_rating,
            coordinate_x=EXCLUDED.coordinate_x,coordinate_y=EXCLUDED.coordinate_y,coordinate_z=EXCLUDED.coordinate_z,
            max_pallet_capacity=EXCLUDED.max_pallet_capacity,max_weight_kg=EXCLUDED.max_weight_kg,
            max_volume_cm3=EXCLUDED.max_volume_cm3,temperature_zone=EXCLUDED.temperature_zone,
            hazard_allowed=EXCLUDED.hazard_allowed,amalgamated_class=EXCLUDED.amalgamated_class,
            dataset_version=EXCLUDED.dataset_version,
            source_lineage=EXCLUDED.source_lineage
    """, rows)
    return len(rows)


def remove_stale_generated_locations(cur, source: Path, warehouse_id: str) -> int:
    current_codes = read(source, "locations").location_code.tolist()
    cur.execute("""
        UPDATE locations
        SET is_active=false,dataset_version=%s
        WHERE warehouse_id=%s
          AND COALESCE(source_lineage->>'source_type','')='generated_operational_baseline'
          AND NOT (location_code=ANY(%s))
    """, (ARCHIVE_DATASET_VERSION, warehouse_id, current_codes))
    return cur.rowcount


def load_partners(cur, source: Path, manifest: dict, warehouse_id: str) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    suppliers = read(source, "suppliers")
    supplier_rows = [(
        row.supplier_id,row.code,row.name,row.email,row.phone,int(row.lead_time_days),float(row.rating),row.status,
        QUALITY_TIER,lineage(manifest,"suppliers"),
    ) for row in suppliers.itertuples(index=False)]
    execute_batched(cur, """
        INSERT INTO suppliers(id,code,name,email,phone,lead_time_days,rating,status,data_quality_tier,source_lineage)
        VALUES %s ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,phone=EXCLUDED.phone,
        lead_time_days=EXCLUDED.lead_time_days,rating=EXCLUDED.rating,status=EXCLUDED.status,
        data_quality_tier=EXCLUDED.data_quality_tier,source_lineage=EXCLUDED.source_lineage
    """, supplier_rows)
    cur.execute("SELECT code,id::text FROM suppliers WHERE code=ANY(%s)", (suppliers.code.tolist(),))
    supplier_code_to_id = dict(cur.fetchall())
    supplier_map = dict(zip(suppliers.supplier_id, suppliers.code.map(supplier_code_to_id)))

    customers = read(source, "customers")
    customer_rows = [(
        row.customer_id,row.code,row.name,row.city,row.country,row.status,DATASET_VERSION,lineage(manifest,"customers"),
    ) for row in customers.itertuples(index=False)]
    execute_batched(cur, """
        INSERT INTO customers(id,code,name,city,country,status,dataset_version,source_lineage) VALUES %s
        ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,city=EXCLUDED.city,country=EXCLUDED.country,
        status=EXCLUDED.status,dataset_version=EXCLUDED.dataset_version,source_lineage=EXCLUDED.source_lineage
    """, customer_rows)
    cur.execute("SELECT code,id::text FROM customers WHERE code=ANY(%s)", (customers.code.tolist(),))
    customer_code_to_id = dict(cur.fetchall())
    customer_map = dict(zip(customers.customer_id, customers.code.map(customer_code_to_id)))

    users = read(source, "users")
    user_rows = [(
        row.user_id,row.username,row.email,row.password_hash,f"POB-{row.employee_id}",row.first_name,row.last_name,
        row.role,warehouse_id,row.status,DATASET_VERSION,lineage(manifest,"users"),
    ) for row in users.itertuples(index=False)]
    execute_batched(cur, """
        INSERT INTO users(id,username,email,password_hash,employee_id,first_name,last_name,role,warehouse_id,status,dataset_version,source_lineage)
        VALUES %s ON CONFLICT(username) DO UPDATE SET email=EXCLUDED.email,employee_id=EXCLUDED.employee_id,
        first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,role=EXCLUDED.role,warehouse_id=EXCLUDED.warehouse_id,
        status=EXCLUDED.status,dataset_version=EXCLUDED.dataset_version,source_lineage=EXCLUDED.source_lineage
    """, user_rows)
    cur.execute("SELECT username,id::text FROM users WHERE username=ANY(%s)", (users.username.tolist(),))
    user_name_to_id = dict(cur.fetchall())
    user_map = dict(zip(users.user_id, users.username.map(user_name_to_id)))
    return supplier_map, customer_map, user_map


def load_supplier_links(cur, source: Path, generated_material_map: dict[str, str], supplier_map: dict[str, str]) -> int:
    frame = read(source, "supplier_materials")
    rows = [(
        supplier_map[row.supplier_id], generated_material_map[row.material_id], float(row.min_order_quantity),
        float(row.order_multiple), float(row.units_per_handling_unit), int(row.lead_time_days), bool(row.preferred),
    ) for row in frame.itertuples(index=False)]
    execute_batched(cur, """
        INSERT INTO supplier_materials(supplier_id,material_id,minimum_order_quantity,order_multiple,units_per_handling_unit,lead_time_days,preferred)
        VALUES %s ON CONFLICT(supplier_id,material_id) DO UPDATE SET
        minimum_order_quantity=EXCLUDED.minimum_order_quantity,order_multiple=EXCLUDED.order_multiple,
        units_per_handling_unit=EXCLUDED.units_per_handling_unit,lead_time_days=EXCLUDED.lead_time_days,
        preferred=EXCLUDED.preferred
    """, rows)
    return len(rows)


def load_bom(cur, source: Path, manifest: dict, warehouse_id: str, material_map: dict[str, str]) -> tuple[int, int]:
    frame = read(source, "bom_components")
    headers = frame[["bom_id","parent_material_id","effective_from"]].drop_duplicates()
    header_rows = [(
        row.bom_id,material_map[row.parent_material_id],warehouse_id,BOM_VERSION,"active",row.effective_from,
        "Complete generated operational BOM",QUALITY_TIER,1.0,True,lineage(manifest,"bom_headers"),
    ) for row in headers.itertuples(index=False)]
    execute_batched(cur, """
        INSERT INTO bom_headers(id,parent_material_id,warehouse_id,version,status,effective_from,notes,data_quality_tier,synthetic_ratio,decision_eligible,source_lineage)
        VALUES %s ON CONFLICT(parent_material_id,(COALESCE(warehouse_id,'00000000-0000-0000-0000-000000000000'::uuid)),version)
        DO UPDATE SET status=EXCLUDED.status,effective_from=EXCLUDED.effective_from,notes=EXCLUDED.notes,
        data_quality_tier=EXCLUDED.data_quality_tier,synthetic_ratio=EXCLUDED.synthetic_ratio,
        decision_eligible=EXCLUDED.decision_eligible,source_lineage=EXCLUDED.source_lineage,updated_at=now()
    """, header_rows)
    cur.execute("SELECT parent_material_id::text,id::text FROM bom_headers WHERE warehouse_id=%s AND version=%s", (warehouse_id,BOM_VERSION))
    parent_to_header = dict(cur.fetchall())
    material_master = pd.concat([read(source,"materials"),read(source,"finished_goods")],ignore_index=True,sort=False).set_index("material_id")
    component_rows = []
    for row in frame.itertuples(index=False):
        parent_id = material_map[row.parent_material_id]
        component = material_master.loc[row.component_material_id]
        component_rows.append((
            stable_component_id(parent_to_header[parent_id],material_map[row.component_material_id]),
            parent_to_header[parent_id],material_map[row.component_material_id],row.component_type,
            float(row.quantity_per_fg),float(row.scrap_rate),int(component.lead_time_days),row.uom,
        ))
    execute_batched(cur, """
        INSERT INTO bom_components(id,bom_header_id,component_material_id,component_type,qty_per_parent,scrap_rate,lead_time_days,uom)
        VALUES %s ON CONFLICT(bom_header_id,component_material_id) DO UPDATE SET
        component_type=EXCLUDED.component_type,qty_per_parent=EXCLUDED.qty_per_parent,
        scrap_rate=EXCLUDED.scrap_rate,lead_time_days=EXCLUDED.lead_time_days,uom=EXCLUDED.uom,updated_at=now()
    """, component_rows)
    return len(header_rows),len(component_rows)


def stable_component_id(header_id: str, component_id: str) -> str:
    return str(uuid.uuid5(uuid.UUID("d5cb9130-f1cf-42ef-b837-90751b12ab5d"),f"{header_id}:{component_id}"))


def load_demand_and_inventory(cur, source: Path, manifest: dict, warehouse_id: str, material_map: dict[str, str]) -> tuple[int,int]:
    demand = read(source,"demand_history")
    demand_rows = [(
        material_map[row.material_id],warehouse_id,row.month,round(float(row.demand_units),2),bool(row.promotion_flag),
        False,float(row.lead_time_days),None,DATASET_VERSION,QUALITY_TIER,1.0,True,lineage(manifest,"demand_history"),
    ) for row in demand.itertuples(index=False)]
    production = read(source, "production_history")
    demand_rows.extend((
        material_map[row.parent_material_id], warehouse_id, row.month, round(float(row.actual_fg_units), 2),
        bool(row.promotion_flag), False, 1.0, None, DATASET_VERSION, QUALITY_TIER, 1.0, True,
        lineage(manifest, "production_history"),
    ) for row in production.itertuples(index=False))
    execute_batched(cur, """
        INSERT INTO demand_history(material_id,warehouse_id,period,demand_units,promotion_flag,holiday_flag,lead_time_days,on_hand_inventory,source,data_quality_tier,synthetic_ratio,decision_eligible,source_lineage)
        VALUES %s ON CONFLICT(material_id,(COALESCE(warehouse_id,'00000000-0000-0000-0000-000000000000'::uuid)),period)
        DO UPDATE SET demand_units=EXCLUDED.demand_units,promotion_flag=EXCLUDED.promotion_flag,
        lead_time_days=EXCLUDED.lead_time_days,source=EXCLUDED.source,data_quality_tier=EXCLUDED.data_quality_tier,
        synthetic_ratio=EXCLUDED.synthetic_ratio,decision_eligible=EXCLUDED.decision_eligible,source_lineage=EXCLUDED.source_lineage
    """,demand_rows)
    return len(demand_rows), load_inventory(cur, source, manifest, warehouse_id, material_map)


def load_inventory(cur, source: Path, manifest: dict, warehouse_id: str, material_map: dict[str, str]) -> int:
    inventory = read(source,"inventory")
    cur.execute(
        "DELETE FROM inventory WHERE warehouse_id=%s AND data_quality_tier=%s",
        (warehouse_id, QUALITY_TIER),
    )
    rows = [(
        row.inventory_id,material_map[row.material_id],warehouse_id,row.location_code,int(round(row.quantity)),
        int(round(row.available_quantity)),int(round(row.reserved_quantity)),float(row.buffer_stock),float(row.max_stock),
        float(row.min_stock),float(row.reorder_point),float(row.moq),int(row.lead_time_days),row.batch_number,row.expiry_date,
        int(row.lead_time_days),float(row.order_quantity),float(row.pallet_requirement),int(row.stacking_quantity),
        row.status,row.material_type,QUALITY_TIER,
        lineage(manifest,"inventory"),
    ) for row in inventory.itertuples(index=False)]
    execute_batched(cur, """
        INSERT INTO inventory(id,material_id,warehouse_id,location_code,quantity,available_quantity,reserved_quantity,
        buffer_stock,max_stock,min_stock,reorder_point,moq,lead_time_days,batch_number,expiry_date,order_delivery_days,
        order_quantity,pallet_requirement,stacking_quantity,status,material_type,data_quality_tier,source_lineage)
        VALUES %s ON CONFLICT(id) DO UPDATE SET location_code=EXCLUDED.location_code,quantity=EXCLUDED.quantity,
        available_quantity=EXCLUDED.available_quantity,reserved_quantity=EXCLUDED.reserved_quantity,
        buffer_stock=EXCLUDED.buffer_stock,max_stock=EXCLUDED.max_stock,min_stock=EXCLUDED.min_stock,
        reorder_point=EXCLUDED.reorder_point,moq=EXCLUDED.moq,lead_time_days=EXCLUDED.lead_time_days,
        batch_number=EXCLUDED.batch_number,expiry_date=EXCLUDED.expiry_date,order_quantity=EXCLUDED.order_quantity,
        pallet_requirement=EXCLUDED.pallet_requirement,stacking_quantity=EXCLUDED.stacking_quantity,
        status=EXCLUDED.status,material_type=EXCLUDED.material_type,
        data_quality_tier=EXCLUDED.data_quality_tier,
        source_lineage=EXCLUDED.source_lineage,updated_at=now()
    """,rows)
    cur.execute("UPDATE locations SET current_pallet_count=0 WHERE warehouse_id=%s", (warehouse_id,))
    cur.execute("""
        UPDATE locations l SET current_pallet_count=x.cnt FROM (
            SELECT location_code,COUNT(*)::int cnt FROM inventory WHERE warehouse_id=%s AND data_quality_tier=%s GROUP BY location_code
        ) x WHERE l.warehouse_id=%s AND l.location_code=x.location_code
    """,(warehouse_id,QUALITY_TIER,warehouse_id))
    return len(rows)


def load_material_location_assignments(
    cur, source: Path, warehouse_id: str, material_map: dict[str, str]
) -> int:
    """Persist one pick face plus every occupied reserve position per SKU.

    These rows are slotting/putaway assignments. They do not mutate inventory;
    physical movement remains transfer-task controlled.
    """
    inventory = read(source, "inventory")
    locations = read(source, "locations")[[
        "location_code", "zone_type", "accessibility_rating", "coordinate_x",
        "coordinate_y", "level_number", "travel_distance_m",
    ]]
    assigned = inventory[["material_id", "material_type", "location_code"]].drop_duplicates().merge(
        locations, on="location_code", how="left", validate="many_to_one"
    )
    assigned["zone_rank"] = assigned.zone_type.map({"PICK_FACE": 0, "RESERVE": 1}).fillna(2)
    assigned["flow_distance"] = assigned.travel_distance_m.fillna(9999)
    assigned = assigned.sort_values(
        ["material_id", "zone_rank", "accessibility_rating", "flow_distance", "level_number", "location_code"],
        ascending=[True, True, False, True, True, True],
    )
    assigned["priority"] = assigned.groupby("material_id").cumcount() + 1

    actual_material_ids = list(material_map.values())
    cur.execute("""
        DELETE FROM material_default_locations mdl
        USING materials m
        WHERE mdl.material_id=m.id
          AND mdl.warehouse_id=%s
          AND m.data_quality_tier='ARCHIVED_GENERATED_BASELINE'
    """, (warehouse_id,))
    cur.execute(
        "DELETE FROM material_default_locations WHERE warehouse_id=%s AND material_id=ANY(%s::uuid[])",
        (warehouse_id, actual_material_ids),
    )
    rows = [(
        material_map[row.material_id], warehouse_id, row.location_code, int(row.priority),
        row.material_type,
        "PRIMARY_PICK_FACE: forecast/velocity access slot" if int(row.priority) == 1
        else "RESERVE: overflow pallet position linked to primary pick face",
    ) for row in assigned.itertuples(index=False)]
    execute_batched(cur, """
        INSERT INTO material_default_locations(
            material_id,warehouse_id,location_code,priority,material_type,notes
        ) VALUES %s
        ON CONFLICT(material_id,warehouse_id,location_code) DO UPDATE SET
            priority=EXCLUDED.priority,material_type=EXCLUDED.material_type,
            notes=EXCLUDED.notes,updated_at=now()
    """, rows)
    return len(rows)


def load_classification(cur, source: Path, manifest: dict, warehouse_id: str, material_map: dict[str, str]) -> tuple[int,int]:
    classes=read(source,"material_classifications")
    thresholds=read(source,"classification_thresholds")
    run_id=str(uuid.uuid5(uuid.UUID("8f1d53ad-70d7-4dd2-81e6-e9b2e4f6e090"),f"{warehouse_id}:{DATASET_VERSION}:{classes.observation_end.max()}"))
    cur.execute("""
        INSERT INTO material_classification_runs(id,warehouse_id,dataset_version,observation_start,observation_end,method,status,source_event_count,source_lineage)
        VALUES (%s,%s,%s,%s,%s,%s,'completed',%s,%s)
        ON CONFLICT(warehouse_id,dataset_version,observation_end) DO UPDATE SET
        observation_start=EXCLUDED.observation_start,method=EXCLUDED.method,status='completed',
        source_event_count=EXCLUDED.source_event_count,source_lineage=EXCLUDED.source_lineage RETURNING id::text
    """,(run_id,warehouse_id,DATASET_VERSION,classes.observation_start.min(),classes.observation_end.max(),
          "ABC_CUMULATIVE_USAGE_AND_1D_NATURAL_BREAKS",int(classes.issue_count_12m.sum()),lineage(manifest,"classification")))
    run_id=cur.fetchone()[0]
    threshold_rows=[(
        run_id,row.material_type,row.category,float(row.abc_a_cumulative_max),float(row.abc_b_cumulative_max),
        float(row.fms_slow_upper),float(row.fms_fast_lower),int(row.source_rows),row.method,
    ) for row in thresholds.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO material_classification_thresholds(run_id,material_type,category,abc_a_cumulative_max,abc_b_cumulative_max,fms_slow_upper,fms_fast_lower,source_rows,method)
        VALUES %s ON CONFLICT(run_id,material_type,category) DO UPDATE SET
        abc_a_cumulative_max=EXCLUDED.abc_a_cumulative_max,abc_b_cumulative_max=EXCLUDED.abc_b_cumulative_max,
        fms_slow_upper=EXCLUDED.fms_slow_upper,fms_fast_lower=EXCLUDED.fms_fast_lower,
        source_rows=EXCLUDED.source_rows,method=EXCLUDED.method
    """,threshold_rows)
    class_rows=[(
        run_id,material_map[row.material_id],warehouse_id,float(row.issue_volume_12m),int(row.issue_count_12m),
        float(row.cumulative_usage_share),row.abc_class,row.fms_class,row.amalgamated_class,
    ) for row in classes.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO material_classification_history(run_id,material_id,warehouse_id,issue_volume_12m,issue_count_12m,cumulative_usage_share,abc_class,fms_class,amalgamated_class)
        VALUES %s ON CONFLICT(run_id,material_id) DO UPDATE SET issue_volume_12m=EXCLUDED.issue_volume_12m,
        issue_count_12m=EXCLUDED.issue_count_12m,cumulative_usage_share=EXCLUDED.cumulative_usage_share,
        abc_class=EXCLUDED.abc_class,fms_class=EXCLUDED.fms_class,amalgamated_class=EXCLUDED.amalgamated_class
    """,class_rows)
    rollup=[(material_map[row.material_id],warehouse_id,int(round(row.issue_volume_12m)),int(row.issue_count_12m),row.abc_class,row.fms_class,row.amalgamated_class) for row in classes.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO material_issue_stats_rollup(material_id,warehouse_id,issue_volume_12m,issue_count_12m,abc_class,fms_class,amalgamated_class)
        VALUES %s ON CONFLICT(material_id,warehouse_id) DO UPDATE SET issue_volume_12m=EXCLUDED.issue_volume_12m,
        issue_count_12m=EXCLUDED.issue_count_12m,abc_class=EXCLUDED.abc_class,fms_class=EXCLUDED.fms_class,
        amalgamated_class=EXCLUDED.amalgamated_class,last_refreshed_at=now()
    """,rollup)
    cur.execute("""
        UPDATE materials m SET abc_class=c.abc_class,fms_class=c.fms_class
        FROM material_classification_history c WHERE c.run_id=%s AND c.material_id=m.id
    """,(run_id,))
    return len(threshold_rows),len(class_rows)


def load_forecast(cur, source: Path, manifest: dict, warehouse_id: str, material_map: dict[str, str]) -> tuple[int,int,int]:
    summary=json.loads((source/"forecast_evidence_summary.json").read_text())
    model=summary["champion"]
    future=read(source,"forecast_results")
    forecast_rows=[(
        material_map[row.material_id],warehouse_id,row.forecast_period,int(row.horizon),model,
        round(float(row.forecast_p05),2),round(float(row.forecast_p50),2),round(float(row.forecast_p95),2),
        row.method,DATASET_VERSION,DATASET_VERSION,QUALITY_TIER,1.0,False,
        lineage(manifest,"forecast_results_legacy_p10_p90_store_p05_p95"),
    ) for row in future.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO forecast_results(material_id,warehouse_id,forecast_period,horizon,model_name,forecast_p10,forecast_p50,forecast_p90,method,mlflow_run_id,training_source,data_quality_tier,synthetic_ratio,decision_eligible,source_lineage)
        VALUES %s ON CONFLICT(material_id,forecast_period,horizon,model_name) DO UPDATE SET
        forecast_p10=EXCLUDED.forecast_p10,forecast_p50=EXCLUDED.forecast_p50,forecast_p90=EXCLUDED.forecast_p90,
        method=EXCLUDED.method,training_source=EXCLUDED.training_source,data_quality_tier=EXCLUDED.data_quality_tier,
        synthetic_ratio=EXCLUDED.synthetic_ratio,decision_eligible=EXCLUDED.decision_eligible,source_lineage=EXCLUDED.source_lineage
    """,forecast_rows)
    test=read(source,"champion_test_backtest_rows")
    backtest_rows=[(
        FORECAST_DATASET,model,"untouched_test",warehouse_id,material_map[row.material_id],row.origin_month,int(row.horizon),
        float(row.y_true),float(row.forecast_p05),float(row.prediction),float(row.forecast_p95),float(row.residual),
        float(row.absolute_error),bool(row.interval_covered),lineage(manifest,"forecast_backtest_rows"),
    ) for row in test.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO forecast_backtest_rows(dataset,model_name,split,warehouse_id,material_id,origin_month,horizon,y_true,forecast_p05,forecast_p50,forecast_p95,residual,absolute_error,interval_covered,source_lineage)
        VALUES %s ON CONFLICT(dataset,model_name,split,warehouse_id,material_id,origin_month,horizon) DO UPDATE SET
        y_true=EXCLUDED.y_true,forecast_p05=EXCLUDED.forecast_p05,forecast_p50=EXCLUDED.forecast_p50,
        forecast_p95=EXCLUDED.forecast_p95,residual=EXCLUDED.residual,absolute_error=EXCLUDED.absolute_error,
        interval_covered=EXCLUDED.interval_covered,source_lineage=EXCLUDED.source_lineage
    """,backtest_rows)
    metrics=summary["test_metrics"]
    evidence_rows=[(
        FORECAST_DATASET,model,warehouse_id,"untouched_test",0,int(metrics["rows"]),int(metrics["materials"]),
        float(metrics["WAPE"]),float(metrics["MAE"]),float(metrics["RMSE"]),float(metrics["Bias"]),
        float(metrics["under_forecast_rate"]),float(summary["interval_nominal_coverage"]),
        float(summary["interval_empirical_coverage"]),QUALITY_TIER,1.0,False,
        lineage(manifest,"forecast_model_evidence_aggregate"),
    )]
    horizon_metrics=read(source,"champion_horizon_metrics")
    for row in horizon_metrics.itertuples(index=False):
        evidence_rows.append((
            FORECAST_DATASET,model,warehouse_id,"untouched_test",int(row.horizon),int(row.rows),int(row.materials),
            float(row.WAPE),float(row.MAE),float(row.RMSE),float(row.Bias),float(row.under_forecast_rate),
            float(summary["interval_nominal_coverage"]),float(row.interval_empirical_coverage),QUALITY_TIER,1.0,False,
            lineage(manifest,"forecast_model_evidence_horizon"),
        ))
    execute_batched(cur,"""
        INSERT INTO forecast_model_evidence(dataset,model_name,warehouse_id,split,horizon,evaluation_rows,material_count,wape,mae,rmse,bias,under_forecast_rate,interval_nominal_coverage,interval_empirical_coverage,data_quality_tier,synthetic_ratio,decision_eligible,source_lineage)
        VALUES %s
        ON CONFLICT(dataset,model_name,warehouse_id,split,horizon) DO UPDATE SET evaluation_rows=EXCLUDED.evaluation_rows,
        material_count=EXCLUDED.material_count,wape=EXCLUDED.wape,mae=EXCLUDED.mae,rmse=EXCLUDED.rmse,bias=EXCLUDED.bias,
        under_forecast_rate=EXCLUDED.under_forecast_rate,interval_nominal_coverage=EXCLUDED.interval_nominal_coverage,
        interval_empirical_coverage=EXCLUDED.interval_empirical_coverage,decision_eligible=EXCLUDED.decision_eligible,
        source_lineage=EXCLUDED.source_lineage
    """,evidence_rows)
    cur.execute("""
        INSERT INTO forecast_model_registry(dataset,model_name,display_name,algorithm,version,status,promotion_eligible,promotion_gate,source_lineage)
        VALUES (%s,%s,'RM/PM Demand Forecast',%s,%s,'PENDING_MANAGER_APPROVAL',%s,%s,%s)
        ON CONFLICT(dataset,model_name,version) DO UPDATE SET promotion_eligible=EXCLUDED.promotion_eligible,
        promotion_gate=EXCLUDED.promotion_gate,source_lineage=EXCLUDED.source_lineage,updated_at=now()
    """,(FORECAST_DATASET,model,model,DATASET_VERSION,bool(summary["promotion_eligible"]),Json(summary["promotion_gate"]),lineage(manifest,"forecast_model_registry")))
    return len(forecast_rows),len(backtest_rows),1


def load_policy_draft(cur, source: Path, manifest: dict, warehouse_id: str, material_map: dict[str, str]) -> tuple[int,int]:
    policy=read(source,"inventory_policy")
    run_id=str(uuid.uuid5(uuid.UUID("dc0e5a40-c2ff-4e33-846c-dcbdff7dd92e"),f"{warehouse_id}:{DATASET_VERSION}:policy"))
    total_delta=float((policy.max_stock-policy.current_on_hand).sum())
    pallet_delta=float(policy.required_pallet_positions.sum())
    cost_delta=float(policy.expected_cost_delta.sum())
    cur.execute("""
        INSERT INTO inventory_policy_recommendation_runs(id,warehouse_id,horizon_months,status,forecast_model_name,forecast_run_id,created_by,notes,total_stock_delta,total_pallet_positions_delta,estimated_holding_cost_delta,high_risk_count,data_insufficient_count)
        VALUES (%s,%s,12,'PENDING_APPROVAL',%s,%s,'project-baseline-loader',%s,%s,%s,%s,0,0)
        ON CONFLICT(id) DO UPDATE SET status='PENDING_APPROVAL',forecast_model_name=EXCLUDED.forecast_model_name,
        notes=EXCLUDED.notes,total_stock_delta=EXCLUDED.total_stock_delta,total_pallet_positions_delta=EXCLUDED.total_pallet_positions_delta,
        estimated_holding_cost_delta=EXCLUDED.estimated_holding_cost_delta,updated_at=now()
    """,(run_id,warehouse_id,json.loads((source/"forecast_evidence_summary.json").read_text())["champion"],DATASET_VERSION,
          f"{DATASET_VERSION} stochastic (s,S) policy draft",total_delta,pallet_delta,cost_delta))
    materials=pd.concat([read(source,"materials"),read(source,"finished_goods")],ignore_index=True,sort=False).set_index("material_id")
    inventory=read(source,"inventory").groupby("material_id",as_index=False).agg(
        current_stock=("quantity","sum"),current_available=("available_quantity","sum"),current_min=("min_stock","max"),
        current_max=("max_stock","max"),current_rop=("reorder_point","max"),
    ).set_index("material_id")
    line_rows=[]
    evidence_rows=[]
    for row in policy.itertuples(index=False):
        material=materials.loc[row.material_id]
        current=inventory.loc[row.material_id]
        line_id=str(uuid.uuid5(uuid.UUID("3316eef8-7b54-4770-8e70-489f1922060d"),f"{run_id}:{material_map[row.material_id]}"))
        status="SAFE_TO_APPLY" if bool(row.capacity_feasible) and row.simulated_fill_rate>=row.target_service_level and row.expected_cost_delta<0 else "HIGH_RISK_REVIEW"
        line_rows.append((
            line_id,run_id,material_map[row.material_id],row.material_code,material.material_type,float(current.current_stock),
            float(current.current_available),float(current.current_min),float(current.current_max),float(current.current_rop),
            int(material.lead_time_days),float(material.min_order_quantity),float(material.order_multiple),float(material.unit_cost),
            float(row.min_stock),float(row.max_stock),float(row.reorder_point),float(row.max_stock),float(row.order_quantity),
            float(row.max_stock-current.current_stock),float(row.required_pallet_positions),float(row.expected_cost_delta),
            max(0.0,100*(1-row.simulated_fill_rate)),0.0,95.0,status,
            "Empirical lead-time demand (s,S) policy; manager approval required",
            Json({"service_level":float(row.target_service_level),"abc":str(row.abc_class),"fms":str(row.fms_class),
                  "handling_unit":str(material.handling_unit_type),"units_per_handling_unit":float(material.units_per_handling_unit),
                  "capacity_feasible":bool(row.capacity_feasible)}),
        ))
        evidence_rows.append((
            line_id,material_map[row.material_id],float(row.target_service_level),float(row.simulated_fill_rate),
            float(row.current_expected_total_cost),float(row.proposed_expected_total_cost),float(row.expected_cost_delta),
            int(row.stockout_days_current),int(row.stockout_days_proposed),bool(row.capacity_feasible),
            "EMPIRICAL_LEAD_TIME_MONTE_CARLO_1000",lineage(manifest,"inventory_policy_simulation"),
        ))
    execute_batched(cur,"""
        INSERT INTO inventory_policy_recommendation_lines(id,run_id,material_id,material_code,material_type,current_stock,current_available_stock,current_min_stock,current_max_stock,current_reorder_point,lead_time_days,moq,order_multiple,unit_cost,proposed_min_stock,proposed_max_stock,proposed_reorder_point,proposed_target_stock,proposed_order_qty,stock_delta,pallet_positions_delta,holding_cost_delta,stockout_risk_score,expiry_risk_score,confidence_score,recommendation_status,rationale,constraint_snapshot)
        VALUES %s ON CONFLICT(run_id,material_id) DO UPDATE SET current_stock=EXCLUDED.current_stock,
        current_available_stock=EXCLUDED.current_available_stock,current_min_stock=EXCLUDED.current_min_stock,
        current_max_stock=EXCLUDED.current_max_stock,current_reorder_point=EXCLUDED.current_reorder_point,
        proposed_min_stock=EXCLUDED.proposed_min_stock,proposed_max_stock=EXCLUDED.proposed_max_stock,
        proposed_reorder_point=EXCLUDED.proposed_reorder_point,proposed_target_stock=EXCLUDED.proposed_target_stock,
        proposed_order_qty=EXCLUDED.proposed_order_qty,stock_delta=EXCLUDED.stock_delta,
        pallet_positions_delta=EXCLUDED.pallet_positions_delta,holding_cost_delta=EXCLUDED.holding_cost_delta,
        recommendation_status=EXCLUDED.recommendation_status,rationale=EXCLUDED.rationale,
        constraint_snapshot=EXCLUDED.constraint_snapshot,updated_at=now()
    """,line_rows)
    execute_batched(cur,"""
        INSERT INTO inventory_policy_simulation_evidence(policy_run_id,material_id,service_level_target,simulated_fill_rate,current_expected_cost,proposed_expected_cost,expected_cost_delta,stockout_days_current,stockout_days_proposed,capacity_feasible,simulation_method,source_lineage)
        SELECT l.run_id,v.material_id::uuid,v.service_level_target,v.simulated_fill_rate,v.current_expected_cost,v.proposed_expected_cost,v.expected_cost_delta,v.stockout_days_current,v.stockout_days_proposed,v.capacity_feasible,v.simulation_method,v.source_lineage::jsonb
        FROM (VALUES %s) AS v(line_id,material_id,service_level_target,simulated_fill_rate,current_expected_cost,proposed_expected_cost,expected_cost_delta,stockout_days_current,stockout_days_proposed,capacity_feasible,simulation_method,source_lineage)
        JOIN inventory_policy_recommendation_lines l ON l.id=v.line_id::uuid
        ON CONFLICT(policy_run_id,material_id) DO UPDATE SET service_level_target=EXCLUDED.service_level_target,
        simulated_fill_rate=EXCLUDED.simulated_fill_rate,current_expected_cost=EXCLUDED.current_expected_cost,
        proposed_expected_cost=EXCLUDED.proposed_expected_cost,expected_cost_delta=EXCLUDED.expected_cost_delta,
        stockout_days_current=EXCLUDED.stockout_days_current,stockout_days_proposed=EXCLUDED.stockout_days_proposed,
        capacity_feasible=EXCLUDED.capacity_feasible,simulation_method=EXCLUDED.simulation_method,source_lineage=EXCLUDED.source_lineage
    """,evidence_rows)
    return 1,len(line_rows)


def archive_previous_generated_operations(cur, warehouse_id: str, dataset_hash: str) -> dict[str, int]:
    """Remove previous artifact revisions from canonical scope without deleting audit history."""
    archived: dict[str, int] = {}
    warehouse_tables = ("operation_events", "stock_movements", "tasks", "orders")
    for table in warehouse_tables:
        cur.execute(
            f"""
            UPDATE {table}
            SET dataset_version=%s
            WHERE warehouse_id=%s
              AND dataset_version=%s
              AND COALESCE(source_lineage->>'dataset_hash', '') <> %s
            """,
            (ARCHIVE_DATASET_VERSION, warehouse_id, DATASET_VERSION, dataset_hash),
        )
        archived[f"archived_{table}"] = cur.rowcount

    cur.execute(
        """
        UPDATE order_items
        SET dataset_version=%s
        WHERE dataset_version=%s
          AND COALESCE(source_lineage->>'dataset_hash', '') <> %s
        """,
        (ARCHIVE_DATASET_VERSION, DATASET_VERSION, dataset_hash),
    )
    archived["archived_order_items"] = cur.rowcount
    return archived


def load_operations(cur, source: Path, manifest: dict, warehouse_id: str, material_map: dict[str,str], supplier_map: dict[str,str], customer_map: dict[str,str], user_map: dict[str,str]) -> dict:
    archived = archive_previous_generated_operations(cur, warehouse_id, manifest["dataset_hash"])
    orders=read(source,"orders")
    order_rows=[(
        row.order_id,row.order_number,row.order_type,customer_map.get(str(row.customer_id)),supplier_map.get(str(row.supplier_id)),
        warehouse_id,row.status,row.priority,row.order_date,row.expected_date,DATASET_VERSION,lineage(manifest,"orders"),
    ) for row in orders.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO orders(id,order_number,order_type,customer_id,supplier_id,warehouse_id,status,priority,order_date,expected_date,dataset_version,source_lineage)
        VALUES %s ON CONFLICT(order_number) DO UPDATE SET customer_id=EXCLUDED.customer_id,supplier_id=EXCLUDED.supplier_id,
        warehouse_id=EXCLUDED.warehouse_id,status=EXCLUDED.status,priority=EXCLUDED.priority,order_date=EXCLUDED.order_date,
        expected_date=EXCLUDED.expected_date,dataset_version=EXCLUDED.dataset_version,source_lineage=EXCLUDED.source_lineage,updated_at=now()
    """,order_rows)
    cur.execute("SELECT order_number,id::text FROM orders WHERE order_number=ANY(%s)",(orders.order_number.tolist(),))
    order_code_to_id=dict(cur.fetchall())
    generated_order_map=dict(zip(orders.order_id,orders.order_number.map(order_code_to_id)))
    lines=read(source,"order_items")
    line_rows=[(
        row.order_item_id,generated_order_map[row.order_id],material_map[row.material_id],int(row.quantity),float(row.unit_price),
        int(row.picked_quantity),int(row.packed_quantity),row.location_code,row.status,DATASET_VERSION,lineage(manifest,"order_items"),
    ) for row in lines.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO order_items(id,order_id,material_id,quantity,unit_price,picked_quantity,packed_quantity,location_code,status,dataset_version,source_lineage)
        VALUES %s ON CONFLICT(id) DO UPDATE SET order_id=EXCLUDED.order_id,material_id=EXCLUDED.material_id,
        quantity=EXCLUDED.quantity,unit_price=EXCLUDED.unit_price,picked_quantity=EXCLUDED.picked_quantity,
        packed_quantity=EXCLUDED.packed_quantity,location_code=EXCLUDED.location_code,status=EXCLUDED.status,
        dataset_version=EXCLUDED.dataset_version,source_lineage=EXCLUDED.source_lineage
    """,line_rows)
    generated_item_map=dict(zip(lines.order_item_id,lines.order_item_id))
    movements=read(source,"stock_movements")
    movement_rows=[(
        row.movement_id,material_map[row.material_id],warehouse_id,row.location_code,row.movement_type,int(row.quantity),
        row.reference_type,generated_order_map.get(row.reference_id,row.reference_id),user_map[row.user_id],row.notes,row.created_at,
        DATASET_VERSION,lineage(manifest,"stock_movements"),
    ) for row in movements.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO stock_movements(id,material_id,warehouse_id,location_code,movement_type,quantity,reference_type,reference_id,user_id,notes,created_at,dataset_version,source_lineage)
        VALUES %s ON CONFLICT(id) DO UPDATE SET material_id=EXCLUDED.material_id,warehouse_id=EXCLUDED.warehouse_id,
        location_code=EXCLUDED.location_code,movement_type=EXCLUDED.movement_type,quantity=EXCLUDED.quantity,
        reference_type=EXCLUDED.reference_type,reference_id=EXCLUDED.reference_id,user_id=EXCLUDED.user_id,
        notes=EXCLUDED.notes,created_at=EXCLUDED.created_at,dataset_version=EXCLUDED.dataset_version,source_lineage=EXCLUDED.source_lineage
    """,movement_rows)
    tasks=read(source,"tasks")
    task_rows=[(
        row.task_id,row.task_number,row.task_type,warehouse_id,user_map[row.assigned_to],row.priority,row.status,row.due_date,
        row.completed_at,row.location_code,row.reference_type,generated_order_map.get(row.reference_id,row.reference_id),row.notes,
        row.created_at,DATASET_VERSION,lineage(manifest,"tasks"),
    ) for row in tasks.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO tasks(id,task_number,task_type,warehouse_id,assigned_to,priority,status,due_date,completed_at,location_code,reference_type,reference_id,notes,created_at,dataset_version,source_lineage)
        VALUES %s ON CONFLICT(task_number) DO UPDATE SET task_type=EXCLUDED.task_type,warehouse_id=EXCLUDED.warehouse_id,
        assigned_to=EXCLUDED.assigned_to,priority=EXCLUDED.priority,status=EXCLUDED.status,due_date=EXCLUDED.due_date,
        completed_at=EXCLUDED.completed_at,location_code=EXCLUDED.location_code,reference_type=EXCLUDED.reference_type,
        reference_id=EXCLUDED.reference_id,notes=EXCLUDED.notes,created_at=EXCLUDED.created_at,
        dataset_version=EXCLUDED.dataset_version,source_lineage=EXCLUDED.source_lineage,updated_at=now()
    """,task_rows)
    cur.execute("SELECT task_number,id::text FROM tasks WHERE task_number=ANY(%s)",(tasks.task_number.tolist(),))
    task_code_to_id=dict(cur.fetchall())
    generated_task_map=dict(zip(tasks.task_id,tasks.task_number.map(task_code_to_id)))
    events=read(source,"operation_events")
    event_rows=[(
        row.event_id,row.operation_type,user_map[row.worker_id],generated_task_map.get(row.task_id,row.task_id),generated_order_map.get(row.order_id,row.order_id),
        generated_item_map.get(row.order_item_id,row.order_item_id),warehouse_id,material_map[row.material_id],int(row.quantity),
        row.started_at,row.completed_at,int(row.duration_minutes),row.status,row.metadata,DATASET_VERSION,lineage(manifest,"operation_events"),
    ) for row in events.itertuples(index=False)]
    execute_batched(cur,"""
        INSERT INTO operation_events(id,operation_type,worker_id,task_id,order_id,order_item_id,warehouse_id,material_id,quantity,started_at,completed_at,duration_minutes,status,metadata,dataset_version,source_lineage)
        VALUES %s ON CONFLICT(id) DO UPDATE SET operation_type=EXCLUDED.operation_type,worker_id=EXCLUDED.worker_id,
        task_id=EXCLUDED.task_id,order_id=EXCLUDED.order_id,order_item_id=EXCLUDED.order_item_id,
        warehouse_id=EXCLUDED.warehouse_id,material_id=EXCLUDED.material_id,quantity=EXCLUDED.quantity,
        started_at=EXCLUDED.started_at,completed_at=EXCLUDED.completed_at,duration_minutes=EXCLUDED.duration_minutes,
        status=EXCLUDED.status,metadata=EXCLUDED.metadata,dataset_version=EXCLUDED.dataset_version,source_lineage=EXCLUDED.source_lineage
    """,event_rows)
    return {
        **archived,
        "orders":len(order_rows),
        "order_items":len(line_rows),
        "stock_movements":len(movement_rows),
        "tasks":len(task_rows),
        "operation_events":len(event_rows),
    }


def artifact_validation(source: Path) -> dict:
    manifest=json.loads((source/"manifest.json").read_text())
    if manifest["dataset_version"] != DATASET_VERSION:
        raise RuntimeError(f"Unexpected dataset version: {manifest['dataset_version']}")
    if not all(manifest["validations"].values()):
        raise RuntimeError(f"Artifact validation failed: {manifest['validations']}")
    required=["forecast_evidence_summary.json","model_leaderboard.csv","forecast_results.csv.gz","champion_test_backtest_rows.csv.gz"]
    missing=[name for name in required if not (source/name).exists()]
    if missing:
        raise RuntimeError(f"Missing forecast evidence: {missing}")
    return manifest


def validate_database(cur, warehouse_id: str, manifest: dict) -> dict:
    checks={
        "materials":"SELECT count(*) FROM materials WHERE data_quality_tier=%s",
        "locations":"SELECT count(*) FROM locations WHERE warehouse_id=%s AND dataset_version=%s",
        "orders":"SELECT count(*) FROM orders WHERE warehouse_id=%s AND dataset_version=%s",
        "order_items":"SELECT count(*) FROM order_items WHERE dataset_version=%s",
        "stock_movements":"SELECT count(*) FROM stock_movements WHERE warehouse_id=%s AND dataset_version=%s",
        "tasks":"SELECT count(*) FROM tasks WHERE warehouse_id=%s AND dataset_version=%s",
        "operation_events":"SELECT count(*) FROM operation_events WHERE warehouse_id=%s AND dataset_version=%s",
        "demand_history":"SELECT count(*) FROM demand_history WHERE warehouse_id=%s AND source=%s",
        "forecast_results":"SELECT count(*) FROM forecast_results WHERE warehouse_id=%s AND training_source=%s",
        "backtest_rows":"SELECT count(*) FROM forecast_backtest_rows WHERE warehouse_id=%s AND dataset=%s",
        "classification_rows":"SELECT count(*) FROM material_classification_history WHERE warehouse_id=%s",
        "location_assignments":"SELECT count(*) FROM material_default_locations WHERE warehouse_id=%s AND material_id IN (SELECT id FROM materials WHERE data_quality_tier=%s)",
        "assigned_materials":"SELECT count(DISTINCT material_id) FROM material_default_locations WHERE warehouse_id=%s AND material_id IN (SELECT id FROM materials WHERE data_quality_tier=%s)",
    }
    results={}
    for key,sql in checks.items():
        if key=="materials": params=(QUALITY_TIER,)
        elif key=="order_items": params=(DATASET_VERSION,)
        elif key=="demand_history": params=(warehouse_id,DATASET_VERSION)
        elif key=="forecast_results": params=(warehouse_id,DATASET_VERSION)
        elif key=="backtest_rows": params=(warehouse_id,FORECAST_DATASET)
        elif key=="classification_rows": params=(warehouse_id,)
        elif key in {"location_assignments", "assigned_materials"}: params=(warehouse_id,QUALITY_TIER)
        else: params=(warehouse_id,DATASET_VERSION)
        cur.execute(sql,params); results[key]=cur.fetchone()[0]
    expected=manifest["row_counts"]
    results["expected_materials"]=expected["materials"]+expected["finished_goods"]
    results["valid"]=(
        results["materials"]>=results["expected_materials"] and results["locations"]==expected["locations"]
        and results["orders"]==expected["orders"] and results["order_items"]==expected["order_items"]
        and results["tasks"]==expected["tasks"] and results["operation_events"]==expected["operation_events"]
        and results["demand_history"]==expected["demand_history"]+expected["production_history"]
        and results["classification_rows"]>=expected["material_classifications"]
        and results["location_assignments"]>=results["expected_materials"]
        and results["assigned_materials"]==results["expected_materials"]
    )
    return results


def load_forecast_only(db_url: str, source: Path, manifest: dict) -> dict:
    conn = psycopg2.connect(db_url)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            require_contract(cur)
            warehouse = read(source, "warehouses").iloc[0]
            cur.execute("SELECT id::text FROM warehouses WHERE code=%s", (warehouse.code,))
            warehouse_row = cur.fetchone()
            if not warehouse_row:
                raise RuntimeError("Canonical warehouse is not loaded; run the full baseline loader first")
            warehouse_id = warehouse_row[0]

            materials = pd.concat([read(source, "materials"), read(source, "finished_goods")], ignore_index=True)
            cur.execute("SELECT material_code,id::text FROM materials WHERE material_code=ANY(%s)", (materials.material_code.tolist(),))
            code_to_id = dict(cur.fetchall())
            missing = sorted(set(materials.material_code) - set(code_to_id))
            if missing:
                raise RuntimeError(f"Canonical material mapping is incomplete; first missing codes: {missing[:5]}")
            material_map = dict(zip(materials.material_id, materials.material_code.map(code_to_id)))
            forecast_rows, backtest_rows, registry_rows = load_forecast(
                cur, source, manifest, warehouse_id, material_map
            )
        conn.commit()
        return {
            "mode": "forecast-only",
            "dataset_version": DATASET_VERSION,
            "warehouse_id": warehouse_id,
            "forecast_results": forecast_rows,
            "backtest_rows": backtest_rows,
            "model_registry": registry_rows,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def load_planning_only(db_url: str, source: Path, manifest: dict) -> dict:
    """Refresh demand, inventory and forecast evidence without replaying operations."""
    conn = psycopg2.connect(db_url)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            require_contract(cur)
            warehouse = read(source, "warehouses").iloc[0]
            cur.execute("SELECT id::text FROM warehouses WHERE code=%s", (warehouse.code,))
            warehouse_row = cur.fetchone()
            if not warehouse_row:
                raise RuntimeError("Canonical warehouse is not loaded; run the full baseline loader first")
            warehouse_id = warehouse_row[0]
            materials = pd.concat([read(source, "materials"), read(source, "finished_goods")], ignore_index=True)
            cur.execute("SELECT material_code,id::text FROM materials WHERE material_code=ANY(%s)", (materials.material_code.tolist(),))
            code_to_id = dict(cur.fetchall())
            material_map = dict(zip(materials.material_id, materials.material_code.map(code_to_id)))
            if any(pd.isna(value) for value in material_map.values()):
                raise RuntimeError("Canonical material mapping is incomplete")
            demand_rows, inventory_rows = load_demand_and_inventory(
                cur, source, manifest, warehouse_id, material_map
            )
            location_assignments = load_material_location_assignments(
                cur, source, warehouse_id, material_map
            )
            forecast_rows, backtest_rows, registry_rows = load_forecast(
                cur, source, manifest, warehouse_id, material_map
            )
        conn.commit()
        return {
            "mode": "planning-only",
            "dataset_version": DATASET_VERSION,
            "warehouse_id": warehouse_id,
            "demand_history": demand_rows,
            "inventory": inventory_rows,
            "location_assignments": location_assignments,
            "forecast_results": forecast_rows,
            "backtest_rows": backtest_rows,
            "model_registry": registry_rows,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def load_layout_only(db_url: str, source: Path, manifest: dict) -> dict:
    """Refresh physical locations and SKU placement without replaying planning or operations."""
    conn = psycopg2.connect(db_url)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            require_contract(cur)
            warehouse = read(source, "warehouses").iloc[0]
            cur.execute("SELECT id::text FROM warehouses WHERE code=%s", (warehouse.code,))
            warehouse_row = cur.fetchone()
            if not warehouse_row:
                raise RuntimeError("Canonical warehouse is not loaded; run the full baseline loader first")
            warehouse_id = warehouse_row[0]
            _, material_map = load_materials(cur, source, manifest)
            if any(pd.isna(value) for value in material_map.values()):
                raise RuntimeError("Canonical material mapping is incomplete")

            location_rows = load_locations(cur, source, manifest, warehouse_id)
            inventory_rows = load_inventory(cur, source, manifest, warehouse_id, material_map)
            assignment_rows = load_material_location_assignments(
                cur, source, warehouse_id, material_map
            )
            stale_rows = remove_stale_generated_locations(cur, source, warehouse_id)
            cur.execute(
                "SELECT count(DISTINCT material_id) FROM material_default_locations "
                "WHERE warehouse_id=%s AND material_id=ANY(%s::uuid[])",
                (warehouse_id, list(material_map.values())),
            )
            assigned_materials = int(cur.fetchone()[0])
            if assigned_materials != len(material_map):
                raise RuntimeError(
                    f"Layout assignment coverage failed: {assigned_materials}/{len(material_map)}"
                )
        conn.commit()
        return {
            "mode": "layout-only",
            "dataset_version": DATASET_VERSION,
            "warehouse_id": warehouse_id,
            "locations": location_rows,
            "inventory": inventory_rows,
            "location_assignments": assignment_rows,
            "assigned_materials": assigned_materials,
            "stale_locations_removed": stale_rows,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def run(db_url: str, source: Path, validate_only: bool, forecast_only: bool = False,
        planning_only: bool = False, layout_only: bool = False) -> dict:
    manifest=artifact_validation(source)
    if validate_only:
        return {"mode":"artifact-validation-only","manifest":manifest}
    if forecast_only:
        return load_forecast_only(db_url, source, manifest)
    if planning_only:
        return load_planning_only(db_url, source, manifest)
    if layout_only:
        return load_layout_only(db_url, source, manifest)
    conn=psycopg2.connect(db_url)
    try:
        conn.autocommit=False
        with conn.cursor() as cur:
            require_contract(cur)
            warehouse=read(source,"warehouses").iloc[0]
            warehouse_id=resolve_warehouse(cur,warehouse,manifest)
            cur.execute("""
                INSERT INTO project_dataset_load_audit(dataset_version,dataset_hash,warehouse_id,status,notes)
                VALUES (%s,%s,%s,'running','canonical project-operational baseline load') RETURNING id::text
            """,(DATASET_VERSION,manifest["dataset_hash"],warehouse_id))
            audit_id=cur.fetchone()[0]
            counts={}
            material_code_map,material_map=load_materials(cur,source,manifest)
            counts["materials"]=len(material_code_map)
            counts["locations"]=load_locations(cur,source,manifest,warehouse_id)
            supplier_map,customer_map,user_map=load_partners(cur,source,manifest,warehouse_id)
            counts["supplier_links"]=load_supplier_links(cur,source,material_map,supplier_map)
            counts["bom_headers"],counts["bom_components"]=load_bom(cur,source,manifest,warehouse_id,material_map)
            counts["demand_history"],counts["inventory"]=load_demand_and_inventory(cur,source,manifest,warehouse_id,material_map)
            counts["location_assignments"]=load_material_location_assignments(cur,source,warehouse_id,material_map)
            counts["classification_thresholds"],counts["classifications"]=load_classification(cur,source,manifest,warehouse_id,material_map)
            counts["forecast_results"],counts["backtest_rows"],counts["model_registry"]=load_forecast(cur,source,manifest,warehouse_id,material_map)
            counts["policy_runs"],counts["policy_lines"]=load_policy_draft(cur,source,manifest,warehouse_id,material_map)
            counts.update(load_operations(cur,source,manifest,warehouse_id,material_map,supplier_map,customer_map,user_map))
            counts["stale_locations_removed"]=remove_stale_generated_locations(cur,source,warehouse_id)
            validation=validate_database(cur,warehouse_id,manifest)
            if not validation["valid"]:
                raise RuntimeError(f"Post-load validation failed: {validation}")
            cur.execute("""
                UPDATE project_dataset_load_audit SET status='completed',row_counts=%s,validation=%s,finished_at=now() WHERE id=%s
            """,(Json(counts),Json(validation),audit_id))
        conn.commit()
        return {"dataset_version":DATASET_VERSION,"warehouse_id":warehouse_id,"counts":counts,"validation":validation}
    except Exception:
        conn.rollback(); raise
    finally:
        conn.close()


def main() -> None:
    parser=argparse.ArgumentParser(description="Load the canonical OptiWMS generated operational baseline")
    parser.add_argument("--db-url",default="postgresql://optiwms:optiwms@localhost:5434/optiwms")
    parser.add_argument("--source",type=Path,default=DEFAULT_SOURCE)
    parser.add_argument("--validate-only",action="store_true",help="Validate generated artifacts without writing PostgreSQL")
    parser.add_argument(
        "--forecast-only", action="store_true",
        help="Upsert forecast, backtest, metric, and registry evidence without rebuilding operational data",
    )
    parser.add_argument(
        "--planning-only", action="store_true",
        help="Upsert FG/RM/PM demand, inventory and forecast evidence without replaying operational events",
    )
    parser.add_argument(
        "--layout-only", action="store_true",
        help="Upsert locations, inventory positions, and SKU location assignments only",
    )
    args=parser.parse_args()
    print(json.dumps(run(
        args.db_url, args.source, args.validate_only, args.forecast_only,
        args.planning_only, args.layout_only,
    ), indent=2, default=str))


if __name__=="__main__":
    main()
