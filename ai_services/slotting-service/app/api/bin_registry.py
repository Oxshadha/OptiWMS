"""
bin_registry.py — Persistent structured bin registry for the warehouse.
"""
import json
import os
from dataclasses import dataclass, field
from config import (
    SLOT_MAX_DEPTH,
    SLOT_MAX_WEIGHT,
    ZONES, ROWS, SLOTS, LEVELS, BINS
)

@dataclass
class BinState:
    used_depth_cm: float = 0.0
    used_weight_kg: float = 0.0
    item_count: int = 0
    is_locked: bool = False
    items: list = field(default_factory=list)

    def remaining_depth(self) -> float:
        return max(0.0, SLOT_MAX_DEPTH - self.used_depth_cm)

    def remaining_weight(self, level_idx: int) -> float:
        return max(0.0, SLOT_MAX_WEIGHT[level_idx] - self.used_weight_kg)


class BinRegistry:
    """
    Global registry tracking the state of all 8,000 warehouse bins.
    """
    def __init__(self):
        self._bins: dict[tuple, BinState] = {}
        self.initialize()

    def initialize(self):
        """Populates all bins with an empty BinState."""
        for z in range(ZONES):
            for r in range(ROWS):
                for s in range(SLOTS):
                    for l in range(LEVELS):
                        for b in range(BINS):
                            self._bins[(z, r, s, l, b)] = BinState()

    def get_bin(self, individual) -> BinState:
        """Fetch the state for a specific bin."""
        key = tuple(individual[:5])
        return self._bins.get(key, BinState())

    def is_available(self, individual, parcel: dict) -> bool:
        """
        Check if the bin has capacity for the parcel's depth and weight,
        and is not locked for maintenance.
        """
        b = self.get_bin(individual)
        level_idx = individual[3]

        if b.is_locked:
            return False
        if b.used_depth_cm + parcel["length"] > SLOT_MAX_DEPTH:
            return False
        if b.used_weight_kg + parcel["weight"] > SLOT_MAX_WEIGHT[level_idx]:
            return False
        
        return True

    def reserve(self, individual, parcel_id: str, length: float, weight: float):
        """Record parcel metrics into the bin."""
        b = self.get_bin(individual)
        b.used_depth_cm += length
        b.used_weight_kg += weight
        b.item_count += 1
        b.items.append(parcel_id)

    def release(self, individual, parcel_id: str, length: float, weight: float):
        """Undo a reservation."""
        b = self.get_bin(individual)
        b.used_depth_cm = max(0.0, b.used_depth_cm - length)
        b.used_weight_kg = max(0.0, b.used_weight_kg - weight)
        
        if parcel_id in b.items:
            b.items.remove(parcel_id)
            b.item_count = max(0, b.item_count - 1)

    def snapshot(self) -> dict:
        """Return a view of active bins for debugging/API."""
        return {
            str(k): v for k, v in self._bins.items()
            if v.item_count > 0 or v.is_locked
        }

    def available_count(self) -> int:
        """Count how many bins are completely empty."""
        return sum(1 for b in self._bins.values() if b.item_count == 0 and not b.is_locked)

    def save(self, path: str):
        """Persist active bins to disk."""
        data = {
            "bins": {
                f"{k[0]},{k[1]},{k[2]},{k[3]},{k[4]}": {
                    "used_depth_cm": v.used_depth_cm,
                    "used_weight_kg": v.used_weight_kg,
                    "item_count": v.item_count,
                    "is_locked": v.is_locked,
                    "items": v.items
                }
                for k, v in self._bins.items() if v.item_count > 0 or v.is_locked
            }
        }
        with open(path, 'w') as f:
            json.dump(data, f)

    def load(self, path: str):
        """Restore bin states from disk."""
        if not os.path.exists(path):
            return
        
        with open(path, 'r') as f:
            data = json.load(f)
            
        for k_str, v_dict in data.get("bins", {}).items():
            k = tuple(map(int, k_str.split(',')))
            if k in self._bins:
                b = self._bins[k]
                b.used_depth_cm = v_dict.get("used_depth_cm", 0.0)
                b.used_weight_kg = v_dict.get("used_weight_kg", 0.0)
                b.item_count = v_dict.get("item_count", 0)
                b.is_locked = v_dict.get("is_locked", False)
                b.items = v_dict.get("items", [])