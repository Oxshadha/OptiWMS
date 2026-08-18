"""Head-to-head MILP vs GA on one identical slotting formulation.

The existing determinism script deliberately avoided this comparison, because the
project's GA (`slotting-service/app/api`) places one parcel at a time into its own
location encoding (`A-01-01-1-A`, two-digit slot) while the MILP assigns all
materials simultaneously over the v8 pool (`A-01-001-1-A`, three-digit bay). Those
are different feasible sets, so scoring one against the other would compare
problems rather than methods.

This module removes that objection by running **both** search strategies over the
same decision variables, the same candidate sets and the same objective. The GA
here is therefore not the shipped per-parcel GA; it is a standard generational GA
written against the MILP's own formulation, so any difference in result is
attributable to the search strategy rather than to the problem.

Fairness protocol:

* identical candidate sets per material (the MILP's own `_milp_candidate_locations`)
* identical objective, evaluated by one shared function for both solvers
* identical constraint set (one material per pick face, relocation cap)
* the GA receives a wall-clock budget of at least the MILP's own solve time, so it
  is never beaten merely by being given less compute
* the GA is run over many seeds, since it is stochastic; the MILP is run repeatedly
  to demonstrate that it is not

Comparisons are paired by instance and tested with Wilcoxon signed-rank, which
assumes neither normality nor equal variances -- appropriate for a small number of
instances and a skewed cost distribution.
"""
from __future__ import annotations

import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[4]
SLOTTING = REPO / "ai_services" / "slotting-service"
if str(SLOTTING) not in sys.path:
    sys.path.insert(0, str(SLOTTING))


# ---------------------------------------------------------------------------
# The shared objective. Both solvers are scored by this and nothing else.
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Instance:
    """One slotting problem: materials, their candidate bins, and the cost table."""
    material_ids: tuple[str, ...]
    candidates: dict[str, tuple[str, ...]]
    cost: dict[tuple[str, str], float]
    incumbent: dict[str, str]
    relocation_cap: int

    @property
    def size(self) -> int:
        return len(self.material_ids)


def evaluate(instance: Instance, assignment: dict[str, str]) -> tuple[float, bool]:
    """Total objective cost, and whether the assignment is feasible.

    Feasibility is exactly the MILP's constraint set: every material placed, on a
    bin from its own candidate list, no two materials sharing a pick face, and the
    number of relocations within the cap.
    """
    if set(assignment) != set(instance.material_ids):
        return float("inf"), False
    used: set[str] = set()
    relocations = 0
    total = 0.0
    for material, location in assignment.items():
        if location not in instance.candidates[material]:
            return float("inf"), False
        if location in used:
            return float("inf"), False
        used.add(location)
        total += instance.cost[(material, location)]
        if instance.incumbent.get(material) and instance.incumbent[material] != location:
            relocations += 1
    if relocations > instance.relocation_cap:
        return float("inf"), False
    return total, True


