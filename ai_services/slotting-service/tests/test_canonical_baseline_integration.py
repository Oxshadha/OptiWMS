import math
from pathlib import Path

import pandas as pd

from app.services.plan_optimizer import (
    PlanLocationInput,
    PlanMaterialInput,
    PlanOptimizeRequest,
    optimize_plan,
)


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "Ai miroservices" / "modeling" / "project_operational_baseline" / "outputs"


def test_canonical_baseline_has_a_physically_feasible_target_state():
    materials = pd.concat([
        pd.read_csv(OUT / "materials.csv.gz"),
        pd.read_csv(OUT / "finished_goods.csv.gz"),
    ], ignore_index=True, sort=False)
    classifications = pd.read_csv(OUT / "material_classifications.csv.gz").set_index("material_id")
    policies = pd.read_csv(OUT / "inventory_policy.csv.gz").set_index("material_id")
    inventory = pd.read_csv(OUT / "inventory.csv.gz")
    locations = pd.read_csv(OUT / "locations.csv.gz")

    storage = locations[locations.zone_type.isin(["PICK_FACE", "RESERVE"])].copy()
    occupancy = inventory.groupby("location_code").size().to_dict()
    incumbent = inventory.groupby("material_id", sort=False).first().location_code.to_dict()
    inventory_class = inventory.groupby("material_id", sort=False).first()[["abc_class", "fms_class"]]

    material_inputs = []
    for row in materials.itertuples(index=False):
        if row.material_id in policies.index:
            policy = policies.loc[row.material_id]
            required_pallets = max(1, int(policy.required_pallet_positions))
        else:
            maximum = float(inventory.loc[inventory.material_id.eq(row.material_id), "max_stock"].max())
            required_pallets = max(1, math.ceil(maximum / max(1, int(row.units_per_pallet))))

        if row.material_id in classifications.index:
            classes = classifications.loc[row.material_id]
            abc, fms = str(classes.abc_class), str(classes.fms_class)
            issue_volume, issue_count = float(classes.issue_volume_12m), int(classes.issue_count_12m)
        else:
            classes = inventory_class.loc[row.material_id]
            abc, fms = str(classes.abc_class), str(classes.fms_class)
            issue_volume, issue_count = float(getattr(row, "base_monthly_units", 0) * 12), 12

        material_inputs.append(PlanMaterialInput(
            material_id=row.material_id,
            material_code=row.material_code,
            material_type=row.material_type,
            abc_class=abc,
            fms_class=fms,
            amalgamated_class=abc + fms,
            issue_volume=issue_volume,
            issue_count=issue_count,
            required_pallets=required_pallets,
            pallet_weight_kg=float(row.max_pallet_weight_kg),
            pallet_volume_cm3=float(row.volume_cm3 * row.units_per_pallet),
            incumbent_primary_location_code=incumbent.get(row.material_id),
            temperature_controlled=bool(row.temperature_controlled),
            hazardous=bool(row.hazardous),
            fragile=bool(row.fragile),
            stackable=bool(row.stackable),
            forecast_demand=issue_volume / 12,
            unit_cost=float(row.unit_cost),
        ))

    location_inputs = [PlanLocationInput(
        location_id=row.location_id,
        location_code=row.location_code,
        area=row.area,
        location_type=row.location_type,
        zone_type=row.zone_type,
        level_number=int(row.level_number),
        accessibility_rating=int(row.accessibility_rating),
        coordinate_x=float(row.coordinate_x),
        coordinate_y=float(row.coordinate_y),
        max_weight_kg=float(row.max_weight_kg),
        max_volume_cm3=float(row.max_volume_cm3),
        capacity=float(row.capacity),
        max_pallet_capacity=int(row.max_pallet_capacity),
        current_pallet_count=int(occupancy.get(row.location_code, 0)),
        temperature_zone=row.temperature_zone,
        hazard_allowed=bool(row.hazard_allowed),
        is_active=True,
    ) for row in storage.itertuples(index=False)]

    result = optimize_plan(PlanOptimizeRequest(
        warehouse_id="CMB-MAIN",
        relocation_budget_pct=30,
        materials=material_inputs,
        locations=location_inputs,
        use_milp_a_class=True,
        solver_engine="ortools",
    ))

    assert result.solver_status in {"OPTIMAL", "FEASIBLE"}, result.infeasible_reason
    assert len(result.assignments) == len(material_inputs) == 866
    assert result.relocation_moves_applied <= result.relocation_cap_used

    material_by_id = {row.material_id: row for row in material_inputs}
    location_by_code = {row.location_code: row for row in location_inputs}
    pallet_load = {}
    primary_codes = []
    for assignment in result.assignments:
        material = material_by_id[assignment.material_id]
        primary_codes.append(assignment.final_primary_location_code)
        allocations = [(assignment.final_primary_location_code, assignment.active_pick_pallet_positions)]
        allocations.extend((reserve.location_code, reserve.reserve_pallet_positions) for reserve in assignment.reserve_locations)
        assert sum(count for _, count in allocations) == assignment.max_stock_pallet_positions
        assert location_by_code[assignment.final_primary_location_code].zone_type == "PICK_FACE"
        for code, count in allocations:
            location = location_by_code[code]
            assert material.pallet_weight_kg * count <= location.max_weight_kg + 1e-6
            assert material.pallet_volume_cm3 * count <= location.max_volume_cm3 + 1e-6
            pallet_load[code] = pallet_load.get(code, 0) + count

    assert len(primary_codes) == len(set(primary_codes))
    assert all(pallet_load[code] <= location_by_code[code].max_pallet_capacity for code in pallet_load)
