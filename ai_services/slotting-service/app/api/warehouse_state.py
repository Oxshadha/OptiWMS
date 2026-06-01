from config import SLOT_MAX_DEPTH

warehouse_state = {}

def get_available_depth(individual):
    used = warehouse_state.get(tuple(individual), 0)
    return SLOT_MAX_DEPTH - used

def reserve_space(individual, parcel_length):
    k = tuple(individual)
    warehouse_state[k] = warehouse_state.get(k, 0) + parcel_length

def release_space(individual, parcel_length):
    k = tuple(individual)
    warehouse_state[k] = max(0, warehouse_state.get(k, 0) - parcel_length)