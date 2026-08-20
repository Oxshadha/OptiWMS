"""
fitness.py — Hard and soft constraint scoring for the DEAP GA.
"""
from functools import partial

from config import (
    SLOT_MAX_WIDTH,
    SLOT_MAX_WEIGHT,
    ZONE_LEVEL_HEIGHT,
    ZONE_VOLUME_CLASS,
    STORAGE_TYPE_COMPATIBILITY,
    slot_speed_band,
    ideal_level_for_weight,
)
from warehouse_state import WarehouseState
from ga_components import toolbox

PENALTY = 1_000
FORKLIFT_RELOCATION_COST = 120.0  # SL Baseline

AMALGAMATED_ZONE_MAP = {
    ("A", "Fast"): 0,  # FA -> Zone A
    ("A", "Medium"): 0,
    ("A", "Slow"): 1,
    ("B", "Fast"): 0,  # BF -> Zone A (high-value fast movers near dispatch)
    ("B", "Medium"): 1,
    ("B", "Slow"): 2,
    ("C", "Fast"): 1,  # CF -> Zone B
    ("C", "Medium"): 2,
    ("C", "Slow"): 3,
}

# ===========================================================================
# HARD CONSTRAINTS
# ===========================================================================

def violates_availability(individual, parcel: dict, state: WarehouseState) -> bool:
    """Check if the bin has sufficient depth/weight capacity and isn't locked."""
    return not state.is_bin_available(individual, parcel)


def violates_height(individual, parcel_height: float) -> bool:
    """Parcel height must fit within the zone's level-clearance limit."""
    zone = individual[0]
    return parcel_height > ZONE_LEVEL_HEIGHT[zone]


def violates_width(parcel_width: float) -> bool:
    """Parcel width must not exceed the shared slot width limit."""
    return parcel_width > SLOT_MAX_WIDTH


def hard_violations(individual, parcel: dict, state: WarehouseState) -> list[str]:
    v = []
    if violates_height(individual, parcel.get("height", 0)):             v.append("height")
    if violates_width(parcel.get("width", 0)):                           v.append("width")
    if violates_availability(individual, parcel, state):          v.append("availability (capacity/locked)")
    return v


# ===========================================================================
# SOFT CONSTRAINTS
# ===========================================================================

def score_zone_volume(individual, product_volume: str) -> float:
    zone = individual[0]
    assigned_class = ZONE_VOLUME_CLASS.get(zone)
    if assigned_class is None: 
        return 50.0
    order = {"high": 0, "medium": 1, "low": 2}
    distance = abs(order.get(product_volume, 2) - order.get(assigned_class, 2))
    return distance * 100.0


def score_slot_speed(individual, movement_speed: str) -> float:
    slot_index = individual[2]
    band = slot_speed_band(slot_index)
    order = {"fast": 0, "medium": 1, "slow": 2}
    distance = abs(order.get(movement_speed, 2) - order.get(band, 2))
    return distance * 60.0


def score_level_weight(individual, parcel_weight: float) -> float:
    level = individual[3]
    ideal = ideal_level_for_weight(parcel_weight)
    return abs(level - ideal) * 30.0


def score_depth_waste(individual, parcel_length: float, state: WarehouseState) -> float:
    available = state.get_available_depth(individual)
    if available <= 0:
        return float(PENALTY)
    waste_ratio = (available - parcel_length) / available   
    return waste_ratio * 40.0


def score_row_proximity(individual) -> float:
    return individual[1] * 5.0


def score_bin_balance(individual, state: WarehouseState) -> float:
    if individual[4] == 1:   
        alt = list(individual)
        alt[4] = 0           
        if state.get_available_depth(alt) > 0:
            return 15.0      
    return 0.0

def score_forecast_velocity(individual, forecast_p50_h1: float) -> float:
    if not forecast_p50_h1:
        return 0.0
    row_index = individual[1]
    return forecast_p50_h1 * row_index * 0.5


