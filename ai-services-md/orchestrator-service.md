# 🔄 Orchestrator Service

The **Orchestrator Service** is a FastAPI-based microservice that manages, triggers, and polls the lifecycle of forecast runs and background pipelines. It coordinates actions between the user interface and the core `forecast-service` execution queues.

---

## 📂 Code Location & Structure

- **Code Path**: [`ai_services/orchestrator-service`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/orchestrator-service)
- **Key Modules**:
  - [`app/main.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/orchestrator-service/app/main.py): Application entry point and router attachments.
  - [`app/api/v1/routes/jobs.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/orchestrator-service/app/api/v1/routes/jobs.py): Contains endpoints that schedule and monitor async pipeline runs.
  - [`app/core/config.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/orchestrator-service/app/core/config.py): Configures environment and integration timeouts.

---

## ⚡ Main API Endpoints

The Orchestrator Service runs on **Port `8092`** by default. Interactive documentation is available at `http://localhost:8092/docs`.

### 1. Forecast Jobs Lifecycle
- **`POST /jobs/forecast-run`**: Triggers a new forecasting pipeline.
  - **Dataset Scope**: Supports targeting specific datasets (e.g. experiment code `"B"` or `"P"`).
  - **Model Target**: Can target a specific model (e.g. `"AUTO"`, `"XGBOOST"`, `"CATBOOST"`).
  - **Asynchronous Execution & Polling**: 
    1. Sends a `POST` request to `forecast-service` to initialize a new run.
    2. Receives a unique `run_id`.
    3. Calls `/publish` on the forecast service with `async_run=true`.
    4. Enters a polling loop, querying the status of `run_id` every few milliseconds/seconds.
    5. Returns the final outcome (either `"published"` or `"failed"`) when complete, or reports `"publishing"` if the timeout expires.

### 2. Service Health
- **`GET /health`**: Verifies orchestrator availability.
- **`GET /`**: Returns basic status metadata, active environment (`local`, `production`), and the base URL of the connected Forecast Service.

---

## 🔌 Integration Setup & Configurations

These settings are configured via `ai_services/.env` or docker-compose environment blocks:

```env
ORCHESTRATOR_SERVICE_PORT=8092
FORECAST_API_BASE_URL=http://forecast-service:8091
AI_ENV=local
LOG_LEVEL=INFO
```

### ⏱️ Timeout Settings (Internal Core Configurations)
- `run_create_timeout_seconds` (Default: `10.0`s)
- `run_publish_timeout_seconds` (Default: `180.0`s)
- `run_publish_poll_interval_seconds` (Default: `0.5`s)

---

## ⚙️ How it Works

```
[ Frontend / Java API ]
         │
         ▼
[ POST /jobs/forecast-run ]
         │
         ├─── 1. POST /runs ───────────────────────► [ Forecast Service ]
         │    (Creates run, returns run_id)                │
         │                                                 │
         ├─── 2. POST /runs/{id}/publish?async=true ───────► (Enqueues job in background)
         │                                                 │
         └─── 3. Loop: GET /runs/{id} ◄────────────────────┘
              (Polls status until 'published' or 'failed')
```
This architecture keeps client applications from encountering gateway timeouts during long forecasting runs (which can take 30-120 seconds to train, evaluate, and check gates).
