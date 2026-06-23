"""
Deterministic plan optimizer for quarterly slotting (heuristic + optional MILP hook).
Backend persists results; this service only computes assignments.
"""
from __future__ import annotations

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
    is_active: bool = True


class PlanOptimizeRequest(BaseModel):
    warehouse_id: str
    relocation_budget_pct: float = 30.0
    materials: List[PlanMaterialInput] = Field(default_factory=list)
    locations: List[PlanLocationInput] = Field(default_factory=list)
    locked_material_ids: List[str] = Field(default_factory=list)
    use_milp_a_class: bool = False


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
    if material.weight_kg and material.pallet_spaces and material.pallet_spaces > 0:
        return material.weight_kg * material.pallet_spaces
    return material.weight_kg or 0.0


def _fits_physical(loc: PlanLocationInput, material: PlanMaterialInput, active_pp: int = 1) -> bool:
    pallet_weight = _pallet_weight_kg(material)
    if pallet_weight > 0 and loc.max_weight_kg and pallet_weight > loc.max_weight_kg:
        return False
    pallet_volume = None
    if material.volume_cm3 and material.pallet_spaces:
        pallet_volume = material.volume_cm3 * material.pallet_spaces
    if pallet_volume and loc.max_volume_cm3 and pallet_volume > loc.max_volume_cm3:
        return False
    if loc.max_pallet_capacity and active_pp > loc.max_pallet_capacity:
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
    )
