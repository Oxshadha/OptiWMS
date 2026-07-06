#!/usr/bin/env python3
"""
Reconcile WMS inventory rows to physical bin/pallet capacity.

The WMS model is bin-level: one storage bin holds one pallet/LPN by default.
This script converts over-sized inventory rows such as 9,000 units in one
location into multiple inventory rows spread across compatible empty bins.

Default mode is dry-run. Use --apply to commit.
"""

from __future__ import annotations

import argparse
import math
import sys
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import psycopg2
import psycopg2.extras


DEFAULT_DB_URL = "postgresql://optiwms:optiwms@localhost:5434/optiwms"


@dataclass(frozen=True)
class Location:
    code: str
    area: str | None
    row_number: str | None
    bay_number: str | None
    level_number: int | None
    bin_position: str | None
    amalgamated_class: str | None
    max_weight_kg: Decimal | None
    max_volume_cm3: Decimal | None
    rack_status: str | None


def as_decimal(value: Any, fallback: str = "0") -> Decimal:
    if value is None:
        return Decimal(fallback)
    return Decimal(str(value))


def positive_decimal(value: Any, fallback: str = "1") -> Decimal:
    dec = as_decimal(value, fallback)
    return dec if dec > 0 else Decimal(fallback)


def norm_type(material_type: str | None) -> str:
    raw = (material_type or "raw_material").lower()
    if raw in {"packing_material", "packaging"}:
        return "packaging_material"
    if raw in {"fg", "product"}:
        return "product"
    return "raw_material"


def material_area_ok(location: Location, material_type: str) -> bool:
    area = (location.area or "").upper()
    if material_type == "raw_material":
        return area.startswith("RM") or area.startswith("R") or area in {"A", "B", "C", "D"}
    if material_type == "packaging_material":
        return area.startswith("PM") or area.startswith("PK") or area.startswith("P")
    if material_type == "product":
        return area.startswith("FG") or area[:1] in {"F", "G", "H", "I", "J", "K", "L", "M"} or "FINISHED" in area or "PRODUCT" in area
    return True


def areas_for_material(material_type: str) -> list[str]:
    if material_type == "packaging_material":
        return ["P", "Q"]
    if material_type == "product":
        return ["F", "G", "H", "I", "J", "K", "L", "M"]
    return ["R", "S", "T"]


def class_for_material(row: dict[str, Any]) -> str:
    abc = str(row.get("abc_class") or "C").upper()[:1]
    fms = str(row.get("fms_class") or "S").upper()[:1]
    if abc not in {"A", "B", "C"}:
        abc = "C"
    if fms not in {"F", "M", "S"}:
        fms = "S"
    return abc + fms


def rack_key(location: Location) -> tuple[str, str, str]:
    return (
        (location.area or "").upper(),
        str(location.row_number or ""),
        str(location.bay_number or ""),
    )


def level_key(location: Location) -> tuple[str, str, str, int]:
    return (
        (location.area or "").upper(),
        str(location.row_number or ""),
        str(location.bay_number or ""),
        int(location.level_number or 1),
    )


def level_capacity(location: Location) -> Decimal:
    level = int(location.level_number or 3)
    return Decimal("500") if level <= 3 else Decimal("300")


def distance(a: Location | None, b: Location) -> tuple[int, int, int, str]:
    if a is None:
        return (0, b.level_number or 9, 0, b.code)
    try:
        row_delta = abs(int(a.row_number or 0) - int(b.row_number or 0))
    except ValueError:
        row_delta = 99
    try:
        bay_delta = abs(int(a.bay_number or 0) - int(b.bay_number or 0))
    except ValueError:
        bay_delta = 99
    level_delta = abs((a.level_number or 3) - (b.level_number or 3))
    same_rack = 0 if rack_key(a) == rack_key(b) else 1
    return (same_rack, row_delta * 100 + bay_delta * 10 + level_delta, b.level_number or 9, b.code)


def pallet_weight(row: dict[str, Any], units_per_pallet: Decimal) -> Decimal:
    max_weight = as_decimal(row.get("max_pallet_weight_kg"))
    if max_weight > 0:
        return max_weight
    unit_weight = as_decimal(row.get("weight_kg"))
    return unit_weight * units_per_pallet if unit_weight > 0 else Decimal("0")


