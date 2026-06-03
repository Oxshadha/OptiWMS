# AI Services Integration Plan (Core WMS + FastAPI)

## Core WMS Today
- Backend: Spring modules under `backend/`.
- Frontend: API clients under `frontend/lib/api`.

## Integration Approach
1. Keep core WMS as system-of-record.
2. AI FastAPI services serve model outputs and orchestration.
3. Frontend reads forecast/inventory views via core backend proxy or directly from AI API gateway.
4. Other Python services consume forecast APIs from `forecast-service`.

## Next Implementation Tasks
1. Add secure auth between WMS and AI services (JWT/service token).
2. Add persistence layer for forecast runs (Postgres schema).
3. Add async job execution in orchestrator (Celery/Arq/Temporal).
4. Add endpoint contracts for dashboard needs:
   - `/forecasts`
   - `/forecast-metrics`
   - `/inventory-recommendations`
   - `/jobs/forecast-run`

## Legacy Note
- The current `forecast-service` still ingests static CSV snapshots from `Ai miroservices/modeling/outputs/reports`.
- The newer notebook-driven workflow now also produces cleaned datasets and saved artifacts under `Ai miroservices/modeling/outputs/`.
- The next integration step should be artifact-based inference from WMS data, not more expansion of the snapshot-ingestion path.
