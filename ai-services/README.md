# AI Microservices (FastAPI)

This workspace hosts Python AI services that integrate with the core WMS backend.

## Goals
- Serve forecasts/metrics/inventory recommendations to admin/manager dashboards.
- Provide reusable APIs for other Python services.
- Keep clear contracts with core WMS (`backend/core-api`) via HTTP.

## Services
- `forecast-service`: serves forecast outputs for UI and supports artifact-based online inference with configurable runtime data source (`csv` or live `wms_db`).
- `orchestrator-service`: triggers and publishes forecast runs (snapshot/online) and health checks.
- `libs/wms_contracts`: shared request/response schemas and WMS API client.

## Runtime Behavior (current)
- Run publish is asynchronous:
  - Forecast service marks run `publishing`, executes in background, then marks `published`/`failed`.
  - Orchestrator polls run state to return final status without long blocking calls.
- Publish completeness is enforced before marking `published`:
  - minimum prediction rows,
  - minimum inventory rows,
  - required `test` metrics rows (and non-null KPI values when enabled).
  - If checks fail, run is marked `failed` with reason in run notes.
- Champion promotion guard:
  - Registry promotion is blocked unless acceptance gate passes (configurable by `GATE_ENFORCE_ON_PROMOTION`).
- Duplicate concurrent runs are prevented per scope:
  - Same `(dataset, model, warehouse)` in `created/publishing` is reused (idempotent trigger behavior).
- Run-level KPI summaries are persisted:
  - `forecast_run_summaries` table and `GET /forecast-metrics/run-summary`.
  - Dashboards can consume precomputed KPIs instead of expensive recomputation.
- Single-call dashboard aggregation endpoint:
  - `GET /dashboard/summary` returns run summary + top reorder rows + forecast point payload in one response.
- Retention controls:
  - old runs are pruned after publish based on configurable max-runs-per-scope and max-age policy.

## Current State
- The active data-science workflow now lives under `Ai miroservices/modeling/`.
- Saved forecasting artifacts, cleaned datasets, and notebook-based evaluation are produced there.
- `ai-services/forecast-service` now supports online artifact inference via `POST /artifacts/infer-boosting-online` with:
  - typed per-series history payloads,
  - server-side feature construction,
  - fallback baselines (`last_value` / `snaive12`) when model artifacts or feature inference fail,
  - explicit fallback flags in response (`fallback_used`, `fallback_reason`, `fallback_count`),
  - JSONL inference audit logs (`inference_audit_log_file`).
  - acceptance gate endpoint (`GET /artifacts/acceptance-gate`) for go/no-go checks.
  - optional service-token auth and online inference rate limiting.

## Production Acceptance Gates
- Forecast quality:
  - WAPE (overall): `<= 0.135`
  - Bias (absolute, normalized): `<= 0.10`
  - Under-forecast rate: `<= 0.60`
  - MASE_mean: `<= 1.10`
- Serving reliability:
  - Endpoint `2xx` success rate: `>= 99.5%`
  - P95 latency for online inference: `<= 500 ms` for normal batch sizes
  - Fallback usage rate (`fallback_used=true`): `<= 5%` steady state
  - Hard-failure rate (non-fallbackable requests): `<= 1%`
- Monitoring/governance:
  - Daily forecast-error + drift review
  - Weekly champion/challenger review
  - Rollback procedure tested and documented

## Security and Reliability Controls
- Optional service auth (FastAPI):
  - `api_auth_required=true`
  - `api_auth_token=<shared-secret>`
- Online inference rate limit:
  - `inference_rate_limit_per_minute` (default: 600)
- Core API forecast-trigger guard:
  - blocks run trigger when inference health is `critical`
  - controlled break-glass override only when explicitly enabled + requested

## Local Run
1. Copy env:
```bash
cp ai-services/.env.example ai-services/.env
```
2. Start services:
```bash
docker compose -f ai-services/docker-compose.ai.yml up --build
```
3. Open docs:
- Forecast API: `http://localhost:8091/docs`
- Orchestrator API: `http://localhost:8092/docs`

## Integration Contract
- Core WMS base URL from env (`WMS_API_BASE_URL`, default `http://localhost:8080/api`).
- Runtime data source is configurable:
  - `RUNTIME_DATA_SOURCE_MODE=csv|wms_db|auto`
  - `WMS_RUNTIME_DATABASE_URL` for live history/inventory reads.
- Runtime schema contract validation:
  - Startup validates required WMS tables/columns for `wms_db` mode.
  - `GET /health/runtime-contract` returns contract status and missing schema details.
- Scheduled operational health snapshots:
  - Background worker computes combined health (`inference + drift + freshness`).
  - Endpoints:
    - `GET /artifacts/operational-health`
    - `GET /artifacts/operational-health/history`
    - `POST /artifacts/operational-health/refresh`
- Production readiness gate endpoint:
  - `GET /artifacts/production-readiness`
  - Aggregates runtime contract, latest published run, acceptance gate, inference criticality, and soak-window critical count.
- Forecast service writes only to its own forecast DB/state tables.
- For live mode, forecast service reads WMS DB (read-only contract expected).
