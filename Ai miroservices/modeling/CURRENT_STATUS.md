# OptiWMS Forecast — Current Status

> **Last updated**: 2026-05-26 (Forecast Gateway API Deployed)

## Architecture

```
[v4 M5 Pipeline]                     [Forecast Service]              [Frontend]
01_prepare_m5_data.py                artifact_service.py              forecasts/page.tsx
03_model_comparison_m5.ipynb  ────→  runtime_data_source.py   ──────→ SKU charts
09_promote_champion.py               forecast_service.py              reorder table
                                           ↑
                                     WMS Database (PostgreSQL)
                                     + forecast_outbound_history_backfill

                                     ┌─────────────────────────┐
  [Chatbot / AI Services]  ────────→ │  Forecast Gateway API   │
  [Other Team Services]    ────────→ │  /api/v1/gateway/*      │
                                     │  (Model-Independent)    │
                                     └──────────┬──────────────┘
                                                ↓
                                     ForecastProvider Abstraction
                                     (BoostingProvider → model artifacts)
```

## Model Status

### Champion Models (All Trained on M5 Dataset - v4 Proper)

We compared 7 models on critical supply chain metrics: WAPE, MAPE, RMSE, MAE, MASE, and Bias.

| Model | Val WAPE | Val RMSE | Val Bias | Test WAPE | Test Bias | Status |
|-------|----------|----------|----------|-----------|-----------|--------|
| **Random Forest** | **0.0716** | **1883.9** | **50.7** | **0.0807** | **-212.1** | 🏆 **Champion (Deployed)** |
| LightGBM | 0.0699 | 2023.1 | 82.2 | 0.0847 | -309.8 | 🥈 Close second (Higher Bias/RMSE) |
| XGBoost | 0.0768 | 2153.1 | -18.1 | - | - | ✅ Lowest Absolute Bias |
| CatBoost | 0.0816 | 1929.7 | -73.3 | - | - | ✅ Good |
| Seasonal Naive | 0.1285 | 3705.5 | 124.3 | 0.1520 | 1332.1 | ⬜ **Fallback Baseline** |

**Why Random Forest was chosen as Champion:**
While LightGBM technically had a slightly better WAPE (0.0699 vs 0.0716), **Random Forest** was explicitly selected as the production champion due to critical warehouse priorities:
1. **Lowest RMSE**: It minimizes massive error spikes. In a warehouse, a massive prediction spike leads to catastrophic stockouts or overstock, making RMSE the most critical safety metric.
2. **Lower Bias**: It has a significantly lower bias tendency compared to LightGBM.

## Forecast Gateway API (NEW)

A **model-independent public API** for all consumers (chatbot, AI agents, other services, team members). No internal knowledge required — callers never specify dataset codes or model names.

### Gateway Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/gateway/forecast` | Run live inference (auto sync/async) |
| `GET` | `/api/v1/gateway/forecast/latest` | Get latest published forecasts |
| `GET` | `/api/v1/gateway/forecast/{sku}` | Get forecast for specific SKU |
| `GET` | `/api/v1/gateway/jobs/{job_id}` | Poll async job status |
| `GET` | `/api/v1/gateway/health` | Service health + champion model info |
| `GET` | `/api/v1/gateway/models` | Available models & champion designation |

### Key Design Decisions

- **Model-independent**: A `ForecastProvider` abstraction layer means swapping models requires zero API changes.
- **Dataset codes hidden**: Internal codes (`P`, `B`, `A`) are never exposed — resolved automatically via `DEFAULT_FORECAST_DATASET`.
- **Smart sync/async**: ≤100 SKUs → synchronous response; >100 SKUs → async job with polling.
- **Standardized envelope**: Every response uses the same `ForecastResponse` schema with `api_version`, `model` metadata, `forecasts[]`, and pagination.
- **Python SDK**: Team members use `forecast_client.py` for 3-line integration.

> 📖 **Full reference**: See `ai_services/FORECAST_GATEWAY_API_GUIDE.md` for team usage guide.

## System Integration & Live Deployment

The system is fully professionalized and actively deploying the best model:

### 1. Model Serialization & Promotion
- **Dynamic Promotion**: The `09_promote_champion.py` script automatically reads the champion model designation from `metadata.json` and deploys it to the correct production path (`outputs/artifacts/P/random_forest_h1/production`).
- **Generalization Tracking**: The comparison notebook now actively tracks Train vs Validation vs Test metrics to visualize and prevent overfitting.

