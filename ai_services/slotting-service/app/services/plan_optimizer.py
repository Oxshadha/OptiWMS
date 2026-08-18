"""
Deterministic plan optimizer for quarterly slotting (heuristic + optional MILP hook).
Backend persists results; this service only computes assignments.
"""
from __future__ import annotations

import hashlib
import os
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PlanMaterialInput(BaseModel):
    material_id: str
    material_code: str
    material_type: str
    amalgamated_class: str = "CS"
    abc_class: str = "C"
    fms_class: str = "S"
    issue_volume: float = 0
    issue_count: int = 0
    weight_kg: Optional[float] = None
    volume_cm3: Optional[float] = None
    pallet_spaces: Optional[float] = None
    incumbent_primary_location_code: Optional[str] = None
    locked: bool = False
    required_pallets: Optional[int] = None
    demand_trend: Optional[str] = None
    min_stock_units: Optional[float] = None
    pallet_weight_kg: Optional[float] = None
    pallet_volume_cm3: Optional[float] = None
    temperature_controlled: bool = False
    hazardous: bool = False
    fragile: bool = False
    stackable: bool = True
    forecast_demand: Optional[float] = None
    unit_cost: Optional[float] = None
    stockout_cost_weight: float = 1.0


class PlanLocationInput(BaseModel):
    location_id: str
    location_code: str
    amalgamated_class: Optional[str] = None
    area: Optional[str] = None
    location_type: Optional[str] = None
    zone_type: Optional[str] = None
    level_number: int = 1
    accessibility_rating: int = 3
    coordinate_x: float = 0
    coordinate_y: float = 0
    max_weight_kg: Optional[float] = None
    max_volume_cm3: Optional[float] = None
    capacity: Optional[float] = None
    max_pallet_capacity: Optional[int] = None
    current_pallet_count: int = 0
    temperature_zone: Optional[str] = None
    hazard_allowed: bool = False
    fragile_allowed: bool = True
    stackable_allowed: bool = True
    is_active: bool = True


class PlanOptimizeRequest(BaseModel):
    warehouse_id: str
    relocation_budget_pct: float = 30.0
    materials: List[PlanMaterialInput] = Field(default_factory=list)
    locations: List[PlanLocationInput] = Field(default_factory=list)
    locked_material_ids: List[str] = Field(default_factory=list)
    use_milp_a_class: bool = False
    solver_engine: str = "heuristic"


class PlanReserveAssignment(BaseModel):
    location_code: str
    reserve_pallet_positions: int = 1
    reserve_zone_hint: str = "deep_reserve"


class PlanAssignmentResponse(BaseModel):
    material_id: str
    material_code: str
    recommended_primary_location_code: Optional[str] = None
    recommended_primary_location_id: Optional[str] = None
    final_primary_location_code: Optional[str] = None
    active_pick_pallet_positions: int = 1
    required_reserve_pallet_positions: int = 0
    max_stock_pallet_positions: int = 1
    reserve_locations: List[PlanReserveAssignment] = Field(default_factory=list)
    distance_saved_meters: float = 0
    zone_upgrade: Optional[str] = None
    move_reason: str = ""
    gain_score: float = 0
    objective_cost: Optional[float] = None
    # Exact breakdown of this location's objective contribution, plus the same
    # figures for the next-best candidate. The solver already computes these; they
    # were previously summed into a scalar and discarded.
    decision_evidence: Optional[Dict[str, Any]] = None
    relocation_applied: bool = False
    status: str = "PROPOSED"


class PlanOptimizeResponse(BaseModel):
    warehouse_id: str
    algorithm: str = "HEURISTIC_V1"
    assignments: List[PlanAssignmentResponse] = Field(default_factory=list)
    total_moves_proposed: int = 0
    relocation_moves_applied: int = 0
    solver_status: str = "NOT_RUN"
    objective_value: Optional[float] = None
    infeasible_reason: Optional[str] = None
    constraints_used: List[str] = Field(default_factory=list)
    relocation_cap_used: int = 0
    assignment_confidence_inputs: Dict[str, float] = Field(default_factory=dict)


AMALGAMATED_PRIORITY = {
    "AF": 1, "AM": 2, "AS": 3, "BF": 4, "BM": 5,
    "BS": 6, "CF": 7, "CM": 8, "CS": 9,
}


def _dispatch_anchor(locations: List[PlanLocationInput]) -> tuple[float, float]:
    if not locations:
        return 0.0, 0.0
    outbound = [
        location for location in locations
        if (location.zone_type or "").upper() in {"PACKING", "DISPATCH"}
        or (location.location_type or "").upper() in {"PACKING", "DISPATCH"}
    ]
    if outbound:
        return (
            sum(location.coordinate_x for location in outbound) / len(outbound),
            sum(location.coordinate_y for location in outbound) / len(outbound),
        )
    return min(l.coordinate_x for l in locations), min(l.coordinate_y for l in locations)


def _distance(loc: PlanLocationInput, anchor: tuple[float, float]) -> float:
    return ((loc.coordinate_x - anchor[0]) ** 2 + (loc.coordinate_y - anchor[1]) ** 2) ** 0.5


def _pick_face_score(loc: PlanLocationInput, pick_face: bool) -> int:
    if pick_face:
        return loc.level_number + (5 - loc.accessibility_rating)
    return (5 - loc.level_number) + loc.accessibility_rating


def _compatible(loc_class: Optional[str], sku_class: str) -> bool:
    if not loc_class or not sku_class:
        return True
    if len(loc_class) < 1 or len(sku_class) < 1:
        return True
    return loc_class == sku_class or loc_class[0] == sku_class[0]


def _level_beam_capacity_kg(level_number: int) -> float:
    if level_number <= 3:
        return 500.0
    if level_number <= 5:
        return 300.0
    return 400.0


def _pallet_weight_kg(material: PlanMaterialInput) -> float:
    if material.pallet_weight_kg is not None:
        return max(0.0, material.pallet_weight_kg)
    if material.weight_kg and material.pallet_spaces and material.pallet_spaces > 0:
        return material.weight_kg * material.pallet_spaces
    return material.weight_kg or 0.0


def _pallet_volume_cm3(material: PlanMaterialInput) -> float:
    if material.pallet_volume_cm3 is not None:
        return max(0.0, material.pallet_volume_cm3)
    if material.volume_cm3 and material.pallet_spaces:
        return max(0.0, material.volume_cm3 * material.pallet_spaces)
    return max(0.0, material.volume_cm3 or 0.0)


