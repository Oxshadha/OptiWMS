# Forecast MLOps + Data Science Master Plan (Enterprise)

Last updated: 2026-04-18
Owner: OptiWMS AI/Forecast stack

## Decision
This plan is accepted with one hard rule:
- Primary forecasting target must be **independent demand** (finished goods / decoupling point).
- Raw and packing material demand must be computed as **dependent demand** via BOM explosion and lead-time shift.

Do not use raw-material-only direct forecasting as the primary enterprise design unless those items have true independent demand.

## Target Operating Model
1. Runtime truth comes from WMS DB (`orders`, `order_items`, `materials`, `inventory`).
2. Forecast service runs two-layer flow:
   - Layer 1: forecast FG demand by horizon.
   - Layer 2: explode FG demand through BOM to RM/pack requirements.
3. Online forecast runs generate operational recommendations for planners/managers.
4. MLOps gates control promotion and release.

## Phase Plan

### Phase 0 - Data Contract and Runtime Reliability
- [x] Freeze canonical runtime schema contract for WMS tables and semantics.
- [x] Enforce contract checks in CI/local smoke (`runtime-contract`, `runtime-data-readiness`).
- [x] Ensure product inventory has realistic non-zero on-hand coverage.
- [ ] Ensure outbound line history coverage is sufficient for all target SKUs.

Exit gate:
- Runtime contract `ok`
- Runtime readiness `ok`
- Online run publishes with non-empty forecast + inventory outputs

### Phase 1 - Historical Backbone and Data Quality
- [x] Build deterministic historical loader (idempotent reruns).
- [ ] Backfill at least 24-36 months daily/weekly history for FG demand.
- [ ] Store current snapshot state from real company workbook as present-state anchor.
- [x] Add DQ suite:
  - missingness
  - duplicates
  - negative/invalid quantities
  - SKU remap integrity
  - warehouse coverage
- [x] Publish DQ report artifact per load.

Exit gate:
- DQ pass rate meets threshold
- [x] Backfill version stamped (`dataset_version`)
- [x] Lineage artifact generated

### Phase 2 - Synthetic Augmentation (Controlled)
- [ ] Use synthetic generation only to fill real-data gaps; never replace real signal entirely.
- [ ] Add realistic seasonality/promo/regime changes aligned to Sri Lanka context.
- [ ] Enforce temporal logic: RM demand should precede FG demand by lead-time windows.
- [ ] Validate synthetic-vs-real distribution drift (KS/quantile checks).

Exit gate:
- Synthetic distribution checks pass
- No leakage from future periods
- Documented assumptions for evaluator review

### Phase 3 - Feature Pipeline and Fair Model Benchmark
- [ ] Single canonical feature pipeline (lags, rolls, calendar, optional exogenous).
- [ ] Fair benchmark on identical splits/protocol:
  - CATBOOST
  - XGBOOST
  - Classical fallback candidates
- [ ] Store full metrics and per-horizon diagnostics.
- [ ] Choose champion by business gate, not one metric.

Exit gate:
- Acceptance gate `ready=true` for champion candidate
- Fallback metrics and fallback usage tracked separately

### Phase 4 - Promotion, Serving, and Drift Ops
- [ ] Promote only through registry gate enforcement.
- [ ] Configure scheduled drift/freshness checks and alert routes.
- [ ] Configure degradation policy (`warn`/`critical`) and operational behavior.
- [ ] Add retrain/recalibration triggers from drift + freshness + KPI decay.

Exit gate:
- Production readiness `ready=true`
- Soak window passes with no critical incidents

### Phase 5 - Continuous Improvement Loop
- [ ] Capture post-deployment forecast vs actual feedback continuously.
- [ ] Periodic retraining and model replacement using same plug-in contract.
- [ ] Maintain rollback-ready prior champion model.

Exit gate:
- Stable release cadence and reproducible rollback proof

## Plug-and-Play Principle
System must support:
- Replacing dataset versions without code rewrites.
- Replacing primary/fallback model artifacts without UI/backend contract breaks.
- Re-running full pipeline from contract validation to promotion.

## Immediate Next Execution Order
1. Complete Phase 0 contract closure.
2. Build historical loader + DQ report (Phase 1).
3. Add controlled synthetic augmentation with validation (Phase 2).
4. Run fair benchmark and gate-driven promotion (Phase 3-4).
