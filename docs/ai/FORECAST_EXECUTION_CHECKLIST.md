# Forecast Production Execution Checklist

Last updated: 2026-04-18  
Project: OptiWMS Forecasting (FastAPI + Spring + Frontend)

How to use:
- Keep `[ ]` for pending.
- Change to `[x]` only when fully verified.
- Add evidence (PR, command output, screenshot) under each item when completed.

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

## 2) Runtime Data Contract (WMS DB)
- [ ] Finalize canonical DB contract for runtime inference:
  - outbound demand source table(s)
  - inventory snapshot table(s)
  - SKU/category master
  - warehouse mapping
- [x] Enforce contract in runtime validator (missing tables/columns should fail clearly).
- [x] Add runtime data-readiness endpoint (`/health/runtime-data-readiness`) for live WMS checks (history rows, inventory SKUs, non-zero on-hand SKUs, warehouse coverage).
- [ ] Verify runtime mode is `wms_db` in non-local environments.
- [ ] Validate non-zero on-hand inventory for sample SKUs from WMS DB.
- [ ] Validate warehouse filter returns warehouse-specific inventory/demand.

## 3) Historical Backfill + Data Quality
- [ ] Backfill historical sales/outbound data into WMS DB (minimum monthly, preferred weekly/daily).
- [ ] Define and run DQ checks:
  - missing month rate
  - negative demand
  - duplicate SKU-month rows
  - broken SKU IDs / remapped SKUs
- [ ] Create data quality report artifact per load.
- [ ] Add idempotent load process (safe reruns without duplicate rows).

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
- [ ] Add scheduled online inference health checks with alerting destinations.
- [ ] Add scheduled freshness checks against latest demand load.
- [ ] Add drift checks using stable baseline run references.
- [ ] Define auto-block/auto-degrade behavior when health is `critical`.
- [ ] Define retraining trigger criteria (drift/freshness/performance decay).

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

## 9) Immediate Next Actions (This Week)
- [ ] Move runtime source to real WMS DB (`wms_db`) and validate row-level outputs.
- [ ] Build and run first historical backfill job.
- [ ] Add DQ report generation for every load.
- [ ] Retrain CATBOOST/XGBOOST on backfilled real history and re-evaluate.
- [ ] Re-promote champion only via acceptance gate.