def _operationally_compatible(loc: PlanLocationInput, material: PlanMaterialInput) -> bool:
    if not _is_operational_storage(loc):
        return False
    if not loc.is_active or not _compatible(loc.amalgamated_class, material.amalgamated_class):
        return False
    if material.temperature_controlled and (loc.temperature_zone or "AMBIENT").upper() == "AMBIENT":
        return False
    if material.hazardous and not loc.hazard_allowed:
        return False
    if material.fragile and not loc.fragile_allowed:
        return False
    if material.stackable and not loc.stackable_allowed:
        return False
    return True


def _is_operational_storage(loc: PlanLocationInput) -> bool:
    if not loc.zone_type and not loc.location_type:
        return True
    return (loc.zone_type or "").upper() in {"STORAGE", "PICK_FACE", "RESERVE"} or (
        loc.location_type or ""
    ).upper() in {"STORAGE", "PICKING", "BULK"}


def _is_pick_face(loc: PlanLocationInput) -> bool:
    if not loc.zone_type and not loc.location_type:
        return True
    return (loc.zone_type or "").upper() in {"PICK_FACE", "STORAGE"} and (
        loc.location_type or "STORAGE"
    ).upper() != "BULK"


def _fits_physical(
    loc: PlanLocationInput,
    material: PlanMaterialInput,
    active_pp: int = 1,
    occupancy_credit: int = 0,
    consider_current_occupancy: bool = True,
) -> bool:
    pallet_weight = _pallet_weight_kg(material)
    if pallet_weight > 0 and loc.max_weight_kg and pallet_weight * active_pp > loc.max_weight_kg:
        return False
    pallet_volume = _pallet_volume_cm3(material)
    if pallet_volume and loc.max_volume_cm3 and pallet_volume * active_pp > loc.max_volume_cm3:
        return False
    remaining_pallets = max(
        0,
        (loc.max_pallet_capacity or int(loc.capacity or 1))
        - (loc.current_pallet_count if consider_current_occupancy else 0)
        + occupancy_credit,
    )
    if active_pp > remaining_pallets:
        return False
    if loc.capacity and material.pallet_spaces and material.pallet_spaces > loc.capacity:
        return False
    return True


def _max_stock_pp(material: PlanMaterialInput) -> int:
    if material.required_pallets and material.required_pallets > 0:
        return material.required_pallets
    monthly = max(1, material.issue_volume / 12)
    weeks = 2 if material.material_type == "packaging_material" else 4
    return max(1, int((monthly * weeks / 4) + 0.999))


def _active_pick_pp(material: PlanMaterialInput, max_pp: int) -> int:
    # A primary is a replenished pick face, not the SKU's entire six-month stock.
    return min(1, max_pp)


def _gain_score(distance_saved: float, zone_upgrade: Optional[str], material: PlanMaterialInput, moving: bool) -> float:
    zone_bonus = 10.0 if zone_upgrade and "→" in zone_upgrade else 0.0
    freq_bonus = 5.0 if material.fms_class == "F" else (2.0 if material.fms_class == "M" else 0.0)
    penalty = 15.0 if moving else 0.0
    return distance_saved * 0.5 + zone_bonus + freq_bonus - penalty


def _candidate_locations(
    material: PlanMaterialInput,
    pick_pool: List[PlanLocationInput],
    anchor: tuple[float, float],
    max_candidates: int = 25,
) -> List[PlanLocationInput]:
    compatible = [
        loc for loc in pick_pool
        if _compatible(loc.amalgamated_class, material.amalgamated_class)
        and _fits_physical(loc, material, _active_pick_pp(material, _max_stock_pp(material)))
    ]
    compatible.sort(key=lambda loc: (
        _pick_face_score(loc, True),
        0 if material.fms_class == "F" else 1,
        _distance(loc, anchor),
    ))
    return compatible[:max_candidates]


# Which cost component moved the decision, in words a warehouse manager uses.
_COMPONENT_PHRASING = {
    "travel": "shorter travel to dispatch",
    "accessibility": "better pick accessibility for this velocity class",
    "vertical_handling": "easier level to handle",
    "relocation": "avoids a relocation",
    "stockout_offset": "higher stockout protection",
}


def _explain_choice(
    selected_code: str,
    selected: Dict[str, float],
    runner_up_code: Optional[str],
    runner_up: Optional[Dict[str, float]],
) -> tuple[str, Dict[str, Any]]:
    """Explain a MILP assignment by what it beat and by how much.

    The solver minimises a sum of named costs, so the honest explanation is the
    per-component difference against the next-best candidate. Nothing is
    approximated here: these are the exact terms the objective was built from.
    """
    evidence: Dict[str, Any] = {
        "method": "milp_objective_decomposition",
        "selected_location": selected_code,
        "selected_components": selected,
        "runner_up_location": runner_up_code,
        "runner_up_components": runner_up,
    }

    if not runner_up or runner_up_code is None:
        evidence["note"] = "Only one feasible candidate survived the constraint filter."
        return (
            f"{selected_code} was the only location satisfying zone, capacity, weight "
            f"and volume constraints for this material."
        ), evidence

    margin = runner_up["total"] - selected["total"]
    deltas = {
        key: round(runner_up.get(key, 0.0) - selected.get(key, 0.0), 3)
        for key in selected
        if key != "total"
    }
    evidence["margin"] = round(margin, 3)
    evidence["component_deltas"] = deltas

    drivers = sorted(deltas.items(), key=lambda kv: abs(kv[1]), reverse=True)
    leading = [
        _COMPONENT_PHRASING.get(name, name.replace("_", " "))
        for name, value in drivers[:2]
        if abs(value) > 1e-6 and value > 0
    ]
    because = " and ".join(leading) if leading else "a lower total handling cost"
    return (
        f"{selected_code} beat {runner_up_code} by {margin:.1f} cost units - {because}."
    ), evidence

def _milp_candidate_locations(
    material: PlanMaterialInput,
    locations: List[PlanLocationInput],
    anchor: tuple[float, float],
    max_candidates: Optional[int] = None,
) -> List[PlanLocationInput]:
    # A dense SKU x bin model is not operationally tractable at warehouse scale.
    # Keep a deterministic sparse compatibility graph, with enough reserve slack
    # to place the SKU's complete pallet requirement.
    configured_limit = max(16, int(os.getenv("SLOTTING_MILP_CANDIDATES_PER_SKU", "36")))
    candidate_limit = max_candidates or max(
        configured_limit,
        min(96, _max_stock_pp(material) + 8),
    )
    eligible = [
        loc for loc in locations
        if _operationally_compatible(loc, material)
        and _fits_physical(
            loc,
            material,
            1,
            # The MILP represents the complete target-state allocation. Current
            # stock is movable incumbent state and must not consume capacity a
            # second time while the same stock is assigned into that target.
            consider_current_occupancy=False,
        )
    ]
    eligible.sort(key=lambda loc: (
        0 if _is_pick_face(loc) else 1,
        0 if loc.amalgamated_class == material.amalgamated_class else 1,
        _pick_face_score(loc, True),
        _distance(loc, anchor),
        loc.location_code,
    ))
    if len(eligible) <= candidate_limit:
        return eligible

    # Keep the best operational choices while rotating a deterministic share of
    # the wider feasible pool. This avoids giving every SKU the same small set
    # of primary bins and keeps the integer model bounded.
    preferred_count = min(16, candidate_limit)
    selected = eligible[:preferred_count]
    selected_codes = {loc.location_code for loc in selected}
    offset = int(hashlib.sha256(material.material_id.encode()).hexdigest()[:8], 16) % len(eligible)
    cursor = offset
    while len(selected) < candidate_limit:
        loc = eligible[cursor % len(eligible)]
        if loc.location_code not in selected_codes:
            selected.append(loc)
            selected_codes.add(loc.location_code)
        cursor += 1
    incumbent = next(
        (loc for loc in eligible if loc.location_code == material.incumbent_primary_location_code),
        None,
    )
    if incumbent and incumbent.location_code not in selected_codes:
        selected[-1] = incumbent
    return selected


