import copy
import uuid

from deap import tools

from ga_components import toolbox, decode
from fitness import register_evaluate, hard_violations
from bin_registry import BinRegistry
from warehouse_state import WarehouseState
from input_handler import get_user_inputs
from config import SLOT_MAX_DEPTH, SLOT_MAX_WEIGHT

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
 

if __name__ == "__main__":
    registry = BinRegistry()
    registry.load("bin_states.json") 
    shared_state = WarehouseState(registry)
    
    print("═" * 34)
    print("  Welcome to OptiWMS Slotting GA")
    print("═" * 34)

    while True:
        parcel = get_user_inputs()
        parcel_id = f"CLI_{str(uuid.uuid4())[:6]}"
        
        best = run_ga(parcel, state=shared_state, pop_size=50, generations=100)
        violations = hard_violations(best, parcel, shared_state)
        
        loc_code = decode(best)
        fitness_score = best.fitness.values[0]
        
        feasibility_status = "✓ Feasible" if not violations else f"⚠ INFEASIBLE — {', '.join(violations)}"
        reason = build_cli_reason(parcel, loc_code)
        
        print("\n" + "═" * 34)
        print("  OptiWMS Slotting Recommendation")
        print("═" * 34)
        print("  Input Summary")
        print("  ─────────────")
        print(f"  Weight         :  {parcel['weight']} kg")
        print(f"  Dimensions     :  {parcel['length']} × {parcel['width']} × {parcel['height']} cm  (L × W × H)")
        print(f"  Volume         :  {parcel['volume_cm3']:,.0f} cm³  →  {parcel['product_volume']}-volume class")
        print(f"  Movement Speed :  {parcel['movement_speed']}")
        print("\n  Recommendation")
        print("  ──────────────")
        print(f"  Location       :  {loc_code}")
        print(f"  Fitness Cost   :  {fitness_score:.1f}   (lower = better)")
        print(f"  Feasibility    :  {feasibility_status}")
        print(f"  Reason         :  {reason}")

        if not violations:
            shared_state.reserve_space(best, parcel_id, parcel["length"], parcel["weight"])
            registry.save("bin_states.json")
            
            bin_state = registry.get_bin(best)
            max_weight = SLOT_MAX_WEIGHT[best[3]]
            print("\n  Bin State")
            print("  ─────────")
            print(f"  Usage          :  {bin_state.used_depth_cm}/{SLOT_MAX_DEPTH} cm | {bin_state.used_weight_kg}/{max_weight} kg")
            print(f"  Items in bin   :  {bin_state.item_count}")

        print("═" * 34 + "\n")

        run_again = input("Run another item? (y/n): ").strip().lower()
        if run_again != 'y':
            print("Exiting OptiWMS Slotting...")
            break