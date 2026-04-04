# Forecasting Notebook Execution Order

Use these notebooks in this order.

## Current recommended workflow

1. `00a_real_source_active_stock_audit.ipynb`
   - audits the real Excel source
   - extracts the canonical `Active stock` seed table
   - confirms the real-data limitation before synthetic generation

2. `00b_fg_rm_foundation_builder.ipynb`
   - builds RM master, FG master, FG-RM BOM, and lead-time priors from real source
   - outputs foundation CSVs in `outputs/generated`

3. `00c_realistic_fg_rm_generation_v2.ipynb`
   - generates `P_v2/W_v2` with statistical controls and FG→RM lead-lag logic
   - writes realism and lag-validation reports

4. `00d_v2_data_eda_and_seasonality.ipynb`
   - data scientist EDA before modeling
   - validates distributions, trend/seasonality, operational feature behavior, and FG↔RM lag

5. `04_fair_play_model_comparison.ipynb`
   - runs strict fair-play comparison on dataset `P`
   - same split and metric protocol across `ETS`, `ARIMA`, `SARIMA`, `XGBOOST`, `CATBOOST`, `LIGHTGBM`, `RANDOM_FOREST`
   - produces baseline winner table and comparison charts

6. `04c_strict_equal_ground_comparison.ipynb`
   - enforces equal evaluation ground (same horizon-month points for every model)
   - writes strict decision CSV outputs:
     - `portable_fair_play_strict_overall.csv`
     - `portable_fair_play_strict_by_horizon.csv`
     - `portable_fair_play_strict_decision.csv`

7. `06_fair_refinement_pv2_and_m5_diagnostics.ipynb`
   - equal-budget refinement for ML models on `PV2`
   - unseen transfer comparison on M5 (raw vs auto-capped)
   - diagnostics: bias/variance proxies, horizon degradation, generalization gap matrix

8. `02_global_model_training_and_artifact_save.ipynb`
   - trains and stores selected global model artifacts on dataset `P`
   - use this after fair-play winner confirmation

9. `05b_global_model_transfer_only.ipynb`
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

10. `00_dataset_audit_and_cleaning.ipynb`
   - audits the older `A`, `B`, `C` synthetic datasets
   - still useful for comparison against the older workflow

11. `01_split_protocol_validation.ipynb`
   - confirms train / validation / test split logic
   - checks leakage assumptions

12. `03_model_bias_overfit_analysis.ipynb`
   - inspects bias and horizon degradation on the training workflow outputs
   - use this after a completed training run

13. `05_m5_submission_inference.ipynb`
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
