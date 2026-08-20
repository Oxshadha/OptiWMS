# OptiWMS Forecast Docs Index

This folder is the forecast **working record**: the runbooks used to operate the
model, the gate that defines acceptance, and the experiment history behind the
result.

It is not the current status. For what the system does today, read:

- [Current implementation and runtime status](../../Ai%20miroservices/modeling/CURRENT_STATUS.md)
- [Final project report](../../report.md)
- [v8 modeling and physical-population guide](../../Ai%20miroservices/modeling/v8_controlled_synthetic_validation/README.md)

The documents below record how that state was reached, and how to operate it.

## Status trackers (historical)
- `FORECAST_EXECUTION_CHECKLIST.md`
  - Implementation status and production blockers as tracked during development. Superseded as a status source by `CURRENT_STATUS.md`.
- `FORECAST_GO_LIVE_PUNCHLIST.md`
  - Final blocker-only go-live list with owner, pass criteria, and evidence commands.

## Planning and architecture intent
- `FORECAST_MLOPS_AND_DATA_SCIENCE_MASTER_PLAN.md`
  - End-to-end enterprise plan for DS + MLOps lifecycle.
- `FORECAST_SYNTHETIC_TO_PRODUCTION_EXECUTION_PLAN.md`
  - Phase-by-phase execution plan from single real Excel anchor to realistic synthetic data, fair model bakeoff, deployment, and production evidence.
- `TWO_LAYER_FORECAST_TO_RM_REQUIREMENTS.md`
  - Two-layer logic: forecast independent demand, then explode to RM/packing via BOM.
- `FORECAST_DATA_REQUIREMENTS_AND_SYNTHETIC_GENERATION_STANDARD.md`
  - Canonical requirements for real-data requests, synthetic-data generation standards, required columns, and BOM/data-model architecture.

## Operational runbooks
- `WMS_FORECAST_DATA_ONBOARDING_RUNBOOK.md`
  - Data contract, model plug contract, onboarding commands, readiness checks, and promotion prerequisites.
- `MODEL_RELEASE_AND_ROLLBACK_RUNBOOK.md`
  - Controlled release/promotion/rollback procedure.
- `EXTERNAL_SIGNALS_INGESTION_RUNBOOK.md`
  - Add external/context signals to portable datasets and retrain via fair-play protocol.
- `FORECAST_SHADOW_MODE_RUNBOOK.md`
  - Production-candidate shadow execution and realized-feedback evaluation procedure.

## Gate definition
- `INDUSTRY_SUBMISSION_ACCEPTANCE_GATE.md`
  - Formal go/no-go quality and serving thresholds.

## Data assessment and experiment tracking
- `EXTERNAL_DATASET_FIT_ASSESSMENT.md`
  - Fit/no-fit decision records for third-party datasets (Kaggle or other) against OptiWMS runtime contract.
- `SYNTHETIC_DATA_GENERATION_EXPERIMENT_LOG.md`
  - Chronological log of synthetic-generation attempts, failures, metric outcomes, and next actions.
- `FORECAST_LEADERBOARD_ROUND_LOG.md`
  - Immutable round-by-round leaderboard snapshots to prevent result loss after notebook reruns.
- `FORECAST_EXPERIMENT_TRACE_20260421.md`
  - Supervisor-facing experiment trace for external-signals A/B cycle (what changed, data used, commands, outputs, decisions).

## Recommended usage order
1. Read `CURRENT_STATUS.md` and `report.md` first for what is actually built.
2. Read `FORECAST_GO_LIVE_PUNCHLIST.md` (final go-live blockers and evidence).
3. Use `WMS_FORECAST_DATA_ONBOARDING_RUNBOOK.md` to onboard data and run validations.
4. Use `FORECAST_SYNTHETIC_TO_PRODUCTION_EXECUTION_PLAN.md` for execution from anchor real data to deployed demo-ready system.
5. Use `FORECAST_MLOPS_AND_DATA_SCIENCE_MASTER_PLAN.md` for DS/model improvement roadmap.
6. Use `INDUSTRY_SUBMISSION_ACCEPTANCE_GATE.md` for pass/fail decision.
7. Use `MODEL_RELEASE_AND_ROLLBACK_RUNBOOK.md` during release.
8. Use `TWO_LAYER_FORECAST_TO_RM_REQUIREMENTS.md` for RM/packing demand flow alignment.
