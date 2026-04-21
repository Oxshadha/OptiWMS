# AI Microservice Production Gap Plan

## Objective

Move from report-snapshot bridge to a robust online forecasting microservice stack:

- Spring Boot core API as secured gateway
- FastAPI forecast-service as model-serving engine
- model registry + fallback + calibration + monitoring

---

## What Is Already Implemented

### Spring Boot (`backend/core-api`)

- Proxy controller and service:
  - `/api/ai/health`
  - `/api/ai/forecasts`
  - `/api/ai/forecast-metrics`
  - `/api/ai/inventory-recommendations`
  - `/api/ai/jobs/forecast-run`
  - `/api/ai/artifacts`
  - `/api/ai/artifacts/infer-classical`
  - `/api/ai/artifacts/infer-boosting`
- Warehouse scoping logic for non-admin users.

### FastAPI (`ai-services/forecast-service`)

- Routes for health/forecasts/metrics/inventory/runs/artifacts.
- Artifact listing and inference API.
- DB tables for runs/predictions/metrics/recommendations.
- Snapshot ingestion flow from CSV reports.

### Modeling stack (`Ai miroservices/modeling`)

- Fair comparison notebooks and strict equal-ground evaluation.
- Transfer evaluation on unseen M5.
- New PV2/WV2 generation and EDA with FG→RM lag signals.

---

## Gaps To Close (Production Critical)

1. **Legacy snapshot dependency**
- Current forecast-service still depends on mounted report files for run publishing.
- True online inference path from WMS history/features is not implemented.

2. **Serving contract gap**
- No strict request schema for “predict N SKUs for horizons H with warehouse context”.
- No model routing by registry/champion-challenger policy.

3. **Feature-builder gap**
- No online feature generation module matching training feature logic.
- Risk of train/serve skew.

4. **Reliability gap**
- No automatic fallback decision path (`naive`/`snaive`) during artifact/load failure or drift.
- No confidence/guardrail metadata in response.

5. **Monitoring gap**
- No live drift checks, bias alerts, calibration saturation alerts, SLA telemetry.

---

## First Implementation Order (Do This Next)

## Phase 1: Serving parity (highest priority)

1. Add strict inference endpoints in forecast-service:
- `POST /inference/forecast`
- `POST /inference/batch-forecast`
- include dataset/model/horizons/warehouse/context payloads.

2. Implement model registry loader:
- reads champion + fallback per dataset from registry JSON.
- supports explicit override by request.

3. Implement online feature builder module:
- same feature profile logic as training (`lags_roll_seasonal_category`, etc.).
- deterministic and versioned.

4. Add fallback engine:
- if model artifact unavailable/invalid -> deterministic naive fallback.

## Phase 2: Integration hardening

1. Update Spring Boot proxy to call new inference endpoints.
2. Add request/response DTO validation at proxy layer.
3. Add timeout/circuit-breaker/retry policy for AI service calls.

## Phase 3: Monitoring + governance

1. Add inference logs with model/version/calibration/fallback-used.
2. Add drift metrics endpoint and daily rollup.
3. Add champion-challenger evaluation job and auto-report.

---

## Immediate Code Changes Completed In This Step

- `forecast-service` artifact inference now supports:
  - `XGBOOST`
  - `CATBOOST`
  - `LIGHTGBM`
  - `RANDOM_FOREST`
- One-hot + `feature_columns` serving parity is applied for:
  - `XGBOOST`, `LIGHTGBM`, `RANDOM_FOREST`
- Dependencies updated for model loading:
  - `lightgbm`
  - `scikit-learn`

- Added strict online inference request schema and endpoint:
  - `POST /artifacts/infer-boosting-online`
  - typed payload for per-series monthly history (`month`, `demand_units`, optional exogenous fields)
  - server-side feature generation from history using artifact `model_cols`
  - train/serve alignment for one-hot models using `feature_columns`
  - per-series validation errors returned in `errors` block

---

## Production Readiness Gate (minimum)

Before claiming production-ready:

- online inference endpoints live and tested against WMS-like payloads
- train/serve feature parity tests passing
- fallback path tested (chaos test for missing artifact)
- drift + bias monitoring dashboards active
- rollback switch verified

If any fail: keep label as pilot/prototype.

---

## Acceptance Gates (Industry Submission)

Use these gates for go/no-go decisions on production claims.

### Model quality gates (holdout + recent live backtest)

- WAPE (overall): **<= 0.135**
- Bias (absolute, normalized): **<= 0.10**
- Under-forecast rate: **<= 0.60**
- MASE_mean: **<= 1.10**

### Reliability gates (serving/runtime)

- Endpoint success rate (`2xx`): **>= 99.5%**
- P95 latency gate (`/artifacts/infer-boosting-online`): **<= 2500 ms**
- P95 latency early warning threshold: **<= 1000 ms**
- Fallback usage rate (`fallback_used=true`): **<= 5%** steady-state
- Unknown/invalid series hard-failure rate: **<= 1%** (should mostly degrade to baseline fallback)

### Data/monitoring gates

- Drift alert SLA: alerts generated within **24h** of threshold breach
- Forecast error dashboard freshness: **daily**
- Champion/challenger reevaluation cadence: **weekly**

### Governance gates

- Every response includes model/version metadata and fallback flags
- Rollback procedure documented and tested
- Train/serve feature parity checks passing
