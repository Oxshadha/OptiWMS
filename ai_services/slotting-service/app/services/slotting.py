import random
from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class Location:
    """
    Represents a physical storage location in the warehouse master data.
    Contains capacity constraints and compatibility rules.
    """
    id: str
    zone: str
    aisle: str
    rack: str
    bin: str
    max_weight: float
    max_volume: float
    allowed_hazard_classes: List[str]
    distance_to_dispatch: float = 0.0  # Used to optimize travel distance


@dataclass
class SKU:
    """
    Represents a distinct item (Stock Keeping Unit) to be slotted.
    Contains physical dimensions, business rules, and movement frequencies.
    """
    id: str
    weight: float
    volume: float
    hazard_class: Optional[str]
    stackability_score: int
    velocity: float  # e.g., Historical pick/putaway frequency


@dataclass
class Gene:
    """
    A Gene represents a single assignment decision.
    In this context, it maps a specific SKU to a specific Location.
    It can also include the quantity or percentage of the SKU's inventory allocated to this location.
    """
    sku_id: str
    location_id: str
    quantity: Optional[float] = None  # Use if SKUs can be split across multiple locations


@dataclass
class Chromosome:
    """
    A Chromosome represents a complete potential slotting solution.
    It contains a collection of Genes that collectively define where every SKU is stored.
    """
    genes: List[Gene] = field(default_factory=list)
    fitness: float = 0.0

    def get_sku_assignments(self) -> Dict[str, List[str]]:
        """
        Helper method to get a mapping of SKU IDs to their assigned Location IDs.
        Useful for constraint checking and fitness evaluation.
        """
        mapping = {}
        for gene in self.genes:
            if gene.sku_id not in mapping:
                mapping[gene.sku_id] = []
            mapping[gene.sku_id].append(gene.location_id)
        return mapping

    def get_location_assignments(self) -> Dict[str, List[str]]:
        """
        Helper method to get a mapping of Location IDs to the SKU IDs assigned to them.
        """
        mapping = {}
        for gene in self.genes:
            if gene.location_id not in mapping:
                mapping[gene.location_id] = []
            mapping[gene.location_id].append(gene.sku_id)
        return mapping


class Population:
    """
    A Population manages a group of Chromosomes (candidate solutions) for a given generation.
    It provides methods for tracking and selecting the best solutions.
    """
    def __init__(self, size: int):
        self.size = size
        self.individuals: List[Chromosome] = []

    def add_individual(self, chromosome: Chromosome):
        self.individuals.append(chromosome)

    def get_fittest(self) -> Optional[Chromosome]:
        """
        Returns the chromosome with the highest fitness score.
        (Assuming a maximization problem where higher fitness is better)
        """
        if not self.individuals:
            return None
        return max(self.individuals, key=lambda ind: ind.fitness)

    def get_average_fitness(self) -> float:
        """
        Calculates the average fitness of the current population.
        """
        if not self.individuals:
            return 0.0
        total_fitness = sum(ind.fitness for ind in self.individuals)
        return total_fitness / len(self.individuals)


def generate_random_chromosome(skus: List[SKU], locations: List[Location]) -> Chromosome:
    """
    Generates a single random solution (Chromosome).
    For each SKU, a random location is selected. 
    This creates a purely random initial assignment. Advanced implementations 
    could incorporate constraints or heuristics here (e.g., checking capacities).
    """
    chromosome = Chromosome()
    for sku in skus:
        # Pick a random location from the available pool
        random_location = random.choice(locations)
        gene = Gene(sku_id=sku.id, location_id=random_location.id)
        chromosome.genes.append(gene)
    return chromosome


def generate_initial_population(
    pop_size: int, 
    skus: List[SKU], 
    locations: List[Location]
) -> Population:
    """
    Generates the initial population of solutions for the genetic algorithm.
    """
    population = Population(size=pop_size)
    for _ in range(pop_size):
        chromosome = generate_random_chromosome(skus, locations)
        population.add_individual(chromosome)
    return population


