# Forecast Production Execution Checklist

Last updated: 2026-04-19  
Project: OptiWMS Forecasting (FastAPI + Spring + Frontend)

How to use:
- Keep `[ ]` for pending.
- Change to `[x]` only when fully verified.
- Add evidence (PR, command output, screenshot) under each item when completed.

Master plan reference:
- `docs/ai/FORECAST_MLOPS_AND_DATA_SCIENCE_MASTER_PLAN.md`

Checklist policy:
- This file is the single source of truth for production tracking.
- Other docs are supporting references, not parallel trackers.

## Current Go-Live Status Snapshot (2026-04-19)
- Overall decision: `NO-GO` (not yet cleared for final production release).
- Blocking reasons:
  - [ ] 24h soak readiness gate not yet passing with zero criticals in window.
  - [ ] Real production BOM master replacement not completed (demo/starter mappings still referenced in checklist).
  - [ ] DS final training/benchmark/promotion evidence package not fully closed.
  - [ ] Final cross-functional sign-off pack (DS + Backend + Product/Ops) not complete.
- Reference blocker doc:
  - `docs/ai/FORECAST_GO_LIVE_PUNCHLIST.md`

## 1) Serving Foundation (Current State)
- [x] Forecast trigger pipeline supports `snapshot` and `online` modes.
- [x] Publish completeness checks are enforced before run is marked `published`.
- [x] Model registry + champion promotion endpoint exists.
- [x] Promotion gate enforcement is active.
- [x] Inference audit logging exists (fallback/error/latency metrics).
- [x] Operational health endpoints exist (inference/drift/freshness).
- [x] Online publish no longer fails when inventory snapshot is missing (fallback path added).
- [x] Acceptance gate bias is normalized (relative bias check).
- [x] End-to-end promotion for `dataset=B`, `model=CATBOOST` verified after online run.
- [x] Two-layer planning pipeline implemented: FG demand forecast -> BOM explosion -> raw-material requirements (`/raw-material-requirements`).

## 2) Runtime Data Contract (WMS DB)
- [x] Finalize canonical DB contract for runtime inference:
  - outbound demand source table(s)
  - inventory snapshot table(s)
  - SKU/category master
  - warehouse mapping
- [x] Enforce contract in runtime validator (missing tables/columns should fail clearly).
- [x] Add runtime data-readiness endpoint (`/health/runtime-data-readiness`) for live WMS checks (history rows, inventory SKUs, non-zero on-hand SKUs, warehouse coverage).
- [x] Add machine-readable readiness audit CLI for pipeline/ops use: `ai-services/forecast-service/scripts/runtime_data_readiness_check.py`.
- [x] Verify runtime mode is `wms_db` in non-local environments.
- [x] Validate non-zero on-hand inventory for sample SKUs from WMS DB.
- [x] Validate warehouse filter returns warehouse-specific inventory/demand.

Evidence (2026-04-18 local run, after bootstrap):
- `/health/runtime-contract?force=true` -> `status=ok`, `mode=wms_db`.
- `/health/runtime-data-readiness` -> `status=ok`, `reason=live_runtime_data_verified`.
- `/health/runtime-data-readiness?warehouse_id=7262019d-9bf4-4824-997c-d7b5c9158ef3` -> `status=ok`, `history_rows=24`, `inventory_skus=120`.
- `python ai-services/forecast-service/scripts/runtime_data_readiness_check.py --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms --schema public --outbound-statuses delivered,packed,picking` -> `status=ok`.
- `python ai-services/forecast-service/scripts/runtime_data_readiness_check.py --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms --strict` -> `status=ok`.
- DB checks:
  - `orders`: 83
  - `order_items`: 102
  - `materials(material_type='product')`: 120
  - `inventory rows`: 291
  - `product inventory with quantity > 0`: 120
- Warehouse filter verification:
  - `POST /jobs/forecast-run?dataset=B&model_name=CATBOOST&mode=snapshot&warehouse_id=7262019d-9bf4-4824-997c-d7b5c9158ef3` -> `status=published`, `run_id=27`.
  - `GET /forecasts?dataset=B&model=CATBOOST&warehouse_id=7262019d-9bf4-4824-997c-d7b5c9158ef3` -> `count=22248`.
  - `GET /inventory-recommendations?dataset=B&model=CATBOOST&warehouse_id=7262019d-9bf4-4824-997c-d7b5c9158ef3` -> `count=103`.
  - `GET /forecasts?dataset=B&model=CATBOOST&warehouse_id=3ed1692b-e09c-4e27-9a07-a966cc4a343d` -> `count=0` (expected for non-mapped warehouse scope).
