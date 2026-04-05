# Forecast System: Enterprise Architecture Audit (OptiWMS)

## Why this document
This is a direct, no-marketing explanation of what your forecasting stack is today, how enterprise forecasting is normally done, and what must change to make it production-grade for industry submission.

---

## 1. Enterprise reality: how forecasting is usually built

At enterprise level, forecasting is split into **three layers**:

1. **Training layer (offline)**
   - trains candidate models from historical data
   - evaluates them on strict holdout rules
   - publishes artifacts and model metadata

2. **Serving layer (online/batch inference)**
   - loads published model artifacts
   - scores new series from live business data
   - returns forecasts with fallback, latency, and audit metadata

3. **Application layer (WMS UI + decisions)**
   - calls serving APIs
   - shows demand forecasts, confidence bands, and inventory actions
   - logs who triggered what and why

This is exactly the structure you should keep.

---

## 2. Your current OptiWMS implementation (as of now)

### 2.1 What is already real
- **Real microservices exist**:
  - `ai-services/forecast-service` (FastAPI)
  - `ai-services/orchestrator-service` (FastAPI)
  - `backend/core-api` (Spring Boot proxy/gateway)
- **Model artifact inference endpoint exists**:
  - `POST /artifacts/infer-boosting-online`
- **Fallback behavior exists**:
  - returns fallback forecasts when model/feature inference fails
  - includes fallback flags and reasons
- **Inference monitoring exists**:
  - inference audit log
  - alerts and acceptance-gate endpoints

### 2.2 What is still bridge mode
- `Trigger Run` path currently creates a run and ingests predictions from report CSV snapshots.
- It does **not** yet do full “read WMS live demand history -> online inference -> persist run” end-to-end.

So: this is a **real microservice architecture**, but forecasting run orchestration is still hybrid (snapshot bridge + online inference capability).

---

## 3. What should be in database (enterprise minimum)

You need two logical storage domains:

## A) Operational forecast store (already present in forecast-service DB)
- `forecast_runs`
- `forecast_predictions`
- `forecast_metrics`
- `inventory_recommendations`

Purpose: run history, UI reads, traceability.

## B) Model lifecycle store (partly in files, should be formalized)
- `model_registry` (dataset, model, version, artifact URI, stage: candidate/champion/retired)
- `model_evaluations` (WAPE/RMSE/MASE/Bias by split/horizon)
- `model_deployments` (when promoted, who approved, rollback pointer)

Purpose: controlled promotion and rollback.

Today artifacts are mostly file-based in:
- `Ai miroservices/modeling/outputs/artifacts/...`

That is acceptable for now, but enterprise maturity requires registry tables + immutable promotion records.

---

## 4. Can model weights be stored and reused for inference?

Yes. That is the normal pattern.

You already do this:
- XGBoost -> `model.json`
- CatBoost -> `model.cbm`
- Other estimators -> `model.pkl`
- metadata -> `metadata.json`

Then serving loads artifacts and performs inference.

This is exactly “build once, infer many times”.

---

## 5. How dataset/model selection should work

Enterprise rule:
- **Training datasets** (`A/B/C/P/PV2/...`) are DS pipeline labels.
- **WMS inference dataset** is not a notebook label; it is live warehouse/business data.

Recommended policy:
1. DS uses `A/B/C/P/PV2` for offline model comparison and robustness checks.
2. Promote one champion model per demand domain (for example FG monthly demand).
3. In production, WMS does not ask user to choose “dataset A/B/C”; it calls champion model for that scope.
4. Admin-only screen can expose challenger testing and model switching.

---

## 6. How this integrates with WMS (actual request path)

Current app path:
1. Frontend (`/admin/forecasts`) calls Spring endpoint `/api/ai/...`.
2. Spring `AiProxyController/Service` forwards to AI services.
3. Orchestrator triggers run creation + publish in forecast-service.
4. Forecast-service persists rows to forecast tables.
5. UI reloads from `/ai/forecasts`, `/ai/forecast-metrics`, `/ai/inventory-recommendations`.

Future target path (recommended):
1. Orchestrator fetches series history from WMS DB/API for selected scope.
2. Calls `infer-boosting-online` (artifact serving).
3. Persists predictions + metrics + recommendations as run.
4. UI reads same tables (no CSV dependency).

---

## 7. Is this a platform for future AI services?

Yes, structurally it can be.

You already have:
- API gateway pattern in Spring (`/api/ai/...`)
- dedicated AI microservices
- shared contracts under `ai-services/libs/wms_contracts`
- health/monitoring hooks

To become a robust AI platform, add:
1. common auth and service-to-service policy
2. shared observability (metrics + tracing + audit dashboard)
3. model registry and deployment governance
4. event-driven scheduling (optional later)

---

## 8. Gaps to close before “enterprise production-ready” claim

1. Remove CSV snapshot dependency from run trigger (keep as fallback only).
2. Add formal model registry tables and champion/challenger promotion workflow.
3. Standardize warehouse keying (ID vs name) across backend + AI services.
4. Add strict run-level audit fields:
   - input window
   - model version
   - fallback count/rate
   - latency summary
   - operator identity
5. Add SLO gates in CI/CD:
   - quality threshold pass
   - fallback-rate pass
   - latency pass
6. Add deterministic rollback runbook (already started in docs/ai).

---

## 9. Straight answers to your core questions

- “Is this a real microservice?”
  - **Yes**, architecture is microservice-based.

- “Can we store model weights and choose inference data later?”
  - **Yes**, and that is the correct enterprise pattern.

- “Are we fully integrated with WMS live data right now?”
  - **Partly**. UI/backend integration is real; run-generation is still partly snapshot-based.

- “Do we have platform base for other AI services?”
  - **Yes**, foundation is there; governance and shared ops controls need strengthening.

---

## 10. Recommended immediate next implementation (priority order)

1. Rewire orchestrator trigger to online artifact inference from WMS history.
2. Persist run outputs exactly as today (same tables) so UI contract stays stable.
3. Add model registry table and bind run to `model_version`.
4. Lock manager UI to horizon only; keep model controls admin-only.
5. Add run audit panel in admin UI (volume, fallback rate, error rate, p95 latency).

---

## 11. Files that define current behavior

- `ai-services/forecast-service/app/services/forecast_service.py`
- `ai-services/forecast-service/app/services/artifact_service.py`
- `ai-services/forecast-service/app/api/v1/routes/artifacts.py`
- `ai-services/forecast-service/app/api/v1/routes/runs.py`
- `ai-services/orchestrator-service/app/api/v1/routes/jobs.py`
- `backend/core-api/src/main/java/com/optiwms/coreapi/ai/AiProxyController.java`
- `backend/core-api/src/main/java/com/optiwms/coreapi/ai/AiProxyService.java`
- `frontend/app/admin/forecasts/page.tsx`