def score_relocation_penalty(is_relocation: bool) -> float:
    if is_relocation:
        return FORKLIFT_RELOCATION_COST
    return 0.0


def score_storage_type_compatibility(individual, storage_type: str | None) -> float:
    if storage_type is None:
        return 0.0
    rules = STORAGE_TYPE_COMPATIBILITY.get(storage_type)
    if rules is None:
        return 0.0

    zone = individual[0]
    level = individual[3]
    cost = 0.0

    if zone not in rules["zones"]:
        cost += PENALTY

    level_height = ZONE_LEVEL_HEIGHT.get(zone, 40)
    if level_height < rules["min_level_height"]:
        cost += 200.0

    level_weight_cap = SLOT_MAX_WEIGHT.get(level, 500)
    if level_weight_cap < rules["min_weight_cap"]:
        cost += 150.0

    return cost


def score_amalgamated_zone(individual, abc_class: str | None, fms_class: str | None) -> float:
    if abc_class is None or fms_class is None:
        return 0.0
    ideal_zone = AMALGAMATED_ZONE_MAP.get((abc_class, fms_class))
    if ideal_zone is None:
        return 25.0
    actual_zone = individual[0]
    distance = abs(actual_zone - ideal_zone)
    return distance * 80.0


def score_level_unit_capacity(individual, storage_type: str | None, quantity: int) -> float:
    """Penalize if the assigned level can't hold the requested quantity for this storage type."""
    if storage_type is None or quantity <= 0:
        return 0.0
    from config import STORAGE_TYPE_COMPATIBILITY  # noqa: already imported at top
    rules = STORAGE_TYPE_COMPATIBILITY.get(storage_type)
    if rules is None:
        return 0.0
    level = individual[3] + 1  # 0-indexed -> 1-indexed
    level_weight = SLOT_MAX_WEIGHT.get(individual[3], 500)
    if level_weight < rules.get("min_weight_cap", 0):
        return PENALTY * 0.5
    return 0.0


def score_demand_volatility(individual, volatility: float | None) -> float:
    """High-volatility SKUs should be in accessible locations (lower rows, lower levels)."""
    if volatility is None or volatility <= 0:
        return 0.0
    row = individual[1]
    level = individual[3]
    accessibility_cost = (row * 0.3 + level * 0.7) * volatility * 0.1
    return min(accessibility_cost, 100.0)

# ===========================================================================
# MAIN FITNESS FUNCTION
# ===========================================================================

def evaluate(individual, parcel: dict, state: WarehouseState) -> tuple:
    cost = 0.0
    violations = hard_violations(individual, parcel, state)
    cost += len(violations) * PENALTY

    cost += score_zone_volume(individual, parcel.get("product_volume", "low"))
    cost += score_slot_speed(individual,  parcel.get("movement_speed", "slow"))
    cost += score_level_weight(individual, parcel.get("weight", 0))
    cost += score_row_proximity(individual)
    cost += score_bin_balance(individual, state)

    cost += score_forecast_velocity(individual, parcel.get("forecast_p50", 0.0))
    cost += score_relocation_penalty(parcel.get("is_relocation", False))

    cost += score_storage_type_compatibility(individual, parcel.get("storage_type"))
    cost += score_amalgamated_zone(individual, parcel.get("abc_class"), parcel.get("fms_class"))
    cost += score_level_unit_capacity(individual, parcel.get("storage_type"), parcel.get("quantity", 1))
    cost += score_demand_volatility(individual, parcel.get("forecast_volatility"))

    if not violations:
        cost += score_depth_waste(individual, parcel.get("length", 0), state)

    return (cost,)


def register_evaluate(parcel: dict, state: WarehouseState) -> None:
    if hasattr(toolbox, "evaluate"):
        toolbox.unregister("evaluate")
    toolbox.register(
        "evaluate",
        partial(evaluate, parcel=parcel, state=state),
    )
