from pathlib import Path

import pandas as pd

from app.services.plan_optimizer import (
    PlanLocationInput,
    PlanMaterialInput,
    PlanOptimizeRequest,
    optimize_plan,
)


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "Ai miroservices" / "modeling" / "v8_controlled_synthetic_validation" / "outputs"


def test_v8_population_has_an_ortools_feasible_complete_assignment():
    materials = pd.read_csv(OUT / "physical_materials.csv")
    requirements = pd.read_csv(OUT / "storage_capacity_requirements.csv")
    locations = pd.read_csv(OUT / "physical_layout.csv.gz")
    assignments = pd.read_csv(OUT / "location_assignments.csv.gz")
    incumbent = (
        assignments.loc[assignments.priority.eq(1)]
        .set_index("material_code")
        .location_code.to_dict()
    )
    population = materials.merge(
        requirements,
        on=["material_code", "material_type", "abc_class", "fms_class", "amalgamated_class"],
        suffixes=("", "_capacity"),
    )

    material_inputs = [
        PlanMaterialInput(
            material_id=row.material_code,
            material_code=row.material_code,
            material_type=row.material_type,
            abc_class=row.abc_class,
            fms_class=row.fms_class,
            amalgamated_class=row.amalgamated_class,
            issue_volume=float(row.issue_volume_12m),
            issue_count=int(row.issue_count_12m),
            required_pallets=int(row.required_positions),
            pallet_weight_kg=float(row.pallet_weight_kg),
            pallet_volume_cm3=float(row.pallet_volume_cm3),
            incumbent_primary_location_code=incumbent[row.material_code],
            temperature_controlled=bool(row.temperature_controlled),
            hazardous=bool(row.hazardous),
            fragile=bool(row.fragile),
            stackable=bool(row.stackable),
            forecast_demand=float(row.issue_volume_12m) / 12.0,
            unit_cost=float(row.unit_cost),
        )
        for row in population.itertuples(index=False)
    ]
    storage = locations.loc[locations.zone_type.isin(["PICK_FACE", "RESERVE"])]
    location_inputs = [
        PlanLocationInput(
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
            current_pallet_count=0,
            temperature_zone=row.temperature_zone,
            hazard_allowed=bool(row.hazard_allowed),
            amalgamated_class=row.physical_class,
            is_active=True,
        )
        for row in storage.itertuples(index=False)
    ]
    result = optimize_plan(
        PlanOptimizeRequest(
            warehouse_id="CMB-MAIN",
            relocation_budget_pct=100,
            materials=material_inputs,
            locations=location_inputs,
            use_milp_a_class=True,
            solver_engine="ortools",
        )
    )

    assert result.algorithm == "ORTOOLS_MILP_FLOW_V3"
    assert result.solver_status in {"OPTIMAL", "FEASIBLE"}, result.infeasible_reason
    assert len(result.assignments) == 144
    assert sum(row.max_stock_pallet_positions for row in result.assignments) == 3257
