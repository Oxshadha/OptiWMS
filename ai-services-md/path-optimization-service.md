# 🗺️ Path Optimization Service

The **Path Optimization Service** is a FastAPI-powered microservice that calculates the shortest and most efficient picking/putaway routes for warehouse operators. By modeling the warehouse layout as a walkable coordinate grid, the service applies the **A\* (A-Star) search algorithm** alongside Traveling Salesperson Problem (TSP) heuristics to optimize walking distances.

---

## 📂 Code Location & Structure

- **Code Path**: [`ai_services/path-optimization-service`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/path-optimization-service)
- **Key Modules**:
  - [`app/main.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/path-optimization-service/app/main.py): Service boot loader and CORS config.
  - [`app/algorithms/astar.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/path-optimization-service/app/algorithms/astar.py): The core A\* algorithm with Euclidean/Manhattan heuristic distance calculations.
  - [`app/algorithms/route_optimizer.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/path-optimization-service/app/algorithms/route_optimizer.py): Multi-stop solver using Nearest-Neighbor heuristics and turn-by-turn instruction compiler.
  - [`app/api/pathfinding_routes.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/path-optimization-service/app/api/pathfinding_routes.py): REST API controller implementing path and putaway routes.

---

## ⚡ Main API Endpoints

The Path Optimization Service runs on **Port `8081`** by default. Interactive documentation is available at `http://localhost:8081/api/docs`.

### 1. Single Path Optimization
- **`POST /api/pathfinding/optimize`** (Alias: `/api/pathfinding/find-path`)
  - Calculates the shortest route from a starting node to an ending node on a grid.
  - **Inputs**: Start/end grid coordinates, grid dimensions, and lists of `blocked_locations` representing racks or congested aisles.
  - **Outputs**: Ordered list of coordinates representing the path, total cost, estimated travel time (using picker or forklift speed models), and turning instructions.

### 2. Multi-Stop Pick Run Routing (TSP)
- **`POST /api/pathfinding/multi-stop`**
  - Solves the picking routing problem for an order containing multiple items.
  - **Inputs**: Start node, end node, a list of intermediate `stops` (pick locations), grid coordinates, and obstacles.
  - **Method**: Orders the stops using a nearest-neighbor TSP approach, links them together using A\*, and returns a unified, flattened path with per-segment directions.

### 3. Putaway Recommendations
- **`POST /api/pathfinding/putaway-suggest`**
  - Identifies the best putaway location for an inbound pallet from a list of candidate zones.
  - **Logic**: Evaluates travel distance from a start node (e.g., `ENTRY` gate) to each candidate location, ranking them by travel cost. Returns the top-3 suggestions complete with maps and turn instructions.

### 4. Batch Operations & Metadata
- **`POST /api/pathfinding/batch-optimize`**: Processes multiple path calculations in parallel in a single API request.
- **`GET /api/pathfinding/stats`**: Summarizes solver capabilities and status metrics.
- **`GET /api/pathfinding/sample-warehouse`**: Exposes the standard warehouse grid configuration.

---

## ⚙️ Pathfinding Core Logic

### A* Cost Calculation
The pathfinder calculates paths utilizing the standard heuristic formula:
$$f(n) = g(n) + h(n)$$
- $g(n)$: The actual travel cost from the starting cell to cell $n$.
  - **Cardinal movement (N, S, E, W)**: $1.0$ unit cost.
  - **Diagonal movement**: $\sqrt{2} \approx 1.414$ unit cost.
- $h(n)$: The estimated remaining distance to the destination (using Manhattan or Euclidean metrics).

### Obstacles & Walkability
Grid blocks representing warehouse shelves, structural pillars, or dynamic traffic blockages are labeled as non-walkable. The graph builder isolates these cells during graph creation, guaranteeing computed paths never cross solid objects.