# ---------------------------------------------------------------------------
# Exact method
# ---------------------------------------------------------------------------
def solve_milp(instance: Instance, time_limit_s: float = 60.0) -> dict[str, Any]:
    """Solve to proven optimality where possible, and report the certificate.

    The status is the point of this method: OPTIMAL is a proof that no better
    feasible assignment exists, which no metaheuristic can supply.
    """
    from ortools.linear_solver import pywraplp

    solver = pywraplp.Solver.CreateSolver("CBC")
    solver.SetTimeLimit(int(time_limit_s * 1000))
    x = {
        (m, loc): solver.BoolVar(f"x_{m}_{loc}")
        for m in instance.material_ids
        for loc in instance.candidates[m]
    }
    for m in instance.material_ids:
        solver.Add(sum(x[(m, loc)] for loc in instance.candidates[m]) == 1)

    by_location: dict[str, list] = {}
    for (m, loc), var in x.items():
        by_location.setdefault(loc, []).append(var)
    for loc, variables in by_location.items():
        if len(variables) > 1:
            solver.Add(sum(variables) <= 1)

    moves = [
        x[(m, loc)]
        for m in instance.material_ids
        for loc in instance.candidates[m]
        if instance.incumbent.get(m) and instance.incumbent[m] != loc
    ]
    if moves:
        solver.Add(sum(moves) <= instance.relocation_cap)

    solver.Minimize(sum(instance.cost[k] * v for k, v in x.items()))

    started = time.perf_counter()
    status = solver.Solve()
    elapsed = time.perf_counter() - started

    names = {
        pywraplp.Solver.OPTIMAL: "OPTIMAL",
        pywraplp.Solver.FEASIBLE: "FEASIBLE",
        pywraplp.Solver.INFEASIBLE: "INFEASIBLE",
        pywraplp.Solver.NOT_SOLVED: "NOT_SOLVED",
    }
    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        return {"status": names.get(status, str(status)), "cost": None, "seconds": elapsed}

    assignment = {
        m: loc
        for m in instance.material_ids
        for loc in instance.candidates[m]
        if x[(m, loc)].solution_value() > 0.5
    }
    cost, feasible = evaluate(instance, assignment)
    return {
        "status": names.get(status, str(status)),
        "cost": cost,
        "feasible": feasible,
        "seconds": elapsed,
        "assignment": assignment,
        # A proof of optimality, not an observation about a sample of runs.
        "proven_optimal": status == pywraplp.Solver.OPTIMAL,
    }


# ---------------------------------------------------------------------------
# Metaheuristic, on the identical formulation
# ---------------------------------------------------------------------------
def solve_ga(
    instance: Instance,
    seed: int,
    time_budget_s: float,
    population_size: int = 80,
    elite: int = 4,
    mutation_rate: float = 0.15,
    tournament: int = 3,
    trace: bool = False,
) -> dict[str, Any]:
    """Generational GA with tournament selection, uniform crossover and elitism.

    A genome is one candidate index per material, so every genome decodes to a
    complete assignment. Pick-face collisions are repaired rather than penalised,
    which keeps the whole population feasible and gives the GA the best chance --
    a penalty-only formulation would waste most of its budget on invalid solutions.
    """
    rng = random.Random(seed)
    materials = instance.material_ids
    options = [instance.candidates[m] for m in materials]

    def repair(genome: list[int]) -> dict[str, str]:
        """Resolve double-booked pick faces by moving the costlier claimant."""
        assignment: dict[str, str] = {}
        taken: dict[str, str] = {}
        order = sorted(
            range(len(materials)),
            key=lambda i: instance.cost[(materials[i], options[i][genome[i]])],
        )
        for i in order:
            material = materials[i]
            choice = options[i][genome[i]]
            if choice in taken:
                alternatives = [c for c in options[i] if c not in taken]
                if not alternatives:
                    assignment[material] = choice  # infeasible; evaluate() will reject
                    continue
                choice = min(alternatives, key=lambda c: instance.cost[(material, c)])
            taken[choice] = material
            assignment[material] = choice
        return assignment

    def fitness(genome: list[int]) -> float:
        cost, feasible = evaluate(instance, repair(genome))
        return cost if feasible else float("inf")

    population = [
        [rng.randrange(len(opt)) for opt in options] for _ in range(population_size)
    ]
    scores = [fitness(g) for g in population]
    generations = 0
    history: list[float] = []
    started = time.perf_counter()

    while time.perf_counter() - started < time_budget_s:
        generations += 1
        ranked = sorted(range(len(population)), key=lambda i: scores[i])
        next_pop = [population[i][:] for i in ranked[:elite]]

        def pick() -> list[int]:
            contenders = rng.sample(range(len(population)), tournament)
            return population[min(contenders, key=lambda i: scores[i])]

        while len(next_pop) < population_size:
            a, b = pick(), pick()
            child = [a[i] if rng.random() < 0.5 else b[i] for i in range(len(materials))]
            for i in range(len(materials)):
                if rng.random() < mutation_rate:
                    child[i] = rng.randrange(len(options[i]))
            next_pop.append(child)

        population = next_pop
        scores = [fitness(g) for g in population]
        if trace:
            history.append(min(scores))

    best = min(range(len(population)), key=lambda i: scores[i])
    cost, feasible = evaluate(instance, repair(population[best]))
    return {
        "seed": seed,
        "cost": cost if feasible else None,
        "feasible": feasible,
        "generations": generations,
        "seconds": time.perf_counter() - started,
        # Best-so-far per generation, for showing where the search plateaus.
        "history": history,
        # No metaheuristic can certify this; that asymmetry is the finding.
        "proven_optimal": False,
    }


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------
def cliffs_delta(a: Sequence[float], b: Sequence[float]) -> tuple[float, str]:
    """Non-parametric effect size: P(a>b) - P(a<b). Thresholds are Romano et al."""
    greater = sum(x > y for x in a for y in b)
    lesser = sum(x < y for x in a for y in b)
    delta = (greater - lesser) / (len(a) * len(b))
    magnitude = abs(delta)
    label = (
        "negligible" if magnitude < 0.147
        else "small" if magnitude < 0.33
        else "medium" if magnitude < 0.474
        else "large"
    )
    return delta, label


