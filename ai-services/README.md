# AI Microservices (FastAPI)

This workspace hosts Python AI services that integrate with the core WMS backend.

## Goals
- Serve forecasts/metrics/inventory recommendations to admin/manager dashboards.
- Provide reusable APIs for other Python services.
- Keep clear contracts with core WMS (`backend/core-api`) via HTTP.

## Services
- `forecast-service`: currently serves ingested forecast outputs and inventory suggestions from report snapshots. This is a legacy bridge, not yet true artifact-based model inference.
- `orchestrator-service`: currently triggers snapshot ingestion and health checks. It does not yet execute the full training/inference workflow.
- `libs/wms_contracts`: shared request/response schemas and WMS API client.

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
- AI services never write directly to core DB in this skeleton.
- Use API-level integration first; add message bus later if needed.
