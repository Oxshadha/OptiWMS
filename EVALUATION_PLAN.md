# OptiWMS - Comprehensive Testing and Evaluation Plan

This document defines the testing methodology, unit test specifications, integration scenarios, and quantitative model evaluation framework for the **OptiWMS** ecosystem. It provides the structured blueprint for evaluating both the Core WMS transactional engine and the Python FastAPI intelligence nodes.

---

## 📋 Section 1: Evaluation Architecture & Testing Strategy

OptiWMS employs a multi-tiered evaluation strategy to ensure that transactional integrity remains intact while mathematical optimization models behave deterministically and yield mathematically valid plans.

```
       [Unit Testing Tier]
       ├── Java: JUnit 5 & Mockito (Services, DB mapping)
       └── Python: Pytest & Mock (Math solvers, endpoints)
                 │
                 ▼
     [Integration Testing Tier]
     ├── Spring Boot WebFlux client <-> FastAPI JSON contracts
     ├── PWA Offline Sync: IndexedDB (Dexie) <-> PostgreSQL
     └── Fail-Safe Fallbacks: RestTemplate circuit-breakers
                 │
                 ▼
      [Quantitative Model Evaluation]
      ├── Forecasting: WAPE, Absolute Bias, Pinball Loss
      ├── Replenishment: Cost Reduction, MOQ constraints, capacity limits
      ├── Slotting: Pick distance delta (MILP vs. GA vs. Heuristics)
      └── Pathing: A* travel time vs. alphabetical/numerical routing
```

---

## ⚙️ Section 2: Test Execution & Command Reference

### 2.1 Java Spring Boot Monolith
The Java backend tests run under JUnit 5 with Mockito. To execute tests for all subprojects, run the following commands from the `/backend` directory:
```bash
# Run all unit and integration tests
./gradlew test

# Run tests for a specific subproject (e.g. core-api)
./gradlew :core-api:test

# Generate a combined test coverage report (if JaCoCo is enabled)
./gradlew jacocoTestReport
```

### 2.2 Python FastAPI AI Nodes
Python tests are managed via `pytest` and can be executed individually inside each service directory.
```bash
# Setup virtual environment and dependencies
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt

# Run pytest inside any ai_services subfolder (e.g., path-optimization-service)
cd ai_services/path-optimization-service
pytest -v

# Run pytest with coverage reporting
pytest --cov=app tests/
```

---

## 🧪 Section 3: Detailed Unit Testing Matrices

Unit testing isolates business services, equations, and API controllers by mocking database layers and external network connections.

### 3.1 Core WMS Backend (Spring Boot)

| Component / Class | Test Case Objective | Inputs / Setup | Mocked Layers | Expected Output / State |
| :--- | :--- | :--- | :--- | :--- |
| `InboundOrderWorkflowService` | Task auto-generation upon PO creation | Inbound order ID, SKU list, Expected Date | `OrderService`, `OrderItemRepository`, `TaskService` | Generates a `receiving` task (status: `pending`) for each order line. |
| `OutboundOrderWorkflowService` | Allocation FIFO inventory locking | Outbound order ID, request quantity, warehouse ID | `InventoryService`, `MaterialLocationAssignmentService` | Binds stock to order items by decrementing available quantity in PostgreSQL, creating `picking` tasks. |
| `PutawayTaskService` | Correct bin assignment execution | Putaway task ID, scanned bin location | `TaskRepository`, `InventoryService` | Task transitions to `completed`, stock records updated with destination location code. |
| `CycleCountService` | Audit discrepancy trigger | Count sheet ID, physically counted qty $\neq$ system inventory qty | `CycleCountRepository`, `InventoryService` | Generates a mismatch alert, flags order as `discrepancy`, and starts approval flow. |

### 3.2 Demand Forecasting Service (`forecast-service`)

