"""
Deterministic plan optimizer for quarterly slotting (heuristic + optional MILP hook).
Backend persists results; this service only computes assignments.
"""
from __future__ import annotations

import hashlib
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


def _fits_physical(
    loc: PlanLocationInput,
    material: PlanMaterialInput,
    active_pp: int = 1,
    occupancy_credit: int = 0,
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
        - loc.current_pallet_count
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
    monthly = max(1, material.issue_volume / 12)
    active = max(1, int((monthly * 2 / 4) + 0.999))
    return min(active, max_pp)


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


def _milp_candidate_locations(
    material: PlanMaterialInput,
    locations: List[PlanLocationInput],
    anchor: tuple[float, float],
    max_candidates: int = 200,
) -> List[PlanLocationInput]:
    eligible = [
        loc for loc in locations
        if _operationally_compatible(loc, material)
        and _fits_physical(
            loc,
            material,
            1,
            occupancy_credit=(
                1 if loc.location_code == material.incumbent_primary_location_code else 0
            ),
        )
    ]
    eligible.sort(key=lambda loc: (
        0 if loc.amalgamated_class == material.amalgamated_class else 1,
        _pick_face_score(loc, True),
        _distance(loc, anchor),
        loc.location_code,
    ))
    if len(eligible) <= max_candidates:
        return eligible

    # Keep the best operational choices while rotating a deterministic share of
    # the wider feasible pool. This avoids giving every SKU the same small set
    # of primary bins and keeps the integer model bounded.
    preferred_count = min(20, max_candidates)
    selected = eligible[:preferred_count]
    selected_codes = {loc.location_code for loc in selected}
    offset = int(hashlib.sha256(material.material_id.encode()).hexdigest()[:8], 16) % len(eligible)
    cursor = offset
    while len(selected) < max_candidates:
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


def _ortools_optimize_plan(
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

    solver = pywraplp.Solver.CreateSolver("CBC") or pywraplp.Solver.CreateSolver("SCIP")
    if solver is None:
        return PlanOptimizeResponse(
            warehouse_id=request.warehouse_id,
            algorithm="HEURISTIC_V1",
            solver_status="UNAVAILABLE",
            infeasible_reason="No OR-Tools MILP backend available",
        )
    solver.SetTimeLimit(60_000)

    primary: Dict[tuple[str, str], Any] = {}
    used: Dict[tuple[str, str], Any] = {}
    allocation: Dict[tuple[str, str], Any] = {}
    for material in movable_materials:
        for loc in candidates[material.material_id]:
            key = (material.material_id, loc.location_code)
            primary[key] = solver.BoolVar(f"primary_{material.material_id}_{loc.location_code}")
            used[key] = solver.BoolVar(f"used_{material.material_id}_{loc.location_code}")
            allocation[key] = solver.IntVar(0, _max_stock_pp(material), f"pallets_{material.material_id}_{loc.location_code}")

    for material in movable_materials:
        material_candidates = candidates[material.material_id]
        solver.Add(sum(primary[(material.material_id, loc.location_code)] for loc in material_candidates) == 1)
        solver.Add(sum(allocation[(material.material_id, loc.location_code)] for loc in material_candidates) == _max_stock_pp(material))
        for loc in material_candidates:
            key = (material.material_id, loc.location_code)
            solver.Add(allocation[key] >= primary[key])
            solver.Add(allocation[key] >= used[key])
            solver.Add(allocation[key] <= _max_stock_pp(material) * used[key])
            solver.Add(primary[key] <= used[key])

    for loc in all_locations:
        loc_materials = [m for m in movable_materials if loc in candidates[m.material_id]]
        if not loc_materials:
            continue
        incumbent_credit = sum(
            1 for material in loc_materials
            if material.incumbent_primary_location_code == loc.location_code
        )
        remaining = max(
            0,
            (loc.max_pallet_capacity or int(loc.capacity or 1))
            - loc.current_pallet_count
            + incumbent_credit,
        )
        solver.Add(sum(allocation[(m.material_id, loc.location_code)] for m in loc_materials) <= remaining)
        solver.Add(sum(primary[(m.material_id, loc.location_code)] for m in loc_materials) <= 1)
        if loc.max_weight_kg:
            solver.Add(sum(_pallet_weight_kg(m) * allocation[(m.material_id, loc.location_code)] for m in loc_materials) <= loc.max_weight_kg)
        if loc.max_volume_cm3:
            solver.Add(sum(_pallet_volume_cm3(m) * allocation[(m.material_id, loc.location_code)] for m in loc_materials) <= loc.max_volume_cm3)

    move_terms = []
    objective_terms = []
    for material in movable_materials:
        incumbent = material.incumbent_primary_location_code
        for loc in candidates[material.material_id]:
            moving = bool(incumbent and incumbent != loc.location_code)
            if moving:
                move_terms.append(primary[(material.material_id, loc.location_code)])
            critical_weight = 3.0 if material.amalgamated_class in {"AF", "AM", "BF"} else (2.0 if material.abc_class == "A" else 1.0)
            demand_weight = max(1.0, material.forecast_demand or material.issue_volume / 12.0)
            travel_cost = _distance(loc, anchor) * critical_weight * (1.0 + min(demand_weight, 100000.0) / 100000.0)
            access_cost = abs(max(1, min(5, loc.accessibility_rating)) - (5 if material.fms_class == "F" else 3)) * critical_weight
            relocation_cost = 25.0 if moving else 0.0
            carrying_cost = 0.001 * max(0.0, material.unit_cost or 0.0)
            stockout_cost = 2.0 * max(0.1, material.stockout_cost_weight) * critical_weight
            objective_terms.append((travel_cost + access_cost + relocation_cost - stockout_cost) * primary[(material.material_id, loc.location_code)])
            objective_terms.append((0.15 * travel_cost + carrying_cost) * allocation[(material.material_id, loc.location_code)])

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
            move_reason="OR-Tools MILP pallet assignment under physical, compatibility, occupancy, and relocation constraints",
            gain_score=max(0.0, distance_saved),
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
            "forecast_weighted_travel_accessibility_objective",
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

    pick_pool = sorted(
        request.locations,
        key=lambda l: (_pick_face_score(l, True), _distance(l, anchor)),
    )
    reserve_pool = sorted(
        request.locations,
        key=lambda l: (_pick_face_score(l, False), -_distance(l, anchor)),
    )

    if request.solver_engine.lower() == "ortools":
        ortools_result = _ortools_optimize_plan(request, pick_pool, reserve_pool, anchor)
        if ortools_result and ortools_result.algorithm == "ORTOOLS_MILP_V2" and ortools_result.assignments:
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
