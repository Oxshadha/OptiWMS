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
- `ai-services/forecast-service` still relies on mounted CSV report files and should be treated as transitional infrastructure until artifact loading and live WMS feature generation are added.

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