| Endpoint / Method | Test Case Objective | Inputs / Setup | Mocked Layers | Expected Output / State |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/v1/artifacts/infer-boosting-online` | Return active forecasting predictions | SKU code, horizon range, historical sales payload | Trained XGBoost / CatBoost model file loading | Returns $P_{10}$, $P_{50}$, and $P_{90}$ forecast quantiles. |
| `resolve_champion_model` | Model registry promotion gates | Evaluation metrics (WAPE, Bias) of trained model | SQLite DB (`forecast_service.db`) | Promotes model to "Champion" only if WAPE $\le$ 0.135 and bias $\le$ 0.10. |
| `online_inference_fallback` | Graceful fallback on missing artifacts | SKU query, corrupted/missing model binary files | File system loaders | Catches IO Exception, triggers statistical baseline model (Snaive12 / last-value), returns warning flag. |

### 3.3 Replenishment Service (`replenishment-service`)

| Endpoint / Method | Test Case Objective | Inputs / Setup | Mocked Layers | Expected Output / State |
| :--- | :--- | :--- | :--- | :--- |
| `calculate_probabilistic_safety_stock` | Safety stock volatility math | Target service level $z$, lead time $L$, demand variance $\sigma_d^2$, lead time variance $\sigma_L^2$ | None (Pure Math validation) | Computes safety stock matching the target parameters exactly. |
| `POST /api/v1/replenishment/run` | MILP supplier splits under constraints | SKU codes, safety stocks, supplier capacity, MOQ limits | Forecast Service, Postgres DB connection | Outputs optimal purchase orders minimizing procurement costs while meeting supplier MOQ criteria. |
| `explain_decision` | XAI waterfall explanation generation | Decision parameters (ROP, EOQ, MOQ, stockout days) | Replenishment Engine | Returns a formatted JSON list of features with positive/negative impact units and text summaries. |

### 3.4 Storage Slotting Service (`slotting-service`)

| Endpoint / Method | Test Case Objective | Inputs / Setup | Mocked Layers | Expected Output / State |
| :--- | :--- | :--- | :--- | :--- |
| `plan_optimizer.py` | ABC-FMS heuristic zoning | SKU lists with frequency and weight | Postgres DB layout mapping | Asserts Fast-movers are assigned to Zone A pick-faces, Slow-movers to Zone D, and Heavy items to bottom beams. |
| `_milp_refine_a_class` | MILP rack assignment refinement | A-class SKU profiles, rack capacities, pick coordinates | PuLP optimization solver | Assigns A-class SKUs to bins that minimize travel distance to dispatch, respecting weight/volume limits. |
| `move_budget_constraint` | Enforce maximum relocation moves limit | Slotting optimization request, move budget = 20% | Local layout cache | Asserts total suggested move operations does not exceed 20% of current slots. |

### 3.5 Path Optimization Service (`path-optimization-service`)

| Endpoint / Method | Test Case Objective | Inputs / Setup | Mocked Layers | Expected Output / State |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/v1/path/optimize` | Shortest path pick sequencing | Target pick coordinates list, warehouse layout graph | Graph loader | Runs A* algorithm, returns ordered sequence coordinates avoiding blocked nodes. |
| `astar_no_path` | Handling inaccessible pick locations | Target coordinates list behind blocked aisles | Layout graph | Gracefully falls back to nearest accessible location or returns warning flag without crashing. |

### 3.6 AI Reasoning Agent (`ai-agent`)

| Endpoint / Method | Test Case Objective | Inputs / Setup | Mocked Layers | Expected Output / State |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/chat` | RAG context search | User questions on returns and QC steps | ChromaDB vector store, Gemini API | Fetches context from ChromaDB, compiles system prompt, returns Gemini-formulated markdown text. |
| `explain_forecast` | Forecast driver explanation | SKU, selected month, SHAP feature attributions | `forecast-service` API, Gemini API | Parses technical feature columns (e.g. `lag_1`) and returns a plain English summary of forecast drivers. |

---

## 🔗 Section 4: Integration and End-to-End Testing

Integration testing confirms the correctness of asynchronous events, network timeouts, and offline boundaries.

### 4.1 Inbound Order Execution Integration
```
[External ERP] --(REST)--> [Spring Boot Monolith] --(DB Write)--> [PostgreSQL]
                                                                        │
                                                             (Trigger Put-away Tasks)
                                                                        ▼
