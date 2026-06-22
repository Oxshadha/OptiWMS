"""
ga_components.py — DEAP Individual, toolbox, and decode helper.
"""
import random
from deap import base, creator, tools
 
from config import (
    ZONES, ROWS, SLOTS, LEVELS, BINS,
    ZONE_LABELS, LEVEL_LABELS, BIN_LABELS,
)
 
if not hasattr(creator, "FitnessMin"):
    creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
 
if not hasattr(creator, "Individual"):
    creator.create("Individual", list, fitness=creator.FitnessMin)
 
toolbox = base.Toolbox()
 
toolbox.register("gene_zone",  random.randint, 0, ZONES  - 1)
toolbox.register("gene_row",   random.randint, 0, ROWS   - 1)
toolbox.register("gene_slot",  random.randint, 0, SLOTS  - 1)
toolbox.register("gene_level", random.randint, 0, LEVELS - 1)
toolbox.register("gene_bin",   random.randint, 0, BINS   - 1)
 
toolbox.register(
    "individual",
    tools.initCycle,
    creator.Individual,
    (
        toolbox.gene_zone,
        toolbox.gene_row,
        toolbox.gene_slot,
        toolbox.gene_level,
        toolbox.gene_bin,
    ),
    n=1,
)
toolbox.register("population", tools.initRepeat, list, toolbox.individual)
 
toolbox.register("mate", tools.cxUniform, indpb=0.5)
toolbox.register(
    "mutate",
    tools.mutUniformInt,
    low= [0, 0, 0, 0, 0],
    up=  [ZONES - 1, ROWS - 1, SLOTS - 1, LEVELS - 1, BINS - 1],
    indpb=0.2,
)
toolbox.register("select", tools.selTournament, tournsize=3)
 
def decode(individual) -> str:
    zone  = ZONE_LABELS [individual[0]]
    row   = individual[1] + 1            
    slot  = individual[2] + 1            
    level = LEVEL_LABELS[individual[3]]
    bin_  = BIN_LABELS  [individual[4]]
    return f"{zone}-{row:02d}-{slot:02d}-{level}-{bin_}"