### 2. Frontend UI / Dashboard Metrics
- **MAPE Calculation Fixed**: The frontend was previously incorrectly multiplying `WAPE * 100` and displaying it as MAPE (which caused a ~15% baseline fallback display).
- **True Metrics Rendered**: The dashboard now correctly extracts the exact `MAPE` metric (e.g. `9.65%` for Random Forest) directly from the backend API's payload, accurately reflecting true ML performance.
- **Reliability & Fallbacks**: The system falls back to `Seasonal Naive` if ML fails (e.g. missing features), ensuring the warehouse always has a demand baseline.

### 3. Forecast Gateway API
- **Model-Independent Endpoint**: Any service can consume forecasts via `POST /api/v1/gateway/forecast` without knowledge of internal model details.
- **Provider Abstraction**: `BoostingForecastProvider` wraps the existing artifact service. Future models implement the `ForecastProvider` protocol with zero gateway changes.
- **Python SDK**: `ai_services/libs/forecast_client.py` provides typed client with `ForecastResult`, `ForecastPoint`, and `ModelInfo` dataclasses.

## Deployment Phases

| Phase | Data Source | Model | Status |
|-------|-----------|-------|--------|
| Phase 1: Pre-training | M5 dataset | 7 Models Compared | ✅ Complete |
| Phase 2: Live Deployment | **WMS PostgreSQL (Online)** | **Random Forest (Champion)** | ✅ **ACTIVE** |
| Phase 3: Gateway API | Model-independent gateway | All models via provider abstraction | ✅ **ACTIVE** |
| Phase 4: Fine-tuning | ≥12 months real WMS data | Warm-start from pre-trained | ⬜ Future |

### Phase 4: Fine-tuning — Why It's Future

The current champion model (Random Forest) was pre-trained on the **M5 public retail dataset** — a large, well-known forecasting benchmark. This was used as a proxy because our real WMS system does not yet have enough historical demand data to train on.

**What needs to happen before Phase 4:**
1. The WMS system must run in production for **≥12 months**, collecting real outbound/demand transaction data
2. Once sufficient real data accumulates, the model is retrained specifically on **our warehouse's actual demand patterns**
3. "Warm-start" means we don't train from scratch — we use the M5 pre-trained model as a starting point and fine-tune it on the real data, which is faster and often yields better results than training from zero

**Why the current approach works well now:**
- The M5 pre-trained model provides a strong baseline for demand forecasting with ~7% WAPE
- The system has a built-in Seasonal Naive fallback if the ML model underperforms on specific SKUs
- The Gateway API is model-independent, so when fine-tuning happens, **zero consumer-side code changes are needed** — the new model is deployed, and all consumers automatically get improved forecasts

**Estimated timeline:** Phase 4 begins after the WMS has been live for 12+ months with consistent data collection.


## Repository Structure

```
Ai miroservices/modeling/
├── v4_m5_proper/         ← Current: complete M5 pipeline with full evaluation
│   ├── 03_model_comparison_m5.ipynb ← Trains models, Generalization Charts, Selects Champion
│   ├── 09_promote_champion.py       ← Deploys Champion to Backend Artifacts
│   ├── champion_model/              ← Local serialized `.pkl` and `metadata.json`
│   └── model_comparison_results.csv ← Static logging of run metrics
├── outputs/artifacts/P/  ← Production Deployment Target
│   ├── random_forest_h1/production/ ← Active Deployment
│   └── lightgbm_h1/production/      ← Previous Deployment
└── CURRENT_STATUS.md     ← This file

ai_services/forecast-service/app/
├── api/v1/
│   ├── routes/
│   │   ├── gateway.py               ← NEW: Forecast Gateway Router (6 endpoints)
│   │   ├── forecasts.py             ← Existing: internal forecast queries
│   │   ├── dashboard.py             ← Existing: dashboard aggregation
│   │   └── artifacts.py             ← Existing: model artifacts & inference
│   └── schemas/
│       ├── forecast_response.py     ← NEW: Standardized response envelope
│       ├── gateway_request.py       ← NEW: Gateway request schemas
│       └── artifacts.py             ← Existing: artifact schemas
├── services/
│   ├── forecast_provider.py         ← NEW: Model-independent provider abstraction
│   ├── artifact_service.py          ← Model loading, inference, champion resolution
│   └── forecast_service.py          ← Publish pipeline, online inference
└── core/config.py                   ← Updated: gateway settings added

ai_services/libs/
└── forecast_client.py               ← NEW: Python SDK for team consumption
```