def _ortools_full_milp_optimize_plan(
    request: PlanOptimizeRequest,
    pick_pool: List[PlanLocationInput],
    reserve_pool: List[PlanLocationInput],
    anchor: tuple[float, float],
) -> Optional[PlanOptimizeResponse]:
    try:
        from ortools.linear_solver import pywraplp
    except Exception as exc:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="HEURISTIC_V1",
            solver_status="UNAVAILABLE",
            infeasible_reason=f"OR-Tools unavailable: {exc}",
        )

    locked = set(request.locked_material_ids)
    movable_materials = [
        material for material in request.materials
        if not material.locked and material.material_id not in locked
    ]
    if not movable_materials:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_V2",
            solver_status="NOOP",
            assignments=[],
            constraints_used=["locked_materials"],
        )

    all_locations = list({loc.location_code: loc for loc in pick_pool + reserve_pool}.values())
    candidates: Dict[str, List[PlanLocationInput]] = {
        material.material_id: _milp_candidate_locations(material, all_locations, anchor)
        for material in movable_materials
    }
    missing = [material.material_code for material in movable_materials if not candidates.get(material.material_id)]
    if missing:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_V2",
            solver_status="INFEASIBLE",
            infeasible_reason=f"No feasible candidate locations for {len(missing)} SKU(s): {', '.join(missing[:5])}",
            constraints_used=["complete_pallet_allocation", "candidate_physical_fit", "material_zone_compatibility"],
        )
    forced_relocations = sum(
        1 for material in movable_materials
        if material.incumbent_primary_location_code
        and all(
            loc.location_code != material.incumbent_primary_location_code
            for loc in candidates[material.material_id]
        )
    )
    relocation_cap = max(0, int(len(request.materials) * (request.relocation_budget_pct / 100.0)))
    exact_incumbent_matches = sum(
        1 for material in movable_materials
        if material.incumbent_primary_location_code
        and any(
            loc.location_code == material.incumbent_primary_location_code
            for loc in all_locations
        )
    )
    if forced_relocations > relocation_cap:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_V2",
            solver_status="INFEASIBLE",
            infeasible_reason=(
                "Relocation cap is below the forced-move lower bound "
                f"(forced_relocations={forced_relocations}, relocation_cap={relocation_cap}, "
                f"exact_incumbent_location_matches={exact_incumbent_matches})"
            ),
            constraints_used=["material_zone_compatibility", "candidate_physical_fit", "relocation_cap"],
            relocation_cap_used=relocation_cap,
        )

    requested_solver = os.getenv("SLOTTING_MILP_SOLVER", "SCIP").upper()
    solver = pywraplp.Solver.CreateSolver(requested_solver)
    if solver is None and requested_solver != "CBC":
        solver = pywraplp.Solver.CreateSolver("CBC")
    if solver is None:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="HEURISTIC_V1",
            solver_status="UNAVAILABLE",
            infeasible_reason="No OR-Tools MILP backend available",
        )
    solver.SetTimeLimit(max(5_000, int(os.getenv("SLOTTING_MILP_TIME_LIMIT_MS", "45000"))))

    primary: Dict[tuple[str, str], Any] = {}
    allocation: Dict[tuple[str, str], Any] = {}
    for material in movable_materials:
        for loc in candidates[material.material_id]:
            key = (material.material_id, loc.location_code)
            primary[key] = solver.BoolVar(f"primary_{material.material_id}_{loc.location_code}")
            location_capacity = loc.max_pallet_capacity or int(loc.capacity or 1)
            allocation[key] = solver.IntVar(
                0,
                min(_max_stock_pp(material), location_capacity),
                f"pallets_{material.material_id}_{loc.location_code}",
            )

    for material in movable_materials:
        material_candidates = candidates[material.material_id]
        solver.Add(sum(primary[(material.material_id, loc.location_code)] for loc in material_candidates) == 1)
        solver.Add(sum(allocation[(material.material_id, loc.location_code)] for loc in material_candidates) == _max_stock_pp(material))
        for loc in material_candidates:
            key = (material.material_id, loc.location_code)
            solver.Add(allocation[key] >= primary[key])
            if not _is_pick_face(loc):
                solver.Add(primary[key] == 0)
            active_pp = _active_pick_pp(material, _max_stock_pp(material))
            solver.Add(allocation[key] >= active_pp * primary[key])
            solver.Add(allocation[key] <= active_pp + _max_stock_pp(material) * (1 - primary[key]))

    materials_by_location: Dict[str, List[PlanMaterialInput]] = {}
    for material in movable_materials:
        for loc in candidates[material.material_id]:
            materials_by_location.setdefault(loc.location_code, []).append(material)

    for loc in all_locations:
        loc_materials = materials_by_location.get(loc.location_code, [])
        if not loc_materials:
            continue
        # This is target-state capacity, not incremental free space. Every
        # movable canonical SKU is reallocated by this model, so subtracting
        # current occupancy would count the same inventory twice and make a
        # physically feasible warehouse appear infeasible.
        target_capacity = loc.max_pallet_capacity or int(loc.capacity or 1)
        solver.Add(sum(allocation[(m.material_id, loc.location_code)] for m in loc_materials) <= target_capacity)
        solver.Add(sum(primary[(m.material_id, loc.location_code)] for m in loc_materials) <= 1)
        if loc.max_weight_kg:
            solver.Add(sum(_pallet_weight_kg(m) * allocation[(m.material_id, loc.location_code)] for m in loc_materials) <= loc.max_weight_kg)
        if loc.max_volume_cm3:
            solver.Add(sum(_pallet_volume_cm3(m) * allocation[(m.material_id, loc.location_code)] for m in loc_materials) <= loc.max_volume_cm3)

    move_terms = []
    objective_terms = []
    # (material_id, location_code) -> named cost components for the primary term.
    cost_components: Dict[tuple, Dict[str, float]] = {}
    max_issue_count = max(1, max(material.issue_count for material in movable_materials))
    max_demand = max(1.0, max(material.forecast_demand or material.issue_volume / 12.0 for material in movable_materials))
    max_positions = max(1, max(_max_stock_pp(material) for material in movable_materials))
    for material in movable_materials:
        incumbent = material.incumbent_primary_location_code
        for loc in candidates[material.material_id]:
            moving = bool(incumbent and incumbent != loc.location_code)
            if moving:
                move_terms.append(primary[(material.material_id, loc.location_code)])
            critical_weight = 3.0 if material.amalgamated_class in {"AF", "AM", "BF"} else (2.0 if material.abc_class == "A" else 1.0)
            demand_weight = max(0.0, material.forecast_demand or material.issue_volume / 12.0) / max_demand
            frequency_weight = max(0, material.issue_count) / max_issue_count
            space_weight = _max_stock_pp(material) / max_positions
            flow_weight = 1.0 + 2.5 * frequency_weight + 1.5 * demand_weight
            travel_cost = _distance(loc, anchor) * critical_weight * flow_weight
            access_cost = abs(max(1, min(5, loc.accessibility_rating)) - (5 if material.fms_class == "F" else 3)) * critical_weight
            vertical_cost = max(0, loc.level_number - 1) * (
                8.0 * frequency_weight + 5.0 * demand_weight + 4.0 * space_weight
            )
            relocation_cost = 25.0 if moving else 0.0
            carrying_cost = 0.001 * max(0.0, material.unit_cost or 0.0)
            stockout_cost = 2.0 * max(0.1, material.stockout_cost_weight) * critical_weight
            primary_cost = travel_cost + access_cost + vertical_cost + relocation_cost - stockout_cost
            objective_terms.append(primary_cost * primary[(material.material_id, loc.location_code)])
            reserve_travel = 0.10 * travel_cost if not _is_pick_face(loc) else 0.25 * travel_cost
            objective_terms.append((reserve_travel + carrying_cost) * allocation[(material.material_id, loc.location_code)])
            cost_components[(material.material_id, loc.location_code)] = {
                "travel": round(travel_cost, 3),
                "accessibility": round(access_cost, 3),
                "vertical_handling": round(vertical_cost, 3),
                "relocation": round(relocation_cost, 3),
                "stockout_offset": round(-stockout_cost, 3),
                "total": round(primary_cost, 3),
            }

    if move_terms:
        solver.Add(sum(move_terms) <= relocation_cap)
    solver.Minimize(sum(objective_terms))
    status = solver.Solve()
    status_name = {
        pywraplp.Solver.OPTIMAL: "OPTIMAL",
        pywraplp.Solver.FEASIBLE: "FEASIBLE",
        pywraplp.Solver.INFEASIBLE: "INFEASIBLE",
        pywraplp.Solver.UNBOUNDED: "UNBOUNDED",
        pywraplp.Solver.ABNORMAL: "ABNORMAL",
        pywraplp.Solver.NOT_SOLVED: "NOT_SOLVED",
    }.get(status, str(status))
    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_V2",
            solver_status=status_name,
            infeasible_reason=(
                "MILP did not find a feasible assignment "
                f"(solver_status={status_name}, forced_relocations={forced_relocations}, "
                f"relocation_cap={relocation_cap})"
            ),
            constraints_used=[
                "one_primary_pick_per_sku",
                "complete_pallet_allocation",
                "one_sku_per_primary_location",
                "location_pallet_capacity",
                "rack_weight_capacity",
                "rack_volume_capacity",
                "material_zone_compatibility",
                "relocation_cap",
            ],
            relocation_cap_used=relocation_cap,
        )

    assignments: List[PlanAssignmentResponse] = []
    moves = 0
    for material in request.materials:
        max_pp = _max_stock_pp(material)
        active_pp = _active_pick_pp(material, max_pp)
        if material.locked or material.material_id in locked:
            assignments.append(PlanAssignmentResponse(
                material_id=material.material_id,
                material_code=material.material_code,
                recommended_primary_location_code=material.incumbent_primary_location_code,
                final_primary_location_code=material.incumbent_primary_location_code,
                active_pick_pallet_positions=active_pp,
                required_reserve_pallet_positions=max(0, max_pp - active_pp),
                max_stock_pallet_positions=max_pp,
                move_reason="Locked line - kept incumbent",
                status="OVERRIDDEN",
            ))
            continue

        selected = next(
            (loc for loc in candidates[material.material_id]
             if primary[(material.material_id, loc.location_code)].solution_value() > 0.5),
            None,
        )
        incumbent = material.incumbent_primary_location_code
        relocation = bool(selected and incumbent and incumbent != selected.location_code)
        if relocation:
            moves += 1
        primary_pp = int(round(allocation[(material.material_id, selected.location_code)].solution_value())) if selected else 0
        reserves = [
            PlanReserveAssignment(
                location_code=loc.location_code,
                reserve_pallet_positions=int(round(allocation[(material.material_id, loc.location_code)].solution_value())),
            )
            for loc in candidates[material.material_id]
            if selected and loc.location_code != selected.location_code
            and allocation[(material.material_id, loc.location_code)].solution_value() > 0.5
        ]
        reserve_pp = sum(r.reserve_pallet_positions for r in reserves)
        selected_components = cost_components.get(
            (material.material_id, selected.location_code)) if selected else None
        runner_up_code, runner_up_components = None, None
        if selected and selected_components is not None:
            rivals = [
                (loc.location_code, cost_components[(material.material_id, loc.location_code)])
                for loc in candidates[material.material_id]
                if loc.location_code != selected.location_code
                and (material.material_id, loc.location_code) in cost_components
            ]
            if rivals:
                runner_up_code, runner_up_components = min(rivals, key=lambda kv: kv[1]["total"])
        if selected_components is not None:
            reason_text, evidence = _explain_choice(
                selected.location_code, selected_components, runner_up_code, runner_up_components)
        else:
            reason_text, evidence = "No feasible MILP assignment for this material.", None

        selected_distance = _distance(selected, anchor) if selected else 0.0
        incumbent_loc = next((loc for loc in all_locations if loc.location_code == incumbent), None)
        distance_saved = max(0.0, (_distance(incumbent_loc, anchor) if incumbent_loc else selected_distance) - selected_distance)
        assignments.append(PlanAssignmentResponse(
            material_id=material.material_id,
            material_code=material.material_code,
            recommended_primary_location_code=selected.location_code if selected else incumbent,
            recommended_primary_location_id=selected.location_id if selected else None,
            final_primary_location_code=selected.location_code if selected else incumbent,
            active_pick_pallet_positions=primary_pp,
            required_reserve_pallet_positions=reserve_pp,
            max_stock_pallet_positions=max_pp,
            reserve_locations=reserves,
            distance_saved_meters=distance_saved,
            move_reason=reason_text,
            gain_score=max(0.0, distance_saved),
            objective_cost=(selected_components or {}).get("total"),
            decision_evidence=evidence,
            relocation_applied=relocation,
            status="PROPOSED",
        ))

    return PlanOptimizeResponse(
        warehouse_id=request.warehouse_id,
        algorithm="ORTOOLS_MILP_V2",
        assignments=assignments,
        total_moves_proposed=moves,
        relocation_moves_applied=moves,
        solver_status=status_name,
        objective_value=solver.Objective().Value(),
        constraints_used=[
            "one_primary_pick_per_sku",
            "complete_pallet_allocation",
            "one_sku_per_primary_location",
            "location_pallet_capacity",
            "rack_weight_capacity",
            "rack_volume_capacity",
            "material_zone_compatibility",
            "temperature_hazard_fragility_stackability",
            "pick_face_primary_and_reserve_overflow",
            "forecast_weighted_travel_accessibility_objective",
            "velocity_volume_and_vertical_handling_objective",
            "carrying_space_and_stockout_risk_objective",
            "relocation_cap",
        ],
        relocation_cap_used=relocation_cap,
        assignment_confidence_inputs={
            "candidate_skus": float(len(movable_materials)),
            "candidate_locations": float(sum(len(v) for v in candidates.values())),
            "relocation_cap_pct": float(request.relocation_budget_pct),
        },
    )


