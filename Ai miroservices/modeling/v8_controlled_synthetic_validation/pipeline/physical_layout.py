from __future__ import annotations

import json
import math
import uuid
from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs"
DATA = OUTPUT / "data"
BASELINE_OUTPUT = ROOT.parent / "project_operational_baseline" / "outputs"
SEED = 20260711
LAYOUT_VERSION = "CMB_METRIC_AISLE_V8_EXPANSION"
PALLET_VOLUME_CM3 = 1_800_000.0

OPERATIONAL_APRON_COORDINATES = {
    "QTN-01": (-31.0, -12.0),
    "RCV-01": (-7.0, -12.0),
    "STG-01": (17.0, -12.0),
    "PACK-01": (41.0, -12.0),
    "DSP-01": (65.0, -12.0),
    "DOOR-01": (17.0, -24.0),
}


def _stable_uuid(kind: str, key: str) -> str:
    namespace = uuid.UUID("791ff7ca-a3f0-4ce2-ad95-02ac0438064e")
    return str(uuid.uuid5(namespace, f"v8:{kind}:{key}"))


def _align_operational_apron(layout: pd.DataFrame) -> pd.DataFrame:
    """Place operational functions on realistic, separately readable positions."""
    aligned = layout.copy()
    for location_code, (coordinate_x, coordinate_y) in OPERATIONAL_APRON_COORDINATES.items():
        location_mask = aligned["location_code"].eq(location_code)
        aligned.loc[location_mask, ["coordinate_x", "coordinate_y"]] = (
            coordinate_x,
            coordinate_y,
        )
    return aligned


