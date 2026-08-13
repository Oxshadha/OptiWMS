# 🎯 Slotting Service

The **Slotting Service** is a FastAPI-powered microservice that optimizes warehouse storage layouts. It uses a **Genetic Algorithm (GA)** powered by the **DEAP** framework to match items with optimal shelf locations based on physical metrics, sales velocity, hazard constraints, and picking travel times.

---

## 📂 Code Location & Structure

- **Code Path**: [`ai_services/slotting-service`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/slotting-service)
- **Key Modules**:
  - [`app/main.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/slotting-service/app/main.py): Service entry point and basic status handlers.
  - [`app/api/endpoints.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/slotting-service/app/api/endpoints.py): Core HTTP endpoints wiring the solver into REST routes.
  - [`app/services/slotting.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/slotting-service/app/services/slotting.py): DEAP GA chromosome design, mutation, and crossover functions.
  - [`app/api/fitness.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/slotting-service/app/api/fitness.py): Evaluates hard constraints (weight, volume, hazards) and soft constraints (distance, height preferences).
  - [`app/services/plan_optimizer.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/slotting-service/app/services/plan_optimizer.py): Deterministic quarterly optimizer utilizing linear heuristics and MILP.

---

## ⚡ Main API Endpoints

The Slotting Service runs on **Port `8093`** by default. Interactive documentation is available at `http://localhost:8093/docs`.

### 1. Recommendations & Optimization
- **`POST /api/v1/slotting/recommend`**: Runs a Genetic Algorithm to find the best rack slots for specific items.
  - Returns a ranked recommendation code (e.g. `A-01-02-L2-B`) with a confidence score and explanation reasons.
  - Provides a list of `alternatives` with scores.
- **`POST /api/v1/slotting/optimize-wms`**: Run a complete warehouse-wide optimization run. Receives material lists and location capacities in the request body, executes the GA, and returns the optimized placement matrix. No local SQLite state is needed.
- **`POST /api/v1/slotting/plan/optimize`**: Deterministic quarterly planning endpoint. Supports a budget for maximum moves and can activate a Mixed-Integer Linear Programming solver (`use_milp_a_class=true`) to optimize fast-moving items.

### 2. Capabilities & Health
- **`GET /api/v1/slotting/capabilities`**: Lists the current algorithms and operational guides.
  - `deterministic_capacity_check` for fast inbound checks.
  - `forecast_space_heuristic` for standard slotting updates.
  - `deap_ga` for experimental research comparisons.
- **`POST /recommendations/slotting`**: Scaffolded endpoint for stable core-backend integration stubs.
- **`GET /health`** / **`GET /api/v1/slotting/health`**: Returns engine status and metadata.

---

## 📐 Placement Rules & Constraints

The solver evaluates several constraints to compute an optimal fitness score (minimizing travel time and layout inefficiency):

### Hard Constraints (Must Pass)
1. **Weight Capacity**: Item weight cannot exceed location maximum capacity.
2. **Volume Capacity**: Item volume (Length × Width × Height) must fit inside location dimensions.
3. **Hazard Isolation**: Hazardous chemicals are locked to designated zones (Zone A/B and excluded from standard racks).

### Soft Constraints (Optimized)
1. **Velocity Zone Alignment**: High-frequency items (Fast class) are guided to locations closest to the dispatch dock (lower aisles in Zone A). Slow-moving items are pushed to upper levels or Zone D.
2. **Ergonomic Height Preferences**: Heavy cartons are placed on ground levels (Level 1-2) to ensure picker safety. Light, smaller items are assigned to upper levels (Level 4-5).
3. **Product Co-Location**: Items frequently ordered together (compatibility matrix) are placed near each other.