def _ortools_optimize_plan(
    request: PlanOptimizeRequest,
    pick_pool: List[PlanLocationInput],
    reserve_pool: List[PlanLocationInput],
    anchor: tuple[float, float],
) -> PlanOptimizeResponse:
    """MILP primary assignment plus integer min-cost-flow reserve allocation."""
    try:
        from ortools.graph.python import min_cost_flow
        from ortools.linear_solver import pywraplp
    except Exception as exc:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_FLOW_V3",
            solver_status="UNAVAILABLE",
            infeasible_reason=f"OR-Tools unavailable: {exc}",
        )

    locked = set(request.locked_material_ids)
    movable = [m for m in request.materials if not m.locked and m.material_id not in locked]
    if not movable:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_FLOW_V3",
            solver_status="NOOP",
            constraints_used=["locked_materials"],
        )

    all_locations = list({loc.location_code: loc for loc in pick_pool + reserve_pool}.values())
    loc_by_code = {loc.location_code: loc for loc in all_locations}
    locked_primary_codes = {
        material.incumbent_primary_location_code
        for material in request.materials
        if (material.locked or material.material_id in locked)
        and material.incumbent_primary_location_code
    }
    primary_candidates: Dict[str, List[PlanLocationInput]] = {}
    for material in movable:
        candidates = _milp_candidate_locations(material, all_locations, anchor)
        primary_candidates[material.material_id] = [
            loc for loc in candidates
            if _is_pick_face(loc) and loc.location_code not in locked_primary_codes
        ]
    missing_primary = [m.material_code for m in movable if not primary_candidates[m.material_id]]
    if missing_primary:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_FLOW_V3",
            solver_status="INFEASIBLE",
            infeasible_reason=(
                f"No physically compatible pick-face candidate for {len(missing_primary)} SKU(s): "
                f"{', '.join(missing_primary[:5])}"
            ),
            constraints_used=["one_primary_pick_per_sku", "candidate_physical_fit"],
        )

    relocation_cap = max(0, int(len(request.materials) * request.relocation_budget_pct / 100.0))
    forced_relocations = sum(
        1 for material in movable
        if material.incumbent_primary_location_code
        and all(
            loc.location_code != material.incumbent_primary_location_code
            for loc in primary_candidates[material.material_id]
        )
    )
    if forced_relocations > relocation_cap:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_FLOW_V3",
            solver_status="INFEASIBLE",
            infeasible_reason=(
                "Relocation cap is below the forced-move lower bound "
                f"(forced_relocations={forced_relocations}, relocation_cap={relocation_cap})"
            ),
            constraints_used=["one_primary_pick_per_sku", "relocation_cap"],
            relocation_cap_used=relocation_cap,
        )

    solver_name = os.getenv("SLOTTING_MILP_SOLVER", "SCIP").upper()
    solver = pywraplp.Solver.CreateSolver(solver_name)
    if solver is None and solver_name != "CBC":
        solver = pywraplp.Solver.CreateSolver("CBC")
    if solver is None:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_FLOW_V3",
            solver_status="UNAVAILABLE",
            infeasible_reason="No OR-Tools MILP backend available",
        )
    solver.SetTimeLimit(max(5_000, int(os.getenv("SLOTTING_MILP_TIME_LIMIT_MS", "45000"))))

    primary: Dict[tuple[str, str], Any] = {}
    primary_by_location: Dict[str, List[Any]] = {}
    move_terms: List[Any] = []
    objective_terms: List[Any] = []
    # (material_id, location_code) -> named cost components. The solver already
    # computes each term; keeping them makes the choice explainable without
    # re-deriving or approximating anything.
    cost_components: Dict[tuple, Dict[str, float]] = {}
    max_issue_count = max(1, max(m.issue_count for m in movable))
    max_demand = max(1.0, max(m.forecast_demand or m.issue_volume / 12.0 for m in movable))
    max_positions = max(1, max(_max_stock_pp(m) for m in movable))

    for material in movable:
        variables = []
        incumbent = material.incumbent_primary_location_code
        for loc in primary_candidates[material.material_id]:
            key = (material.material_id, loc.location_code)
            variable = solver.BoolVar(f"primary_{material.material_id}_{loc.location_code}")
            primary[key] = variable
            variables.append(variable)
            primary_by_location.setdefault(loc.location_code, []).append(variable)
            moving = bool(incumbent and incumbent != loc.location_code)
            if moving:
                move_terms.append(variable)
            critical = 3.0 if material.amalgamated_class in {"AF", "AM", "BF"} else (2.0 if material.abc_class == "A" else 1.0)
            demand_weight = max(0.0, material.forecast_demand or material.issue_volume / 12.0) / max_demand
            frequency_weight = max(0, material.issue_count) / max_issue_count
            space_weight = _max_stock_pp(material) / max_positions
            flow_weight = 1.0 + 2.5 * frequency_weight + 1.5 * demand_weight
            travel = _distance(loc, anchor) * critical * flow_weight
            access = abs(max(1, min(5, loc.accessibility_rating)) - (5 if material.fms_class == "F" else 3)) * critical
            vertical = max(0, loc.level_number - 1) * (
                8.0 * frequency_weight + 5.0 * demand_weight + 4.0 * space_weight
            )
            relocation_cost = 25.0 if moving else 0.0
            candidate_cost = travel + access + vertical + relocation_cost
            objective_terms.append(candidate_cost * variable)
            cost_components[key] = {
                "travel": round(travel, 3),
                "accessibility": round(access, 3),
                "vertical_handling": round(vertical, 3),
                "relocation": round(relocation_cost, 3),
                "total": round(candidate_cost, 3),
            }
        solver.Add(sum(variables) == 1)
    for variables in primary_by_location.values():
        solver.Add(sum(variables) <= 1)
    if move_terms:
        solver.Add(sum(move_terms) <= relocation_cap)
    solver.Minimize(sum(objective_terms))

    primary_status = solver.Solve()
    if primary_status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        status_name = {
            pywraplp.Solver.INFEASIBLE: "INFEASIBLE",
            pywraplp.Solver.NOT_SOLVED: "NOT_SOLVED",
            pywraplp.Solver.ABNORMAL: "ABNORMAL",
        }.get(primary_status, str(primary_status))
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="ORTOOLS_MILP_FLOW_V3",
            solver_status=status_name,
            infeasible_reason=(
                "Primary pick-face MILP did not solve "
                f"(solver_status={status_name}, forced_relocations={forced_relocations}, relocation_cap={relocation_cap})"
            ),
            constraints_used=["one_primary_pick_per_sku", "one_sku_per_primary_location", "relocation_cap"],
            relocation_cap_used=relocation_cap,
        )

    selected_primary = {
        material.material_id: next(
            loc for loc in primary_candidates[material.material_id]
            if primary[(material.material_id, loc.location_code)].solution_value() > 0.5
        )
        for material in movable
    }

    reserve_demand = {m.material_id: max(0, _max_stock_pp(m) - 1) for m in movable}
    total_reserve = sum(reserve_demand.values())
    location_capacity = {
        loc.location_code: min(1, loc.max_pallet_capacity or int(loc.capacity or 1))
        for loc in all_locations
    }
    for code in locked_primary_codes:
        if code in location_capacity:
            location_capacity[code] = max(0, location_capacity[code] - 1)
    for loc in selected_primary.values():
        location_capacity[loc.location_code] = max(0, location_capacity[loc.location_code] - 1)

    flow_assignments: Dict[str, Dict[str, int]] = {m.material_id: {} for m in movable}
    flow_cost = 0
    if total_reserve:
        configured = max(64, int(os.getenv("SLOTTING_FLOW_CANDIDATES_PER_SKU", "1000")))
        solved_flow = None
        last_flow_status = "NOT_SOLVED"
        for candidate_limit in sorted(set([
            min(len(all_locations), configured),
            min(len(all_locations), max(configured, 2000)),
            len(all_locations),
        ])):
            flow = min_cost_flow.SimpleMinCostFlow()
            material_node = {m.material_id: index for index, m in enumerate(movable)}
            location_offset = len(material_node)
            free_locations = [
                loc for loc in all_locations
                if location_capacity.get(loc.location_code, 0) > 0
            ]
            location_node = {
                loc.location_code: location_offset + index
                for index, loc in enumerate(free_locations)
            }
            sink = location_offset + len(location_node)
            arc_owner: Dict[int, tuple[str, str]] = {}
            for material in movable:
                demand = reserve_demand[material.material_id]
                if demand <= 0:
                    continue
                candidates = _milp_candidate_locations(
                    material, all_locations, anchor, max_candidates=max(candidate_limit, demand + 12)
                )
                for loc in candidates:
                    if loc.location_code not in location_node:
                        continue
                    cost = int(round(100 * (
                        _distance(loc, anchor) * (0.10 if not _is_pick_face(loc) else 0.25)
                        + max(0, loc.level_number - 1) * (1.0 if material.fms_class == "F" else 0.25)
                    )))
                    arc = flow.add_arc_with_capacity_and_unit_cost(
                        material_node[material.material_id], location_node[loc.location_code], 1, cost
                    )
                    arc_owner[arc] = (material.material_id, loc.location_code)
                flow.set_node_supply(material_node[material.material_id], demand)
            for code, node in location_node.items():
                flow.add_arc_with_capacity_and_unit_cost(node, sink, location_capacity[code], 0)
            flow.set_node_supply(sink, -total_reserve)
            flow_status = flow.solve()
            last_flow_status = {
                flow.OPTIMAL: "OPTIMAL",
                flow.FEASIBLE: "FEASIBLE",
                flow.INFEASIBLE: "INFEASIBLE",
                flow.UNBALANCED: "UNBALANCED",
                flow.NOT_SOLVED: "NOT_SOLVED",
            }.get(flow_status, str(flow_status))
            if flow_status in (flow.OPTIMAL, flow.FEASIBLE):
                solved_flow = (flow, arc_owner, candidate_limit)
                break
        if solved_flow is None:
            return PlanOptimizeResponse(
                warehouse_id=request.warehouse_id,
                algorithm="ORTOOLS_MILP_FLOW_V3",
                solver_status="INFEASIBLE",
                infeasible_reason=(
                    "Reserve min-cost flow could not allocate complete target stock "
                    f"(reserve_pallets={total_reserve}, free_target_bins={sum(location_capacity.values())}, "
                    f"flow_status={last_flow_status})"
                ),
                constraints_used=["complete_pallet_allocation", "location_pallet_capacity", "candidate_physical_fit"],
                relocation_cap_used=relocation_cap,
            )
        flow, arc_owner, used_candidate_limit = solved_flow
        flow_cost = flow.optimal_cost()
        for arc, owner in arc_owner.items():
            amount = int(flow.flow(arc))
            if amount > 0:
                material_id, code = owner
                flow_assignments[material_id][code] = amount
    else:
        used_candidate_limit = 0

    assignments: List[PlanAssignmentResponse] = []
    moves = 0
    for material in request.materials:
        max_pp = _max_stock_pp(material)
        if material.locked or material.material_id in locked:
            assignments.append(PlanAssignmentResponse(
                material_id=material.material_id,
                material_code=material.material_code,
                recommended_primary_location_code=material.incumbent_primary_location_code,
                final_primary_location_code=material.incumbent_primary_location_code,
                active_pick_pallet_positions=1,
                required_reserve_pallet_positions=max(0, max_pp - 1),
                max_stock_pallet_positions=max_pp,
                move_reason="Locked line - kept incumbent",
                status="OVERRIDDEN",
            ))
            continue
        selected = selected_primary[material.material_id]
        incumbent = material.incumbent_primary_location_code
        relocation = bool(incumbent and incumbent != selected.location_code)
        moves += int(relocation)
        incumbent_loc = loc_by_code.get(incumbent) if incumbent else None
        distance_saved = max(
            0.0,
            (_distance(incumbent_loc, anchor) if incumbent_loc else _distance(selected, anchor))
            - _distance(selected, anchor),
        )
        reserves = [
            PlanReserveAssignment(location_code=code, reserve_pallet_positions=count)
            for code, count in sorted(flow_assignments[material.material_id].items())
        ]
        selected_components = cost_components.get((material.material_id, selected.location_code))
        runner_up_code, runner_up_components = None, None
        rivals = [
            (loc.location_code, cost_components[(material.material_id, loc.location_code)])
            for loc in primary_candidates[material.material_id]
            if loc.location_code != selected.location_code
            and (material.material_id, loc.location_code) in cost_components
        ]
        if rivals:
            runner_up_code, runner_up_components = min(rivals, key=lambda kv: kv[1]["total"])
        if selected_components is not None:
            reason_text, evidence = _explain_choice(
                selected.location_code, selected_components, runner_up_code, runner_up_components)
            if evidence is not None:
                evidence["candidates_considered"] = len(primary_candidates[material.material_id])
        else:
            reason_text, evidence = (
                "OR-Tools MILP pick face plus integer min-cost-flow reserve allocation", None)

        assignments.append(PlanAssignmentResponse(
            material_id=material.material_id,
            material_code=material.material_code,
            recommended_primary_location_code=selected.location_code,
            recommended_primary_location_id=selected.location_id,
            final_primary_location_code=selected.location_code,
            active_pick_pallet_positions=1,
            required_reserve_pallet_positions=sum(r.reserve_pallet_positions for r in reserves),
            max_stock_pallet_positions=max_pp,
            reserve_locations=reserves,
            distance_saved_meters=distance_saved,
            move_reason=reason_text,
            gain_score=distance_saved,
            objective_cost=(selected_components or {}).get("total"),
            decision_evidence=evidence,
            relocation_applied=relocation,
            status="PROPOSED",
        ))

    return PlanOptimizeResponse(
        warehouse_id=request.warehouse_id,
        algorithm="ORTOOLS_MILP_FLOW_V3",
        assignments=assignments,
        total_moves_proposed=moves,
        relocation_moves_applied=moves,
        solver_status="OPTIMAL" if primary_status == pywraplp.Solver.OPTIMAL else "FEASIBLE",
        objective_value=solver.Objective().Value() + flow_cost / 100.0,
        constraints_used=[
            "one_primary_pick_per_sku",
            "one_sku_per_primary_location",
            "complete_pallet_allocation",
            "one_pallet_per_bin_location_contract",
            "pallet_weight_and_volume_fit",
            "material_zone_compatibility",
            "temperature_hazard_fragility_stackability",
            "forecast_weighted_travel_accessibility_objective",
            "velocity_volume_and_vertical_handling_objective",
            "relocation_cap",
        ],
        relocation_cap_used=relocation_cap,
        assignment_confidence_inputs={
            "candidate_skus": float(len(movable)),
            "reserve_pallets": float(total_reserve),
            "flow_candidate_limit": float(used_candidate_limit),
            "relocation_cap_pct": float(request.relocation_budget_pct),
        },
    )