def bootstrap_ci(
    values: Sequence[float],
    statistic: Callable[[Sequence[float]], float] = np.mean,
    resamples: int = 10_000,
    confidence: float = 0.95,
    seed: int = 12345,
) -> tuple[float, float]:
    """Percentile bootstrap CI -- no distributional assumption on the gaps."""
    rng = np.random.default_rng(seed)
    data = np.asarray(values, dtype=float)
    draws = [
        statistic(rng.choice(data, size=len(data), replace=True))
        for _ in range(resamples)
    ]
    alpha = (1 - confidence) / 2
    return float(np.quantile(draws, alpha)), float(np.quantile(draws, 1 - alpha))


# ---------------------------------------------------------------------------
# Building instances from the real v8 population
# ---------------------------------------------------------------------------
def build_instances(
    outputs: Path,
    n_instances: int = 12,
    materials_per_instance: int = 25,
    seed: int = 2026,
    candidates_per_material: int = 36,
) -> list[Instance]:
    """Carve independent slotting problems out of the real v8 warehouse.

    Candidate sets and costs come from the shipped solver's own helpers, so the
    formulation under test is the one the system actually runs, not a restatement
    of it. Instances are disjoint material samples, which is what lets the
    comparison be paired and tested per instance.
    """
    from app.services.plan_optimizer import (  # type: ignore
        PlanLocationInput,
        PlanMaterialInput,
        _dispatch_anchor,
        _distance,
        _is_pick_face,
        _max_stock_pp,
        _milp_candidate_locations,
    )

    materials_df = pd.read_csv(outputs / "physical_materials.csv")
    layout_df = pd.read_csv(outputs / "physical_layout.csv.gz")
    assign_df = pd.read_csv(outputs / "location_assignments.csv.gz")
    incumbent_all = (
        assign_df.loc[assign_df.priority.eq(1)]
        .set_index("material_code").location_code.to_dict()
    )

    locations = [
        PlanLocationInput(
            location_id=str(r.location_id),
            location_code=str(r.location_code),
            max_pallet_capacity=int(r.capacity) if pd.notna(r.capacity) else 1,
            accessibility_rating=int(r.accessibility_rating) if pd.notna(r.accessibility_rating) else 3,
            level_number=int(r.level_number) if pd.notna(r.level_number) else 1,
            coordinate_x=float(r.coordinate_x) if pd.notna(r.coordinate_x) else 0.0,
            coordinate_y=float(r.coordinate_y) if pd.notna(r.coordinate_y) else 0.0,
            zone_type=str(r.zone_type) if pd.notna(r.zone_type) else None,
            location_type=str(r.location_type) if pd.notna(r.location_type) else None,
        )
        for r in layout_df.itertuples(index=False)
    ]
    anchor = _dispatch_anchor(locations)
    pick_faces = [loc for loc in locations if _is_pick_face(loc)]

    pool = list(materials_df.itertuples(index=False))

    instances: list[Instance] = []
    for k in range(n_instances):
        # Independent random subsets rather than a partition, so instance count is
        # not capped by population size and larger sizes stay reachable.
        rng = random.Random(seed + k)
        chunk = rng.sample(pool, min(materials_per_instance, len(pool)))

        candidates: dict[str, tuple[str, ...]] = {}
        cost: dict[tuple[str, str], float] = {}
        incumbent: dict[str, str] = {}
        ids: list[str] = []

        max_issue = max(1, max(int(getattr(m, "issue_count", 0) or 0) for m in chunk))
        max_positions = max(1, max(int(getattr(m, "required_pallets", 1) or 1) for m in chunk))

        for m in chunk:
            material = PlanMaterialInput(
                material_id=str(m.material_code),
                material_code=str(m.material_code),
                material_type=str(getattr(m, "material_type", "raw_material")),
                abc_class=str(getattr(m, "abc_class", "C")),
                fms_class=str(getattr(m, "fms_class", "S")),
                amalgamated_class=str(getattr(m, "amalgamated_class", "CS")),
                required_pallets=int(getattr(m, "required_pallets", 1) or 1),
                pallet_weight_kg=float(getattr(m, "pallet_weight_kg", 0) or 0),
                pallet_volume_cm3=float(getattr(m, "pallet_volume_cm3", 0) or 0),
                issue_count=int(getattr(m, "issue_count", 0) or 0),
                incumbent_primary_location_code=incumbent_all.get(str(m.material_code)),
            )
            options = [
                loc for loc in _milp_candidate_locations(material, pick_faces, anchor)
                if _is_pick_face(loc)
            ][:candidates_per_material]
            if len(options) < 2:
                continue

            ids.append(material.material_id)
            candidates[material.material_id] = tuple(loc.location_code for loc in options)
            if material.incumbent_primary_location_code:
                incumbent[material.material_id] = material.incumbent_primary_location_code

            # Exactly the live solver's primary-assignment cost terms.
            critical = 3.0 if material.amalgamated_class in {"AF", "AM", "BF"} else (
                2.0 if material.abc_class == "A" else 1.0)
            frequency_weight = max(0, material.issue_count) / max_issue
            demand_weight = frequency_weight
            space_weight = _max_stock_pp(material) / max_positions
            flow_weight = 1.0 + 2.5 * frequency_weight + 1.5 * demand_weight
            for loc in options:
                travel = _distance(loc, anchor) * critical * flow_weight
                access = abs(max(1, min(5, loc.accessibility_rating))
                             - (5 if material.fms_class == "F" else 3)) * critical
                vertical = max(0, loc.level_number - 1) * (
                    8.0 * frequency_weight + 5.0 * demand_weight + 4.0 * space_weight)
                moving = bool(material.incumbent_primary_location_code
                              and material.incumbent_primary_location_code != loc.location_code)
                cost[(material.material_id, loc.location_code)] = (
                    travel + access + vertical + (25.0 if moving else 0.0))

        if len(ids) >= 5:
            instances.append(Instance(
                material_ids=tuple(ids),
                candidates=candidates,
                cost=cost,
                incumbent=incumbent,
                relocation_cap=len(ids),   # unconstrained; isolates search quality
            ))
    return instances


def matched_pairs_rank_biserial(
    treatment: Sequence[float], control: Sequence[float]
) -> tuple[float, str]:
    """Effect size for the Wilcoxon signed-rank test, on the paired differences.

    Cliff's delta is a two-independent-sample statistic. Applying it to raw paired
    costs here would pool instances of different sizes, so it would measure how
    much instance size varies rather than how the two methods differ -- on this
    data that understates a decisive result as "negligible".

    r = (W+ - W-) / (W+ + W-), i.e. the signed proportion of ranked differences
    favouring the treatment. +1 means every pair moved the same way.
    """
    differences = [t - c for t, c in zip(treatment, control) if t != c]
    if not differences:
        return 0.0, "none"
    ranks = pd.Series([abs(d) for d in differences]).rank().tolist()
    positive = sum(r for r, d in zip(ranks, differences) if d > 0)
    negative = sum(r for r, d in zip(ranks, differences) if d < 0)
    r = (positive - negative) / (positive + negative)
    magnitude = abs(r)
    label = (
        "negligible" if magnitude < 0.1
        else "small" if magnitude < 0.3
        else "medium" if magnitude < 0.5
        else "large"
    )
    return r, label
