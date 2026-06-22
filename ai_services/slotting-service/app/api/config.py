"""
config.py — Warehouse dimension constants and helper functions.
"""

ZONES  = 4          # 0=A, 1=B, 2=C, 3=D
ROWS   = 20         # 0..19  →  rows 1..20
SLOTS  = 10         # 0..9   →  slot labels 01..10
LEVELS = 5          # 0..4   →  L1..L5
BINS   = 2          # 0=Bin A,  1=Bin B

ZONE_LABELS  = ["A", "B", "C", "D"]
LEVEL_LABELS = ["L1", "L2", "L3", "L4", "L5"]
BIN_LABELS   = ["A", "B"]

ZONE_VOLUME_CLASS = {
    0: "high",    # Zone A — high-volume / fast-moving
    1: "medium",  # Zone B
    2: "low",     # Zone C
    3: None,      # Zone D — no restriction (overflow / bulk)
}

ZONE_LEVEL_HEIGHT = {
    0: 100,  # Zone A (cm)
    1: 70,   # Zone B
    2: 40,   # Zone C
    3: 40,   # Zone D
}

FAST_SLOT_MAX = 2    # slots 0..2   (first 3)
SLOW_SLOT_MIN = 7    # slots 7..9   (last 3)

STORAGE_TYPE_COMPATIBILITY = {
    "PALLET":  {"zones": [0, 1, 2, 3], "min_level_height": 150, "min_weight_cap": 200},
    "DRUM":    {"zones": [0, 1],       "min_level_height": 100, "min_weight_cap": 300},
    "REEL":    {"zones": [1, 2],       "min_level_height": 60,  "min_weight_cap": 100},
    "CARTON":  {"zones": [0, 1, 2, 3], "min_level_height": 40,  "min_weight_cap": 50},
    "BAG":     {"zones": [0, 1, 2, 3], "min_level_height": 40,  "min_weight_cap": 50},
    "IBC":     {"zones": [0],          "min_level_height": 120, "min_weight_cap": 1000},
    "ROLL":    {"zones": [1, 2, 3],    "min_level_height": 40,  "min_weight_cap": 50},
}


def slot_speed_band(slot_index: int) -> str:
    if slot_index <= FAST_SLOT_MAX:
        return "fast"
    if slot_index >= SLOW_SLOT_MIN:
        return "slow"
    return "medium"


SLOT_MAX_WEIGHT = {
    0: 2000,  # Level 1 (ground) — heavy pallets, drums, IBCs
    1: 1500,  # Level 2
    2: 1000,  # Level 3
    3: 800,   # Level 4
    4: 500,   # Level 5
}

SLOT_MAX_WIDTH = 100   # cm
SLOT_MAX_DEPTH = 200   # cm per bin

VOLUME_HIGH_THRESHOLD   = 50_000   # cm³
VOLUME_MEDIUM_THRESHOLD =  5_000

VELOCITY_FAST_THRESHOLD   = 100
VELOCITY_MEDIUM_THRESHOLD =  20


def calculate_volume(length_cm: float, width_cm: float, height_cm: float) -> float:
    return length_cm * width_cm * height_cm


def classify_volume(volume_cm3) -> str:
    if volume_cm3 is None:
        return "medium"
    if volume_cm3 >= VOLUME_HIGH_THRESHOLD:
        return "high"
    if volume_cm3 >= VOLUME_MEDIUM_THRESHOLD:
        return "medium"
    return "low"


def classify_velocity(velocity) -> str:
    if velocity is None:
        return "medium"
    if velocity >= VELOCITY_FAST_THRESHOLD:
        return "fast"
    if velocity >= VELOCITY_MEDIUM_THRESHOLD:
        return "medium"
    return "slow"


def ideal_level_for_weight(weight_kg: float) -> int:
    for level_idx in reversed(range(LEVELS)):
        if weight_kg <= SLOT_MAX_WEIGHT[level_idx]:
            return level_idx
    return 0
