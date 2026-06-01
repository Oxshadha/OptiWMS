from functools import partial
from config import (
    SLOT_MAX_WEIGHT, SLOT_MAX_WIDTH,
    ZONE_LEVEL_HEIGHT, ZONE_VOLUME_CLASS,
    slot_speed_band
)
from warehouse_state import get_available_depth
from ga_components import toolbox

PENALTY = 1000   # per hard-constraint violation

#  HARD CONSTRAINTS
#  Each returns True when the individual violates the rule.

def violates_weight(individual, parcel_weight):
    """Level weight capacity must not be exceeded."""
    level = individual[3]
    return parcel_weight > SLOT_MAX_WEIGHT[level]

def violates_height(individual, parcel_height):
    """
    Parcel height must fit within the zone's level height.
    Zone A allows 100 cm, Zone B 70 cm, Zone C/D 40 cm.
    """
    zone = individual[0]
    return parcel_height > ZONE_LEVEL_HEIGHT[zone]   # zone-aware now

def violates_width(parcel_width):
    """Parcel width is the same limit across all zones."""
    return parcel_width > SLOT_MAX_WIDTH

def violates_depth(individual, parcel_length):
    """Remaining bin depth must fit the parcel length."""
    return get_available_depth(individual) < parcel_length

def hard_violations(individual, parcel):
    """
    Returns list of violated constraint names.
    Empty list = fully feasible individual.
    """
    v = []
    if violates_weight(individual, parcel["weight"]):           v.append("weight")
    if violates_height(individual, parcel["height"]):           v.append("height")
    if violates_width(parcel["width"]):                         v.append("width")
    if violates_depth(individual, parcel["length"]):            v.append("depth")
    return v

#  SOFT CONSTRAINTS
#  Each returns a cost ≥ 0.  Lower = better placement.

def score_zone_volume(individual, product_volume):
    """
    Penalise placing a parcel in a zone reserved for a different
    volume class.

    product_volume must be "high", "medium", or "low".

    Penalty map:
      correct zone          →   0
      one class away        → 100  (e.g. high item in medium zone)
      two classes away      → 200  (e.g. high item in low zone)
      unassigned zone (D)   →  50  (acceptable but not ideal)
    """
    zone = individual[0]
    assigned_class = ZONE_VOLUME_CLASS[zone]

    if assigned_class is None:
        return 50   # Zone D: allowed but not preferred

    order = {"high": 0, "medium": 1, "low": 2}
    distance = abs(order[product_volume] - order[assigned_class])
    return distance * 100

def score_slot_speed(individual, movement_speed):
    """
    Penalise placing an item in a rack band that does not match
    its movement speed.

    movement_speed must be "fast", "medium", or "slow".

    Penalty:
      correct band     →   0
      one band off     →  60  (e.g. fast item in medium band)
      two bands off    → 120  (e.g. fast item in slow band)
    """
    slot_index = individual[2]
    band = slot_speed_band(slot_index)

    order = {"fast": 0, "medium": 1, "slow": 2}
    distance = abs(order[movement_speed] - order[band])
    return distance * 60

def score_level_weight(individual, parcel_weight):
    """
    Heavier parcels should sit on lower levels (L1=index 0).
    Penalty grows the higher a heavy item is placed.
    """
    level = individual[3]
    ideal = 4 - min(int(parcel_weight / 25), 4)   # heavy→L1(0), light→L5(4)
    return abs(level - ideal) * 30

def score_depth_waste(individual, parcel_length):
    """
    Prefer bins where the parcel uses a larger fraction of available depth.
    Avoids fragmenting racks with tiny parcels leaving awkward gaps.
    """
    available = get_available_depth(individual)
    if available <= 0:
        return PENALTY
    waste_ratio = (available - parcel_length) / available   # 0=perfect, 1=wasteful
    return waste_ratio * 40

def score_row_proximity(individual):
    """
    Lower row index = closer to the dispatch/entry point.
    Small constant penalty per row away from row 0.
    """
    return individual[1] * 5

def score_bin_balance(individual):
    """
    Mild preference to fill Bin A before Bin B on the same level,
    so bin usage is predictable and auditable.
    """
    if individual[4] == 1:   # Bin B chosen
        ind_a = list(individual)
        ind_a[4] = 0
        if get_available_depth(ind_a) > 0:
            return 15   # Bin A still has space — nudge toward it
    return 0


#  MAIN FITNESS FUNCTION

def evaluate(individual, parcel):
    """
    Compute the placement cost for a 5-gene chromosome
    [zone, row, slot, level, bin].

    Parcel dict keys:
        weight          (kg)
        length          (cm)   — depth into rack
        height          (cm)
        width           (cm)
        product_volume  (str)  — "high" | "medium" | "low"
        movement_speed  (str)  — "fast" | "medium" | "slow"

    Returns (cost,) — DEAP requires a tuple. Lower = better.
    """
    cost = 0.0

    # Hard constraints
    violations = hard_violations(individual, parcel)
    cost += len(violations) * PENALTY

    # Soft constraints 
    # Always scored so the GA can rank even infeasible individuals
    # by how close they are to feasibility.
    cost += score_zone_volume(individual, parcel["product_volume"])
    cost += score_slot_speed(individual, parcel["movement_speed"])
    cost += score_level_weight(individual, parcel["weight"])
    cost += score_row_proximity(individual)
    cost += score_bin_balance(individual)

    # Depth waste only makes sense for feasible solutions
    if not violations:
        cost += score_depth_waste(individual, parcel["length"])

    return (cost,)

def register_evaluate(parcel):
    """Call once per inbound order before running the GA."""
    toolbox.register("evaluate", partial(evaluate, parcel=parcel))