def _milp_refine_a_class(
    proposals: List[Dict[str, Any]],
    pick_pool: List[PlanLocationInput],
    anchor: tuple[float, float],
) -> None:
    """PuLP assignment for A-class SKUs to golden pick-face slots (small subproblem)."""
    try:
        import pulp
    except ImportError:
        return

    a_props = [p for p in proposals if p["material"].abc_class == "A" and p["status"] != "OVERRIDDEN"]
    if not a_props:
        return

    golden = [
        loc for loc in pick_pool
        if _pick_face_score(loc, True) <= 2
    ][: max(40, len(a_props) * 2)]
    if not golden:
        return

    prob = pulp.LpProblem("a_class_slotting", pulp.LpMinimize)
    x = {}
    for i, prop in enumerate(a_props):
        mat = prop["material"]
        for j, loc in enumerate(golden):
            if not _compatible(loc.amalgamated_class, mat.amalgamated_class):
                continue
            if not _fits_physical(loc, mat):
                continue
            x[i, j] = pulp.LpVariable(f"x_{i}_{j}", cat=pulp.LpBinary)

    if not x:
        return

    # Each SKU at most one location; each location at most one A-class SKU
    for i in range(len(a_props)):
        vars_i = [x[k] for k in x if k[0] == i]
        if vars_i:
            prob += pulp.lpSum(vars_i) <= 1
    for j in range(len(golden)):
        vars_j = [x[k] for k in x if k[1] == j]
        if vars_j:
            prob += pulp.lpSum(vars_j) <= 1

    prob += pulp.lpSum(
        x[i, j] * _distance(golden[j], anchor)
        for (i, j) in x
    )

    prob.solve(pulp.PULP_CBC_CMD(msg=False))
    if pulp.LpStatus[prob.status] != "Optimal":
        return

    used_locs: set[str] = set()
    for (i, j), var in x.items():
        if var.value() and var.value() > 0.5:
            prop = a_props[i]
            loc = golden[j]
            if loc.location_code in used_locs:
                continue
            used_locs.add(loc.location_code)
            incumbent = prop["incumbent"]
            prop["recommended"] = loc.location_code
            prop["location_id"] = loc.location_id
            inc_dist = 0.0
            if incumbent:
                inc_loc = next((l for l in pick_pool if l.location_code == incumbent), None)
                if inc_loc:
                    inc_dist = _distance(inc_loc, anchor)
            rec_dist = _distance(loc, anchor)
            prop["distance_saved"] = max(0.0, inc_dist - rec_dist)
            prop["move_reason"] = "A-class MILP golden-slot assignment"
            prop["relocation_applied"] = incumbent != loc.location_code


