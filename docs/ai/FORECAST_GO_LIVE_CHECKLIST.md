# Forecast Go-Live Checklist (Production)

Use this checklist as the final go/no-go gate for OptiWMS forecasting.

Status legend:
- `done` = implemented in codebase
- `ops` = requires runtime/config/deployment action
- `open` = remaining engineering work

## 1) Runtime Integrity

1. Async publish queue and run state lifecycle (`created` -> `publishing` -> `published|failed`)  
   Status: `done`

2. Idempotent run trigger (same scope reuses active run)  
   Status: `done`

3. Publish completeness guard (no partial published run)  
   Required:
   - predictions rows >= `PUBLISH_MIN_PREDICTION_ROWS`
   - inventory rows >= `PUBLISH_MIN_INVENTORY_ROWS`
   - `test` metric rows present if `PUBLISH_REQUIRE_TEST_METRICS=true`
   - non-null test KPI values if `PUBLISH_REQUIRE_NON_NULL_TEST_KPIS=true`  
   Status: `done`

4. Retention policy for run and audit data  
   Status: `done`

## 2) Data Contract and Sources

1. Runtime source mode (`csv|wms_db|auto`) config-only switch  
   Status: `done`

2. WMS schema contract validation on startup and health endpoint (`/health/runtime-contract`)  
   Status: `done`

3. Strict production source mode (`RUNTIME_DATA_SOURCE_MODE=wms_db`)  
   Status: `ops`

4. Final WMS DB connection and schema verification in production environment  
   Status: `ops`

## 3) Model Serving and Fallback

1. Primary model online inference endpoint (`/artifacts/infer-boosting-online`)  
   Status: `done`

2. Classical/naive fallback on load/feature/inference failures + response flags  
   Status: `done`

3. Inference audit and alerts (fallback/error/latency)  
   Status: `done`

4. Champion/fallback release promotion policy enforced by acceptance gate  
   Status: `done`

## 4) UI/API Reliability

1. Single-call dashboard summary endpoint (`/dashboard/summary`)  
   Status: `done`

2. Run summary endpoint (`/forecast-metrics/run-summary`)  
   Status: `done`

3. Core API passthrough for runtime contract health (`/api/ai/health/runtime-contract`)  
   Status: `done`

4. Frontend fully migrated to single-call summary path in all panels  
   Status: `open`

## 5) MLOps Readiness

1. Acceptance gate thresholds defined (quality + serving)  
   Status: `done`

2. Gate evidence attached to release (run id, model version, metrics window)  
   Status: `ops`

3. Load-test evidence stored in repo (P95/P99 latency and error/fallback rates)  
   Status: `open`

4. Drift and freshness scheduled checks  
   Status: `done`

## 6) Required Commands Before Production Cutover

1. Build and run services:

```bash
cd ai-services
docker compose -f docker-compose.ai.yml up -d --build
```

2. Verify service and contract health:

```bash
curl http://localhost:8091/health
curl "http://localhost:8091/health/runtime-contract?force=true"
curl http://localhost:8092/health
```

3. Trigger controlled run:

```bash
curl -X POST "http://localhost:8092/jobs/forecast-run?dataset=PV2&model_name=CATBOOST&mode=snapshot"
```

4. Verify summary and gate:

```bash
curl "http://localhost:8091/forecast-metrics/run-summary?dataset=PV2&model=CATBOOST"
curl "http://localhost:8091/artifacts/acceptance-gate?dataset=PV2&model_name=CATBOOST&split=test&inference_window=200"
curl "http://localhost:8091/artifacts/operational-health"
curl "http://localhost:8091/artifacts/operational-health/history?limit=10"
curl "http://localhost:8091/artifacts/production-readiness?dataset=PV2&model_name=CATBOOST&split=test&inference_window=200&soak_hours=24"
```

## 7) Production Decision Rule

Mark **Production Ready** only if all are true:
- Runtime contract health returns `status=ok` in `wms_db` mode
- Latest run is `published` with no completeness violations
- Acceptance gate is `pass=true`
- Inference alert status is not `critical`
- Load-test evidence is documented and within SLO
