"""
config.py — Warehouse dimension constants and helper functions.
"""

ZONES  = 4    
ROWS   = 20   
SLOTS  = 10   
LEVELS = 5    
BINS   = 2    
 
ZONE_LABELS  = ["A", "B", "C", "D"]
LEVEL_LABELS = ["L1", "L2", "L3", "L4", "L5"]
BIN_LABELS   = ["A", "B"]
 
ZONE_VOLUME_CLASS = {
    0: "high",    
    1: "medium",  
    2: "low",     
    3: None,      
}
 
ZONE_LEVEL_HEIGHT = {
    0: 100,  
    1: 70,   
    2: 40,   
    3: 40,   
}
 
FAST_SLOT_MAX = 2   
SLOW_SLOT_MIN = 7   
 
def slot_speed_band(slot_index: int) -> str:
    if slot_index <= FAST_SLOT_MAX:
        return "fast"
    if slot_index >= SLOW_SLOT_MIN:
        return "slow"
    return "medium"
 
SLOT_MAX_WEIGHT = {
    0: 500,   
    1: 400,   
    2: 300,   
    3: 200,   
    4: 100,   
}
 
SLOT_MAX_WIDTH = 100   
SLOT_MAX_DEPTH = 200   
 
VOLUME_HIGH_THRESHOLD   = 50_000   
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
    for level_idx in range(LEVELS):
        if weight_kg <= SLOT_MAX_WEIGHT[level_idx]:
            pass
    for level_idx in reversed(range(LEVELS)):
        if weight_kg <= SLOT_MAX_WEIGHT[level_idx]:
            return level_idx
    return 0