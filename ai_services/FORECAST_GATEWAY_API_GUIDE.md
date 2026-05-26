# Forecast Gateway API — Team Guide

> **For**: Developers integrating with the OptiWMS Forecast Service  
> **Base URL**: `http://localhost:8091` (local) or `http://forecast-service:8091` (Docker)  
> **Swagger Docs**: `http://localhost:8091/docs`  
> **Last updated**: 2026-05-26

---

## Quick Start

### Option 1: Python SDK (Recommended)

```python
# 1. Import the client
from forecast_client import ForecastClient

# 2. Connect to the forecast service
client = ForecastClient("http://forecast-service:8091")

# 3. Get forecasts — that's it!
result = client.get_latest()
for point in result.forecasts:
    print(f"{point.sku} H+{point.horizon}: {point.p50:.0f} units")
```

The SDK file is at: `ai_services/libs/forecast_client.py`

### Option 2: HTTP (curl / any language)

```bash
# Get latest forecasts
curl http://localhost:8091/gateway/forecast/latest

# Get forecast for a specific SKU
curl http://localhost:8091/gateway/forecast/SKU-001

# Run live inference
curl -X POST http://localhost:8091/gateway/forecast \
  -H "Content-Type: application/json" \
  -d '{"skus": ["SKU-001", "SKU-002"], "horizons": [1, 3, 6]}'

# Check service health
curl http://localhost:8091/gateway/health
```

---

## Endpoints Reference

### 1. `POST /gateway/forecast` — Run Live Inference

Run a real-time forecast for specific SKUs. The gateway automatically selects the best model.

**Request:**
```json
{
  "skus": ["SKU-001", "SKU-002"],
  "horizons": [1, 3, 6, 12],
  "warehouse_id": "WH-001",
  "mode": null,
  "include_inventory": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skus` | `string[]` | No | SKUs to forecast. `null` = all available SKUs |
| `horizons` | `int[]` | No | Months ahead to forecast. Default: `[1, 3, 6, 12]` |
| `warehouse_id` | `string` | No | Warehouse scope. `null` = default |
| `mode` | `string` | No | `"sync"`, `"async"`, or `null` (auto-detect) |
| `include_inventory` | `bool` | No | Also return reorder recommendations |

**Response (sync):**
```json
{
  "api_version": "1.0",
  "request_id": "a1b2c3d4-...",
  "timestamp": "2026-05-26T12:00:00Z",
  "status": "success",
  "model": {
    "name": "random_forest",
    "version": "v1",
    "is_champion": true,
    "fallback_used": false,
    "fallback_method": null
  },
  "warehouse_id": "WH-001",
  "forecasts": [
    {
      "sku": "SKU-001",
      "category": "Soap",
      "horizon": 1,
      "period": "H+1",
      "p10": 90.0,
      "p50": 100.0,
      "p90": 110.0,
      "unit": "units",
      "confidence_level": 0.80,
      "actual": null
    }
  ],
  "total_count": 1,
  "errors": null,
  "message": "Generated 1 forecast points across 1 horizons."
}
```

**Response (async — when >100 SKUs):**
```json
{
  "api_version": "1.0",
  "request_id": "...",
  "status": "accepted",
  "job_id": 42,
  "poll_url": "/api/v1/gateway/jobs/42",
  "estimated_seconds": 12.0,
  "message": "Forecast job #42 queued. Poll /api/v1/gateway/jobs/42 for results."
}
```

---

### 2. `GET /gateway/forecast/latest` — Latest Published Forecasts

Returns pre-computed predictions from the most recent published forecast run. **Fastest option** — no live inference required.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sku` | `string` | Filter by SKU |
| `warehouse_id` | `string` | Filter by warehouse |
| `horizon` | `int` (1-12) | Filter by forecast horizon |
| `category` | `string` | Filter by product category |
| `limit` | `int` (1-5000) | Results per page. Default: 100 |
| `offset` | `int` | Pagination offset. Default: 0 |

**Example:**
```bash
# Get latest 1-month forecasts for soap category
curl "http://localhost:8091/gateway/forecast/latest?horizon=1&category=Soap&limit=50"
```

---

### 3. `GET /gateway/forecast/{sku}` — Forecast for Specific SKU

Returns all available forecast horizons for a single SKU.

**Example:**
```bash
curl http://localhost:8091/gateway/forecast/SKU-001
```

**Response:** Same `ForecastResponse` envelope with all horizons for that SKU.

---

### 4. `GET /gateway/jobs/{job_id}` — Poll Async Job

For async forecasts, poll this endpoint until status is `"completed"`.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include_results` | `bool` | Include forecast data when complete. Default: `true` |
| `limit` | `int` | Max forecast results. Default: 500 |

