# OptiWMS Forecast Docs Index

Last updated: 2026-04-19

Use this folder as the single forecast documentation set.

## Primary tracker
- `FORECAST_EXECUTION_CHECKLIST.md`
  - Single source of truth for implementation status and remaining production blockers.

## Planning and architecture intent
- `FORECAST_MLOPS_AND_DATA_SCIENCE_MASTER_PLAN.md`
  - End-to-end enterprise plan for DS + MLOps lifecycle.
- `TWO_LAYER_FORECAST_TO_RM_REQUIREMENTS.md`
  - Two-layer logic: forecast independent demand, then explode to RM/packing via BOM.
- `FORECAST_DATA_REQUIREMENTS_AND_SYNTHETIC_GENERATION_STANDARD.md`
  - Canonical requirements for real-data requests, synthetic-data generation standards, required columns, and BOM/data-model architecture.

## Operational runbooks
- `WMS_FORECAST_DATA_ONBOARDING_RUNBOOK.md`
  - Data contract, model plug contract, onboarding commands, readiness checks, and promotion prerequisites.
- `MODEL_RELEASE_AND_ROLLBACK_RUNBOOK.md`
  - Controlled release/promotion/rollback procedure.

## Gate definition
- `INDUSTRY_SUBMISSION_ACCEPTANCE_GATE.md`
  - Formal go/no-go quality and serving thresholds.

## Recommended usage order
1. Read `FORECAST_EXECUTION_CHECKLIST.md` (what is done vs pending).
2. Use `WMS_FORECAST_DATA_ONBOARDING_RUNBOOK.md` to onboard data and run validations.
3. Use `FORECAST_MLOPS_AND_DATA_SCIENCE_MASTER_PLAN.md` for DS/model improvement roadmap.
4. Use `INDUSTRY_SUBMISSION_ACCEPTANCE_GATE.md` for pass/fail decision.
5. Use `MODEL_RELEASE_AND_ROLLBACK_RUNBOOK.md` during release.
6. Use `TWO_LAYER_FORECAST_TO_RM_REQUIREMENTS.md` for RM/packing demand flow alignment.
