import importlib.util

import pytest

from app.services.plan_optimizer import PlanLocationInput, PlanMaterialInput, PlanOptimizeRequest, optimize_plan


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
                    required_pallets=1,
                    incumbent_primary_location_code="RM-OLD-001",
                )
            ],
            locations=[
                PlanLocationInput(
                    location_id="l1",
                    location_code="RM-A-001",
                    amalgamated_class="CS",
                    max_pallet_capacity=2,
                    coordinate_x=1,
                    coordinate_y=1,
                ),
                PlanLocationInput(
                    location_id="l2",
                    location_code="RM-B-001",
                    amalgamated_class="CS",
                    max_pallet_capacity=2,
                    coordinate_x=5,
                    coordinate_y=5,
                ),
            ],
        )
    )

    assert result.algorithm == "ORTOOLS_MILP_V1"
    assert result.solver_status in {"OPTIMAL", "FEASIBLE"}
    assert result.assignments
    assert result.constraints_used
