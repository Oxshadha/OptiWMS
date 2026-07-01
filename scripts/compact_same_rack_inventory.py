#!/usr/bin/env python3
"""Compact inventory inside the same rack from upper bins into lower empty bins.

This is intentionally conservative: no SKU changes rack, no cross-zone movement happens,
and every move is checked against bin and level beam weight capacity.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor


DEFAULT_DB_URL = "postgresql://optiwms:optiwms@localhost:5434/optiwms"


@dataclass(frozen=True)
class Location:
    code: str
    warehouse_id: str
    area: str
    row_number: str
    bay_number: str
    level_number: int
    bin_position: str
    rack_status: str
    max_weight_kg: Decimal

    @property
    def rack_key(self) -> tuple[str, str, str, str]:
        return (self.warehouse_id, self.area, self.row_number, self.bay_number)

    @property
    def level_key(self) -> tuple[str, str, str, str, int]:
        return (*self.rack_key, self.level_number)


def dec(value: Any, default: str = "0") -> Decimal:
    if value is None:
        return Decimal(default)
    return Decimal(str(value))


def pallet_weight(row: dict[str, Any]) -> Decimal:
    max_pallet_weight = dec(row.get("max_pallet_weight_kg"))
    if max_pallet_weight > 0:
        return max_pallet_weight
    units = dec(row.get("units_per_pallet") or row.get("pallet_spaces") or 1, "1")
    return dec(row.get("weight_kg")) * units


def supports(location: Location, row: dict[str, Any]) -> bool:
    if (location.rack_status or "active").lower() != "active":
        return False
    weight = pallet_weight(row)
    if location.max_weight_kg > 0 and weight > location.max_weight_kg:
        return False
    return True


def load_locations(cur) -> dict[str, Location]:
    cur.execute(
        """
        SELECT location_code, warehouse_id::text AS warehouse_id, area, row_number, bay_number,
               level_number, bin_position, COALESCE(rack_status, 'active') AS rack_status,
               COALESCE(max_weight_kg, CASE WHEN level_number <= 3 THEN 500 ELSE 300 END) AS max_weight_kg
        FROM locations
        WHERE zone_type = 'STORAGE'
          AND COALESCE(is_active, true) = true
        """
    )
    return {
        row["location_code"]: Location(
            code=row["location_code"],
            warehouse_id=row["warehouse_id"],
            area=(row["area"] or "").upper(),
            row_number=str(row["row_number"] or ""),
            bay_number=str(row["bay_number"] or ""),
            level_number=int(row["level_number"] or 1),
            bin_position=(row["bin_position"] or "").upper(),
            rack_status=row["rack_status"],
            max_weight_kg=dec(row["max_weight_kg"]),
        )
        for row in cur.fetchall()
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", default=os.getenv("DATABASE_URL", DEFAULT_DB_URL))
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--warehouse-id")
    parser.add_argument("--limit", type=int, default=0, help="Optional max moves for one run.")
    args = parser.parse_args()

    conn = psycopg2.connect(args.db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            locations = load_locations(cur)

            where = "WHERE i.quantity > 0 AND i.location_code IS NOT NULL"
            params: list[Any] = []
            if args.warehouse_id:
                where += " AND i.warehouse_id = %s"
                params.append(args.warehouse_id)

            cur.execute(
                f"""
                SELECT i.id::text AS inventory_id, i.location_code, i.quantity,
                       i.material_id::text AS material_id, m.material_code,
                       m.units_per_pallet, m.pallet_spaces, m.max_pallet_weight_kg, m.weight_kg
                FROM inventory i
                JOIN materials m ON m.id = i.material_id
                {where}
                ORDER BY i.warehouse_id, m.material_code, i.location_code
                """,
                params,
            )
            rows = [row for row in cur.fetchall() if row["location_code"] in locations]

            occupied = {row["location_code"] for row in rows}
            level_used: dict[tuple[str, str, str, str, int], Decimal] = defaultdict(Decimal)
            rows_by_code = {row["location_code"]: row for row in rows}
            for row in rows:
                loc = locations[row["location_code"]]
                level_used[loc.level_key] += pallet_weight(row)

            locations_by_rack: dict[tuple[str, str, str, str], list[Location]] = defaultdict(list)
            for loc in locations.values():
                locations_by_rack[loc.rack_key].append(loc)
            for rack_locations in locations_by_rack.values():
                rack_locations.sort(key=lambda l: (-l.level_number, l.bin_position))

            level_caps: dict[tuple[str, str, str, str, int], Decimal] = defaultdict(Decimal)
            for loc in locations.values():
                level_caps[loc.level_key] += loc.max_weight_kg

            moves: list[tuple[str, str, str, str]] = []
            sources = sorted(
                rows,
                key=lambda row: (
                    locations[row["location_code"]].warehouse_id,
                    locations[row["location_code"]].area,
                    locations[row["location_code"]].row_number,
                    locations[row["location_code"]].bay_number,
                    -locations[row["location_code"]].level_number,
                    locations[row["location_code"]].bin_position,
                ),
            )

            for row in sources:
                source = locations[row["location_code"]]
                if source.level_number <= 1:
                    continue
                weight = pallet_weight(row)
                candidates = [
                    loc
                    for loc in locations_by_rack[source.rack_key]
                    if loc.level_number < source.level_number
                    and loc.code not in occupied
                    and supports(loc, row)
                    and level_used[loc.level_key] + weight <= level_caps[loc.level_key]
                ]
                candidates.sort(key=lambda loc: (-loc.level_number, loc.bin_position))
                if not candidates:
                    continue
                target = candidates[0]
                occupied.remove(source.code)
                occupied.add(target.code)
                level_used[source.level_key] = max(Decimal("0"), level_used[source.level_key] - weight)
                level_used[target.level_key] += weight
                rows_by_code.pop(source.code, None)
                rows_by_code[target.code] = row
                moves.append((row["inventory_id"], source.code, target.code, row["material_code"]))
                if args.limit and len(moves) >= args.limit:
                    break

            print(f"same-rack compaction moves: {len(moves)}")
            for inventory_id, source, target, material_code in moves[:20]:
                print(f"{material_code}: {source} -> {target} ({inventory_id})")
            if len(moves) > 20:
                print(f"... {len(moves) - 20} more")

            if args.apply:
                for inventory_id, _source, target, _material_code in moves:
                    cur.execute(
                        """
                        UPDATE inventory
                        SET location_code = %s,
                            updated_at = now()
                        WHERE id = %s
                        """,
                        (target, inventory_id),
                    )
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
