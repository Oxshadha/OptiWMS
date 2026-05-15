# Path Optimization Service - API Documentation

## Overview

The Path Optimization Service provides real-time A* pathfinding for warehouse operations. It calculates optimal routes for picking and putaway tasks, supporting complex constraints and dynamic warehouse layouts.

**Base URL:** `http://localhost:8081`

---

## Authentication

Currently, no authentication is required. CORS is enabled for all origins.

---

## Core Endpoints

### 1. Optimize Path - **POST** `/api/pathfinding/optimize`

Compute the optimal path between two locations using A* algorithm.

**Request Body:**
```json
{
  "start": "AISLE_1_A",
  "end": "AISLE_2_C",
  "warehouse_config": {
    "nodes": [...],
    "edges": [...]
  },
  "constraints": {
    "worker_type": "picker",
    "avoid_congestion": false,
    "avoid_narrow_aisles": false
  }
}
```

**Required Fields:**
- `start` (string): Node ID of starting location
- `end` (string): Node ID of destination

**Optional Fields:**
- `warehouse_config` (object): Custom warehouse configuration. If omitted, uses default sample warehouse
- `constraints` (object): Route constraints
  - `worker_type`: "picker" or "forklift" (default: "picker")
  - `avoid_congestion` (boolean): Avoid high-traffic areas
  - `avoid_narrow_aisles` (boolean): Avoid narrow aisles

**Response:**
```json
{
  "path_found": true,
  "path": [
    {
      "node_id": "AISLE_1_A",
      "row": 2,
      "col": 1,
      "cost": 0.0
    },
    {
      "node_id": "AISLE_2_C",
      "row": 5,
      "col": 5,
      "cost": 8.5
    }
  ],
  "path_length": 2,
  "total_cost": 8.5,
  "execution_time_ms": 2.34,
  "message": "Path found successfully",
  "node_count": 18
}
```

**Status Codes:**
- `200 OK`: Successfully computed path
- `400 Bad Request`: Invalid input
- `500 Internal Server Error`: Server error

---

### 2. Batch Optimize - **POST** `/api/pathfinding/batch-optimize`

Compute multiple paths in a single request (useful for multi-item picking).

**Request Body:**
```json
{
  "requests": [
    {
      "start": "ENTRY",
      "end": "AISLE_1_A",
      "constraints": {"worker_type": "picker"}
    },
    {
      "start": "AISLE_1_A",
      "end": "AISLE_2_C",
      "constraints": {"worker_type": "picker"}
    }
  ]
}
```

**Response:**
```json
{
  "batch_size": 2,
  "results": [
    { "path_found": true, "path": [...], "total_cost": 2.5, ... },
    { "path_found": true, "path": [...], "total_cost": 8.5, ... }
  ],
  "total_execution_time_ms": 5.68,
  "average_time_ms": 2.84
}
```

---

### 3. Get Warehouse Info - **POST** `/api/pathfinding/warehouse-info`

Get metadata about the warehouse layout.

**Request Body (Optional):**
```json
{
  "warehouse_config": { /* custom config or null for default */ }
}
```

**Response:**
```json
{
  "node_count": 18,
  "edge_count": 28,
  "layout_type": "graph-based",
  "nodes": [
    {
      "id": "ENTRY",
      "row": 0,
      "col": 5,
      "type": "entry",
      "walkable": true
    },
    ...
  ]
}
```

---

### 4. Get Sample Warehouse - **GET** `/api/pathfinding/sample-warehouse`

Retrieve the default sample warehouse configuration.

**Response:**
```json
{
  "name": "OptiWMS Demo Warehouse",
  "version": "1.0",
  "nodes": [...],
  "edges": [...],
  "metadata": {...}
}
```

---

### 5. Service Stats - **GET** `/api/pathfinding/stats`

Get service information and capabilities.

**Response:**
```json
{
  "service": "path-optimization-service",
  "algorithm": "A*",
  "version": "1.0.0",
  "features": [
    "Graph-based pathfinding",
    "Grid-based pathfinding",
    "8-directional movement",
    "Euclidean distance heuristic",
    "Batch pathfinding",
    "Dynamic constraints",
    "Obstacle support"
  ],
  "status": "operational"
}
```

---

## Health Check Endpoints

### GET `/health/`
Service health status.

### GET `/health/readiness`
Kubernetes readiness probe.

### GET `/health/liveness`
Kubernetes liveness probe.

---

## Data Models

### Node
```typescript
interface Node {
  id: string;              // Unique identifier (e.g., "A1", "ENTRY")
  row: number;            // Grid row position
  col: number;            // Grid column position
  type: string;           // "entry", "exit", "rack", "aisle", "bin", "packing"
  walkable: boolean;      // Can the node be traversed (false if blocked)
}
```

### Edge
```typescript
interface Edge {
  from: string;           // Source node ID
  to: string;             // Target node ID
  cost: number;           // Movement cost (distance or time)
  bidirectional: boolean; // Is traversal allowed both ways
  available: boolean;     // Can the edge currently be used
}
```

