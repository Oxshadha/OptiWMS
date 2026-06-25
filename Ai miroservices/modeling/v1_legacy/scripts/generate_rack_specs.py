"""
Rack Specs Generator — Phase 1.4
Formalizes rack specifications with per-level, per-storage-type capacity.
Mirrors values from RackDataSeeder.java and config.py.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from common import OUT_DIR

GENERATED_DIR = OUT_DIR / "generated"
SEED = 42

AREAS = {
    "RM": {"name": "Raw Materials Storage", "aisles": 10, "bays_per_aisle": 4, "levels": 5},
    "FG": {"name": "Finished Goods Storage", "aisles": 15, "bays_per_aisle": 4, "levels": 5},
    "PK": {"name": "Picking Area",          "aisles": 5,  "bays_per_aisle": 3, "levels": 3},
    "PA": {"name": "Putaway Area",          "aisles": 5,  "bays_per_aisle": 3, "levels": 3},
    "RC": {"name": "Reception Area",        "aisles": 3,  "bays_per_aisle": 2, "levels": 2},
    "SH": {"name": "Shipping Area",         "aisles": 3,  "bays_per_aisle": 2, "levels": 2},
}

LEVEL_SPECS = {
    1: {"weight_cap_kg": 2000, "pallet_cap": 2, "height_cm": 150, "accessibility": 10},
    2: {"weight_cap_kg": 1500, "pallet_cap": 2, "height_cm": 170, "accessibility": 8},
    3: {"weight_cap_kg": 1000, "pallet_cap": 2, "height_cm": 190, "accessibility": 6},
    4: {"weight_cap_kg": 800,  "pallet_cap": 1, "height_cm": 210, "accessibility": 4},
    5: {"weight_cap_kg": 500,  "pallet_cap": 1, "height_cm": 230, "accessibility": 2},
}

STORAGE_TYPE_LEVEL_RULES = {
    "PALLET": {"allowed_levels": [1, 2, 3, 4, 5], "max_units": {1: 2, 2: 2, 3: 2, 4: 1, 5: 1}},
    "DRUM":   {"allowed_levels": [1, 2, 3],       "max_units": {1: 4, 2: 3, 3: 2}},
    "IBC":    {"allowed_levels": [1],              "max_units": {1: 1}},
    "CARTON": {"allowed_levels": [1, 2, 3, 4, 5], "max_units": {1: 20, 2: 18, 3: 15, 4: 12, 5: 8}},
    "BAG":    {"allowed_levels": [1, 2, 3, 4, 5], "max_units": {1: 10, 2: 8, 3: 6, 4: 4, 5: 3}},
    "ROLL":   {"allowed_levels": [1, 2, 3, 4],    "max_units": {1: 6, 2: 5, 3: 4, 4: 3}},
    "REEL":   {"allowed_levels": [2, 3, 4, 5],    "max_units": {2: 4, 3: 3, 4: 2, 5: 2}},
}

AREA_ZONE_MAP = {
    "RM": "A",  # Raw materials -> Zone A
    "FG": "B",  # Finished goods -> Zone B
    "PK": "C",  # Picking -> Zone C
    "PA": "D",  # Putaway -> Zone D
    "RC": "E",
    "SH": "F",
}

BINS_PER_LEVEL = {1: 3, 2: 3, 3: 3, 4: 2, 5: 2}


def generate_rack_specs() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Generate rack locations and per-level specs."""
    locations = []
    level_specs = []
    rng = np.random.default_rng(SEED)

    for area_code, area_cfg in AREAS.items():
        zone = AREA_ZONE_MAP[area_code]
        n_levels = area_cfg["levels"]

        for aisle in range(1, area_cfg["aisles"] + 1):
            for bay in range(1, area_cfg["bays_per_aisle"] + 1):
                aisle_factor = 1.0 - ((aisle - 1) / area_cfg["aisles"]) * 0.5
                bay_factor = 1.0 - ((bay - 1) / area_cfg["bays_per_aisle"]) * 0.3
                rack_accessibility = max(1, min(10, int(round(5 + (aisle_factor + bay_factor) * 5))))

                for level in range(1, n_levels + 1):
                    spec = LEVEL_SPECS[level]
                    n_bins = BINS_PER_LEVEL.get(level, 2)
                    bin_labels = ["A", "B", "C"][:n_bins]

                    for bin_pos in bin_labels:
                        loc_code = f"{zone}-{aisle:02d}-{bay:02d}-{level}-{bin_pos}"
                        locations.append({
                            "location_code": loc_code,
                            "area": area_code,
                            "area_name": area_cfg["name"],
                            "zone": zone,
                            "aisle": aisle,
                            "bay": bay,
                            "level": level,
                            "bin_position": bin_pos,
                            "weight_capacity_kg": spec["weight_cap_kg"],
                            "pallet_capacity": spec["pallet_cap"],
                            "height_cm": spec["height_cm"],
                            "accessibility_rating": rack_accessibility,
                            "level_accessibility": spec["accessibility"],
                            "coordinate_x": aisle * 200 + bay * 50,
                            "coordinate_y": level * 150,
                        })

                    level_specs.append({
                        "area": area_code,
                        "aisle": aisle,
                        "bay": bay,
                        "level": level,
                        "weight_capacity_kg": spec["weight_cap_kg"],
                        "pallet_capacity": spec["pallet_cap"],
                        "height_cm": spec["height_cm"],
                        "accessibility": spec["accessibility"],
                        "bins": n_bins,
                    })

    return pd.DataFrame(locations), pd.DataFrame(level_specs)


def generate_storage_type_capacity_matrix() -> pd.DataFrame:
    """Storage type x level -> max unit capacity."""
    rows = []
    for st, rules in STORAGE_TYPE_LEVEL_RULES.items():
        for level in range(1, 6):
            rows.append({
                "storage_type": st,
                "level": level,
                "allowed": level in rules["allowed_levels"],
                "max_units": rules["max_units"].get(level, 0),
                "weight_cap_kg": LEVEL_SPECS[level]["weight_cap_kg"],
                "height_cm": LEVEL_SPECS[level]["height_cm"],
            })
    return pd.DataFrame(rows)


def main() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    locations_df, levels_df = generate_rack_specs()
    capacity_matrix = generate_storage_type_capacity_matrix()

    loc_path = GENERATED_DIR / "rack_locations.csv"
    levels_path = GENERATED_DIR / "rack_level_specs.csv"
    cap_path = GENERATED_DIR / "storage_type_capacity_matrix.csv"

    locations_df.to_csv(loc_path, index=False)
    levels_df.to_csv(levels_path, index=False)
    capacity_matrix.to_csv(cap_path, index=False)

    summary = {
        "total_locations": len(locations_df),
        "total_levels": len(levels_df),
        "areas": {
            area: {
                "racks": int(locations_df[locations_df["area"] == area]["location_code"]
                             .apply(lambda x: "-".join(x.split("-")[:3])).nunique()),
                "locations": int((locations_df["area"] == area).sum()),
            }
            for area in AREAS
        },
        "storage_types": len(STORAGE_TYPE_LEVEL_RULES),
    }
    summary_path = GENERATED_DIR / "rack_specs_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"Rack locations: {loc_path} ({len(locations_df)} locations)")
    print(f"Level specs: {levels_path} ({len(levels_df)} level entries)")
    print(f"Capacity matrix: {cap_path}")
    print(f"Summary: {summary_path}")
    for area, info in summary["areas"].items():
        print(f"  {area}: {info['racks']} racks, {info['locations']} locations")


if __name__ == "__main__":
    main()