**Status values:** `accepted` → `processing` → `completed` or `failed`

**Example:**
```bash
# Poll until complete
curl "http://localhost:8091/gateway/jobs/42?include_results=true"
```

---

### 5. `GET /gateway/health` — Health Check

Returns service health, champion model info, and artifact availability.

**Example:**
```bash
curl http://localhost:8091/gateway/health
```

**Response:**
```json
{
  "api_version": "1.0",
  "status": "ok",
  "service": "forecast-gateway",
  "champion_model": {
    "name": "random_forest",
    "version": "v1",
    "is_champion": true
  },
  "total_artifacts": 48,
  "last_run_id": 15,
  "uptime_seconds": 3600.5
}
```

---

### 6. `GET /gateway/models` — Available Models

Shows all available models and which one is the current champion.

**Example:**
```bash
curl http://localhost:8091/gateway/models
```

---

## Response Schema

Every gateway response uses the same **standardized envelope**:

```
ForecastResponse
├── api_version      (string)  — Always "1.0"
├── request_id       (string)  — UUID for tracing/debugging
├── timestamp        (string)  — ISO 8601 when response was generated
├── status           (string)  — "success" | "partial" | "error"
├── model            (object)  — What model produced these results
│   ├── name         (string)  — e.g. "random_forest"
│   ├── version      (string)  — e.g. "v1"
│   ├── is_champion  (bool)    — Is this the designated champion?
│   ├── fallback_used (bool)   — Was a fallback/baseline used?
│   └── fallback_method (str)  — e.g. "snaive12" (if fallback)
├── warehouse_id     (string?) — Warehouse scope
├── forecasts[]      (array)   — The forecast data points
│   ├── sku          (string)  — Product identifier
│   ├── category     (string?) — Product category
│   ├── horizon      (int)     — Months ahead (1-12)
│   ├── period       (string)  — Target period label
│   ├── p10          (float)   — 10th percentile (optimistic)
│   ├── p50          (float)   — Median forecast (point estimate)
│   ├── p90          (float)   — 90th percentile (pessimistic)
│   ├── unit         (string)  — "units"
│   └── actual       (float?)  — Actual value (null for future)
├── total_count      (int)     — Total forecast points
├── pagination       (object?) — Pagination info (for list queries)
├── errors           (array?)  — Per-series errors if any
└── message          (string?) — Human-readable status message
```

### Understanding the Forecast Values

| Field | Meaning | Use Case |
|-------|---------|----------|
| `p50` | **Median forecast** — the most likely demand | Primary planning value |
| `p10` | **Optimistic lower bound** — demand probably won't go below this | Minimum stock level |
| `p90` | **Pessimistic upper bound** — demand probably won't exceed this | Maximum stock capacity |
| `p10-p90` range | **80% confidence interval** | Risk assessment |

---

## Python SDK Reference

### Installation

No pip install needed — just copy or import the file:

```python
import sys
sys.path.insert(0, "/path/to/ai_services/libs")
from forecast_client import ForecastClient
```

### Methods

```python
client = ForecastClient(base_url, token=None, timeout=30.0)

# Run live inference
result = client.forecast(skus=["SKU-001"], horizons=[1, 3])

# Get latest published forecasts
result = client.get_latest(sku="SKU-001", warehouse_id="WH-001", limit=100)

# Get specific SKU
result = client.get_sku("SKU-001")

# Async: submit + wait
async_ref = client.forecast(skus=large_list, mode="async")
result = client.wait_for_job(async_ref.job_id, timeout=120)

# Health check
health = client.health()
print(health.status, health.champion_model.name)

# Available models
models = client.models()
```

### Result Objects

```python
# ForecastResult
result.status       # "success" | "partial" | "error"
result.ok           # True if status == "success"
result.model.name   # "random_forest"
result.forecasts    # list[ForecastPoint]
result.total_count  # int
result.message      # human-readable message

# Filter helpers
result.by_sku("SKU-001")    # → list of points for that SKU
result.by_horizon(3)         # → list of points for H+3

# Each ForecastPoint
point.sku       # "SKU-001"
point.horizon   # 1
point.p50       # 100.0 (median forecast)
point.p10       # 90.0  (lower bound)
point.p90       # 110.0 (upper bound)
point.category  # "Soap"
```

---