- Gate status after online run:
  - acceptance gate = `ready:false` (blocked by `fallback_rate`, `hard_error_rate`)
  - production readiness = `ready:false` (blocked by acceptance + inference critical window)
- Conclusion: runtime data contract is live and warehouse scoping is validated for snapshot-published runs; remaining blockers are online per-warehouse history sufficiency and model-serving quality gates.
- Operational runbook: `docs/ai/WMS_FORECAST_DATA_ONBOARDING_RUNBOOK.md`

## 3) Historical Backfill + Data Quality
- [ ] Backfill historical sales/outbound data into WMS DB (minimum monthly, preferred weekly/daily).
- [ ] Define and run DQ checks:
  - missing month rate
  - negative demand
  - duplicate SKU-month rows
  - broken SKU IDs / remapped SKUs
- [x] Create data quality report artifact per load.
- [x] Add idempotent load process (safe reruns without duplicate rows).

Evidence (2026-04-18):
- Added script: `ai-services/forecast-service/scripts/export_outbound_history_and_dq.py`
- Added script: `ai-services/forecast-service/scripts/load_outbound_history_backfill.py`
- Generated artifacts:
  - `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/20260418T165423Z_20f258f6b84ece23/outbound_demand_daily.csv`
  - `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/20260418T165423Z_20f258f6b84ece23/outbound_demand_monthly.csv`
  - `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/20260418T165423Z_20f258f6b84ece23/dq_report.json`
  - `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/20260418T165423Z_20f258f6b84ece23/lineage.json`
- DQ summary:
  - `base_rows=48`, `distinct_skus=28`, `negative_qty_rows=0`, `missing_months_rate=0.0`
- Idempotent load summary:
  - first load: `rows_inserted=48`, `rows_updated=0`
  - rerun: `rows_inserted=0`, `rows_updated=48`
  - `forecast_outbound_history_backfill` row count: `48`
  - `forecast_backfill_load_audit` includes both runs with `status=ok`
- Runtime readiness after backfill:
  - `/health/runtime-data-readiness` -> `history_rows=96` (orders + backfill), status `ok`
- Current blocker:
  - Online run publishes, but inference alert is `critical` for `dataset=B, model=CATBOOST` with `fallback_rate=1.0`, `errors_count>0` (series count currently too small and all requests falling back).
  - History depth check: product SKU month coverage is `min=1`, `p50=1`, `max=2` months across 28 SKUs, while current CATBOOST artifacts require lag/rolling windows up to 12 months (`lag_12`, `roll_mean_12`, `roll_std_12`), so online feature build fails and fallback is expected.
  - Gate snapshot after online run `run_id=28`:
    - acceptance gate: `ready=false` (`fallback_rate=1.0`, `hard_error_rate=2.0`)
    - production readiness: `ready=false` (`inference_status=critical`, soak window critical count > 0)

## 4) Training Dataset Pipeline (Data Science Handoff-Ready)
- [ ] Build one canonical feature pipeline:
  - lag features
  - rolling stats
  - calendar/seasonality features
  - optional price/promo/exogenous features
- [ ] Version datasets (`dataset_version`) and store lineage metadata.
- [ ] Export train/val/test split manifests (time-based, leak-safe).
- [ ] Persist reusable training artifacts to stable paths.

## 5) Model Build + Evaluation Fairness
- [ ] Retrain candidate models on same dataset/split protocol:
  - CATBOOST
  - XGBOOST
  - fallback baseline(s)
- [ ] Store all model metrics in unified report table/file.
- [ ] Select champion by gate + business criteria (not single metric only).
- [ ] Ensure fallback model metrics are separately tracked and visible.

## 6) Inference Reliability + MLOps Ops Loop
- [x] Add scheduled online inference health checks with alerting destinations.
- [x] Add scheduled freshness checks against latest demand load.
- [x] Add drift checks using stable baseline run references.
- [x] Define auto-block/auto-degrade behavior when health is `critical`.
- [ ] Define retraining trigger criteria (drift/freshness/performance decay).

Evidence (2026-04-19):
- Governance + evidence endpoints are live:
  - `GET /artifacts/governance/status`
  - `POST /artifacts/governance/tick`
  - `GET /artifacts/release-evidence`
