from ga_components import toolbox, decode
from fitness import register_evaluate, hard_violations
from warehouse_state import reserve_space

def run_ga(parcel, pop_size=50):
    register_evaluate(parcel)
    pop = toolbox.population(n=pop_size)
    for ind in pop:
        ind.fitness.values = toolbox.evaluate(ind)
    pop.sort(key=lambda x: x.fitness.values[0])
    return pop[0]

if __name__ == "__main__":
    # Two test parcels showing the new fields
    parcels = [
        {
            "weight": 60,           # kg  — heavy
            "length": 80,           # cm
            "height": 90,           # cm  — tall → needs Zone A (100 cm)
            "width":  50,           # cm
            "product_volume": "high",   # → prefers Zone A
            "movement_speed": "fast",   # → prefers slots 001–003
        },
        {
            "weight": 8,
            "length": 30,
            "height": 35,           # cm  — fits Zone C (40 cm)
            "width":  20,
            "product_volume": "low",    # → prefers Zone C
            "movement_speed": "slow",   # → prefers slots 198–200
        },
    ]

    for parcel in parcels:
        print(f"\n── Parcel: {parcel['product_volume']}-volume, "
              f"{parcel['movement_speed']}-moving, h={parcel['height']}cm ──")
        best = run_ga(parcel)
        violations = hard_violations(best, parcel)
        status = "feasible" if not violations else f"INFEASIBLE {violations}"
        print(f"  Recommended: {decode(best)}")
        print(f"  Cost: {best.fitness.values[0]:.1f}  |  {status}")
        if not violations:
            reserve_space(best, parcel["length"])