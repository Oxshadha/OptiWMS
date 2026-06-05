from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Sequence

import pygad

from app.services.slotting import Location, SKU


@dataclass
class LocationScore:
    location: Location
    score: float


@dataclass
class RecommendationResult:
    sku: SKU
    recommended_location: Location
    score: float
    reason: str
    alternatives: List[LocationScore]


def _location_distance(location: Location) -> float:
    x = float(location.coordinate_x or 0.0)
    y = float(location.coordinate_y or 0.0)
    z = float(location.coordinate_z or 0.0)
    return math.sqrt(x * x + y * y + z * z)


def _score_pair(sku: SKU, location: Location) -> float:
    score = 1000.0
    distance = _location_distance(location)

    score -= distance * (1.0 + (float(sku.velocity or 0.0) / 100.0))

    if sku.weight > location.max_weight:
        score -= (sku.weight - location.max_weight) * 120.0

    if sku.volume > location.max_volume:
        score -= (sku.volume - location.max_volume) * 60.0

    if sku.hazard_class and sku.hazard_class != "none":
        if sku.hazard_class not in location.allowed_hazard_classes:
            score -= 600.0

    if location.zone == (sku.hazard_class or ""):
        score += 25.0

    if location.zone == "A" and (sku.velocity or 0.0) >= 100.0:
        score += 50.0
    elif location.zone == "D" and (sku.velocity or 0.0) < 50.0:
        score += 20.0

    return score


def _top_alternatives(sku: SKU, locations: Sequence[Location], limit: int) -> List[LocationScore]:
    ranked = sorted(
        (LocationScore(location=location, score=_score_pair(sku, location)) for location in locations),
        key=lambda item: item.score,
        reverse=True,
    )
    return ranked[:limit]


def recommend_slotting(
    skus: List[SKU],
    locations: List[Location],
    population_size: int = 20,
    generations: int = 50,
    mutation_rate: float = 0.05,
    top_k_alternatives: int = 3,
) -> tuple[float, List[RecommendationResult]]:
    if not skus or not locations:
        raise ValueError("Both SKUs and Locations must be provided for recommendation.")

    gene_space = [list(range(len(locations))) for _ in skus]

    def fitness_func(_ga_instance, solution, _solution_idx):
        total_score = 0.0
        location_load_weight = {index: 0.0 for index in range(len(locations))}
        location_load_volume = {index: 0.0 for index in range(len(locations))}

        for gene_index, location_index in enumerate(solution):
            sku = skus[gene_index]
            location = locations[int(location_index)]
            total_score += _score_pair(sku, location)
            location_load_weight[int(location_index)] += sku.weight
            location_load_volume[int(location_index)] += sku.volume

        for index, location in enumerate(locations):
            if location_load_weight[index] > location.max_weight:
                total_score -= (location_load_weight[index] - location.max_weight) * 220.0
            if location_load_volume[index] > location.max_volume:
                total_score -= (location_load_volume[index] - location.max_volume) * 150.0

        return total_score

    ga = pygad.GA(
        num_generations=generations,
        num_parents_mating=max(2, min(population_size // 2, len(skus))),
        fitness_func=fitness_func,
        sol_per_pop=max(4, population_size),
        num_genes=len(skus),
        gene_space=gene_space,
        mutation_type="random",
        mutation_probability=mutation_rate,
        crossover_type="single_point",
        parent_selection_type="tournament",
        keep_parents=1,
        suppress_warnings=True,
    )
    ga.run()

    best_solution, best_fitness, _ = ga.best_solution()

    recommendations: List[RecommendationResult] = []
    for index, gene in enumerate(best_solution):
        sku = skus[index]
        recommended_location = locations[int(gene)]
        alternatives = _top_alternatives(sku, locations, top_k_alternatives)

        reason_parts = [
            f"zone {recommended_location.zone}",
            f"distance {_location_distance(recommended_location):.1f}",
        ]
        if sku.velocity is not None:
            reason_parts.append(f"velocity {sku.velocity:.1f}")
        if sku.weight > recommended_location.max_weight:
            reason_parts.append("weight exceeds capacity")
        if sku.volume > recommended_location.max_volume:
            reason_parts.append("volume exceeds capacity")

        recommendations.append(
            RecommendationResult(
                sku=sku,
                recommended_location=recommended_location,
                score=_score_pair(sku, recommended_location),
                reason=", ".join(reason_parts),
                alternatives=alternatives,
            )
        )

    return best_fitness, recommendations