def optimize_plan(request: PlanOptimizeRequest) -> PlanOptimizeResponse:
    anchor = _dispatch_anchor(request.locations)
    locked = set(request.locked_material_ids)

    loc_by_code = {l.location_code: l for l in request.locations}
    assigned_primary: set[str] = set()

    sorted_materials = sorted(
        request.materials,
        key=lambda m: (AMALGAMATED_PRIORITY.get(m.amalgamated_class, 9), -m.issue_volume),
    )

    operational_locations = [location for location in request.locations if _is_operational_storage(location)]
    pick_pool = sorted(
        [location for location in operational_locations if _is_pick_face(location)],
        key=lambda l: (_pick_face_score(l, True), _distance(l, anchor)),
    )
    reserve_pool = sorted(
        [location for location in operational_locations if not _is_pick_face(location)],
        key=lambda l: (_pick_face_score(l, False), -_distance(l, anchor)),
    )

    if request.solver_engine.lower() == "ortools":
        ortools_result = _ortools_optimize_plan(request, pick_pool, reserve_pool, anchor)
        if ortools_result and ortools_result.algorithm.startswith("ORTOOLS_") and ortools_result.assignments:
            return ortools_result
        if ortools_result and ortools_result.solver_status == "INFEASIBLE":
            return ortools_result

    proposals: List[Dict[str, Any]] = []

    for material in sorted_materials:
        if material.locked or material.material_id in locked:
            incumbent = material.incumbent_primary_location_code
            proposals.append({
                "material": material,
                "incumbent": incumbent,
                "recommended": incumbent,
                "location_id": None,
                "gain": 0.0,
                "distance_saved": 0.0,
                "zone_upgrade": None,
                "move_reason": "Locked line — kept incumbent",
                "max_pp": _max_stock_pp(material),
                "active_pp": _active_pick_pp(material, _max_stock_pp(material)),
                "reserves": [],
                "status": "OVERRIDDEN",
                "relocation_applied": False,
            })
            continue

        primary = None
        max_pp = _max_stock_pp(material)
        active_pp = _active_pick_pp(material, max_pp)
        for loc in pick_pool:
            if loc.location_code in assigned_primary:
                continue
            if not _compatible(loc.amalgamated_class, material.amalgamated_class):
                continue
            if not _fits_physical(loc, material, active_pp):
                continue
            if _pick_face_score(loc, True) > 2:
                continue
            primary = loc
            break

        if primary is None:
            for loc in pick_pool:
                if loc.location_code in assigned_primary:
                    continue
                if not _compatible(loc.amalgamated_class, material.amalgamated_class):
                    continue
                if not _fits_physical(loc, material, active_pp):
                    continue
                primary = loc
                break

        if primary:
            assigned_primary.add(primary.location_code)

        reserve_pp = max(0, max_pp - active_pp)
        reserves = []
        if reserve_pp > 0:
            for loc in reserve_pool:
                if not _compatible(loc.amalgamated_class, material.amalgamated_class):
                    continue
                if not _fits_physical(loc, material, reserve_pp):
                    continue
                reserves.append({
                        "location_code": loc.location_code,
                        "reserve_pallet_positions": reserve_pp,
                        "reserve_zone_hint": "deep_reserve",
                    })
                break

        incumbent = material.incumbent_primary_location_code
        recommended = primary.location_code if primary else incumbent
        inc_dist = _distance(loc_by_code[incumbent], anchor) if incumbent and incumbent in loc_by_code else 0
        rec_dist = _distance(primary, anchor) if primary else inc_dist
        distance_saved = max(0.0, inc_dist - rec_dist)

        inc_zone = loc_by_code[incumbent].amalgamated_class if incumbent and incumbent in loc_by_code else None
        rec_zone = primary.amalgamated_class if primary else inc_zone
        zone_upgrade = None
        if inc_zone != rec_zone:
            zone_upgrade = f"{inc_zone or '?'} → {rec_zone or '?'}"

        moving = incumbent and recommended and incumbent != recommended
        gain = _gain_score(distance_saved, zone_upgrade, material, moving)
        reason = (
            "Fast/high-volume SKU — golden pick-face slot"
            if material.amalgamated_class in ("AF", "AM")
            else f"Within-aisle assignment for {material.amalgamated_class}"
        )

        proposals.append({
            "material": material,
            "incumbent": incumbent,
            "recommended": recommended,
            "location_id": primary.location_id if primary else None,
            "gain": gain,
            "distance_saved": distance_saved,
            "zone_upgrade": zone_upgrade,
            "move_reason": reason,
            "max_pp": max_pp,
            "active_pp": active_pp,
            "reserves": reserves,
            "status": "PROPOSED",
            "relocation_applied": moving,
        })

    if request.use_milp_a_class:
        _milp_refine_a_class(proposals, pick_pool, anchor)

    movable = [p for p in proposals if p["incumbent"] and p["recommended"] and p["incumbent"] != p["recommended"]]
    budget = int(len(request.materials) * (request.relocation_budget_pct / 100.0))
    movable.sort(key=lambda p: p["gain"], reverse=True)
    approved_ids = {p["material"].material_id for p in movable[:budget]}

    assignments: List[PlanAssignmentResponse] = []
    moves_proposed = len(movable)
    moves_applied = 0

    for p in proposals:
        material = p["material"]
        apply_move = p["material"].material_id in approved_ids
        if p["status"] == "OVERRIDDEN":
            final_loc = p["recommended"]
        elif apply_move:
            final_loc = p["recommended"]
            moves_applied += 1
            status = "PROPOSED"
            reason = p["move_reason"]
            relocation_applied = True
        elif p["incumbent"] and p["recommended"] and p["incumbent"] != p["recommended"]:
            final_loc = p["incumbent"]
            status = "KEPT_INCUMBENT"
            reason = "Marginal gain — relocation budget exhausted"
            relocation_applied = False
        else:
            final_loc = p["recommended"]
            status = p["status"]
            reason = p["move_reason"]
            relocation_applied = False

        reserve_models = [
            PlanReserveAssignment(**r) for r in p["reserves"]
        ]
        assignments.append(PlanAssignmentResponse(
            material_id=material.material_id,
            material_code=material.material_code,
            recommended_primary_location_code=p["recommended"],
            recommended_primary_location_id=p["location_id"],
            final_primary_location_code=final_loc,
            active_pick_pallet_positions=p["active_pp"],
            required_reserve_pallet_positions=max(0, p["max_pp"] - p["active_pp"]),
            max_stock_pallet_positions=p["max_pp"],
            reserve_locations=reserve_models,
            distance_saved_meters=p["distance_saved"] if relocation_applied else 0,
            zone_upgrade=p["zone_upgrade"],
            move_reason=reason,
            gain_score=p["gain"],
            relocation_applied=relocation_applied,
            status=status,
        ))

    return PlanOptimizeResponse(
        warehouse_id=request.warehouse_id,
        algorithm="HEURISTIC_MILP_V1" if request.use_milp_a_class else "HEURISTIC_V1",
        assignments=assignments,
        total_moves_proposed=moves_proposed,
        relocation_moves_applied=moves_applied,
        solver_status="FALLBACK" if request.solver_engine.lower() == "ortools" else "NOT_RUN",
        infeasible_reason="OR-Tools unavailable or returned no usable assignment; heuristic fallback used" if request.solver_engine.lower() == "ortools" else None,
        constraints_used=["compatibility", "physical_fit", "relocation_budget"],
        relocation_cap_used=budget,
    )