def evaluate_fitness(
    chromosome: Chromosome, 
    sku_map: Dict[str, SKU], 
    location_map: Dict[str, Location]
) -> float:
    """
    Evaluates the fitness of a single chromosome (slotting solution).
    A higher score is better. Penalties are subtracted for constraint violations.
    
    Objectives evaluated:
    1. Minimize travel distance: (SKU velocity * Location distance_to_dispatch)
    2. Capacity constraints: Penalize if a location exceeds max weight or volume.
    3. Compatibility rules: Penalize temperature or hazard class mismatches.
    """
    base_score = 10000.0  # Starting score
    total_travel_distance = 0.0
    penalty = 0.0
    
    # Track accumulated weight and volume per location
    location_current_weight = {loc_id: 0.0 for loc_id in location_map}
    location_current_volume = {loc_id: 0.0 for loc_id in location_map}

    for gene in chromosome.genes:
        sku = sku_map.get(gene.sku_id)
        loc = location_map.get(gene.location_id)
        
        if not sku or not loc:
            continue

        qty = gene.quantity if gene.quantity is not None else 1.0
        
        # Accumulate dimensions for capacity checks
        location_current_weight[loc.id] += sku.weight * qty
        location_current_volume[loc.id] += sku.volume * qty
        
        # 1. Travel Distance (Minimize travel for high-velocity items)
        total_travel_distance += sku.velocity * loc.distance_to_dispatch
        
        # 2. Compatibility Rules
        if sku.hazard_class and sku.hazard_class not in loc.allowed_hazard_classes:
            penalty += 500.0  # Heavy penalty for safety/hazard mismatch

    # 3. Capacity Constraints Checks
    for loc_id in location_map:
        loc = location_map[loc_id]
        
        # Weight penalty
        if location_current_weight[loc_id] > loc.max_weight:
            overage = location_current_weight[loc_id] - loc.max_weight
            penalty += overage * 10.0  # Scale penalty by how much it's overweight
            
        # Volume penalty
        if location_current_volume[loc_id] > loc.max_volume:
            overage = location_current_volume[loc_id] - loc.max_volume
            penalty += overage * 10.0  # Scale penalty by how much it's over volume

    # Calculate final fitness. We subtract the distance and penalties from the base score.
    final_fitness = base_score - total_travel_distance - penalty
    
    # Update the chromosome's fitness
    chromosome.fitness = final_fitness
    return final_fitness


def select_parent_tournament(population: Population, tournament_size: int = 3) -> Chromosome:
    """
    Selects a parent chromosome from the population using Tournament Selection.
    A small random subset of chromosomes is chosen, and the one with the highest
    fitness wins. This method helps maintain diversity and avoids early convergence.
    """
    if not population.individuals:
        raise ValueError("Cannot select from an empty population.")
        
    # Pick random candidates for the tournament
    tournament_candidates = random.sample(
        population.individuals, 
        min(tournament_size, len(population.individuals))
    )
    
    # Return the candidate with the best fitness
    best_candidate = max(tournament_candidates, key=lambda ind: ind.fitness)
    return best_candidate


def select_parent_roulette(population: Population) -> Chromosome:
    """
    Selects a parent using Roulette Wheel (Fitness Proportionate) Selection.
    Solutions with higher fitness have a proportionally higher chance of being picked.
    """
    if not population.individuals:
        raise ValueError("Cannot select from an empty population.")
        
    total_fitness = sum(ind.fitness for ind in population.individuals)
    
    if total_fitness <= 0:
        # If all solutions are equally bad (or 0), pick randomly
        return random.choice(population.individuals)
        
    pick = random.uniform(0, total_fitness)
    current = 0.0
    for ind in population.individuals:
        current += ind.fitness
        if current > pick:
            return ind
            
    return population.individuals[-1]  # Safety fallback


def crossover_single_point(parent1: Chromosome, parent2: Chromosome) -> Chromosome:
    """
    Performs Single-Point Crossover between two parent chromosomes to produce an offspring.
    Assumes the genes in both parents are aligned (same SKUs in the same order).
    """
    if len(parent1.genes) != len(parent2.genes):
        raise ValueError("Parents must have the same number of genes for crossover.")
        
    if len(parent1.genes) <= 1:
        # Cannot perform meaningful crossover on a single gene
        return Chromosome(genes=[Gene(sku_id=g.sku_id, location_id=g.location_id, quantity=g.quantity) for g in parent1.genes])

    crossover_point = random.randint(1, len(parent1.genes) - 1)
    offspring_genes = []
    
    # Inherit first part from Parent 1
    for i in range(crossover_point):
        gene = parent1.genes[i]
        offspring_genes.append(Gene(sku_id=gene.sku_id, location_id=gene.location_id, quantity=gene.quantity))
        
    # Inherit second part from Parent 2
    for i in range(crossover_point, len(parent2.genes)):
        gene = parent2.genes[i]
        offspring_genes.append(Gene(sku_id=gene.sku_id, location_id=gene.location_id, quantity=gene.quantity))
        
    return Chromosome(genes=offspring_genes)