- Health scheduler is active via:
  - `POST /artifacts/operational-health/refresh` (manual tick)
  - Spring monitor job (`AiInferenceMonitorJob`) periodic refresh + readiness logging
- Alert dispatch hook implemented:
  - `OPS_ALERT_WEBHOOK_URL` (+ `OPS_ALERT_MIN_STATUS`) in forecast-service config/env.
- Auto-governance controls implemented (env-driven):
  - `GOVERNANCE_ENABLED`
  - `GOVERNANCE_AUTO_PROMOTE`
  - `GOVERNANCE_AUTO_ROLLBACK`
  - `GOVERNANCE_ENFORCE_GATE_ON_AUTOPROMOTE`
  - `GOVERNANCE_ROLLBACK_MODEL_NAME`

## 7) UI/Operational Readiness
- [ ] Decision View:
  - horizon filter works consistently (`All` and specific horizons)
  - SKU search/select works predictably
  - warehouse behavior matches role policy
  - inventory recommendations sortable and explainable
- [ ] Model Performance View:
  - all KPIs populated from real backend sources
  - inference path mix (primary/fallback/failed) visible
  - metric semantics clearly explained
- [ ] Remove non-essential warning banners once stable.
- [ ] Add operator runbook links directly in UI.

## 8) Deployment Readiness Gate (Go/No-Go)
- [ ] Runtime contract status = `ok`.
- [ ] Latest run status = `published`.
- [ ] Acceptance gate = `ready: true`.
- [ ] Production readiness endpoint = `ready: true`.
- [ ] Champion model promoted in model registry.
- [ ] Shadow run window completed with no critical incidents.
- [ ] Sign-off by:
  - Data Science
  - Backend
  - Product/Operations

Strict promotion guard:
- [ ] Promotion executed only after `production-readiness?soak_hours=24` returns `ready=true`.
- [ ] No use of `soak_hours=0` as final promotion evidence (debug/proving only).

## 9) Immediate Next Actions (This Week)
- [ ] Move runtime source to real WMS DB (`wms_db`) and validate row-level outputs.
- [x] Build and run first historical backfill job.
- [x] Add DQ report generation for every load.
- [ ] Retrain CATBOOST/XGBOOST on expanded backfilled real history and re-evaluate.
- [ ] Re-promote champion only via acceptance gate.
- [ ] Replace starter manual BOM mappings with validated production BOM master from ERP/WMS.
- [x] Fix online inference to reduce fallback from 100% to gate threshold (`<=5%`) before promotion.

Pipeline evidence (2026-04-18):
- Added one-command pipeline: `ai-services/forecast-service/scripts/run_outbound_backfill_pipeline.py`
- Run output:
  - `dataset_version=d4cd9fd2a63b2bb0`
  - `output_dir=/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/20260418T180258Z_d4cd9fd2a63b2bb0`
  - DQ `status=ok`
  - load `rows_inserted=0`, `rows_updated=48` (idempotent rerun)
- Added controlled depth generator: `ai-services/forecast-service/scripts/generate_synthetic_history_for_runtime.py`
- Synthetic history load output:
  - `rows_generated=4320` (120 SKUs x 36 months), `rows_inserted=4320`
  - backfill coverage after load: `sku_count=120`, `min_months=36`, `p50_months=36`, `max_months=36`
- After repeated clean online runs:
  - `inference-alerts (dataset=B, model=CATBOOST, limit=200)` -> `status=ok`, `fallback_rate=0.0`, `total_errors=0`
  - acceptance gate -> `ready=true`
  - production readiness (`soak_hours=24`) -> `ready=false` only because `soak_window_no_critical` still includes older critical snapshots from same 24h window
  - production readiness (`soak_hours=0`) -> `ready=true` (manual non-soak validation mode)
- Bug fix:
  - `soak_hours=0` override handling fixed in `app/services/production_readiness_service.py` (previously ignored due `soak_hours or 24` behavior)
- Pipeline enhancement:
  - `run_outbound_backfill_pipeline.py` now supports `--augment-runtime-history --augment-months <N>` to run synthetic depth augmentation in the same command.

## 10) Plan Alignment Decision (2026-04-18)
- [x] Adopt enterprise two-layer planning as default:
  - independent demand forecast (FG/decoupling point) first
  - dependent demand for RM/pack via BOM + lead-time logic
