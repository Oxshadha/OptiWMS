"""
warehouse_state.py — Session wrapper for bin tracking.
"""
from bin_registry import BinRegistry


class WarehouseState:
    """
    Session wrapper for a GA run. Delegates all reads and writes
    to the underlying global BinRegistry.
    """

    def __init__(self, registry: BinRegistry = None):
        self.registry = registry if registry else BinRegistry()

    def get_available_depth(self, individual) -> float:
        """Return remaining depth (cm) in the bin."""
        return self.registry.get_bin(individual).remaining_depth()

    def is_bin_available(self, individual, parcel: dict) -> bool:
        """Check combined depth, weight, and lock availability."""
        return self.registry.is_available(individual, parcel)

    def reserve_space(self, individual, parcel_id: str, parcel_length: float, parcel_weight: float) -> None:
        """Write-through to BinRegistry to record space consumption."""
        self.registry.reserve(individual, parcel_id, parcel_length, parcel_weight)

    def release_space(self, individual, parcel_id: str, parcel_length: float, parcel_weight: float) -> None:
        """Undo a prior reservation in the BinRegistry."""
        self.registry.release(individual, parcel_id, parcel_length, parcel_weight)


# ---------------------------------------------------------------------------
# Module-level singleton — used ONLY for backwards compatibility in tests.
# ---------------------------------------------------------------------------
_global_state = WarehouseState()

def get_available_depth(individual) -> float:
    return _global_state.get_available_depth(individual)

def reserve_space(individual, parcel_id: str, parcel_length: float, parcel_weight: float) -> None:
    _global_state.reserve_space(individual, parcel_id, parcel_length, parcel_weight)

def release_space(individual, parcel_id: str, parcel_length: float, parcel_weight: float) -> None:
    _global_state.release_space(individual, parcel_id, parcel_length, parcel_weight)