# 📊 Forecast Service

The **Forecast Service** is a FastAPI-based microservice that generates and serves demand forecasting predictions, inventory reorder recommendations, and model performance metrics. It supports both batch forecast runs and real-time online inference using pre-trained machine learning model artifacts (XGBoost, CatBoost, LightGBM, and RandomForest).

---

## 📂 Code Location & Structure

- **Code Path**: [`ai_services/forecast-service`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service)
- **Key Modules**:
  - [`app/main.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/main.py): Application entry point and worker lifecycle management.
  - [`app/api/v1/routes/`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/api/v1/routes): Exposes endpoints for forecasts, runs, health, model registry, and dashboard views.
  - [`app/services/shap_service.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/shap_service.py): Calculates SHAP feature attributions to provide explainable forecasts.
  - [`app/services/run_publish_service.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/run_publish_service.py): Handles background forecast generation queues.
  - [`app/services/governance_service.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/governance_service.py): Manages auto-promotion, rollback, and acceptance gate evaluations.

---

## ⚡ Main API Endpoints

The Forecast Service runs on **Port `8091`** by default. Interactive documentation is available at `http://localhost:8091/docs`.

### 1. Gateway & Serving Endpoints
- **`POST /gateway/forecast`**: Performs real-time online inference for specified SKUs. Automatically routes requests to the champion model. If the request is small (<= 100 SKUs), it runs synchronously; otherwise, it triggers an asynchronous job.
- **`GET /gateway/forecast/latest`**: Fetch pre-calculated predictions from the most recent published run. This is the fastest, lowest-latency path.
- **`GET /gateway/forecast/{sku}`**: Get all forecast horizons (e.g. 1 to 12 months) for a single SKU.

### 2. Online Model Inference & Fallback
- **`POST /artifacts/infer-boosting-online`**: Runs live inference using tree-based boosting model artifacts.
  - **Feature Construction**: Dynamically constructs lag-based features (e.g. `lag_1`, `roll_mean_6`) from history.
  - **Safety Fallback**: If model loading, feature calculation, or prediction fails, the endpoint automatically falls back to statistical baselines (`last_value` or `snaive12` - Seasonal Naive).
  - **Fallback Tracking**: Response payloads explicitly denote `fallback_used` (boolean), `fallback_reason` (string), and `fallback_count` (int).
  - **Audit Logging**: Write transaction details to JSONL logs (`inference_audit_log_file`).

### 3. Production Readiness & Acceptance Gates
- **`GET /artifacts/acceptance-gate`**: Validates active models against performance rules.
  - *WAPE Gate*: Overall weighted absolute percentage error must be `<= 0.135` (13.5%).
  - *Bias Gate*: Absolute normalized bias must be `<= 0.10` (10.0%).
  - *Under-forecast Rate*: Under-forecasting must be `<= 0.60` (60.0%).
  - *MASE Mean Gate*: Mean Absolute Scaled Error must be `<= 1.10`.
- **`GET /artifacts/production-readiness`**: Returns a comprehensive health indicator summarizing startup database contract compliance, model acceptance status, latency health, and fallback error rates.
- **`GET /health/runtime-contract`**: Validates the availability of live database schemas and tables on service startup.

### 4. Shadow Mode & Governance
- **`GET /artifacts/operational-health`**: Returns real-time health indicators (model drift, inference frequency, data freshness).
- **`POST /artifacts/operational-health/refresh`**: Manually forces recalculation of metrics.
- **`GET /api/v1/shap/explanation`**: Fetches pre-computed SHAP values for a given SKU and horizon, highlighting the driving factor (e.g., seasonal indicators or past stockouts).

---

## ⚙️ Environment Configuration

These settings are configured via `ai_services/.env`:

```env
FORECAST_SERVICE_PORT=8091
RUNTIME_DATA_SOURCE_MODE=csv              # 'csv' or 'wms_db' or 'auto'
WMS_RUNTIME_DATABASE_URL=postgresql://... # PostgreSQL connection for live mode
API_AUTH_REQUIRED=false                   # Toggle service-token authentication
API_AUTH_TOKEN=your-secret                # Service authorization token
GATE_MAX_WAPE=0.135                       # Max WAPE threshold
GATE_MAX_ABS_BIAS=0.10                    # Max absolute bias threshold
GOVERNANCE_ENABLED=true                   # Enables auto-promotions and rollbacks
GOVERNANCE_AUTO_PROMOTE=true              # Promotes challenger to champion if it beats thresholds
```

---

## 🔄 Dynamic Data Flow & Background Workers

1. **`PublishQueueWorker`**: Processes queue triggers. It ensures forecast runs are completely computed and verified (minimum rows, presence of test metrics) before writing them to the SQLite database (`forecast_service.db`) and promoting the run.
2. **`OperationalHealthWorker`**: Operates on a regular interval (e.g. every 120 seconds) to compute metrics freshness and trigger warnings if live tables are stale.
3. **`governance_worker`**: Implements soak-window tests (default 24 hours) for challenger models to ensure stability before they are promoted to champion.