### Constraint
```typescript
interface Constraint {
  worker_type: string;       // "picker" or "forklift"
  avoid_congestion: boolean; // Avoid high-traffic areas
  avoid_narrow_aisles: boolean; // Avoid narrow warehouse sections
}
```

### PathResponse
```typescript
interface PathResponse {
  path_found: boolean;        // Whether a path was found
  path: PathStep[];          // Ordered list of nodes in path
  path_length: number;       // Number of steps
  total_cost: number;        // Sum of edge weights
  execution_time_ms: number; // Algorithm execution time
  message: string;           // Status message
  node_count?: number;       // Total nodes in warehouse
}
```

---

## Algorithm Details

### A* Pathfinding

The service uses the A* algorithm with:

- **g(n)**: Actual travel cost from start
- **h(n)**: Euclidean distance heuristic to goal
- **f(n) = g(n) + h(n)**: Total estimated cost

**Heuristic Function:**
```
h(node1, node2) = sqrt((node1.row - node2.row)² + (node1.col - node2.col)²)
```

**Time Complexity:** O(b^d) where b is branching factor, d is depth
**Space Complexity:** O(b^d) for open/closed sets

---

## Example Usage

### Python Example
```python
import requests
import json

BASE_URL = "http://localhost:8081"

# Load sample warehouse
response = requests.get(f"{BASE_URL}/api/pathfinding/sample-warehouse")
warehouse = response.json()

# Optimize a path
payload = {
    "start": "ENTRY",
    "end": "AISLE_2_C",
    "warehouse_config": warehouse,
    "constraints": {
        "worker_type": "picker",
        "avoid_congestion": True
    }
}

response = requests.post(
    f"{BASE_URL}/api/pathfinding/optimize",
    json=payload
)

result = response.json()
print(f"Path found: {result['path_found']}")
print(f"Steps: {result['path_length']}")
print(f"Total distance: {result['total_cost']:.2f}")
print(f"Execution time: {result['execution_time_ms']:.2f}ms")
```

### JavaScript/Fetch Example
```javascript
const BASE_URL = "http://localhost:8081";

async function optimizePath(start, end) {
  const warehouse = await fetch(`${BASE_URL}/api/pathfinding/sample-warehouse`)
    .then(r => r.json());

  const payload = {
    start,
    end,
    warehouse_config: warehouse,
    constraints: {
      worker_type: "picker",
      avoid_congestion: false
    }
  };

  const response = await fetch(`${BASE_URL}/api/pathfinding/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return await response.json();
}

// Usage
optimizePath("ENTRY", "AISLE_2_C").then(result => {
  console.log(`Found path with ${result.path_length} steps`);
  console.log(`Path: ${result.path.map(p => p.node_id).join(" -> ")}`);
});
```

### cURL Example
```bash
curl -X POST http://localhost:8081/api/pathfinding/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "start": "ENTRY",
    "end": "AISLE_2_C",
    "constraints": {
      "worker_type": "picker"
    }
  }'
```

---

## Error Handling

### Common Errors

**No Path Found**
```json
{
  "path_found": false,
  "path": [],
  "message": "No path found between nodes",
  "total_cost": 0
}
```

**Invalid Start Node**
```json
{
  "path_found": false,
  "path": [],
  "message": "Start node 'INVALID' not found in warehouse",
  "total_cost": 0
}
```

**No Warehouse Data**
```json
{
  "status": 400,
  "detail": "Warehouse configuration not provided and default not available"
}
```

---

## Performance Characteristics

- **Single Path**: < 5ms for typical warehouse (18 nodes)
- **Batch (10 paths)**: < 50ms total
- **Large Warehouse (1000+ nodes)**: < 100ms average
- **Memory Usage**: ~1KB per node

---

## Best Practices

1. **Reuse Warehouse Config**: Cache the warehouse configuration to avoid repeated downloads
2. **Batch Operations**: Use batch endpoint for multiple paths to reduce overhead
3. **Error Handling**: Always check `path_found` boolean in response
4. **Monitoring**: Track execution times to detect performance degradation
5. **Dynamic Obstacles**: Update warehouse config when aisles become blocked

---

## Migration & Integration

This service is designed for microservice architecture:

- **Docker Ready**: See Dockerfile for containerization
- **REST API**: Standard JSON request/response
- **Stateless**: No session or state management (scales horizontally)
- **CORS Enabled**: Works with any frontend
- **Health Checks**: Kubernetes-ready probes at `/health/*`

---

## Future Enhancements

- [ ] Multi-destination optimization (TSP variant)
- [ ] Real-time congestion model
- [ ] Worker availability tracking
- [ ] Machine learning-based cost estimation
- [ ] GraphQL endpoint
- [ ] WebSocket for real-time updates

---

## Support

For issues or questions:
- Check service logs: `docker logs <container-id>`
- Test endpoint: `curl http://localhost:8081/`
- Verify API: `http://localhost:8081/api/docs` (Swagger UI)
