# Forecast Synthetic-to-Production Execution Plan

Last updated: 2026-04-20

## Objective
Build a defensible end-to-end forecast demo using:
- one real anchor source Excel (`RM ROP and Pallet requirement - SEP.xlsx`),
- realistic synthetic history generation,
- fair model comparison with notebooks,
- deployment of selected primary/fallback models into current MLOps pipeline,
- full WMS runtime inference with BOM-dependent raw/packing demand outputs.

## Anchor Real Data Source

Primary real file (user-provided):
- `/Users/k.e.oshada/Desktop/Mavin sir resources WMS hemas/RM ROP and Pallet requirement - SEP.xlsx`

Fallback copy already used in repo flows:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/Forecast model train data optiwms/RM ROP and Pallet requirement  4- SEP.xlsx`

Rule:
- Treat this real Excel as calibration anchor only (levels/ranges/planning realism), not as full historical demand truth.

## Scope decision (what to forecast)

1. Primary forecast target:
- finished-good product demand (`materials.material_type='product'`) from outbound history.

2. Operational procurement target:
- raw + packing demand derived through BOM explosion from product forecasts.

3. Optional direct raw/packing forecast:
- only for materials with true independent demand signal.

This is the enterprise-standard two-layer setup.

## Phase plan (execute in order)

## Phase 0 - Governance lock (done/keep)
- [x] Runtime contract checks enabled.
- [x] Acceptance gate + production-readiness + soak checks available.
- [x] Champion registry and promotion guards implemented.
- [x] Evidence bundle endpoint implemented.

Exit criteria:
- `/artifacts/acceptance-gate` ready=true
- `/artifacts/production-readiness` ready=true (with soak 24h)

## Phase 1 - Real anchor audit and profiling
- [ ] Profile the real Excel columns, units, SKU identifiers, and planning semantics.
- [ ] Map raw/packing categories to WMS material taxonomy.
- [ ] Produce anchor profile outputs:
  - per-SKU level range
  - month-wise demand shape
  - variability class (stable/seasonal/intermittent)
  - outlier bands

Notebook:
- `Ai miroservices/modeling/notebooks/00a_real_source_active_stock_audit.ipynb`

Deliverable:
- `Ai miroservices/modeling/outputs/reports/anchor_profile_summary.csv`

## Phase 2 - Synthetic history generation (realism constrained)
- [ ] Generate FG demand series with trend/seasonality/regime changes.
- [ ] Constrain synthetic values by Excel anchor ranges and category logic.
- [ ] Inject realistic variability (promo windows, intermittent SKUs, structural shifts).
- [ ] Ensure BOM-driven conversion to RM/packing demand with lead-time shift.
- [ ] Record lineage (`dataset_version`, seed, generation config).

Existing generator:
- `ai-services/forecast-service/scripts/generate_excel_constrained_bom_dependent_history.py`

Reference notebooks:
- `Ai miroservices/modeling/notebooks/00b_fg_rm_foundation_builder.ipynb`
- `Ai miroservices/modeling/notebooks/00c_realistic_fg_rm_generation_v2.ipynb`
- `Ai miroservices/modeling/notebooks/00d_v2_data_eda_and_seasonality.ipynb`

Deliverables:
- synthetic history CSV
- synthetic quality report JSON
- DQ summary CSV

## Phase 3 - WMS runtime population (demo but realistic)
- [ ] Load generated history into `forecast_outbound_history_backfill`.
- [ ] Ensure `orders/order_items/materials/inventory` satisfy runtime readiness.
- [ ] Ensure `materials.material_type='product'` exists for forecasted independent SKUs.
- [ ] Ensure non-zero on-hand coverage for operational recommendation behavior.
- [ ] Load/maintain BOM master mappings for RM/packing components.

Runbook:
- `docs/ai/WMS_FORECAST_DATA_ONBOARDING_RUNBOOK.md`

Exit criteria:
- `/health/runtime-contract` = ok
- `/health/runtime-data-readiness` = ok

## Phase 4 - Fair model bakeoff (same ground)
- [ ] Run strict equal-ground comparison across candidate models.
- [ ] Keep split policy and evaluation windows identical.
- [ ] Compare classical + boosting using same feature policy where applicable.
- [ ] Choose primary + fallback based on acceptance gate metrics, not one metric only.

Primary notebooks:
- `Ai miroservices/modeling/notebooks/04_fair_play_model_comparison.ipynb`
- `Ai miroservices/modeling/notebooks/04c_strict_equal_ground_comparison.ipynb`
- `Ai miroservices/modeling/notebooks/06_fair_refinement_pv2_and_m5_diagnostics.ipynb`

Model training script:
- `Ai miroservices/modeling/scripts/train_and_save_models.py`

Deliverables:
- leaderboard CSV
- by-horizon metrics CSV
- selected champion/fallback rationale note

## Phase 5 - Artifact deployment to inference
- [ ] Save selected model artifacts to artifact root by dataset/model/horizon.
- [ ] Ensure metadata completeness (`model_cols` and feature metadata).
- [ ] Register model in model registry and promote only through gate checks.

Artifact root:
- `Ai miroservices/modeling/outputs/artifacts`

Registry endpoints:
- `/model-registry`
- `/model-registry/promotion-check`
- `/model-registry/promote`

## Phase 6 - Operational validation and evidence
- [ ] Run online forecasts repeatedly to build serving-window evidence.
- [ ] Refresh operational health snapshots.
- [ ] Export release evidence bundle.
- [ ] Validate business plausibility checks (non-negative, quantile order, inventory coherence).

Evidence command:
- `ai-services/forecast-service/scripts/post_load_validation_and_evidence.py`

Deliverable:
- `ai-services/forecast-service/artifacts/evidence/post_load_validation_<timestamp>.json`

## Phase 7 - Demo-ready UI narrative
- [ ] Decision View demonstrates operational outcomes:
  - horizon-based forecast,
  - reorder priorities,
  - inventory recommendation behavior.
- [ ] Model Performance demonstrates quality + reliability:
  - WAPE/MASE/RMSE/Bias,
  - fallback/error rates,
  - readiness and soak status.

## Technical standards (must hold)

- No hardcoded fake metrics in UI.
- No bypass of gate checks for champion promotion.
- Synthetic data generation must be reproducible (`seed`, `dataset_version`, report artifacts).
- BOM-dependent RM calculations must use active/effective BOM logic.
- Every run must be traceable by `run_id`, dataset, model, warehouse scope.

## Immediate implementation commands (current path)

1. Generate BOM-dependent synthetic history (anchor-constrained):
```bash
python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/generate_excel_constrained_bom_dependent_history.py \
  --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --schema public \
  --excel-path "/Users/k.e.oshada/Desktop/Mavin sir resources WMS hemas/RM ROP and Pallet requirement - SEP.xlsx" \
  --months 36 \
  --source-tag excel_bom_dependent_synth \
  --out-csv /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/synthetic_bom_dependent_history.csv
```

2. Build serving-window evidence (online runs):
```bash
for i in {1..20}; do
  curl -sS -X POST "http://localhost:8092/jobs/forecast-run?dataset=B&model_name=CATBOOST&mode=online" >/dev/null
done
```

3. Validate gate/readiness:
```bash
curl "http://localhost:8091/artifacts/acceptance-gate?dataset=B&model_name=CATBOOST&split=test&inference_window=200"
curl "http://localhost:8091/artifacts/production-readiness?dataset=B&model_name=CATBOOST&split=test&inference_window=200&soak_hours=24"
```

4. Export evidence:
```bash
curl "http://localhost:8091/artifacts/release-evidence?dataset=B&model_name=CATBOOST&split=test&inference_window=200&soak_hours=24&history_limit=50"
```

## Remaining production blockers after this plan

- Business-owned final BOM master replacement (from demo mappings to true production master).
- More real historical depth for final DS sign-off.
- Formal planner validation of recommendation plausibility.

