# Forecasting Notebook Execution Order

Use these notebooks in this order.

## Current recommended workflow

1. `00a_real_source_active_stock_audit.ipynb`
   - audits the real Excel source
   - extracts the canonical `Active stock` seed table
   - confirms the real-data limitation before synthetic generation

2. `00e_anchor_excel_profile.ipynb`
   - profiles the real Excel workbook and selected anchor sheet
   - infers SKU/quantity/date columns for downstream generation contracts
   - writes:
     - `outputs/reports/anchor_profile_summary.csv`
     - `outputs/reports/anchor_profile_metadata.json`

3. `00f_synthetic_generation_and_runtime_validation.ipynb`
   - executes anchor-constrained BOM-dependent synthetic history generation into WMS DB
   - uses wider independent tail coverage (`independent_tail_top_n=260`) to improve anchor SKU coverage
   - runs post-load runtime validation and evidence collection
   - writes:
     - `ai-services/forecast-service/artifacts/backfill/synthetic_bom_dependent_history.csv`
     - `ai-services/forecast-service/artifacts/evidence/post_load_validation_<timestamp>.json`
     - `outputs/reports/synthetic_runtime_contract.json`

4. `00h_anchor_synthetic_alignment_check.ipynb`
   - compares anchor Excel levels vs generated synthetic SKU demand levels
   - reports SKU match coverage and alignment error profile
   - writes:
     - `outputs/reports/synthetic_anchor_alignment_summary.csv`
     - `outputs/reports/synthetic_anchor_alignment_metadata.json`
     - `outputs/reports/synthetic_anchor_alignment_details.csv`

5. `00g_promotion_and_release_gate.ipynb`
   - verifies acceptance/readiness gates from service endpoints
   - ensures model registry entry exists for target dataset/model
   - promotes champion only when readiness is true
   - writes:
     - `outputs/reports/promotion_and_release_gate_snapshot.json`

6. `00b_fg_rm_foundation_builder.ipynb`
   - builds RM master, FG master, FG-RM BOM, and lead-time priors from real source
   - outputs foundation CSVs in `outputs/generated`

7. `00c_realistic_fg_rm_generation_v2.ipynb`
   - generates `P_v2/W_v2` with statistical controls and FG→RM lead-lag logic
   - writes realism and lag-validation reports

8. `00d_v2_data_eda_and_seasonality.ipynb`
   - data scientist EDA before modeling
   - validates distributions, trend/seasonality, operational feature behavior, and FG↔RM lag

9. `04_fair_play_model_comparison.ipynb`
   - runs strict fair-play comparison on dataset `P`
   - same split and metric protocol across `ETS`, `ARIMA`, `SARIMA`, `XGBOOST`, `CATBOOST`, `LIGHTGBM`, `RANDOM_FOREST`
   - produces baseline winner table and comparison charts

10. `04c_strict_equal_ground_comparison.ipynb`
   - enforces equal evaluation ground (same horizon-month points for every model)
   - writes strict decision CSV outputs:
     - `portable_fair_play_strict_overall.csv`
     - `portable_fair_play_strict_by_horizon.csv`
     - `portable_fair_play_strict_decision.csv`

11. `06_fair_refinement_pv2_and_m5_diagnostics.ipynb`
   - equal-budget refinement for ML models on `PV2`
   - unseen transfer comparison on M5 (raw vs auto-capped)
   - diagnostics: bias/variance proxies, horizon degradation, generalization gap matrix

12. `02_global_model_training_and_artifact_save.ipynb`
   - trains and stores selected global model artifacts on dataset `P`
   - use this after fair-play winner confirmation

13. `05b_global_model_transfer_only.ipynb`
   - runs saved-artifact transfer on M5 monthly aggregates
   - current default path is `P + XGBOOST + recent_level_blend`
   - this is the main external-transfer validation notebook

## Publish to microservice (required for Trigger Run)

After you produce report files from training/evaluation, publish the exact CSV names used by `forecast-service`:

```bash
cd "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts"
python publish_reports_for_service.py --tag portable_fair_play_p --dataset P --model XGBOOST
```

This writes:
- `outputs/reports/dashboard_forecast_output.csv`
- `outputs/reports/dashboard_inventory_recommendations.csv`
- `outputs/reports/test_metrics_by_horizon.csv`

Then restart AI services and use **Run Forecast** from UI.

## Secondary / diagnostic notebooks

14. `00_dataset_audit_and_cleaning.ipynb`
   - audits the older `A`, `B`, `C` synthetic datasets
   - still useful for comparison against the older workflow

15. `01_split_protocol_validation.ipynb`
   - confirms train / validation / test split logic
   - checks leakage assumptions

16. `03_model_bias_overfit_analysis.ipynb`
   - inspects bias and horizon degradation on the training workflow outputs
   - use this after a completed training run

17. `05_m5_submission_inference.ipynb`
   - keep this separate from transfer evaluation
   - it is not the main proof notebook for the current portable workflow

## Dataset interpretation

- Dataset `P`: portable synthetic dataset anchored to the real `Active stock` sheet
- Dataset `W`: WMS-style synthetic dataset with operational features
- Dataset `A`: older baseline synthetic benchmark
- Dataset `B`: older augmented synthetic benchmark
- Dataset `C`: older stress / robustness scenario dataset

Use `P` for transfer evaluation.
Use `W` later for internal OptiWMS operational modeling.

## Legacy notebooks

Older exploratory notebooks were moved into `notebooks/legacy/`.
They are kept for reference, but they are not the main execution path anymore.
