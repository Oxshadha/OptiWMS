from functools import partial

from config import (
    SLOT_MAX_WIDTH,
    ZONE_LEVEL_HEIGHT,
    ZONE_VOLUME_CLASS,
    slot_speed_band,
    ideal_level_for_weight,
)
from warehouse_state import WarehouseState
from ga_components import toolbox

PENALTY = 1_000   


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
    if violates_height(individual, parcel["height"]):             v.append("height")
    if violates_width(parcel["width"]):                           v.append("width")
    if violates_availability(individual, parcel, state):          v.append("availability (capacity/locked)")
    return v


# ===========================================================================
# SOFT CONSTRAINTS
# ===========================================================================

def score_zone_volume(individual, product_volume: str) -> float:
    zone = individual[0]
    assigned_class = ZONE_VOLUME_CLASS[zone]
    if assigned_class is None: 
        return 50.0
    order = {"high": 0, "medium": 1, "low": 2}
    distance = abs(order[product_volume] - order[assigned_class])
    return distance * 100.0


def score_slot_speed(individual, movement_speed: str) -> float:
    slot_index = individual[2]
    band = slot_speed_band(slot_index)
    order = {"fast": 0, "medium": 1, "slow": 2}
    distance = abs(order[movement_speed] - order[band])
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


# ===========================================================================
# MAIN FITNESS FUNCTION
# ===========================================================================

def evaluate(individual, parcel: dict, state: WarehouseState) -> tuple:
    cost = 0.0
    violations = hard_violations(individual, parcel, state)
    cost += len(violations) * PENALTY

    cost += score_zone_volume(individual, parcel["product_volume"])
    cost += score_slot_speed(individual,  parcel["movement_speed"])
    cost += score_level_weight(individual, parcel["weight"])
    cost += score_row_proximity(individual)
    cost += score_bin_balance(individual, state)

    if not violations:
        cost += score_depth_waste(individual, parcel["length"], state)

    return (cost,)


def register_evaluate(parcel: dict, state: WarehouseState) -> None:
    if hasattr(toolbox, "evaluate"):
        toolbox.unregister("evaluate")
    toolbox.register(
        "evaluate",
        partial(evaluate, parcel=parcel, state=state),
    )