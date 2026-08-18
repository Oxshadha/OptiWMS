"""The MILP must explain each assignment by what it beat, not with a fixed sentence.

Every line used to receive the identical ``move_reason`` while the solver's seven
named cost components were computed and discarded. These tests hold the recovered
decomposition to the objective it came from.
"""
import importlib.util

import pytest

from app.services.plan_optimizer import (
    PlanLocationInput,
    PlanMaterialInput,
    PlanOptimizeRequest,
    _explain_choice,
    optimize_plan,
)

requires_ortools = pytest.mark.skipif(
    importlib.util.find_spec("ortools") is None, reason="OR-Tools not installed"
)


def _plan_with_two_viable_bins() -> PlanOptimizeRequest:
    """One fast-moving SKU, one near bin and one far bin -- travel should decide."""
    return PlanOptimizeRequest(
        warehouse_id="colombo-main",
        relocation_budget_pct=100,
        solver_engine="ortools",
        materials=[
            PlanMaterialInput(
                material_id="m1", material_code="100001", material_type="raw_material",
                amalgamated_class="AF", abc_class="A", fms_class="F",
                required_pallets=1, pallet_weight_kg=100, pallet_volume_cm3=500,
                issue_count=400, forecast_demand=900.0,
                incumbent_primary_location_code="RM-FAR-001",
            )
        ],
        locations=[
            PlanLocationInput(
                location_id="near", location_code="RM-NEAR-001", amalgamated_class="AF",
                max_pallet_capacity=2, max_weight_kg=2000, max_volume_cm3=20000,
                accessibility_rating=5, level_number=1, coordinate_x=1, coordinate_y=1,
            ),
            PlanLocationInput(
                location_id="far", location_code="RM-FAR-001", amalgamated_class="AF",
                max_pallet_capacity=2, max_weight_kg=2000, max_volume_cm3=20000,
                accessibility_rating=5, level_number=1, coordinate_x=90, coordinate_y=90,
            ),
        ],
    )


@requires_ortools
def test_each_line_gets_its_own_reason_naming_the_runner_up():
    result = optimize_plan(_plan_with_two_viable_bins())
    line = result.assignments[0]

    assert "OR-Tools MILP pallet assignment under physical" not in line.move_reason, (
        "the boilerplate reason is back"
    )
    assert line.decision_evidence is not None
    evidence = line.decision_evidence
    assert evidence["method"] == "milp_objective_decomposition"
    assert evidence["selected_location"] == line.recommended_primary_location_code
    # The reason must name the alternative it beat.
    if evidence.get("runner_up_location"):
        assert evidence["runner_up_location"] in line.move_reason


@requires_ortools
def test_components_sum_exactly_to_the_reported_objective_cost():
    """The breakdown is exact arithmetic on the objective, not an approximation."""
    result = optimize_plan(_plan_with_two_viable_bins())
    line = result.assignments[0]
    parts = line.decision_evidence["selected_components"]
    recomputed = sum(v for k, v in parts.items() if k != "total")
    assert recomputed == pytest.approx(parts["total"], abs=1e-6)
    assert line.objective_cost == pytest.approx(parts["total"], abs=1e-6)


@requires_ortools
def test_the_chosen_bin_is_never_more_expensive_than_the_runner_up():
    result = optimize_plan(_plan_with_two_viable_bins())
    evidence = result.assignments[0].decision_evidence
    if evidence.get("runner_up_components"):
        assert evidence["margin"] >= 0, "solver picked a costlier bin than the alternative"


@requires_ortools
def test_objective_cost_is_the_objective_not_the_gain_score():
    """objective_cost used to be overwritten with gain_score, which is a different
    quantity on a different scale."""
    result = optimize_plan(_plan_with_two_viable_bins())
    line = result.assignments[0]
    assert line.objective_cost is not None
    assert line.objective_cost != line.gain_score or line.gain_score == 0


# ── Pure unit tests of the explanation itself ────────────────────────────────

def test_single_candidate_is_explained_as_a_constraint_outcome():
    reason, evidence = _explain_choice("BIN-A", {"travel": 5.0, "total": 5.0}, None, None)
    assert "only location" in reason
    assert evidence["runner_up_location"] is None


def test_reason_names_the_dominant_component():
    selected = {"travel": 10.0, "accessibility": 2.0, "relocation": 0.0, "total": 12.0}
    runner_up = {"travel": 40.0, "accessibility": 2.0, "relocation": 0.0, "total": 42.0}
    reason, evidence = _explain_choice("BIN-A", selected, "BIN-B", runner_up)
    assert "BIN-B" in reason and "30.0 cost units" in reason
    assert "shorter travel to dispatch" in reason
    assert evidence["component_deltas"]["travel"] == 30.0