def pallet_volume(row: dict[str, Any], units_per_pallet: Decimal) -> Decimal:
    unit_volume = as_decimal(row.get("volume_cm3"))
    return unit_volume * units_per_pallet if unit_volume > 0 else Decimal("0")


def location_supports(location: Location, row: dict[str, Any], units_per_pallet: Decimal) -> bool:
    status = (location.rack_status or "active").lower()
    if status != "active":
        return False
    material_type = norm_type(row.get("material_type"))
    if not material_area_ok(location, material_type):
        return False
    weight = pallet_weight(row, units_per_pallet)
    if location.max_weight_kg is not None and location.max_weight_kg > 0 and weight > location.max_weight_kg:
        return False
    volume = pallet_volume(row, units_per_pallet)
    if location.max_volume_cm3 is not None and location.max_volume_cm3 > 0 and volume > location.max_volume_cm3:
        return False
    return True


def can_use_level(
    location: Location,
    row: dict[str, Any],
    units_per_pallet: Decimal,
    level_used: dict[tuple[str, str, str, int], Decimal],
) -> bool:
    weight = pallet_weight(row, units_per_pallet)
    if weight <= 0:
        return True
    key = level_key(location)
    return level_used.get(key, Decimal("0")) + weight <= level_capacity(location)


def calibrated_units_per_pallet(row: dict[str, Any], target_pallet_weight_kg: Decimal) -> Decimal:
    current = positive_decimal(row.get("pallet_spaces"))
    unit_weight = as_decimal(row.get("weight_kg"))
    if unit_weight <= 0 or target_pallet_weight_kg <= 0:
        return current
    current_weight = unit_weight * current
    if current_weight <= target_pallet_weight_kg:
        return current
    fitted = int(target_pallet_weight_kg // unit_weight)
    return Decimal(max(fitted, 1))


def fetch_locations(cur, warehouse_id: str) -> dict[str, Location]:
    cur.execute(
        """
        SELECT location_code, area, row_number, bay_number, level_number, bin_position,
               amalgamated_class, max_weight_kg, max_volume_cm3, rack_status
        FROM locations
        WHERE warehouse_id = %s
          AND is_active = true
          AND zone_type = 'STORAGE'
          AND location_code IS NOT NULL
        """,
        (warehouse_id,),
    )
    locations: dict[str, Location] = {}
    for row in cur.fetchall():
        locations[row["location_code"]] = Location(
            code=row["location_code"],
            area=row["area"],
            row_number=row["row_number"],
            bay_number=row["bay_number"],
            level_number=row["level_number"],
            bin_position=row["bin_position"],
            amalgamated_class=row["amalgamated_class"],
            max_weight_kg=row["max_weight_kg"],
            max_volume_cm3=row["max_volume_cm3"],
            rack_status=row["rack_status"],
        )
    return locations


def create_auto_bins(
    cur,
    warehouse_id: str,
    row: dict[str, Any],
    bins_needed: int,
    existing: dict[str, Location],
    auto_next_index: dict[tuple[str, str], int],
) -> list[Location]:
    material_type = norm_type(row.get("material_type"))
    slot_class = class_for_material(row)

    created: list[Location] = []
    remaining_bins = bins_needed
    for area in areas_for_material(material_type):
        if remaining_bins <= 0:
            break

        idx_key = (warehouse_id, area)
        if idx_key not in auto_next_index:
            max_index = 0
            for loc in existing.values():
                if (loc.area or "").upper() != area:
                    continue
                try:
                    row_no = int(str(loc.row_number or "0"))
                    bay_no = int(str(loc.bay_number or "0"))
                except ValueError:
                    continue
                if 90 <= row_no <= 99 and 1 <= bay_no <= 999:
                    max_index = max(max_index, (row_no - 90) * 999 + bay_no)
            auto_next_index[idx_key] = max_index + 1

        start_bay_index = auto_next_index[idx_key]
        available_racks = max(0, 9990 - (start_bay_index - 1))
        racks_to_create = min(max(1, math.ceil(remaining_bins / 10)), available_racks)
        if racks_to_create <= 0:
            continue

        for rack_offset in range(racks_to_create):
            row_no = 90 + ((start_bay_index + rack_offset - 1) // 999)
            row_code = f"{row_no:02d}"
            bay_no = ((start_bay_index + rack_offset - 1) % 999) + 1
            bay_code = f"{bay_no:03d}"
            x = Decimal(row_no * 12)
            y = Decimal(ord(area[0]) * 10)
            for level in range(1, 6):
                level_cap = Decimal("500") if level <= 3 else Decimal("300")
                for bin_pos in ("A", "B"):
                    code = f"{area}-{row_code}-{bay_code}-{level}-{bin_pos}"
                    if code in existing:
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
                            0, %s, 1200000, 1,
                            %s, %s, %s, %s
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
                            f"Auto-generated {area} rack for bin-level inventory allocation",
                            level_cap,
                            5 if level <= 2 else 3,
                            x,
                            y,
                            Decimal((level - 1) * 2),
                        ),
                    )
                    cur.execute(
                        """
                        INSERT INTO location_levels (
                            id, location_id, level_number, weight_capacity_kg, pallet_capacity,
                            height_cm, accessibility_rating, current_weight_kg, current_pallet_count
                        )
                        VALUES (%s, %s, %s, %s, 2, 180, %s, 0, 0)
                        """,
                        (str(uuid.uuid4()), loc_id, level, level_cap, 5 if level <= 2 else 3),
                    )
                    loc = Location(
                        code=code,
                        area=area,
                        row_number=row_code,
                        bay_number=bay_code,
                        level_number=level,
                        bin_position=bin_pos,
                        amalgamated_class=slot_class,
                        max_weight_kg=level_cap,
                        max_volume_cm3=Decimal("1200000"),
                        rack_status="active",
                    )
                    existing[code] = loc
                    created.append(loc)
                    remaining_bins -= 1
                    if remaining_bins <= 0:
                        break
                    if remaining_bins <= 0:
                        break
            if remaining_bins <= 0:
                break
        auto_next_index[idx_key] = start_bay_index + racks_to_create
    if remaining_bins > 0:
        raise RuntimeError(f"Auto-generated storage exhausted for {material_type}; remaining bins: {remaining_bins}")
    return created[:bins_needed]


