# 🔌 Logistic Agent (Coordinator Service)

The **Logistic Agent** is a FastAPI microservice that acts as the central coordinator and data hub for the OptiWMS AI stack. It does not run heavy optimization algorithms itself; instead, it provides client pipelines and routing controllers that synchronize data and coordinate workflows across the pathfinding, forecasting, slotting, and orchestrator services.

---

## 📂 Code Location & Structure

- **Code Path**: [`ai_services/logistic-agent`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/logistic-agent)
- **Key Modules**:
  - [`app/main.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/logistic-agent/app/main.py): Registers routers and configures startup lifecycles.
  - [`app/api/orders_routes.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/logistic-agent/app/api/orders_routes.py): Orchestrates picking, forecasting, and slotting requests for order processing.
  - [`app/api/sync_routes.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/logistic-agent/app/api/sync_routes.py): Coordinates data broadcast signals across AI services.
  - [`app/services/service_client.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/logistic-agent/app/services/service_client.py): Unified client abstraction wrapping asynchronous HTTP requests to sibling microservices.

---

## ⚡ Main API Endpoints

The Logistic Agent runs on **Port `3001`** by default. Interactive documentation is available at `http://localhost:3001/docs`.

### 1. Order Process Orchestration
- **`POST /api/orders/process`**: Orchestrates complete workflows for processing warehouse orders:
  1. Requests the layout configuration from the Path Optimization Service.
  2. Queries optimized pick routes between `ENTRY` and `EXIT` nodes.
  3. Queries forecast outputs for the SKUs inside the order.
  4. Resolves slotting locations for items.
  5. Sends the aggregated dataset to the orchestrator service to execute the process.
- **`GET /api/orders/aggregate`**: Gathers metrics and states for a specific order ID from the pathfinding, forecast, and slotting services.

### 2. Synchronization & Broadcasting
- **`POST /api/sync/data`**: Triggers a synchronization task between a source service and a target service.
- **`POST /api/sync/warehouse-to-all`**: Broadcasts warehouse structure configurations to the pathfinding, forecast, slotting, and orchestrator services to keep their local graphs and models aligned.
- **`POST /api/sync/orders-to-all`**: Broadcasts active order states to all connected services.

---

## 🔌 Connection Map & Service URLs

The service communicates with sibling FastAPI services using the following default endpoints (modifiable in [`service_client.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/logistic-agent/app/services/service_client.py)):

| Target Service | Integration URL (Local Development) | Default Timeout |
| :--- | :--- | :--- |
| **Pathfinding Service** | `http://localhost:8081` | 30 seconds |
| **Forecast Service** | `http://localhost:8082` | 30 seconds |
| **Slotting Service** | `http://localhost:8083` | 30 seconds |
| **Orchestrator Service** | `http://localhost:8084` | 30 seconds |

*(Note: During Docker Compose deployments, these service paths are updated to refer to the inner Docker network addresses, e.g., `http://forecast-service:8091`.)*
