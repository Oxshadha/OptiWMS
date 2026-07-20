#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import Json, execute_values


DATASET_VERSION = "PROJECT_OPERATIONAL_SIMULATION_V8"
QUALITY_TIER = "PROJECT_OPERATIONAL_SIMULATION"
FORECAST_MODEL = "PROJECT_OPS_EXTRA_TREES_CAUSAL"
FORECAST_DATASET = "PROJECT_OPS_RM_PM"
DEMAND_SOURCE = "project_ops_v8"
BOM_VERSION = "PROJECT_OPS_V8"


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


def add_months(value: date, months: int) -> date:
    index = value.month - 1 + months
    return date(value.year + index // 12, index % 12 + 1, 1)


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


def load_materials(cur, materials: pd.DataFrame, finished_goods: pd.DataFrame, digest: str) -> dict[str, str]:
    rows = []
    for row in materials.itertuples(index=False):
        unit = "KG" if row.material_type == "raw_material" else "EA"
        storage = "PALLET" if row.material_type == "raw_material" else "CARTON"
        rows.append((
            row.material_code, row.description, unit, storage, row.material_type,
            float(row.moq), float(row.order_multiple), int(row.lead_time_days),
            True, QUALITY_TIER, 1.0, True, Json(lineage("materials", digest)),
        ))
    for row in finished_goods.itertuples(index=False):
        rows.append((
            row.fg_code, f"Controlled finished good {row.fg_code}", "EA", "PALLET", "product",
            1.0, 1.0, 1, True, QUALITY_TIER, 1.0, True, Json(lineage("finished_goods", digest)),
        ))
    execute_values(
        cur,
        """
        INSERT INTO materials(
            material_code, description, unit_type, storage_type, material_type,
            min_order_quantity, order_multiple, order_delivery_days, requires_pallet,
            data_quality_tier, synthetic_ratio, decision_eligible, source_lineage
        ) VALUES %s
        ON CONFLICT (material_code) DO UPDATE SET
            description = EXCLUDED.description,
            unit_type = EXCLUDED.unit_type,
            storage_type = EXCLUDED.storage_type,
            material_type = EXCLUDED.material_type,
            min_order_quantity = EXCLUDED.min_order_quantity,
            order_multiple = EXCLUDED.order_multiple,
            order_delivery_days = EXCLUDED.order_delivery_days,
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


def load_demand(cur, demand: pd.DataFrame, material_ids: dict[str, str], warehouse_id: str, digest: str) -> int:
    cur.execute("DELETE FROM demand_history WHERE warehouse_id = %s AND source = %s", (warehouse_id, DEMAND_SOURCE))
    rows = [(
        material_ids[row.material_code], warehouse_id, str(pd.Timestamp(row.month).date()),
        float(row.demand_units), bool(row.promotion_flag), bool(row.holiday_flag),
        float(row.lead_time_days), None, DEMAND_SOURCE, QUALITY_TIER, 1.0, True,
        Json(lineage("demand_history", digest)),
    ) for row in demand.itertuples(index=False)]
    execute_values(cur, """
        INSERT INTO demand_history(
            material_id, warehouse_id, period, demand_units, promotion_flag, holiday_flag,
            lead_time_days, on_hand_inventory, source, data_quality_tier,
            synthetic_ratio, decision_eligible, source_lineage
        ) VALUES %s
        """, rows, page_size=2000)
    return len(rows)


def load_inventory(cur, policy: pd.DataFrame, initial: pd.DataFrame, materials: pd.DataFrame, material_ids: dict[str, str], warehouse_id: str, digest: str) -> int:
    source_code_map = dict(zip(materials["material_id"], materials["material_code"]))
    initial_map = dict(zip(initial["material_id"], initial["initial_on_hand"]))
    for row in policy.itertuples(index=False):
        code = source_code_map[int(row.material_id)]
        quantity = float(initial_map[int(row.material_id)])
        cur.execute("""
            UPDATE inventory SET
                quantity=%s, available_quantity=%s, reserved_quantity=0,
                buffer_stock=%s, min_stock=%s, max_stock=%s, reorder_point=%s,
                moq=%s, lead_time_days=%s, order_delivery_days=%s,
                status='active', data_quality_tier=%s, source_lineage=%s, updated_at=now()
            WHERE material_id=%s AND warehouse_id=%s AND location_code IS NULL
        """, (
            quantity, quantity, float(row.safety_stock), float(row.proposed_min),
            float(row.proposed_max), float(row.reorder_point), float(row.moq),
            int(row.lead_time_days), int(row.lead_time_days), QUALITY_TIER,
            Json(lineage("inventory", digest)), material_ids[code], warehouse_id,
        ))
        if cur.rowcount == 0:
            cur.execute("""
                INSERT INTO inventory(
                    material_id, warehouse_id, location_code, quantity, available_quantity,
                    reserved_quantity, buffer_stock, min_stock, max_stock, reorder_point,
                    moq, lead_time_days, order_delivery_days, status,
                    data_quality_tier, source_lineage
                ) VALUES (%s,%s,NULL,%s,%s,0,%s,%s,%s,%s,%s,%s,%s,'active',%s,%s)
            """, (
                material_ids[code], warehouse_id, quantity, quantity,
                float(row.safety_stock), float(row.proposed_min), float(row.proposed_max),
                float(row.reorder_point), float(row.moq), int(row.lead_time_days),
                int(row.lead_time_days), QUALITY_TIER, Json(lineage("inventory", digest)),
            ))
    return len(policy)


def load_forecasts(cur, intervals: pd.DataFrame, material_ids: dict[str, str], warehouse_id: str, digest: str, anchor: date) -> int:
    intervals = intervals.copy()
    source_months = sorted(intervals["origin_month"].unique())
    month_map = {month: add_months(anchor, idx) for idx, month in enumerate(source_months)}
    cur.execute("DELETE FROM forecast_results WHERE warehouse_id = %s AND model_name = %s", (warehouse_id, FORECAST_MODEL))
    rows = []
    for row in intervals.itertuples(index=False):
        period = month_map[row.origin_month]
        rows.append((
            material_ids[row.material_code], warehouse_id, period, source_months.index(row.origin_month) + 1,
            FORECAST_MODEL, float(row.p05), float(row.prediction), float(row.p95),
            "extra_trees_causal_simulation", "v8-controlled", "project_ops_v8",
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


def load_model_evidence(cur, digest: str, warehouse_id: str) -> int:
    """Load locked selection and untouched-test evidence, never training metrics."""
    summary = json.loads((source_dir() / "run_summary.json").read_text())
    selection = summary["selection_champion_metrics"]
    test = summary["test_champion_metrics"]
    calibration = summary["interval_calibration"]
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
    execute_values(cur, """
        INSERT INTO forecast_model_evidence(
            dataset, model_name, warehouse_id, split, horizon, evaluation_rows, material_count,
            wape, mae, rmse, bias, under_forecast_rate, interval_nominal_coverage,
            interval_empirical_coverage, data_quality_tier, synthetic_ratio, decision_eligible,
            source_lineage
        ) VALUES %s
    """, rows)
    return len(rows)


def refresh_issue_stats(cur, warehouse_id: str) -> int:
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
    cur.execute("""
        WITH totals AS (
            SELECT mis.material_id, mis.warehouse_id,
                   SUM(mis.issue_volume) AS volume,
                   SUM(mis.issue_count) AS counts
            FROM material_issue_stats mis
            JOIN materials m ON m.id = mis.material_id
            WHERE mis.warehouse_id = %s
              AND m.data_quality_tier = %s
              AND mis.period_month >= (
                  SELECT MAX(mis2.period_month)
                  FROM material_issue_stats mis2
                  JOIN materials m2 ON m2.id = mis2.material_id
                  WHERE mis2.warehouse_id = %s AND m2.data_quality_tier = %s
              ) - INTERVAL '11 months'
            GROUP BY mis.material_id, mis.warehouse_id
        ), ranked AS (
            SELECT *, SUM(volume) OVER (ORDER BY volume DESC) / NULLIF(SUM(volume) OVER (), 0)::numeric AS cumulative_share
            FROM totals
        )
        INSERT INTO material_issue_stats_rollup(
            material_id, warehouse_id, issue_volume_12m, issue_count_12m,
            abc_class, fms_class, amalgamated_class, last_refreshed_at
        )
        SELECT material_id, warehouse_id, volume, counts,
               CASE WHEN cumulative_share <= .80 THEN 'A' WHEN cumulative_share <= .95 THEN 'B' ELSE 'C' END,
               CASE WHEN counts >= 10 THEN 'F' WHEN counts >= 5 THEN 'M' ELSE 'S' END,
               (CASE WHEN cumulative_share <= .80 THEN 'A' WHEN cumulative_share <= .95 THEN 'B' ELSE 'C' END ||
                CASE WHEN counts >= 10 THEN 'F' WHEN counts >= 5 THEN 'M' ELSE 'S' END),
               now()
        FROM ranked
        ON CONFLICT (material_id, warehouse_id) DO UPDATE SET
            issue_volume_12m=EXCLUDED.issue_volume_12m,
            issue_count_12m=EXCLUDED.issue_count_12m,
            abc_class=EXCLUDED.abc_class,
            fms_class=EXCLUDED.fms_class,
            amalgamated_class=EXCLUDED.amalgamated_class,
            last_refreshed_at=now()
    """, (warehouse_id, QUALITY_TIER, warehouse_id, QUALITY_TIER))
    return inserted


def validate(cur, warehouse_id: str) -> dict:
    cur.execute("""
        SELECT
          (SELECT COUNT(*) FROM materials WHERE data_quality_tier=%s),
          (SELECT COUNT(*) FROM inventory WHERE warehouse_id=%s AND data_quality_tier=%s),
          (SELECT COUNT(*) FROM bom_headers WHERE warehouse_id=%s AND version=%s),
          (SELECT COUNT(*) FROM bom_components bc JOIN bom_headers bh ON bh.id=bc.bom_header_id WHERE bh.warehouse_id=%s AND bh.version=%s),
          (SELECT COUNT(*) FROM demand_history WHERE warehouse_id=%s AND source=%s),
          (SELECT COUNT(*) FROM forecast_results WHERE warehouse_id=%s AND model_name=%s),
          (SELECT COUNT(*) FROM forecast_model_evidence WHERE warehouse_id=%s AND dataset=%s AND model_name=%s AND decision_eligible=TRUE),
          (SELECT COUNT(*) FROM supplier_materials sm JOIN materials m ON m.id=sm.material_id WHERE m.data_quality_tier=%s),
          (SELECT COUNT(*) FROM material_issue_stats_rollup mir JOIN materials m ON m.id=mir.material_id WHERE mir.warehouse_id=%s AND m.data_quality_tier=%s)
    """, (
        QUALITY_TIER, warehouse_id, QUALITY_TIER, warehouse_id, BOM_VERSION,
        warehouse_id, BOM_VERSION, warehouse_id, DEMAND_SOURCE,
        warehouse_id, FORECAST_MODEL, warehouse_id, FORECAST_DATASET, FORECAST_MODEL,
        QUALITY_TIER, warehouse_id, QUALITY_TIER,
    ))
    keys = ["materials", "inventory", "bom_headers", "bom_components", "demand_rows", "forecast_rows", "model_evidence_rows", "supplier_links", "issue_rollups"]
    return dict(zip(keys, cur.fetchone()))


def run(db_url: str, warehouse_code: str, dry_run: bool) -> dict:
    out = source_dir()
    files = {
        "materials": out / "data/materials.csv",
        "fg": out / "data/finished_goods.csv",
        "bom": out / "data/bom_components.csv",
        "demand": out / "data/material_demand.csv",
        "initial": out / "data/initial_inventory.csv",
        "policy": out / "inventory_policy_simulation.csv",
        "intervals": out / "champion_prediction_intervals.csv",
    }
    missing = [str(path) for path in files.values() if not path.exists()]
    if missing:
        raise RuntimeError(f"missing v8 artifacts: {missing}")
    digest = dataset_hash(list(files.values()))
    frames = {name: pd.read_csv(path) for name, path in files.items()}
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
            material_ids = load_materials(cur, frames["materials"], frames["fg"], digest)
            counts = {
                "materials": len(material_ids),
                "suppliers": load_suppliers(cur, frames["materials"], material_ids, digest),
                "bom_components": load_bom(cur, frames["bom"], frames["fg"], material_ids, warehouse_id, digest),
                "demand_rows": load_demand(cur, frames["demand"], material_ids, warehouse_id, digest),
                "inventory_rows": load_inventory(cur, frames["policy"], frames["initial"], frames["materials"], material_ids, warehouse_id, digest),
                "forecast_rows": load_forecasts(cur, frames["intervals"], material_ids, warehouse_id, digest, add_months(date.today(), 1)),
                "model_evidence_rows": load_model_evidence(cur, digest, warehouse_id),
                "issue_stats": refresh_issue_stats(cur, warehouse_id),
            }
            validation = validate(cur, warehouse_id)
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Load the coherent project-operational simulation into OptiWMS PostgreSQL.")
    parser.add_argument("--db-url", default="postgresql://optiwms:optiwms@localhost:5434/optiwms")
    parser.add_argument("--warehouse-code", default="WH-001")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(args.db_url, args.warehouse_code, args.dry_run), indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