def inventory_columns(cur) -> list[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inventory'
        ORDER BY ordinal_position
        """
    )
    return [row["column_name"] for row in cur.fetchall()]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", default=DEFAULT_DB_URL)
    parser.add_argument("--warehouse-id", default=None)
    parser.add_argument("--apply", action="store_true", help="Commit changes. Without this, rollback after reporting.")
    parser.add_argument("--limit", type=int, default=0, help="Limit oversized source rows for testing.")
    parser.add_argument(
        "--target-pallet-weight-kg",
        default="250",
        help="Used to calibrate units-per-pallet when material pallet specs exceed rack limits.",
    )
    parser.add_argument(
        "--no-calibrate-pallet-specs",
        action="store_true",
        help="Do not update material pallet_spaces/max_pallet_weight_kg before splitting inventory.",
    )
    parser.add_argument(
        "--auto-create-locations",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Create additional RM/PM/FG racks when current layout capacity is insufficient.",
    )
    args = parser.parse_args()

    conn = psycopg2.connect(args.db_url)
    try:
        conn.autocommit = False
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            columns = inventory_columns(cur)
            copy_columns = [
                c for c in columns
                if c not in {"id", "created_at", "updated_at", "quantity", "available_quantity", "reserved_quantity", "location_code", "lpn_code"}
            ]

            params: list[Any] = []
            warehouse_filter = ""
            if args.warehouse_id:
                warehouse_filter = "AND i.warehouse_id = %s"
                params.append(args.warehouse_id)

            limit_sql = ""
            if args.limit > 0:
                limit_sql = "LIMIT %s"
                params.append(args.limit)

            cur.execute(
                f"""
                SELECT i.*, m.material_code, m.material_type, m.pallet_spaces,
                       m.weight_kg, m.volume_cm3, m.max_pallet_weight_kg,
                       r.abc_class, r.fms_class
                FROM inventory i
                JOIN materials m ON m.id = i.material_id
                LEFT JOIN material_issue_stats_rollup r
                       ON r.material_id = i.material_id AND r.warehouse_id = i.warehouse_id
                WHERE COALESCE(i.quantity, 0) > 0
                  {warehouse_filter}
                ORDER BY i.warehouse_id, m.material_code, i.location_code NULLS LAST
                {limit_sql}
                """,
                params,
            )
            rows = cur.fetchall()

            touched = 0
            inserted = 0
            calibrated = 0
            skipped: list[str] = []
            location_cache: dict[str, dict[str, Location]] = {}
            occupied_by_wh: dict[str, set[str]] = {}
            level_used_by_wh: dict[str, dict[tuple[str, str, str, int], Decimal]] = {}
            auto_next_index: dict[tuple[str, str], int] = {}
            target_pallet_weight = Decimal(str(args.target_pallet_weight_kg))

            for row in rows:
                warehouse_id = str(row["warehouse_id"])
                if warehouse_id not in location_cache:
                    location_cache[warehouse_id] = fetch_locations(cur, warehouse_id)
                    cur.execute(
                        """
                        SELECT location_code
                        FROM inventory
                        WHERE warehouse_id = %s
                          AND COALESCE(quantity, 0) > 0
                          AND location_code IS NOT NULL
                        """,
                        (warehouse_id,),
                    )
                    occupied_by_wh[warehouse_id] = {r["location_code"] for r in cur.fetchall()}
                    cur.execute(
                        """
                        SELECT i.location_code, i.quantity, m.weight_kg, m.pallet_spaces,
                               m.max_pallet_weight_kg, l.area, l.row_number, l.bay_number, l.level_number
                        FROM inventory i
                        JOIN materials m ON m.id = i.material_id
                        JOIN locations l ON l.location_code = i.location_code
                        WHERE i.warehouse_id = %s
                          AND COALESCE(i.quantity, 0) > 0
                        """,
                        (warehouse_id,),
                    )
                    level_used: dict[tuple[str, str, str, int], Decimal] = {}
                    for occ in cur.fetchall():
                        loc = location_cache[warehouse_id].get(occ["location_code"])
                        if loc is None:
                            continue
                        upp = positive_decimal(occ.get("pallet_spaces"))
                        qty = int(occ.get("quantity") or 0)
                        pallets = max(1, math.ceil(qty / int(upp))) if qty > 0 else 0
                        weight = pallet_weight(occ, upp) * Decimal(pallets)
                        level_used[level_key(loc)] = level_used.get(level_key(loc), Decimal("0")) + weight
                    level_used_by_wh[warehouse_id] = level_used

                locations = location_cache[warehouse_id]
                occupied = occupied_by_wh[warehouse_id]
                level_used = level_used_by_wh[warehouse_id]
                units_per_pallet = positive_decimal(row.get("pallet_spaces"))
                if not args.no_calibrate_pallet_specs:
                    revised = calibrated_units_per_pallet(row, target_pallet_weight)
                    if revised != units_per_pallet:
                        revised_weight = as_decimal(row.get("weight_kg")) * revised
                        cur.execute(
                            """
                            UPDATE materials
                            SET pallet_spaces = %s,
                                max_pallet_weight_kg = %s,
                                updated_at = now()
                            WHERE id = %s
                            """,
                            (revised, revised_weight, row["material_id"]),
                        )
                        row["pallet_spaces"] = revised
                        row["max_pallet_weight_kg"] = revised_weight
                        units_per_pallet = revised
                        calibrated += 1
                qty = int(row["quantity"])
                required = max(1, math.ceil(qty / int(units_per_pallet)))
                current_code = row.get("location_code")
                current_location = locations.get(current_code) if current_code else None

                current_level_ok = (
                    current_location is not None
                    and location_supports(current_location, row, units_per_pallet)
                    and required <= 1
                    and level_used.get(level_key(current_location), Decimal("0")) <= level_capacity(current_location)
                )
                if current_level_ok:
                    continue

                if current_location is not None and current_code in occupied:
                    occupied.remove(current_code)
                    level_used[level_key(current_location)] = max(
                        Decimal("0"),
                        level_used.get(level_key(current_location), Decimal("0"))
                        - pallet_weight(row, units_per_pallet) * Decimal(required),
                    )

                candidates = [
                    loc for loc in locations.values()
                    if loc.code == current_code or loc.code not in occupied
                    if location_supports(loc, row, units_per_pallet)
                    if can_use_level(loc, row, units_per_pallet, level_used)
                ]
                candidates.sort(key=lambda loc: distance(current_location, loc))

                if len(candidates) < required:
                    if args.auto_create_locations:
                        created = create_auto_bins(
                            cur,
                            warehouse_id,
                            row,
                            required - len(candidates),
                            locations,
                            auto_next_index,
                        )
                        candidates.extend([
                            loc for loc in created
                            if location_supports(loc, row, units_per_pallet)
                            if can_use_level(loc, row, units_per_pallet, level_used)
                        ])
                        candidates.sort(key=lambda loc: distance(current_location, loc))
                    if len(candidates) < required:
                        skipped.append(
                            f"{row['material_code']}: needs {required} bins, only {len(candidates)} compatible bins available"
                        )
                        continue

                allocations: list[tuple[Location, int]] = []
                remaining = qty
                per_pallet = int(units_per_pallet)
                for loc in candidates[:required]:
                    alloc_qty = min(remaining, per_pallet)
                    allocations.append((loc, alloc_qty))
                    remaining -= alloc_qty
                    occupied.add(loc.code)
                    level_used[level_key(loc)] = (
                        level_used.get(level_key(loc), Decimal("0"))
                        + pallet_weight(row, units_per_pallet)
                    )

                first_loc, first_qty = allocations[0]
                first_reserved = min(int(row.get("reserved_quantity") or 0), first_qty)
                cur.execute(
                    """
                    UPDATE inventory
                    SET location_code = %s,
                        quantity = %s,
                        available_quantity = %s,
                        reserved_quantity = %s,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (
                        first_loc.code,
                        first_qty,
                        max(0, first_qty - first_reserved),
                        first_reserved,
                        row["id"],
                    ),
                )
                touched += 1

                insert_columns = ["id", *copy_columns, "location_code", "lpn_code", "quantity", "available_quantity", "reserved_quantity"]
                placeholders = ", ".join(["%s"] * len(insert_columns))
                quoted = ", ".join(insert_columns)
                insert_sql = f"INSERT INTO inventory ({quoted}) VALUES ({placeholders})"

                for seq, (loc, alloc_qty) in enumerate(allocations[1:], start=2):
                    values = [str(uuid.uuid4())]
                    values.extend(row.get(col) for col in copy_columns)
                    values.extend([
                        loc.code,
                        f"ALLOC-{seq}-{uuid.uuid4().hex[:8]}",
                        alloc_qty,
                        alloc_qty,
                        0,
                    ])
                    cur.execute(insert_sql, values)
                    inserted += 1

            print(f"oversized/source rows reconciled: {touched}")
            print(f"new bin-level inventory rows inserted: {inserted}")
            print(f"material pallet specs calibrated: {calibrated}")
            cur.execute(
                """
                SELECT count(*) AS auto_bins,
                       count(DISTINCT area || '-' || row_number || '-' || bay_number) AS auto_racks
                FROM locations
                WHERE warehouse_id = COALESCE(%s::uuid, warehouse_id)
                  AND description = 'Auto-generated ' || area || ' rack for bin-level inventory allocation'
                """,
                (args.warehouse_id,),
            )
            auto = cur.fetchone()
            print(f"auto-generated storage bins in transaction: {auto['auto_bins']}")
            print(f"auto-generated storage racks in transaction: {auto['auto_racks']}")
            if skipped:
                print("skipped rows:")
                for item in skipped[:20]:
                    print(f"  - {item}")
                if len(skipped) > 20:
                    print(f"  ... {len(skipped) - 20} more")

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