def crossover_uniform(parent1: Chromosome, parent2: Chromosome) -> Chromosome:
    """
    Performs Uniform Crossover between two parent chromosomes.
    For each gene position, it randomly selects the gene from either parent1 or parent2.
    """
    if len(parent1.genes) != len(parent2.genes):
        raise ValueError("Parents must have the same number of genes for crossover.")
        
    offspring_genes = []
    
    for i in range(len(parent1.genes)):
        # 50% chance to inherit from either parent
        chosen_parent = parent1 if random.random() < 0.5 else parent2
        gene = chosen_parent.genes[i]
        offspring_genes.append(Gene(sku_id=gene.sku_id, location_id=gene.location_id, quantity=gene.quantity))
        
    return Chromosome(genes=offspring_genes)


def mutate_random_assignment(chromosome: Chromosome, available_locations: List[Location], mutation_rate: float = 0.01):
    """
    Mutates a chromosome by randomly changing the assigned location of some genes.
    The mutation_rate (e.g., 0.01 for 1%) determines the probability of each gene being mutated.
    This introduces entirely new genetic material into the population.
    """
    for gene in chromosome.genes:
        if random.random() < mutation_rate:
            # Pick a completely new location at random
            new_location = random.choice(available_locations)
            gene.location_id = new_location.id


def mutate_swap(chromosome: Chromosome, mutation_rate: float = 0.01):
    """
    Mutates a chromosome by swapping the locations of two genes.
    This is often useful for tightly constrained spaces where randomly assigning
    a new location might frequently violate capacities, but swapping two items
    might yield a valid, slightly different solution.
    """
    if len(chromosome.genes) < 2:
        return
        
    for i in range(len(chromosome.genes)):
        if random.random() < mutation_rate:
            # Pick another random gene to swap with
            j = random.randint(0, len(chromosome.genes) - 1)
            
            # Swap their location assignments
            temp_loc = chromosome.genes[i].location_id
            chromosome.genes[i].location_id = chromosome.genes[j].location_id
            chromosome.genes[j].location_id = temp_loc


def run_slotting_optimization(
    skus: List[SKU], 
    locations: List[Location], 
    population_size: int = 20, 
    generations: int = 50,
    mutation_rate: float = 0.05
) -> Chromosome:
    """
    Executes the Genetic Algorithm for warehouse slotting optimization.
    Returns the best Chromosome (slotting assignment) found.
    """
    if not skus or not locations:
        raise ValueError("Both SKUs and Locations must be provided to run the optimization.")

    location_map = {loc.id: loc for loc in locations}
    sku_map = {sku.id: sku for sku in skus}

    population = generate_initial_population(pop_size=population_size, skus=skus, locations=locations)

    for gen in range(generations):
        # 1. Evaluate Fitness
        for ind in population.individuals:
            evaluate_fitness(ind, sku_map, location_map)

        # 2. Create next generation
        new_population = Population(size=population_size)
        
        # Elitism
        best_ind = population.get_fittest()
        new_population.add_individual(best_ind)
        
        while len(new_population.individuals) < population_size:
            # Selection
            parent1 = select_parent_tournament(population)
            parent2 = select_parent_tournament(population)
            
            # Crossover
            offspring = crossover_single_point(parent1, parent2)
            
            # Mutation
            mutate_random_assignment(offspring, locations, mutation_rate=mutation_rate)
            
            new_population.add_individual(offspring)
            
        population = new_population

    # Evaluate final generation
    for ind in population.individuals:
        evaluate_fitness(ind, sku_map, location_map)
        
    return population.get_fittest()


