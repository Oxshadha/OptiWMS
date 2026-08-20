"""
solver_determinism_evidence.py
==============================
Produces REAL solver evidence for Chapter 7 from the v8 controlled population.

WHAT THIS SCRIPT DOES AND DELIBERATELY DOES NOT DO
--------------------------------------------------------------------------
It does NOT produce a head-to-head "MILP versus GA" benchmark, because the two
solvers in this project do not solve the same problem:

  * The MILP (`slotting-service/app/services/plan_optimizer.py`,
    `_ortools_full_milp_optimize_plan`) assigns ALL 144 materials
    SIMULTANEOUSLY across the 4,200 real v8 storage positions, choosing a pick
    face plus reserve positions, minimising a monetary objective built from
    travel, access, vertical, relocation, carrying and stockout cost terms.

  * The GA (`slotting-service/app/api/main.py`, `run_ga`) places ONE PARCEL AT
    A TIME. Its chromosome is 5 genes, [zone, row, slot, level, bin], over an
    abstract 4 x 20 x 10 x 5 x 2 = 8,000-bin grid defined in `config.py`. Its
    fitness is a hard/soft constraint penalty score, not a monetary cost.

  They do not even share a location namespace. `ga_components.decode()` emits
  codes of the form "A-01-01-L1-A" (alphabetic level, two bins). The v8 layout
  uses "A-01-01-2-B" (numeric level, three bins). Zero of the 4,206 v8 location
  codes match the GA pattern.

  Forcing a comparison would require inventing a mapping layer between the two
  representations. Any result would then measure that invented mapping rather
  than the system, which is precisely the class of fabricated evidence this
  chapter is trying to eliminate. So this script reports TWO SEPARATE, HONESTLY
  LABELLED FACTS instead:

    Part A - the production MILP is deterministic on the real v8 population.
    Part B - the advisory GA is stochastic on its own per-parcel problem.

  Together these justify the architectural decision (MILP is the authoritative
  planner, GA is an advisory per-parcel putaway helper). They do NOT establish
  that either solver produces better solutions than the other.

REQUIREMENTS
--------------------------------------------------------------------------
Run from the repository root with an environment that has ortools and deap:

    cd "<repo>/Ai miroservices/modeling/v8_controlled_synthetic_validation"
    python solver_determinism_evidence.py

Both dependencies are hard requirements. This script raises rather than
substituting synthetic stand-ins if either is missing.

OUTPUTS (written to ./outputs/solver_evidence/)
--------------------------------------------------------------------------
    milp_determinism.json          repeated-run identity result
    ga_stochasticity.csv           per-parcel GA results across seeds
    solver_behaviour.png           two-panel figure for Chapter 7
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# Hard dependencies - never silently substituted
# --------------------------------------------------------------------------
try:
    from ortools.linear_solver import pywraplp  # noqa: F401
except ImportError as exc:  # pragma: no cover
    raise RuntimeError(
        "OR-Tools is required. `pip install ortools`. This script never "
        "simulates a solve."
    ) from exc

HERE = Path.cwd().resolve()
REPO = HERE.parents[2]
OUT = HERE / "outputs"
EVID = OUT / "solver_evidence"
EVID.mkdir(parents=True, exist_ok=True)

SLOTTING = REPO / "ai_services" / "slotting-service"
sys.path.insert(0, str(SLOTTING))
sys.path.insert(0, str(SLOTTING / "app" / "api"))

MILP_RUNS = 3
GA_SEEDS = [17, 42, 101, 303, 707]
GA_PARCELS = 20


# ==========================================================================
# Part A - MILP determinism on the real v8 population
# ==========================================================================
def part_a_milp_determinism() -> dict:
    from app.services.plan_optimizer import (  # type: ignore
        PlanLocationInput,
        PlanMaterialInput,
        PlanOptimizeRequest,
        optimize_plan,
    )

    materials = pd.read_csv(OUT / "physical_materials.csv")
    requirements = pd.read_csv(OUT / "storage_capacity_requirements.csv")
    locations = pd.read_csv(OUT / "physical_layout.csv.gz")
    assignments = pd.read_csv(OUT / "location_assignments.csv.gz")

    incumbent = (
        assignments.loc[assignments.priority.eq(1)]
        .set_index("material_code")
        .location_code.to_dict()
    )
    population = materials.merge(
        requirements,
        on=[
            "material_code",
            "material_type",
            "abc_class",
            "fms_class",
            "amalgamated_class",
        ],
        suffixes=("", "_capacity"),
    )

    material_inputs = [
        PlanMaterialInput(
            material_id=r.material_code,
            material_code=r.material_code,
            material_type=r.material_type,
            abc_class=r.abc_class,
            fms_class=r.fms_class,
            amalgamated_class=r.amalgamated_class,
            issue_volume=float(r.issue_volume_12m),
            issue_count=int(r.issue_count_12m),
            required_pallets=int(r.required_positions),
            pallet_weight_kg=float(r.pallet_weight_kg),
            pallet_volume_cm3=float(r.pallet_volume_cm3),
            incumbent_primary_location_code=incumbent[r.material_code],
            temperature_controlled=bool(r.temperature_controlled),
            hazardous=bool(r.hazardous),
            fragile=bool(r.fragile),
            stackable=bool(r.stackable),
            forecast_demand=float(r.issue_volume_12m) / 12.0,
            unit_cost=float(r.unit_cost),
        )
        for r in population.itertuples(index=False)
    ]

    location_inputs = [
        PlanLocationInput(**{k: v for k, v in row._asdict().items() if k != "Index"})
        for row in locations.itertuples()
    ]

    signatures, objectives, statuses = [], [], []
    for run in range(MILP_RUNS):
        result = optimize_plan(
            PlanOptimizeRequest(materials=material_inputs, locations=location_inputs, warehouse_id="WH-V8", solver_engine="ortools")
        )
        pairs = sorted(
            (a.material_id, a.recommended_primary_location_code)
            for a in getattr(result, "assignments", [])
        )
        signatures.append(hash(tuple(pairs)))
        objectives.append(getattr(result, "objective_value", None))
        statuses.append(getattr(result, "solver_status", None))
        print(f"  MILP run {run + 1}/{MILP_RUNS}: "
              f"status={statuses[-1]} objective={objectives[-1]}")

    identical = len(set(signatures)) == 1
    obj_spread = (
        float(np.ptp([o for o in objectives if o is not None]))
        if any(o is not None for o in objectives)
        else None
    )
    return {
        "runs": MILP_RUNS,
        "assignment_sets_identical": bool(identical),
        "distinct_assignment_signatures": len(set(signatures)),
        "objective_values": objectives,
        "objective_value_range": obj_spread,
        "statuses": statuses,
        "population": {
            "materials": int(len(material_inputs)),
            "locations": int(len(location_inputs)),
        },
        "claim": (
            "Repeated OR-Tools solves on the identical v8 input reproduce the "
            "same assignment set and objective value."
        ),
        "claim_boundary": (
            "Determinism only. This is not a solution-quality comparison "
            "against any other method."
        ),
    }


# ==========================================================================
# Part B - GA stochasticity on its own per-parcel problem
# ==========================================================================
def part_b_ga_stochasticity() -> pd.DataFrame:
    try:
        import random

        import ga_components as gc  # type: ignore
        import main as ga_main  # type: ignore
        from warehouse_state import WarehouseState  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "DEAP and the slotting-service GA modules are required. "
            "`pip install deap`. This script never simulates a GA run."
        ) from exc

    materials = pd.read_csv(OUT / "physical_materials.csv").head(GA_PARCELS)

    rows = []
    for seed in GA_SEEDS:
        random.seed(seed)
        np.random.seed(seed)
        state = WarehouseState()
        for m in materials.itertuples(index=False):
            parcel = {
                "length": 100.0,
                "width": 80.0,
                "height": 90.0,
                "weight": float(m.pallet_weight_kg),
                "volume_cm3": float(m.pallet_volume_cm3),
                "product_volume": {"A": "high", "B": "medium", "C": "low"}[m.abc_class],
                "movement_speed": {"F": "fast", "M": "medium", "S": "slow"}[m.fms_class],
            }
            best = ga_main.run_ga(parcel, state=state, pop_size=50, generations=100)
            rows.append(
                {
                    "seed": seed,
                    "material_code": m.material_code,
                    "abc_class": m.abc_class,
                    "fms_class": m.fms_class,
                    "location_code": gc.decode(best),
                    "fitness": float(best.fitness.values[0]),
                }
            )
        print(f"  GA seed {seed}: {len(materials)} parcels placed")

    return pd.DataFrame(rows)


# ==========================================================================
def make_figure(milp: dict, ga: pd.DataFrame) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(1, 2, figsize=(12, 4.4))

    a = ax[0]
    objs = [o for o in milp["objective_values"] if o is not None]
    a.plot(range(1, len(objs) + 1), objs, marker="o", lw=2, color="tab:green")
    a.set_xticks(range(1, len(objs) + 1))
    a.set_xlabel("Repeated solve")
    a.set_ylabel("MILP objective value")
    a.set_title(
        "Production MILP on the v8 population:\n"
        f"{milp['distinct_assignment_signatures']} distinct assignment set(s) "
        f"over {milp['runs']} runs"
    )
    a.grid(alpha=0.3)

    b = ax[1]
    spread = ga.groupby("material_code").location_code.nunique()
    b.hist(spread, bins=range(1, len(GA_SEEDS) + 2), align="left",
           color="tab:purple", alpha=0.75, edgecolor="black")
    b.set_xticks(range(1, len(GA_SEEDS) + 1))
    b.set_xlabel(f"Distinct locations chosen across {len(GA_SEEDS)} seeds")
    b.set_ylabel("Materials")
    b.set_title("Advisory GA on its own per-parcel problem:\n"
                "seed-to-seed variation in chosen bin")
    b.grid(axis="y", alpha=0.3)

    fig.suptitle(
        "Solver behaviour: deterministic planner, stochastic advisor "
        "(separate problems, not a head-to-head benchmark)"
    )
    fig.tight_layout()
    fig.savefig(EVID / "solver_behaviour.png", dpi=150)
    plt.close(fig)


def main() -> None:
    print("Part A - MILP determinism on the real v8 population")
    milp = part_a_milp_determinism()
    (EVID / "milp_determinism.json").write_text(json.dumps(milp, indent=2))

    print("Part B - GA stochasticity on its own per-parcel problem")
    ga = part_b_ga_stochasticity()
    ga.to_csv(EVID / "ga_stochasticity.csv", index=False)

    make_figure(milp, ga)

    agree = ga.groupby("material_code").location_code.nunique()
    print("\n--- SUMMARY -------------------------------------------------")
    print(f"MILP assignment sets identical across {milp['runs']} runs: "
          f"{milp['assignment_sets_identical']}")
    print(f"MILP objective value range: {milp['objective_value_range']}")
    print(f"GA materials placed identically by all {len(GA_SEEDS)} seeds: "
          f"{int((agree == 1).sum())} of {len(agree)}")
    print(f"Artifacts written to: {EVID}")
    print("Send these three files back and they will be wired into Chapter 7.")


if __name__ == "__main__":
    main()