[Floor Worker PWA] <-- (REST Task Push) -- [Spring Boot WebFlux] <-- [Slotting Engine FastAPI]
```
* **Test Objective**: Verify that when a receiving task completes in the WMS, the slotting service is triggered, calculates a new layout, and writes a pending put-away task back to the DB.
* **Test Steps**:
  1. Submit a Mock Inbound Order containing 5 SKUs.
  2. Mock the receiving scanning actions in the PWA.
  3. Verify that PostgreSQL reflects order state as `RECEIVED`.
  4. Intercept the call to `POST /api/v1/slotting/plan/optimize`. Assert the correct payload (SKU dimensions, volumes) is sent to FastAPI.
  5. Verify that 5 put-away tasks are successfully created in the `tasks` table with target location codes populated.

### 4.2 Outbound Order Route & Pick Integration
* **Test Objective**: Verify that a picker route is generated on the PWA using coordinates calculated by the path optimization service.
* **Test Steps**:
  1. Ingest an Outbound Order from the ERP.
  2. The worker selects the task on the PWA dashboard.
  3. Verify that Spring Boot makes a REST call to `logistic-agent`, which routes it to `path-optimization-service`.
  4. Assert that the response contains the ordered sequence of bins (A* route).
  5. Assert that the PWA displays the sequential pick path in the user interface.

### 4.3 PWA Offline-First IndexedDB Synchronization
* **Test Objective**: Verify data integrity when the Mobile PWA loses network connection during a picking execution.
* **Test Steps**:
  1. Load a picking task on the mobile PWA.
  2. Simulate network disconnection (disable browser connection).
  3. Perform picking transactions (scan items, enter count).
  4. Verify that transaction logs are saved locally in **IndexedDB (Dexie.js)**, and dashboard shows "Offline Mode".
  5. Re-enable network connection.
  6. Verify that background sync triggers automatically, pushing IndexedDB queue records to `/api/tasks/sync`.
  7. Verify PostgreSQL `tasks` and `inventory_items` tables are updated.

### 4.4 Fail-Open and Degradation Integration (Resilience)
* **Test Objective**: Verify that Java-based fallback heuristics are triggered when Python FastAPI microservices are offline.
* **Test Steps**:
  1. Stop the FastAPI `slotting-service` container.
  2. Trigger slotting allocation in the WMS Admin portal.
  3. Assert that `SlottingPlanClient.java` catches a `RestClientException`.
  4. Verify that the system logs a warning and executes the internal Java fallback heuristic (allocates standard available racks).
  5. Asserts the system finishes the task and does not crash or block the UI.

---

## 📊 Section 5: Quantitative Model Evaluation Metrics

These metrics serve as the target mathematical benchmarks to evaluate the quality of the AI models.

### 5.1 Demand Forecasting Accuracy
* **Weighted Absolute Percentage Error (WAPE)**:
  $$\text{WAPE} = \frac{\sum_{t=1}^N |y_t - \hat{y}_t|}{\sum_{t=1}^N y_t}$$
  * *Target*: $\text{WAPE} \le 0.135$ for A-class items.
* **Absolute Forecast Bias**:
  $$\text{Bias} = \frac{\sum_{t=1}^N (y_t - \hat{y}_t)}{\sum_{t=1}^N y_t}$$
  * *Target*: $-0.10 \le \text{Bias} \le 0.10$ to prevent systemic over-ordering or under-ordering.
* **Quantile Pinball Loss** (for $P_{10}$ and $P_{90}$ confidence boundaries):
  $$\text{Loss}_q(y, \hat{y}) = \max(q(y - \hat{y}), (q - 1)(y - \hat{y}))$$

### 5.2 Storage Slotting Quality
* **Picker Travel Distance Delta**:
  $$\Delta D = \frac{D_{\text{heuristic}} - D_{\text{MILP}}}{D_{\text{heuristic}}} \times 100\%$$
  * *Target*: $\Delta D \ge 25\%$ travel reduction for high-velocity SKUs when using MILP refinement compared to basic alphabetical slotting.
* **Layout Stability / Churn Limit**:
  $$\text{Churn} = \frac{\text{Suggested Relocations}}{\text{Total Bins}} \times 100\%$$
  * *Target*: $\text{Churn} \le 20\%$ to enforce physical relocation labor budgets.

### 5.3 Path Optimization Efficiency
* **A* Heuristic Route Improvement**:
  * Measured as picker pick-time per task reduction.
  * *Target*: $\ge 30\%$ reduction in picking trip durations compared to alphabetical coordinate routing.
* **Calculation Latency**:
  * *Target*: $P_{95} \text{ latency} \le 1.5$ seconds for graph grids up to 500 nodes.