if __name__ == "__main__":
    sample_locations = [
        # Zone A - Fast Moving 
        Location(id="LOC-A1", zone="A", aisle="1", rack="1", bin="1", max_weight=400.0, max_volume=100.0, allowed_hazard_classes=["none"], distance_to_dispatch=5.0),
        Location(id="LOC-A2", zone="A", aisle="1", rack="2", bin="1", max_weight=500.0, max_volume=100.0, allowed_hazard_classes=["none"], distance_to_dispatch=10.0),
        Location(id="LOC-A3", zone="A", aisle="1", rack="3", bin="1", max_weight=500.0, max_volume=100.0, allowed_hazard_classes=["none"], distance_to_dispatch=15.0),
        Location(id="LOC-A4", zone="A", aisle="2", rack="1", bin="1", max_weight=400.0, max_volume=120.0, allowed_hazard_classes=["none"], distance_to_dispatch=10.0),
        Location(id="LOC-A5", zone="A", aisle="2", rack="2", bin="1", max_weight=600.0, max_volume=150.0, allowed_hazard_classes=["none"], distance_to_dispatch=15.0),
        
        # Zone B - Heavy/Bulk items 
        Location(id="LOC-B1", zone="B", aisle="3", rack="1", bin="1", max_weight=2000.0, max_volume=300.0, allowed_hazard_classes=["none"], distance_to_dispatch=30.0),
        Location(id="LOC-B2", zone="B", aisle="3", rack="2", bin="1", max_weight=2000.0, max_volume=300.0, allowed_hazard_classes=["none"], distance_to_dispatch=35.0),
        Location(id="LOC-B3", zone="B", aisle="4", rack="1", bin="1", max_weight=1500.0, max_volume=250.0, allowed_hazard_classes=["none"], distance_to_dispatch=40.0),
        Location(id="LOC-B4", zone="B", aisle="4", rack="2", bin="1", max_weight=1500.0, max_volume=250.0, allowed_hazard_classes=["none"], distance_to_dispatch=45.0),
        Location(id="LOC-B5", zone="B", aisle="4", rack="3", bin="1", max_weight=2500.0, max_volume=400.0, allowed_hazard_classes=["none"], distance_to_dispatch=50.0),
        Location(id="LOC-B6", zone="B", aisle="4", rack="4", bin="1", max_weight=2500.0, max_volume=400.0, allowed_hazard_classes=["none"], distance_to_dispatch=55.0),
        
        # Zone C - Hazardous Materials 
        Location(id="LOC-C1", zone="C", aisle="5", rack="1", bin="1", max_weight=300.0, max_volume=50.0, allowed_hazard_classes=["flammable", "toxic"], distance_to_dispatch=60.0),
        Location(id="LOC-C2", zone="C", aisle="5", rack="2", bin="1", max_weight=300.0, max_volume=50.0, allowed_hazard_classes=["flammable", "toxic", "corrosive"], distance_to_dispatch=65.0),
        Location(id="LOC-C3", zone="C", aisle="5", rack="3", bin="1", max_weight=500.0, max_volume=80.0, allowed_hazard_classes=["oxidizer", "corrosive"], distance_to_dispatch=70.0),
        Location(id="LOC-C4", zone="C", aisle="5", rack="4", bin="1", max_weight=400.0, max_volume=70.0, allowed_hazard_classes=["flammable", "explosive"], distance_to_dispatch=75.0),
        Location(id="LOC-C5", zone="C", aisle="5", rack="5", bin="1", max_weight=1000.0, max_volume=150.0, allowed_hazard_classes=["flammable", "toxic", "corrosive", "oxidizer"], distance_to_dispatch=80.0),
        
        # Zone D - Overflow / Slow Moving 
        Location(id="LOC-D1", zone="D", aisle="6", rack="1", bin="1", max_weight=800.0, max_volume=200.0, allowed_hazard_classes=["none"], distance_to_dispatch=80.0),
        Location(id="LOC-D2", zone="D", aisle="6", rack="2", bin="1", max_weight=800.0, max_volume=200.0, allowed_hazard_classes=["none"], distance_to_dispatch=85.0),
        Location(id="LOC-D3", zone="D", aisle="6", rack="3", bin="1", max_weight=1000.0, max_volume=250.0, allowed_hazard_classes=["none"], distance_to_dispatch=90.0),
        Location(id="LOC-D4", zone="D", aisle="7", rack="1", bin="1", max_weight=600.0, max_volume=150.0, allowed_hazard_classes=["none"], distance_to_dispatch=95.0),
        Location(id="LOC-D5", zone="D", aisle="7", rack="2", bin="1", max_weight=600.0, max_volume=150.0, allowed_hazard_classes=["none"], distance_to_dispatch=100.0),
    ]

    sample_skus = [
        # High Velocity / Small 
        SKU(id="SKU-FAST-01", weight=2.0, volume=1.0, hazard_class="none", stackability_score=10, velocity=300.0),
        SKU(id="SKU-FAST-02", weight=5.0, volume=2.0, hazard_class="none", stackability_score=8, velocity=250.0),
        SKU(id="SKU-FAST-03", weight=3.0, volume=1.5, hazard_class="none", stackability_score=9, velocity=280.0),
        SKU(id="SKU-FAST-04", weight=10.0, volume=4.0, hazard_class="none", stackability_score=5, velocity=150.0),
        
        # Medium Velocity / Standard
        SKU(id="SKU-MED-01", weight=20.0, volume=15.0, hazard_class="none", stackability_score=4, velocity=50.0),
        SKU(id="SKU-MED-02", weight=25.0, volume=18.0, hazard_class="none", stackability_score=4, velocity=45.0),
        SKU(id="SKU-MED-03", weight=15.0, volume=10.0, hazard_class="none", stackability_score=5, velocity=60.0),
        
        # Low Velocity / Heavy Bulk 
        SKU(id="SKU-HEAVY-01", weight=1000.0, volume=150.0, hazard_class="none", stackability_score=1, velocity=5.0),
        SKU(id="SKU-HEAVY-02", weight=800.0, volume=100.0, hazard_class="none", stackability_score=1, velocity=10.0),
        SKU(id="SKU-HEAVY-03", weight=1200.0, volume=200.0, hazard_class="none", stackability_score=1, velocity=2.0),
        SKU(id="SKU-HEAVY-04", weight=1500.0, volume=250.0, hazard_class="none", stackability_score=1, velocity=1.0),
        SKU(id="SKU-HEAVY-05", weight=2000.0, volume=350.0, hazard_class="none", stackability_score=1, velocity=3.0),
        SKU(id="SKU-HEAVY-06", weight=1800.0, volume=300.0, hazard_class="none", stackability_score=1, velocity=4.0),
        
        # Hazardous Materials 
        SKU(id="SKU-HAZ-FLAM", weight=15.0, volume=10.0, hazard_class="flammable", stackability_score=3, velocity=15.0),
        SKU(id="SKU-HAZ-TOX", weight=10.0, volume=8.0, hazard_class="toxic", stackability_score=2, velocity=5.0),
        SKU(id="SKU-HAZ-CORR", weight=25.0, volume=12.0, hazard_class="corrosive", stackability_score=2, velocity=8.0),
        SKU(id="SKU-HAZ-OXI", weight=50.0, volume=20.0, hazard_class="oxidizer", stackability_score=1, velocity=2.0),
        SKU(id="SKU-HAZ-EXP", weight=100.0, volume=30.0, hazard_class="explosive", stackability_score=1, velocity=1.0),
        
        # Slow Moving / Overflow 
        SKU(id="SKU-SLOW-01", weight=30.0, volume=20.0, hazard_class="none", stackability_score=3, velocity=1.0),
        SKU(id="SKU-SLOW-02", weight=40.0, volume=25.0, hazard_class="none", stackability_score=3, velocity=0.5),
        SKU(id="SKU-SLOW-03", weight=10.0, volume=10.0, hazard_class="none", stackability_score=5, velocity=0.2),
        SKU(id="SKU-SLOW-04", weight=50.0, volume=30.0, hazard_class="none", stackability_score=2, velocity=0.8),
        SKU(id="SKU-SLOW-05", weight=100.0, volume=60.0, hazard_class="none", stackability_score=2, velocity=1.5),
    ]

    # Maps needed for fitness evaluation
    location_map = {loc.id: loc for loc in sample_locations}
    sku_map = {sku.id: sku for sku in sample_skus}

    # --- Run a simple GA loop ---
    print("Initializing Population...")
    population_size = 20
    generations = 50
    
    population = generate_initial_population(pop_size=population_size, skus=sample_skus, locations=sample_locations)

    for gen in range(generations):
        # 1. Evaluate Fitness
        for ind in population.individuals:
            evaluate_fitness(ind, sku_map, location_map)
            
        # Optional: Print best fitness every 10 generations
        if gen % 10 == 0:
            best_ind = population.get_fittest()
            print(f"Generation {gen} | Best Fitness: {best_ind.fitness:.2f}")

        # 2. Create next generation
        new_population = Population(size=population_size)
        
        # Elitism: keep the best individual so we never lose a good solution
        best_ind = population.get_fittest()
        new_population.add_individual(best_ind)
        
        while len(new_population.individuals) < population_size:
            # Selection
            parent1 = select_parent_tournament(population)
            parent2 = select_parent_tournament(population)
            
            # Crossover
            offspring = crossover_single_point(parent1, parent2)
            
            # Mutation
            mutate_random_assignment(offspring, sample_locations, mutation_rate=0.05)
            
            new_population.add_individual(offspring)
            
        population = new_population

    # Evaluate final generation
    for ind in population.individuals:
        evaluate_fitness(ind, sku_map, location_map)
        
    final_best = population.get_fittest()
    print(f"\nOptimization Complete.")
    print(f"Final Best Fitness: {final_best.fitness:.2f}")
    print("\nBest Slotting Assignment:")
    for gene in final_best.genes:
        sku = sku_map[gene.sku_id]
        loc = location_map[gene.location_id]
        print(f"  {sku.id} -> {loc.id}")
        print(f"    - SKU Needs: Hazard={sku.hazard_class}")
        print(f"    - Loc Specs: AllowedHazards={'none' if 'none' in loc.allowed_hazard_classes else loc.allowed_hazard_classes}")
