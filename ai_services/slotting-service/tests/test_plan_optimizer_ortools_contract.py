import importlib.util

import pytest

from app.services.plan_optimizer import (
    PlanLocationInput,
    PlanMaterialInput,
    PlanOptimizeRequest,
    _milp_candidate_locations,
    optimize_plan,
)


def test_milp_candidate_pool_is_bounded_deterministic_and_safety_compatible():
    material = PlanMaterialInput(
        material_id="controlled-hazard-rm",
        material_code="RM-0123",
        material_type="raw_material",
        temperature_controlled=True,
        hazardous=True,
        pallet_weight_kg=500,
        incumbent_primary_location_code="BIN-498",
    )
    locations = [
        PlanLocationInput(
            location_id=f"l{i}",
            location_code=f"BIN-{i:03d}",
            temperature_zone="CONTROLLED" if i % 2 == 0 else "AMBIENT",
            hazard_allowed=i % 3 == 0,
            max_pallet_capacity=1,
            current_pallet_count=1 if i == 498 else 0,
            max_weight_kg=1200,
            coordinate_x=float(i),
        )
        for i in range(500)
    ]

    first = _milp_candidate_locations(material, locations, (0.0, 0.0))
    second = _milp_candidate_locations(material, locations, (0.0, 0.0))

    assert 1 <= len(first) <= 200
    assert [loc.location_code for loc in first] == [loc.location_code for loc in second]
    assert all(loc.temperature_zone == "CONTROLLED" and loc.hazard_allowed for loc in first)
    assert "BIN-498" in {loc.location_code for loc in first}


def test_ortools_plan_contract_when_solver_available():
    if importlib.util.find_spec("ortools") is None:
        pytest.skip("OR-Tools is not installed in this local environment")

    result = optimize_plan(
        PlanOptimizeRequest(
            warehouse_id="colombo-main",
            relocation_budget_pct=100,
            solver_engine="ortools",
            materials=[
                PlanMaterialInput(
                    material_id="m1",
                    material_code="100001",
                    material_type="raw_material",
                    amalgamated_class="CS",
                    required_pallets=3,
                    pallet_weight_kg=200,
                    pallet_volume_cm3=1000,
                    incumbent_primary_location_code="RM-OLD-001",
                )
            ],
            locations=[
                PlanLocationInput(
                    location_id="l1",
                    location_code="RM-A-001",
                    amalgamated_class="CS",
                    max_pallet_capacity=2,
                    max_weight_kg=400,
                    max_volume_cm3=2000,
                    coordinate_x=1,
                    coordinate_y=1,
                ),
                PlanLocationInput(
                    location_id="l2",
                    location_code="RM-B-001",
                    amalgamated_class="CS",
                    max_pallet_capacity=2,
                    max_weight_kg=400,
                    max_volume_cm3=2000,
                    coordinate_x=5,
                    coordinate_y=5,
                ),
            ],
        )
    )

    assert result.algorithm == "ORTOOLS_MILP_V2"
    assert result.solver_status in {"OPTIMAL", "FEASIBLE"}
    assert result.assignments
    assert result.constraints_used
    assignment = result.assignments[0]
    assert assignment.active_pick_pallet_positions + assignment.required_reserve_pallet_positions == 3
    assert sum(r.reserve_pallet_positions for r in assignment.reserve_locations) == assignment.required_reserve_pallet_positions