## Integration Examples

### Chatbot / AI Agent

```python
from forecast_client import ForecastClient

client = ForecastClient("http://forecast-service:8091")

def handle_user_query(sku: str) -> str:
    result = client.get_sku(sku)
    if not result.forecasts:
        return f"No forecast data available for {sku}."
    
    lines = [f"📊 Forecast for {sku} (Model: {result.model.name}):"]
    for p in result.forecasts:
        lines.append(f"  H+{p.horizon}: {p.p50:.0f} units (range: {p.p10:.0f}–{p.p90:.0f})")
    return "\n".join(lines)
```

### Inventory Service

```python
from forecast_client import ForecastClient

client = ForecastClient("http://forecast-service:8091")

def check_reorder_needs(warehouse_id: str):
    result = client.get_latest(warehouse_id=warehouse_id, horizon=1)
    
    reorder_skus = []
    for point in result.forecasts:
        if point.p50 > current_stock.get(point.sku, 0):
            reorder_skus.append({
                "sku": point.sku,
                "forecast_demand": point.p50,
                "safety_buffer": point.p90 - point.p50,
            })
    return reorder_skus
```

### Dashboard / Frontend (JavaScript)

```javascript
// Using fetch
const response = await fetch('http://localhost:8091/gateway/forecast/latest?limit=50');
const data = await response.json();

// data.status === "success"
// data.model.name === "random_forest"
// data.forecasts[0].sku, .p50, .horizon, etc.
```

### Batch Processing (async)

```python
from forecast_client import ForecastClient

client = ForecastClient("http://forecast-service:8091")

# Submit large batch (>100 SKUs → automatically async)
ref = client.forecast(skus=all_warehouse_skus, horizons=[1, 3, 6, 12])

if isinstance(ref, AsyncJobResult):
    # Wait for completion (polls every 2s, timeout 120s)
    result = client.wait_for_job(ref.job_id, timeout=120)
else:
    result = ref  # Small batch → was synchronous

print(f"Got {result.total_count} forecast points")
```

---

## Authentication

| Caller | Auth Method | How |
|--------|-------------|-----|
| **Frontend (Admin logged in)** | JWT from Java backend | `Authorization: Bearer <jwt_token>` |
| **Internal services** | Shared service token | `Authorization: Bearer <WMS_SERVICE_TOKEN>` |
| **Local development** | None required | Auth is disabled by default (`api_auth_required=false`) |

To enable auth:
```env
API_AUTH_REQUIRED=true
API_AUTH_TOKEN=your-shared-secret
```

---

## Error Handling

| HTTP Code | Meaning | Action |
|-----------|---------|--------|
| `200` | Success | Parse the `ForecastResponse` |
| `400` | Bad request | Check request body/parameters |
| `401` | Unauthorized | Check auth token |
| `404` | Not found (SKU or job) | Verify the SKU/job_id exists |
| `429` | Rate limited | Wait and retry (max 600 req/min) |
| `500` | Server error | Contact the AI team |

### Partial Success

The `status` field can be:
- `"success"` — All SKUs forecasted successfully
- `"partial"` — Some SKUs succeeded, others had errors (check `errors[]`)
- `"error"` — Complete failure (check `errors[]` and `message`)

Always check `result.model.fallback_used` — if `true`, the primary ML model failed and a statistical baseline was used instead.

---

## FAQ

**Q: Do I need to specify which model to use?**  
A: No. The gateway automatically uses the current champion model (Random Forest). When the champion changes, your code doesn't need to change.

**Q: What are dataset codes like "P" or "B"?**  
A: These are internal ML experiment labels. You never need to know or use them — the gateway resolves the correct dataset automatically.

**Q: How fast is the API?**  
A: 
- `GET /gateway/forecast/latest` — <100ms (reads from database)
- `POST /gateway/forecast` (1-10 SKUs) — 1-5 seconds (live inference)
- `POST /gateway/forecast` (100+ SKUs) — async, 10-60 seconds

**Q: What if the model is down?**  
A: The system automatically falls back to a statistical baseline (Seasonal Naive). The response will have `model.fallback_used: true` so you know.

**Q: Can I get forecasts in a different format?**  
A: The response format is standardized. Use the `fields` parameter to limit which fields are returned if you need a lighter payload.

---

## Contact

- **Swagger Docs**: `http://localhost:8091/docs` (interactive API explorer)
- **Health Check**: `GET /gateway/health`
- **Architecture**: See `Ai miroservices/modeling/CURRENT_STATUS.md`