def _align_velocity_zones_to_doors(layout: pd.DataFrame) -> pd.DataFrame:
    """Assign rack F/M/S suffixes by travel depth from the nearest door.

    ABC remains the capacity/value compatibility prefix. FMS on a physical rack
    is a velocity zone: the nearest third of racks is Fast, the middle third is
    Medium, and the deepest third is Slow. This keeps the physical layout and
    slotting meaning aligned instead of scattering velocity suffixes randomly.
    """
    aligned = layout.copy()
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
    racks["door_distance"] = np.abs(
        rack_points[:, None, :] - door_points[None, :, :]
    ).sum(axis=2).min(axis=1)
    racks = racks.sort_values(["door_distance", *rack_keys]).reset_index(drop=True)
    fast_max = racks.iloc[(len(racks) - 1) // 3]["door_distance"]
    medium_max = racks.iloc[(len(racks) * 2 - 1) // 3]["door_distance"]
    racks["velocity_class"] = np.select(
        [racks["door_distance"].le(fast_max), racks["door_distance"].le(medium_max)],
        ["F", "M"],
        default="S",
    )
    velocity_by_rack = racks.set_index(rack_keys)["velocity_class"]
    storage_index = pd.MultiIndex.from_frame(aligned.loc[storage_mask, rack_keys])
    suffixes = velocity_by_rack.reindex(storage_index).to_numpy()
    prefixes = aligned.loc[storage_mask, "physical_class"].astype("string").str[0].str.upper()
    valid_prefix = prefixes.isin(["A", "B", "C"])
    aligned.loc[storage_mask, "physical_class"] = np.where(
        valid_prefix,
        prefixes.fillna("C").to_numpy() + suffixes,
        aligned.loc[storage_mask, "physical_class"],
    )
    return aligned


def _read_baseline_materials() -> pd.DataFrame:
    return pd.concat(
        [
            pd.read_csv(BASELINE_OUTPUT / "materials.csv.gz"),
            pd.read_csv(BASELINE_OUTPUT / "finished_goods.csv.gz"),
        ],
        ignore_index=True,
        sort=False,
    )


def _classifications() -> pd.DataFrame:
    demand = pd.read_csv(DATA / "material_demand.csv", parse_dates=["month"])
    production = pd.read_csv(DATA / "production_plan_actuals.csv", parse_dates=["month"])
    finished_goods = pd.read_csv(DATA / "finished_goods.csv")

    cutoff = demand["month"].max() - pd.DateOffset(months=11)
    rm_pm = (
        demand.loc[demand["month"].ge(cutoff)]
        .groupby(["material_code", "material_type"], as_index=False)
        .agg(
            issue_volume_12m=("demand_units", "sum"),
            issue_count_12m=("demand_units", lambda values: int((values > 0).sum())),
        )
    )
    fg_cutoff = production["month"].max() - pd.DateOffset(months=11)
    fg = (
        production.loc[production["month"].ge(fg_cutoff)]
        .groupby("fg_id", as_index=False)
        .agg(
            issue_volume_12m=("actual_fg_units", "sum"),
            issue_count_12m=("actual_fg_units", lambda values: int((values > 0).sum())),
        )
        .merge(finished_goods[["fg_id", "fg_code"]], on="fg_id", how="left")
        .rename(columns={"fg_code": "material_code"})
    )
    fg["material_type"] = "product"
    frame = pd.concat(
        [
            rm_pm,
            fg[["material_code", "material_type", "issue_volume_12m", "issue_count_12m"]],
        ],
        ignore_index=True,
    )

    classified = []
    for _, group in frame.groupby("material_type", sort=True):
        group = group.sort_values(["issue_volume_12m", "material_code"], ascending=[False, True]).copy()
        total = max(float(group["issue_volume_12m"].sum()), 1.0)
        group["cumulative_usage_share"] = group["issue_volume_12m"].cumsum() / total
        group["abc_class"] = np.select(
            [
                group["cumulative_usage_share"].le(0.80),
                group["cumulative_usage_share"].le(0.95),
            ],
            ["A", "B"],
            default="C",
        )
        group["fms_class"] = np.select(
            [group["issue_count_12m"].ge(10), group["issue_count_12m"].ge(5)],
            ["F", "M"],
            default="S",
        )
        group["amalgamated_class"] = group["abc_class"] + group["fms_class"]
        classified.append(group)
    return pd.concat(classified, ignore_index=True).sort_values("material_code").reset_index(drop=True)


def _physical_materials(classifications: pd.DataFrame) -> pd.DataFrame:
    v8_materials = pd.read_csv(DATA / "materials.csv")
    finished_goods = pd.read_csv(DATA / "finished_goods.csv")
    baseline = _read_baseline_materials()
    baseline_by_code = baseline.set_index("material_code", drop=False)

    records: list[dict] = []

    def template_for(code: str, material_type: str, index: int) -> pd.Series:
        if code in baseline_by_code.index:
            return baseline_by_code.loc[code]
        candidates = baseline.loc[baseline["material_type"].eq(material_type)].sort_values("material_code")
        if candidates.empty:
            raise RuntimeError(f"No physical template for {material_type}")
        return candidates.iloc[index % len(candidates)]

    for index, row in enumerate(v8_materials.sort_values("material_code").itertuples(index=False)):
        template = template_for(row.material_code, row.material_type, index)
        records.append(
            _material_record(
                row.material_code,
                row.description,
                row.material_type,
                float(row.unit_cost),
                float(row.moq),
                float(row.order_multiple),
                int(row.lead_time_days),
                template,
            )
        )
    for index, row in enumerate(finished_goods.sort_values("fg_code").itertuples(index=False)):
        template = template_for(row.fg_code, "product", index)
        records.append(
            _material_record(
                row.fg_code,
                f"Controlled finished good {row.fg_code}",
                "product",
                float(template.unit_cost),
                1.0,
                1.0,
                1,
                template,
            )
        )

    frame = pd.DataFrame(records).merge(
        classifications,
        on=["material_code", "material_type"],
        how="left",
        validate="one_to_one",
    )
    if frame["amalgamated_class"].isna().any():
        raise RuntimeError("Every physical material must have an ABC/FMS classification")
    return frame.sort_values("material_code").reset_index(drop=True)


def _material_record(
    code: str,
    description: str,
    material_type: str,
    unit_cost: float,
    moq: float,
    order_multiple: float,
    lead_time_days: int,
    template: pd.Series,
) -> dict:
    units_per_pallet = max(1, int(round(float(template.units_per_pallet))))
    unit_weight = float(template.weight_kg)
    unit_volume = float(template.volume_cm3)
    pallet_weight = unit_weight * units_per_pallet
    pallet_volume = unit_volume * units_per_pallet
    if pallet_weight > 1_200.0 + 1e-6 or pallet_volume > PALLET_VOLUME_CM3 + 1e-6:
        raise RuntimeError(f"Physical template exceeds pallet limits for {code}")
    return {
        "material_code": code,
        "description": description,
        "material_type": material_type,
        "category": str(template.category),
        "unit_type": str(template.unit_type),
        "storage_type": str(template.storage_type),
        "handling_unit_type": str(template.handling_unit_type),
        "units_per_handling_unit": float(template.units_per_handling_unit),
        "order_multiple": order_multiple,
        "min_order_quantity": moq,
        "lead_time_days": lead_time_days,
        "unit_cost": unit_cost,
        "length_cm": float(template.length_cm),
        "width_cm": float(template.width_cm),
        "height_cm": float(template.height_cm),
        "weight_kg": unit_weight,
        "volume_cm3": unit_volume,
        "units_per_pallet": units_per_pallet,
        "pallet_spaces": float(template.pallet_spaces),
        "pallet_weight_kg": pallet_weight,
        "pallet_volume_cm3": pallet_volume,
        "stackable": bool(template.stackable),
        "max_stack_height": int(template.max_stack_height),
        "temperature_controlled": bool(template.temperature_controlled),
        "hazardous": bool(template.hazardous),
        "fragile": bool(template.fragile),
        "shelf_life_days": int(template.shelf_life_days),
        "physical_template_code": str(template.material_code),
        "physical_provenance": "PROJECT_OPERATIONAL_SYNTHETIC_TEMPLATE_MATCH",
    }


def _inventory_capacity(materials: pd.DataFrame) -> pd.DataFrame:
    source_materials = pd.read_csv(DATA / "materials.csv")
    initial = pd.read_csv(DATA / "initial_inventory.csv")
    policy = pd.read_csv(OUTPUT / "inventory_policy_simulation.csv")
    production = pd.read_csv(DATA / "production_plan_actuals.csv", parse_dates=["month"])
    finished_goods = pd.read_csv(DATA / "finished_goods.csv")

    rm_pm = (
        source_materials[["material_id", "material_code"]]
        .merge(initial[["material_id", "initial_on_hand"]], on="material_id", how="left")
        .merge(
            policy[
                [
                    "material_id",
                    "safety_stock",
                    "proposed_min",
                    "proposed_max",
                    "reorder_point",
                    "order_quantity",
                ]
            ],
            on="material_id",
            how="left",
        )
    )
    rm_pm = rm_pm.rename(columns={"initial_on_hand": "current_on_hand"})

    latest = production["month"].max()
    recent = production.loc[production["month"].ge(latest - pd.DateOffset(months=2))]
    fg = (
        recent.groupby("fg_id", as_index=False)["actual_fg_units"]
        .mean()
        .merge(finished_goods[["fg_id", "fg_code"]], on="fg_id", how="left")
    )
    fg["current_on_hand"] = fg["actual_fg_units"] * 1.20
    fg["safety_stock"] = fg["actual_fg_units"] * 0.30
    fg["proposed_min"] = fg["actual_fg_units"] * 0.75
    fg["reorder_point"] = fg["proposed_min"]
    fg["order_quantity"] = fg["actual_fg_units"]
    fg["proposed_max"] = fg["actual_fg_units"] * 2.00
    fg = fg.rename(columns={"fg_code": "material_code"})
    fg = fg[
        [
            "material_code",
            "current_on_hand",
            "safety_stock",
            "proposed_min",
            "proposed_max",
            "reorder_point",
            "order_quantity",
        ]
    ]

    capacity = pd.concat(
        [
            rm_pm[
                [
                    "material_code",
                    "current_on_hand",
                    "safety_stock",
                    "proposed_min",
                    "proposed_max",
                    "reorder_point",
                    "order_quantity",
                ]
            ],
            fg,
        ],
        ignore_index=True,
    )
    capacity = capacity.merge(
        materials[
            [
                "material_code",
                "material_type",
                "units_per_pallet",
                "pallet_weight_kg",
                "pallet_volume_cm3",
                "abc_class",
                "fms_class",
                "amalgamated_class",
            ]
        ],
        on="material_code",
        how="left",
        validate="one_to_one",
    )
    capacity["capacity_quantity"] = capacity[["current_on_hand", "proposed_max"]].max(axis=1)
    capacity["required_positions"] = np.maximum(
        1, np.ceil(capacity["capacity_quantity"] / capacity["units_per_pallet"])
    ).astype(int)
    capacity["current_positions"] = np.maximum(
        1, np.ceil(capacity["current_on_hand"] / capacity["units_per_pallet"])
    ).astype(int)
    return capacity.sort_values("material_code").reset_index(drop=True)


def _expanded_layout(capacity: pd.DataFrame) -> pd.DataFrame:
    existing = pd.read_csv(BASELINE_OUTPUT / "locations.csv.gz")
    storage = existing.loc[existing["zone_type"].isin(["PICK_FACE", "RESERVE"])].copy()
    existing_racks = storage[["area", "row_number", "bay_number", "physical_class"]].drop_duplicates()
    required = capacity.groupby("abc_class")["required_positions"].sum().to_dict()
    required_with_margin = {key: int(math.ceil(value * 1.10)) for key, value in required.items()}
    required_total = sum(required_with_margin.values())
    existing_racks_by_abc = (
        existing_racks.assign(abc=existing_racks["physical_class"].str[0])
        .groupby("abc")
        .size()
        .to_dict()
    )
    target_racks = {}
    for abc in ["A", "B", "C"]:
        existing_count = existing_racks_by_abc.get(abc, 0)
        abc_capacity = capacity.loc[capacity["abc_class"].eq(abc)]
        additional_for_count = max(
            0, math.ceil((required_with_margin.get(abc, 0) - existing_count * 15) / 15)
        )
        additional_for_beams = 0
        # The original V3 racks deliberately decrease beam capacity by level.
        # Expansion racks are engineered for 1,200 kg on every level. Reserve
        # enough expansion racks for each cumulative weight band.
        for threshold, positions_per_existing_rack in [
            (1000.0, 3),
            (800.0, 6),
            (550.0, 9),
            (350.0, 12),
        ]:
            heavy_positions = int(
                abc_capacity.loc[
                    abc_capacity["pallet_weight_kg"].gt(threshold), "required_positions"
                ].sum()
            )
            additional_for_beams = max(
                additional_for_beams,
                max(
                    0,
                    math.ceil(
                        (heavy_positions - existing_count * positions_per_existing_rack) / 15
                    ),
                ),
            )
        target_racks[abc] = existing_count + max(additional_for_count, additional_for_beams)

    minimum_racks = max(240, sum(target_racks.values()))
    total_racks = int(math.ceil(minimum_racks / 40.0) * 40)
    total_positions = total_racks * 15
    if total_positions < required_total:
        raise RuntimeError("Expanded layout calculation did not reserve its capacity margin")
    while sum(target_racks.values()) < total_racks:
        abc = max(
            ["A", "B", "C"],
            key=lambda key: required_with_margin.get(key, 0) / max(target_racks[key] * 15, 1),
        )
        target_racks[abc] += 1

    new_racks_by_abc = {
        abc: target_racks[abc] - existing_racks_by_abc.get(abc, 0) for abc in ["A", "B", "C"]
    }
    new_classes: list[str] = []
    suffix_cycles = {
        "A": ["AF", "AF", "AF", "AM", "AS"],
        "B": ["BF", "BF", "BM", "BS"],
        "C": ["CF", "CF", "CM", "CS"],
    }
    for abc in ["A", "B", "C"]:
        count = new_racks_by_abc[abc]
        cycle = suffix_cycles[abc]
        new_classes.extend(cycle[index % len(cycle)] for index in range(count))
    rng = np.random.default_rng(SEED + 801)
    rng.shuffle(new_classes)

    warehouse_id = str(existing.iloc[0]["warehouse_id"])
    new_rows = []
    class_counters = {"A": 0, "B": 0, "C": 0}
    rack_index = 0
    row_count = total_racks // 40
    for row_number in range(2, row_count + 1):
        for area_index, area in enumerate("ABCDE"):
            coordinate_x = 8.0 + area_index * 6.0
            for bay in range(1, 9):
                physical_class = new_classes[rack_index]
                rack_index += 1
                abc = physical_class[0]
                class_counters[abc] += 1
                # Reserve engineered compatibility bands inside every ABC area.
                # Constrained SKUs are allocated first; ordinary stock may use
                # remaining compatible capacity afterward.
                hazard_allowed = class_counters[abc] % 4 == 0
                controlled = class_counters[abc] % 4 == 1
                coordinate_y = 8.0 + (((row_number - 1) * 8) + (bay - 1)) * 5.0
                base_distance = abs(coordinate_x - 4.0) + abs(coordinate_y - 2.0)
                for level in range(1, 6):
                    for position_index, position in enumerate("ABC"):
                        code = f"{area}-{row_number:02d}-{bay:02d}-{level}-{position}"
                        vertical_penalty = (0.0, 0.0, 2.5, 5.0, 8.0)[level - 1]
                        new_rows.append(
                            {
                                "location_id": _stable_uuid("location", code),
                                "warehouse_id": warehouse_id,
                                "location_code": code,
                                "area": area,
                                "row_number": f"{row_number:02d}",
                                "bay_number": f"{bay:02d}",
                                "level_number": level,
                                "bin_position": position,
                                "location_type": "picking" if level <= 2 else "storage",
                                "zone_type": "PICK_FACE" if level <= 2 else "RESERVE",
                                "capacity": 1,
                                "accessibility_rating": max(1, 6 - level),
                                "coordinate_x": coordinate_x,
                                "coordinate_y": coordinate_y,
                                "coordinate_z": level * 1.5,
                                "max_pallet_capacity": 1,
                                "max_weight_kg": 1200.0,
                                "max_volume_cm3": PALLET_VOLUME_CM3,
                                "temperature_zone": "CONTROLLED" if controlled else "AMBIENT",
                                "hazard_allowed": hazard_allowed,
                                "travel_distance_m": round(base_distance + vertical_penalty, 2),
                                "distance_to_receiving_m": round(base_distance + vertical_penalty, 2),
                                "distance_to_dispatch_m": round(base_distance + vertical_penalty, 2),
                                "physical_class": physical_class,
                                "layout_version": LAYOUT_VERSION,
                            }
                        )
    if rack_index != len(new_classes):
        raise RuntimeError("Expanded rack grid does not match the class plan")
    layout = pd.concat([existing, pd.DataFrame(new_rows)], ignore_index=True, sort=False)
    layout = _align_operational_apron(layout)
    layout = _align_velocity_zones_to_doors(layout)
    if layout["location_code"].duplicated().any():
        raise RuntimeError("Expanded layout contains duplicate location codes")
    return layout


def _allocate(
    materials: pd.DataFrame, capacity: pd.DataFrame, layout: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    material_index = materials.set_index("material_code")
    storage = layout.loc[layout["zone_type"].isin(["PICK_FACE", "RESERVE"])].copy()
    used: set[str] = set()
    assignments: list[dict] = []
    inventory_rows: list[dict] = []
    class_priority = {"A": 0, "B": 1, "C": 2}

    ordered = capacity.merge(
        materials[["material_code", "hazardous", "temperature_controlled"]],
        on="material_code",
        how="left",
        validate="one_to_one",
    ).sort_values(
        [
            "abc_class",
            "hazardous",
            "temperature_controlled",
            "required_positions",
            "material_code",
        ],
        key=lambda series: series.map(class_priority) if series.name == "abc_class" else series,
        ascending=[True, False, False, False, True],
    )
    for item in ordered.itertuples(index=False):
        material = material_index.loc[item.material_code]
        candidates = storage.loc[
            ~storage["location_code"].isin(used)
            & storage["physical_class"].str.startswith(str(item.abc_class), na=False)
            & storage["max_weight_kg"].ge(float(material.pallet_weight_kg))
            & storage["max_volume_cm3"].ge(float(material.pallet_volume_cm3))
        ].copy()
        if bool(material.hazardous):
            candidates = candidates.loc[candidates["hazard_allowed"]]
        if bool(material.temperature_controlled):
            candidates = candidates.loc[candidates["temperature_zone"].eq("CONTROLLED")]
        candidates["class_penalty"] = candidates["physical_class"].ne(item.amalgamated_class).astype(int)
        candidates["zone_rank"] = candidates["zone_type"].map({"PICK_FACE": 0, "RESERVE": 1})
        candidates = candidates.sort_values(
            [
                "zone_rank",
                "class_penalty",
                "travel_distance_m",
                "level_number",
                "location_code",
            ]
        )
        pick = candidates.loc[candidates["zone_type"].eq("PICK_FACE")].head(1)
        if pick.empty:
            raise RuntimeError(f"No compatible pick face for {item.material_code}")
        primary_code = str(pick.iloc[0]["location_code"])
        selected_codes = [primary_code]
        used.add(primary_code)
        reserve = candidates.loc[~candidates["location_code"].isin(used)].copy()
        reserve["reserve_rank"] = reserve["zone_type"].ne("RESERVE").astype(int)
        reserve = reserve.sort_values(
            [
                "reserve_rank",
                "class_penalty",
                "travel_distance_m",
                "level_number",
                "location_code",
            ]
        )
        needed = int(item.required_positions) - 1
        selected_codes.extend(reserve.head(needed)["location_code"].astype(str).tolist())
        if len(selected_codes) != int(item.required_positions):
            raise RuntimeError(
                f"Insufficient compatible capacity for {item.material_code}: "
                f"needed={item.required_positions}, available={len(selected_codes)}"
            )
        used.update(selected_codes)

        remaining_capacity = float(item.capacity_quantity)
        for priority, code in enumerate(selected_codes, start=1):
            quantity_capacity = min(float(material.units_per_pallet), remaining_capacity)
            remaining_capacity = max(0.0, remaining_capacity - quantity_capacity)
            assignments.append(
                {
                    "material_code": item.material_code,
                    "material_type": item.material_type,
                    "location_code": code,
                    "priority": priority,
                    "assignment_role": "PRIMARY_PICK_FACE" if priority == 1 else "RESERVE",
                    "quantity_capacity": round(quantity_capacity, 3),
                    "abc_class": item.abc_class,
                    "fms_class": item.fms_class,
                    "amalgamated_class": item.amalgamated_class,
                }
            )

        current_codes = selected_codes[: int(item.current_positions)]
        remaining_stock = float(item.current_on_hand)
        for position_index, code in enumerate(current_codes, start=1):
            quantity = min(float(material.units_per_pallet), remaining_stock)
            if position_index == len(current_codes):
                quantity = remaining_stock
            remaining_stock = max(0.0, remaining_stock - quantity)
            inventory_rows.append(
                {
                    "inventory_key": _stable_uuid(
                        "inventory", f"{item.material_code}:{code}:PROJECT_OPS_V8"
                    ),
                    "material_code": item.material_code,
                    "material_type": item.material_type,
                    "location_code": code,
                    "quantity": round(quantity, 3),
                    "available_quantity": round(quantity, 3),
                    "reserved_quantity": 0.0,
                    "buffer_stock": round(float(item.safety_stock), 3),
                    "min_stock": round(float(item.proposed_min), 3),
                    "max_stock": round(float(item.proposed_max), 3),
                    "reorder_point": round(float(item.reorder_point), 3),
                    "order_quantity": round(float(item.order_quantity), 3),
                    "pallet_requirement": int(item.required_positions),
                    "stacking_quantity": int(material.max_stack_height),
                    "abc_class": item.abc_class,
                    "fms_class": item.fms_class,
                    "status": "active",
                }
            )
    return pd.DataFrame(assignments), pd.DataFrame(inventory_rows)


def _validation(
    materials: pd.DataFrame,
    capacity: pd.DataFrame,
    layout: pd.DataFrame,
    assignments: pd.DataFrame,
    inventory: pd.DataFrame,
) -> tuple[pd.DataFrame, dict]:
    storage = layout.loc[layout["zone_type"].isin(["PICK_FACE", "RESERVE"])].copy()
    material_index = materials.set_index("material_code")
    location_index = storage.set_index("location_code")
    joined = assignments.join(material_index, on="material_code", rsuffix="_material").join(
        location_index, on="location_code", rsuffix="_location"
    )
    expected_positions = int(capacity["required_positions"].sum())
    checks = [
        ("physical_material_count", len(materials) == 144, len(materials), 144),
        (
            "physical_dimensions_complete",
            bool(
                materials[
                    ["length_cm", "width_cm", "height_cm", "weight_kg", "volume_cm3", "pallet_spaces"]
                ]
                .gt(0)
                .all()
                .all()
            ),
            int(
                materials[
                    ["length_cm", "width_cm", "height_cm", "weight_kg", "volume_cm3", "pallet_spaces"]
                ]
                .gt(0)
                .all(axis=1)
                .sum()
            ),
            144,
        ),
        ("canonical_layout_rows_preserved", len(layout) >= 606, len(layout), ">=606"),
        ("storage_capacity_margin", len(storage) >= expected_positions, len(storage), expected_positions),
        (
            "assignment_position_count",
            len(assignments) == expected_positions,
            len(assignments),
            expected_positions,
        ),
        (
            "all_materials_assigned",
            assignments["material_code"].nunique() == 144,
            assignments["material_code"].nunique(),
            144,
        ),
        (
            "unique_location_assignment",
            not assignments["location_code"].duplicated().any(),
            int(assignments["location_code"].nunique()),
            len(assignments),
        ),
        (
            "one_pick_face_per_material",
            bool(
                assignments.loc[assignments["assignment_role"].eq("PRIMARY_PICK_FACE")]
                .groupby("material_code")
                .size()
                .eq(1)
                .all()
            ),
            int(assignments["assignment_role"].eq("PRIMARY_PICK_FACE").sum()),
            144,
        ),
        (
            "pallet_weight_within_location",
            bool(joined["pallet_weight_kg"].le(joined["max_weight_kg"] + 1e-6).all()),
            float((joined["max_weight_kg"] - joined["pallet_weight_kg"]).min()),
            ">=0 kg margin",
        ),
        (
            "pallet_volume_within_location",
            bool(joined["pallet_volume_cm3"].le(joined["max_volume_cm3"] + 1e-6).all()),
            float((joined["max_volume_cm3"] - joined["pallet_volume_cm3"]).min()),
            ">=0 cm3 margin",
        ),
        (
            "abc_location_compatible",
            bool(
                joined["amalgamated_class"].str[0].eq(joined["physical_class"].str[0]).all()
            ),
            int(
                joined["amalgamated_class"].str[0].eq(joined["physical_class"].str[0]).sum()
            ),
            len(joined),
        ),
        (
            "temperature_compatible",
            bool(
                (
                    ~joined["temperature_controlled"]
                    | joined["temperature_zone"].eq("CONTROLLED")
                ).all()
            ),
            int(
                (
                    ~joined["temperature_controlled"]
                    | joined["temperature_zone"].eq("CONTROLLED")
                ).sum()
            ),
            len(joined),
        ),
        (
            "hazard_compatible",
            bool((~joined["hazardous"] | joined["hazard_allowed"]).all()),
            int((~joined["hazardous"] | joined["hazard_allowed"]).sum()),
            len(joined),
        ),
        (
            "inventory_totals_match_source",
            bool(
                np.allclose(
                    inventory.groupby("material_code")["quantity"].sum().sort_index(),
                    capacity.set_index("material_code")["current_on_hand"].sort_index(),
                    atol=0.01,
                )
            ),
            round(float(inventory["quantity"].sum()), 3),
            round(float(capacity["current_on_hand"].sum()), 3),
        ),
    ]
    evidence = pd.DataFrame(checks, columns=["check", "passed", "observed", "expected"])
    summary = {
        "status": "PASSED" if bool(evidence["passed"].all()) else "FAILED",
        "seed": SEED,
        "layout_version": LAYOUT_VERSION,
        "materials": int(len(materials)),
        "storage_locations": int(len(storage)),
        "layout_rows": int(len(layout)),
        "assignment_rows": int(len(assignments)),
        "inventory_rows": int(len(inventory)),
        "required_capacity_positions": expected_positions,
        "unused_storage_positions": int(len(storage) - len(assignments)),
        "checks_passed": int(evidence["passed"].sum()),
        "checks_total": int(len(evidence)),
        "external_physical_survey": "UNVERIFIED",
        "decision_scope": "PROJECT_OPERATIONAL_SYNTHETIC_BASELINE",
    }
    return evidence, summary


def build_physical_population(output: Path = OUTPUT) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    classifications = _classifications()
    materials = _physical_materials(classifications)
    capacity = _inventory_capacity(materials)
    layout = _expanded_layout(capacity)
    assignments, inventory = _allocate(materials, capacity, layout)
    evidence, summary = _validation(materials, capacity, layout, assignments, inventory)
    if summary["status"] != "PASSED":
        failed = evidence.loc[~evidence["passed"], "check"].tolist()
        raise RuntimeError(f"Physical population validation failed: {failed}")

    materials.to_csv(output / "physical_materials.csv", index=False)
    classifications.to_csv(output / "physical_classifications.csv", index=False)
    capacity.to_csv(output / "storage_capacity_requirements.csv", index=False)
    layout.to_csv(output / "physical_layout.csv.gz", index=False, compression="gzip")
    assignments.to_csv(output / "location_assignments.csv.gz", index=False, compression="gzip")
    inventory.to_csv(output / "physical_inventory.csv.gz", index=False, compression="gzip")
    evidence.to_csv(output / "storage_slotting_validation.csv", index=False)
    (output / "storage_slotting_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    return summary


def main() -> int:
    print(json.dumps(build_physical_population(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
