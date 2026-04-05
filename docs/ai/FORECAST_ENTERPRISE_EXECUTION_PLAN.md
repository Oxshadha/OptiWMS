# Forecast Platform: Enterprise Execution Plan

## Scope
Build an enterprise-grade forecasting platform for OptiWMS with:
- stable API contracts,
- replaceable model artifacts,
- fallback-safe inference,
- auditable run orchestration,
- clean separation between UI, backend gateway, orchestration, and model serving.

This plan is based on current code in:
- `frontend/app/admin/forecasts/page.tsx`
- `backend/core-api/src/main/java/com/optiwms/coreapi/ai/*`
- `ai-services/forecast-service/*`
- `ai-services/orchestrator-service/*`
- `Ai miroservices/modeling/*`

---

## Current Baseline (what exists now)

1. Forecast microservices exist and are running:
- `forecast-service` (serving + artifact inference + audit logs)
- `orchestrator-service` (run trigger)

2. Core API gateway exists:
- `/api/ai/*` proxy and guard logic implemented.

3. Frontend forecast page exists:
- decision view and model performance view,
- role-based controls partly enforced,
- SKU type-ahead and run trigger UX improved.

4. Gap:
- trigger flow is still hybrid/snapshot-driven for run population.
- no formal model registry table for champion/fallback lifecycle governance.

---

## Target Architecture (industry level)

1. **Model Registry Layer**
- canonical registry for model versions and stage (`candidate/champion/fallback/retired`)
- dataset + warehouse scoped model selection
- promotion audit trail

2. **Run Orchestration Layer**
- trigger uses deterministic model selection from registry
- run record includes selected model version context
- run creation decoupled from UI choices where needed

3. **Inference Layer**
- online artifact inference first-class
- strict fallback contract (`fallback_used`, `fallback_reason`)
- per-request audit (latency/errors/fallback count)

4. **Application Layer**
- manager UI constrained to operational controls
- admin UI owns model governance + diagnostics

---

## Phase Plan

## Phase 1 (Immediate, execute now)
- Add forecast-service DB model registry table.
- Add registry APIs:
  - list entries
  - register entry
  - promote champion
  - get champion
- Add AUTO model resolution in run creation path.

Deliverable:
- model selection is no longer hardcoded only in UI; service can resolve champion from registry.

## Phase 2
- Wire orchestrator trigger to call online inference path (WMS history adapter) and persist outputs.
- Keep CSV snapshot ingest as controlled fallback mode.

Deliverable:
- trigger no longer depends primarily on static report CSVs.

## Phase 3
- Add inference-run audit dashboard endpoint (aggregated SLO metrics per model version).
- Add acceptance gate enforcement before promotion.

Deliverable:
- measurable production readiness controls.

## Phase 4
- Add model deployment audit trail + rollback endpoint.
- Enforce signed promotion workflow (admin-only).

Deliverable:
- enterprise governance and rollback safety.

---

## Data and Storage Contracts

Operational store (existing):
- `forecast_runs`
- `forecast_predictions`
- `forecast_metrics`
- `inventory_recommendations`

Model lifecycle store (new in Phase 1):
- `model_registry_entries`

Planned governance store (Phase 4):
- `model_registry_promotions` (audit events)

---

## Acceptance Criteria

Phase 1 done when:
- can register XGBOOST/CATBOOST/etc with dataset scope via API
- can promote champion via API
- creating run with model=`AUTO` resolves to champion and succeeds

Phase 2 done when:
- trigger path can produce run output without requiring pre-generated report CSVs
- fallback path and reason are persisted/visible

Phase 3/4 done when:
- promotion and rollback are auditable and gated by thresholds

---

## Execution Status

- [x] Plan authored from current repo scan
- [x] Phase 1 implemented
- [x] Phase 1 validated
- [ ] Phase 2 implemented
- [ ] Phase 2 validated
- [ ] Phase 3 implemented
- [ ] Phase 4 implemented