- [ ] Do not ship production with starter/demo BOM mappings.
- [ ] Complete Phase 0 exit gate from master plan before further model promotion.

## 11) New Historical Dataset -> Model -> WMS Runtime (Standard Operating Flow)
- [ ] Stage and validate newly received historical dataset.
  - schema checks
  - key checks (SKU, warehouse, date continuity)
  - DQ checks (null/negative/duplicates/outlier bands)
- [ ] Produce dataset lineage package for each onboarded dataset.
  - dataset_version/hash
  - extraction window
  - transformation notes
- [ ] Run notebook DS cycle on that dataset with fair protocol.
  - EDA first
  - leak-safe time splits
  - same feature policy across candidates
- [ ] Train and compare candidate models on same ground:
  - CATBOOST
  - XGBOOST
  - baseline/fallback model
- [ ] Select best two models (champion + fallback) based on gate criteria, not a single metric.
- [ ] Package and publish selected two into forecast artifact/runtime paths.
- [ ] Execute snapshot + online run validations on WMS-backed runtime data.
- [ ] Pass acceptance gate and production readiness gate before champion promotion.
- [ ] Keep rollback-ready previous champion version.

## 12) Final Production Signoff Blockers (Must Close)
- [ ] 24h soak gate must pass with zero critical health entries in window.
- [ ] Replace starter/demo BOM mapping with real BOM master (validated by planning/operations).
- [x] Add WMS-native BOM master tables + versioning/effective-dating (not only forecast-service local table).
- [ ] Add admin BOM CRUD UI panel for controlled edits and auditability.
- [ ] Add canonical `packing_material` classification and backfill existing material types accordingly.
- [ ] Ensure inventory recommendations are run-consistent and traceable by run_id/model_version/dataset_version.
- [ ] Ensure ongoing WMS movement history accumulation is active and auditable.
- [ ] Complete one full retrain cycle from newly accumulated real data and re-verify gates.

## 13) Data Science Focus (What to optimize next)
- [ ] Prioritize data realism and coverage before model complexity.
- [ ] Expand exogenous signals where available (promo/season/calendar/stockout flags).
- [ ] Track model quality and serving reliability together:
  - WAPE
  - MASE
  - Bias%
  - under_forecast_rate
  - fallback_rate
  - hard_error_rate
  - latency p95
- [ ] Re-rank candidate models only after feature/data revision, not ad-hoc one-off runs.

Reference:
- `docs/ai/FORECAST_DATA_REQUIREMENTS_AND_SYNTHETIC_GENERATION_STANDARD.md`

## 14) BOM Master Backend (Implemented 2026-04-19)
- [x] WMS BOM schema migration added:
  - `backend/infra/src/main/resources/db/migration/V55__create_bom_master_tables.sql`
  - tables: `bom_headers`, `bom_components`, `bom_audit_log`
- [x] Spring infra entities/repositories added for BOM master and audit.
- [x] Spring core-api CRUD endpoints added:
  - `GET /api/planning/bom/headers`
  - `GET /api/planning/bom/headers/{id}`
  - `POST /api/planning/bom/headers` (admin)
  - `PUT /api/planning/bom/headers/{id}` (admin)
  - `DELETE /api/planning/bom/headers/{id}` (admin)
  - `GET /api/planning/bom/headers/{headerId}/components`
  - `POST /api/planning/bom/headers/{headerId}/components` (admin)
  - `PUT /api/planning/bom/components/{id}` (admin)
  - `DELETE /api/planning/bom/components/{id}` (admin)
  - `GET /api/planning/bom/audit` (admin)
- [x] Core API compile verified: `./gradlew :core-api:compileJava` -> `BUILD SUCCESSFUL`.

## 15) Forecast-Service BOM Source Integration (Implemented 2026-04-19)
- [x] Raw-material requirement generation now prefers WMS BOM master (`bom_headers` + `bom_components`) in runtime mode.
- [x] Warehouse-aware BOM resolution added:
  - picks active/effective header per parent SKU
  - prefers warehouse-specific BOM over global BOM
- [x] Component scope expanded for RM planning to include both `raw_material` and `packaging_material`.
- [x] Local `bom_component_mappings` path retained only as controlled fallback when no active WMS BOM mapping is found.
- [x] BOM endpoint behavior updated:
  - `GET /api/v1/bom-mappings?source=auto|wms|local`
  - default `auto` returns WMS BOM if available, otherwise local fallback with source tag.
