import copy
import uuid

from deap import tools

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ga_components import toolbox, decode

from fitness import register_evaluate, hard_violations
from bin_registry import BinRegistry
from warehouse_state import WarehouseState
from config import SLOT_MAX_DEPTH, LEVEL_MAX_WEIGHT
from endpoints import router as api_router

DEFAULT_POP_SIZE        = 50
DEFAULT_GENERATIONS     = 100
DEFAULT_CX_PROBABILITY  = 0.7    
DEFAULT_MUT_PROBABILITY = 0.2    


def run_ga(
    parcel: dict,
    state: WarehouseState | None = None,
    pop_size: int   = DEFAULT_POP_SIZE,
    generations: int = DEFAULT_GENERATIONS,
    cx_prob: float  = DEFAULT_CX_PROBABILITY,
    mut_prob: float = DEFAULT_MUT_PROBABILITY,
):
    if state is None:
        state = WarehouseState()
 
    register_evaluate(parcel, state)
 
    population = toolbox.population(n=pop_size)
    for ind in population:
        ind.fitness.values = toolbox.evaluate(ind)
 
    best_ever = copy.deepcopy(min(population, key=lambda x: x.fitness.values[0]))
 
    for _gen in range(generations):
        offspring = toolbox.select(population, k=len(population))
        offspring = [copy.deepcopy(ind) for ind in offspring]
 
        for i in range(0, len(offspring) - 1, 2):
            if __import__("random").random() < cx_prob:
                toolbox.mate(offspring[i], offspring[i + 1])
                del offspring[i].fitness.values
                del offspring[i + 1].fitness.values
 
        for ind in offspring:
            if __import__("random").random() < mut_prob:
                toolbox.mutate(ind)
                del ind.fitness.values
 
        for ind in offspring:
            if not ind.fitness.valid:
                ind.fitness.values = toolbox.evaluate(ind)
 
        population[:] = offspring
 
        gen_best = min(population, key=lambda x: x.fitness.values[0])
        if best_ever.fitness.values[0] < gen_best.fitness.values[0]:
            worst_idx = max(
                range(len(population)),
                key=lambda i: population[i].fitness.values[0],
            )
            population[worst_idx] = copy.deepcopy(best_ever)
        else:
            best_ever = copy.deepcopy(gen_best)
 
    return best_ever
 
def build_cli_reason(parcel: dict, location_code: str) -> str:
    parts = []
    parts.append(f"{parcel['movement_speed'].capitalize()}-moving item")
    parts.append(f"{parcel['product_volume']}-volume class")
    
    if parcel["weight"] > 200:
        parts.append("heavy item — lower level preferred")
    elif parcel["weight"] < 10:
        parts.append("light item — upper level preferred")
        
    if parcel["height"] > 80:
        parts.append("tall carton — Zone A clearance required")
    elif parcel["height"] <= 40:
        parts.append("compact height — Zone C/D compatible")
        
    zone = location_code[0] if location_code else "?"
    zone_desc = {
        "A": "Zone A (fast/high-volume, near dispatch)",
        "B": "Zone B (medium-volume)",
        "C": "Zone C (low-volume / compact)",
        "D": "Zone D (overflow / slow-moving)",
    }.get(zone, f"Zone {zone}")
    parts.append(f"assigned to {zone_desc}")
    
    return "; ".join(parts) + "."
 

# CLI runner removed - use the FastAPI endpoints instead.