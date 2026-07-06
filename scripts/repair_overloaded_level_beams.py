#!/usr/bin/env python3
"""Move bin-level inventory off overloaded rack beams into generated lower-level bins."""

from __future__ import annotations

import argparse
import math
import sys
import uuid
from collections import defaultdict
from decimal import Decimal
from typing import Any

import psycopg2
import psycopg2.extras


DEFAULT_DB_URL = "postgresql://optiwms:optiwms@localhost:5434/optiwms"


PRODUCT_AREAS = ["F", "G", "H", "I", "J", "K", "L", "M"]
RAW_AREAS = ["R", "S", "T"]
PACK_AREAS = ["P", "Q"]


def norm_type(value: str | None) -> str:
    raw = (value or "raw_material").lower()
    if raw in {"packing_material", "packaging"}:
        return "packaging_material"
    if raw in {"product", "fg"}:
        return "product"
    return "raw_material"


def areas_for(material_type: str) -> list[str]:
    if material_type == "product":
        return PRODUCT_AREAS
    if material_type == "packaging_material":
        return PACK_AREAS
    return RAW_AREAS


def class_for(row: dict[str, Any]) -> str:
    abc = str(row.get("abc_class") or "C").upper()[:1]
    fms = str(row.get("fms_class") or "S").upper()[:1]
    return (abc if abc in {"A", "B", "C"} else "C") + (fms if fms in {"F", "M", "S"} else "S")


def pallet_weight(row: dict[str, Any]) -> Decimal:
    if row.get("max_pallet_weight_kg") is not None:
        return Decimal(str(row["max_pallet_weight_kg"]))
    return Decimal(str(row.get("weight_kg") or 0)) * Decimal(str(row.get("pallet_spaces") or 1))


def create_lower_bin(cur, warehouse_id: str, row: dict[str, Any], next_index: dict[tuple[str, str], int]) -> str:
    material_type = norm_type(row.get("material_type"))
    slot_class = class_for(row)
    for area in areas_for(material_type):
        key = (warehouse_id, area)
        if key not in next_index:
            cur.execute(
                """
                SELECT COALESCE(MAX((NULLIF(regexp_replace(row_number, '[^0-9]', '', 'g'), '')::int - 90) * 999
                                    + NULLIF(regexp_replace(bay_number, '[^0-9]', '', 'g'), '')::int), 0) AS max_idx
                FROM locations
                WHERE warehouse_id = %s
                  AND area = %s
                  AND NULLIF(regexp_replace(row_number, '[^0-9]', '', 'g'), '')::int BETWEEN 90 AND 99
                """,
                (warehouse_id, area),
            )
            next_index[key] = int(cur.fetchone()["max_idx"] or 0) + 1

        while next_index[key] <= 9990:
            idx = next_index[key]
            next_index[key] += 1
            row_no = 90 + ((idx - 1) // 999)
            bay_no = ((idx - 1) % 999) + 1
            row_code = f"{row_no:02d}"
            bay_code = f"{bay_no:03d}"
            for level in (1, 2, 3):
                for bin_pos in ("A", "B"):
                    code = f"{area}-{row_code}-{bay_code}-{level}-{bin_pos}"
                    cur.execute("SELECT 1 FROM locations WHERE location_code = %s", (code,))
                    if cur.fetchone():
                        continue
                    loc_id = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO locations (
                            id, warehouse_id, location_code, area, row_number, bay_number,
                            level_number, bin_position, location_type, zone_type, is_active,
                            rack_status, amalgamated_class, description, max_pallet_capacity,
                            current_pallet_count, max_weight_kg, max_volume_cm3, max_lpn_count,
                            accessibility_rating, coordinate_x, coordinate_y, coordinate_z
                        )
                        VALUES (
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, 'STORAGE', true,
                            'active', %s, %s, 1,
                            0, 500, 1200000, 1,
                            5, %s, %s, %s
                        )
                        """,
                        (
                            loc_id,
                            warehouse_id,
                            code,
                            area,
                            row_code,
                            bay_code,
                            level,
                            bin_pos,
                            f"storage_{area.lower()}",
                            slot_class,
                            f"Auto-generated {area} lower-level spillover bin for beam repair",
                            Decimal(row_no * 12),
                            Decimal(ord(area[0]) * 10),
                            Decimal((level - 1) * 2),
                        ),
                    )
                    cur.execute(
                        """
                        INSERT INTO location_levels (
                            id, location_id, level_number, weight_capacity_kg, pallet_capacity,
                            height_cm, accessibility_rating, current_weight_kg, current_pallet_count
                        )
                        VALUES (%s, %s, %s, 500, 2, 180, 5, 0, 0)
                        """,
                        (str(uuid.uuid4()), loc_id, level),
                    )
                    return code
    raise RuntimeError(f"No generated lower-level capacity left for {material_type}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", default=DEFAULT_DB_URL)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    conn = psycopg2.connect(args.db_url)
    conn.autocommit = False
    moved = 0
    next_index: dict[tuple[str, str], int] = {}
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT i.id inventory_id, i.warehouse_id, i.location_code, i.quantity,
                       m.material_code, m.material_type, m.weight_kg, m.pallet_spaces,
                       m.max_pallet_weight_kg, r.abc_class, r.fms_class,
                       l.area, l.row_number, l.bay_number, l.level_number,
                       CASE WHEN l.level_number <= 3 THEN 500::numeric ELSE 300::numeric END AS cap_kg
                FROM inventory i
                JOIN materials m ON m.id = i.material_id
                JOIN locations l ON l.location_code = i.location_code
                LEFT JOIN material_issue_stats_rollup r
                       ON r.material_id = i.material_id AND r.warehouse_id = i.warehouse_id
                WHERE i.quantity > 0
                ORDER BY i.warehouse_id, l.area, l.row_number, l.bay_number, l.level_number, i.location_code
                """
            )
            rows = cur.fetchall()

            by_level: dict[tuple[str, str, str, str, int], list[dict[str, Any]]] = defaultdict(list)
            for row in rows:
                key = (
                    str(row["warehouse_id"]),
                    row["area"],
                    row["row_number"],
                    row["bay_number"],
                    int(row["level_number"]),
                )
                row["pallet_weight"] = pallet_weight(row)
                by_level[key].append(row)

            for _key, level_rows in by_level.items():
                cap = Decimal(str(level_rows[0]["cap_kg"]))
                used = sum((r["pallet_weight"] for r in level_rows), Decimal("0"))
                if used <= cap:
                    continue
                movable = sorted(level_rows, key=lambda r: (r["pallet_weight"], r["location_code"]), reverse=True)
                for row in movable:
                    if used <= cap:
                        break
                    target = create_lower_bin(cur, str(row["warehouse_id"]), row, next_index)
                    cur.execute(
                        """
                        UPDATE inventory
                        SET location_code = %s,
                            updated_at = now()
                        WHERE id = %s
                        """,
                        (target, row["inventory_id"]),
                    )
                    used -= row["pallet_weight"]
                    moved += 1

            print(f"inventory rows moved from overloaded beams: {moved}")

        if args.apply:
            conn.commit()
            print("committed")
        else:
            conn.rollback()
            print("dry-run rollback; rerun with --apply to commit")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
