import random
from deap import base, creator, tools
from config import ZONES, ROWS, SLOTS, LEVELS, BINS
from config import ZONE_LABELS, LEVEL_LABELS, BIN_LABELS

creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
creator.create("Individual", list, fitness=creator.FitnessMin)

toolbox = base.Toolbox()

toolbox.register("gene_zone",  random.randint, 0, ZONES  - 1)
toolbox.register("gene_row",   random.randint, 0, ROWS   - 1)   # 0..19
toolbox.register("gene_slot",  random.randint, 0, SLOTS  - 1)   # 0..9  ← was 0..199
toolbox.register("gene_level", random.randint, 0, LEVELS - 1)
toolbox.register("gene_bin",   random.randint, 0, BINS   - 1)

toolbox.register(
    "individual", tools.initCycle, creator.Individual,
    (toolbox.gene_zone, toolbox.gene_row, toolbox.gene_slot,
     toolbox.gene_level, toolbox.gene_bin), n=1
)
toolbox.register("population", tools.initRepeat, list, toolbox.individual)

def decode(individual):
    zone  = ZONE_LABELS[individual[0]]
    row   = individual[1] + 1                 # 0 → 1,  19 → 20
    slot  = individual[2] + 1                 # 0 → 1,   9 → 10
    level = LEVEL_LABELS[individual[3]]
    bin_  = BIN_LABELS[individual[4]]
    return f"{zone}-{row:02d}-{slot:02d}-{level}-{bin_}"
    #  e.g.  A-07-03-L2-A