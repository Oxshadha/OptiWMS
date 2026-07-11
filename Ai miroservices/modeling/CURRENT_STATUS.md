# OptiWMS Forecast - Current Status

> Last updated: 2026-07-11
> Scope: forecast modeling, Spring/WMS runtime alignment, Forecasts dashboard, inventory policy, and slotting planning evidence.

## Executive Status

The forecast runtime has moved from the older v6 FG/bootstrap path toward a v7 RM/PM planning path.

Current truth:

- `forecast_results` in Spring/WMS PostgreSQL is now the canonical operational forecast table.
- v7 generated and published RM/PM forecast rows with model id `V7_RM_PM_DIRECT`.
- The Forecasts dashboard can now read canonical rows through Spring `/api/ai/*` endpoints when those rows exist.
- The notebook/evidence layer has been rebuilt as a 13-notebook v7 statistical evidence sequence using the v6 academic notebook style and the forecasting-paper methodology.

Important caveat:

- Current v7 LightGBM is a candidate RM/PM model, not a model that should be called production-grade without caveat.
- Current backtest result is useful but not excellent: WAPE `25.09%`, MAE `433.24`, RMSE `2421.59`, bias `1.58%`, under-forecast rate `50.64%`.
- This is better than the simple baselines currently tested, but the margin is not enough to hide limitations. The correct evaluator story is honest: direct RM/PM forecasting is now the right architecture, but statistical evidence still needs strengthening.
- The current `demand_history` rows are labelled `canonical_v6`, but their loader identifies the dataset as `HEMAS_SYNTHETIC_WMS_V6`. They are simulated operational history, not verified real material-issue transactions.
- A corrected offline experiment now exists. It fixes target/feature alignment and produces a better scale-normalized candidate, but it has not been published or promoted.

## What Is Wired To The Application

### Spring/WMS API

Implemented runtime alignment:

- `backend/core-api/src/main/java/com/optiwms/coreapi/ai/ForecastResultReadService.java`
  - Reads latest rows from `forecast_results`.
  - Uses canonical dataset `RM_PM`.
  - Prefers canonical model id `V7_RM_PM_DIRECT` when rows exist.
  - Returns dashboard-compatible forecast rows with `p10`, `p50`, `p90`, `horizon`, `month`, `sku`, `category`, `warehouse_id`, and optional `y_true`.

- `backend/core-api/src/main/java/com/optiwms/coreapi/ai/AiProxyController.java`
  - `/api/ai/forecasts` checks Spring `forecast_results` first, then falls back to the Python forecast-service path.
  - `/api/ai/forecast-dashboard-summary` checks Spring `forecast_results` first, then falls back.
  - `/api/ai/gateway/models` returns Spring canonical model metadata when canonical rows exist.

This is the correct enterprise direction: Spring/PostgreSQL is the business source of truth; Python remains useful for model training, inference, governance, and publish jobs.

### Python Forecast Service

Current role:

- Still exists and still serves older ML-service endpoints.
- Should not be treated as the business source of truth for planning.
- Its SQLite `forecast_predictions` table should be considered an optional local/demo cache, not the operational planning database.

Current helper:

- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/pipeline/sync_forecast_service.py`
  - Exists as a temporary bridge if a local demo requires syncing v7 CSV output into forecast-service SQLite.
  - This should not be the long-term enterprise path.

### v7 Modeling Pipeline

Current location:

- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/`

Current source tables:

- `materials`
- `inventory`
- `demand_history`
- `forecast_results`
- `bom_headers`
- `bom_components`

Current output facts from v7 artifacts:

- RM/PM demand rows: `10,368`
- RM/PM demand materials: `288`
- Demand window: `2023-02-01` to `2026-01-01`
- BOM headers/components: `3` headers, `2` component rows
- BOM parent-product coverage: `0.0%`
- Forecast rows generated: `3,456`
- Policy recommendation rows: `288`
- Slotting readiness rows: `288`
- Published Spring rows: `3,456` under model id `V7_RM_PM_DIRECT`

Current model leaderboard:

| Model | WAPE | MAE | RMSE | Bias | Under-forecast rate |
|---|---:|---:|---:|---:|---:|
| LightGBM global RM/PM | 25.09% | 433.24 | 2421.59 | 1.58% | 50.64% |
| Croston/SBA | 25.84% | 446.17 | 2401.37 | 3.11% | 43.46% |
| Moving average 6 | 28.29% | 488.43 | 2752.24 | 8.23% | 39.53% |
| Moving average 3 | 28.98% | 500.50 | 2724.77 | 6.53% | 40.05% |
| Seasonal naive | 34.82% | 601.35 | 3386.66 | 7.53% | 37.44% |

Model interpretation:

- LightGBM is currently the best WAPE model among the tested candidates.
- Croston/SBA has similar RMSE and a lower under-forecast rate, so it must remain visible as a serious baseline for intermittent demand.
- The system should not claim LightGBM is statistically sufficient without caveat. The rebuilt notebooks now expose residual behavior, rolling-origin stability, interval calibration, and per-material error distribution for review.

### Corrected Offline Experiment

Locations:

- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/13_Corrected_High_Volume_LightGBM_Experiment.ipynb`
- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/pipeline/corrected_experiment.py`
- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/pipeline/run_corrected_experiment.py`
- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/outputs/corrected_experiment/`

Defect corrected:

- Previous training rows used a `t+1` target while lag/rolling features were indexed and shifted differently from future inference.
- The corrected contract defines target month `t` using demand observed only through `t-1`; future inference follows the same rule.

Experiment design:

- Six expanding-window, one-step-ahead forecast origins.
- `288` materials and `1,728` held-out material-month rows per candidate.
- Compared aligned log-L2, log-Huber, raw-L1, Tweedie, Poisson, volume-weighted log-L2, and material-scale-normalized variants.
- No forecasts were published by this experiment.

| Model | WAPE | MAE | RMSE | Bias | Under-forecast rate |
|---|---:|---:|---:|---:|---:|
| Scale-normalized LightGBM (`lgb_ratio_log_l2`) | 24.17% | 417.41 | 2331.47 | 3.63% | 45.60% |
| Previous v7 LightGBM evaluation | 25.09% | 433.24 | 2421.59 | 1.58% | 50.64% |

High-volume evidence:

- Highest-demand quintile WAPE: `22.96%`.
- Highest-demand quintile MAE: `1,891.63` units.
- Highest-demand quintile RMSE: `5,194.35` units.
- Extreme observations still dominate business risk even though relative WAPE improved.

Feature evidence:

- Previous gain importance assigned `86.73%` to `roll_mean_12`.
- Corrected gain importance is less concentrated: `roll_std_6` is largest at `43.56%`, while `roll_mean_12` falls to `2.61%`.
- Held-out permutation importance is also generated because correlated lag/rolling inputs can distort gain rankings.

Statistical interpretation:

- Scale normalization improved more than raw volume weighting or objective changes alone.
- The corrected champion significantly reduced paired absolute error versus ordinary aligned log-L2, raw-L1, Tweedie, Poisson, and weighted candidates in this simulated backtest.
- Its advantage over scale-normalized L1 is not statistically conclusive (`p = 0.2173`).
- Production validity is still unproven because the history is simulated and lacks real production-plan, validated BOM, issue, backorder, and shutdown signals.

## v8 Controlled Synthetic Validation Harness

Location:

- `Ai miroservices/modeling/v8_controlled_synthetic_validation/`

Purpose:

- Test the complete forecasting method against a known causal data-generating process.
- Determine whether the pipeline can recover production-plan and BOM signals when they are complete.
- Compare direct-history forecasting with deterministic BOM explosion and causal ML.
- The v8 outputs are now also loaded as the explicit project-operational seed dataset. This is for integrated WMS demonstration, not a claim of external production history.

Controlled dataset:

- Seed: `20260711`
- History: `72` monthly periods
- Finished goods: `24`
- Raw materials: `90`
- Packaging materials: `30`
- Effective BOM component rows: `211`
- Controlled FG-parent coverage: `100%`
- Controlled material-component coverage: `100%`; every generated RM/PM material appears in at least one BOM.
- Material policies include MOQ, order multiple, lead time, service level and unit cost.
- Demand generation includes trend, seasonality, promotions, holidays, structural shifts, production-plan error, yield, scrap, heteroscedastic noise and discrete shocks.
- Every row is labelled `CONTROLLED_SYNTHETIC_GROUND_TRUTH`; none is represented as real Hemas history.

Leakage-safe protocol:

- Target month `t` uses observed demand only through `t-1`.
- Known production-plan/BOM requirement for `t` is available only to causal candidates.
- Six rolling months are used for LightGBM hyperparameter tuning.
- A different six rolling months lock the champion.
- The final twelve rolling origins are untouched until final scoring.
- All candidates are compared on the same `1,440` material-month test rows.

Candidate families:

- Seasonal naive, moving average, Croston/SBA and damped Holt/ETS.
- Deterministic production-plan BOM explosion.
- Ridge and Elastic Net.
- Random Forest and Extra Trees.
- Direct scale-normalized LightGBM.
- Causal scale-normalized LightGBM.
- Causal Tweedie LightGBM.

Locked champion and untouched test:

| Model | WAPE | MAE | RMSE | Bias | Shock WAPE |
|---|---:|---:|---:|---:|---:|
| Random Forest causal | 8.24% | 728.08 | 1368.54 | 0.69% | 8.07% |
| Extra Trees causal (locked champion) | 8.34% | 736.76 | 1408.46 | -0.15% | 8.57% |
| BOM plan | 8.51% | 752.43 | 1347.60 | 1.84% | 8.31% |
| LightGBM causal Tweedie | 8.63% | 762.45 | 1533.57 | -0.67% | 8.74% |
| LightGBM causal ratio | 9.23% | 815.41 | 1547.04 | 0.15% | 8.85% |
| LightGBM direct ratio | 10.33% | 912.84 | 1667.26 | 0.09% | 9.86% |
| Holt damped | 10.67% | 943.24 | 1803.29 | -1.17% | 10.46% |

Statistical comparison:

- Extra Trees was locked from the selection window; Random Forest scored slightly lower WAPE on the untouched test, but the difference is not significant (`paired t p = 0.3918`; monthly DM-style `p = 0.6607`).
- Extra Trees versus BOM plan: no significant mean-error difference (`paired t p = 0.3634`; monthly DM-style `p = 0.6358`).
- Extra Trees versus causal Tweedie LightGBM: no significant difference (`paired t p = 0.1479`; monthly DM-style `p = 0.3580`).
- Extra Trees versus direct LightGBM: Extra Trees is better (`paired t p < 0.0001`; monthly DM-style `p < 0.0001`).
- Extra Trees versus causal ratio LightGBM: Extra Trees is better (`paired t p < 0.0001`; monthly DM-style `p = 0.0002`).
- The DM-style test has only twelve aggregate monthly loss differences and is explicitly treated as low-power evidence.

Residual and uncertainty evidence:

- Jarque-Bera rejects Gaussian residuals (`p < 0.001`).
- Breusch-Pagan rejects constant variance (`p < 0.001`).
- Absolute residual magnitude rises with fitted scale (`Spearman rho = 0.732`, `p < 0.001`).
- Monthly mean residual autocorrelation is not detected by the tested Ljung-Box lag (`p = 0.334`).
- Split-conformal nominal 90% interval coverage is `92.08%` on the untouched test rows.

Interpretation:

- The pipeline can recover a known RM/PM causal process and correctly benefits from production-plan/BOM inputs.
- The result supports the architecture and experimental implementation.
- It does not prove that every v7 error is exclusively a data problem.
- It does not prove production accuracy because the generated BOM, production and demand rows are synthetic controls.
- Real material issues, production orders and validated effective-dated BOMs must pass the same protocol before operational promotion.

Generated notebooks:

1. `00_Controlled_Data_Generation.ipynb`
2. `01_Controlled_Demand_EDA.ipynb`
3. `02_Features_Models_And_Tuning.ipynb`
4. `03_Untouched_Test_And_Hypothesis_Tests.ipynb`
5. `04_Residuals_Intervals_And_Policy.ipynb`
6. `05_Statistical_Conclusion.ipynb`
7. `06_Final_Enterprise_Model_Decision_And_E2E.ipynb`

Final deployment artifacts:

- `outputs/model_card.json`
- `outputs/integration_contract.json`
- `outputs/deployment_decision.json`

Final deployment decision:

- `V8_CONTROLLED_EXTRA_TREES_CAUSAL` is approved for offline validation, simulation UI work, inventory-policy integration tests, and MILP/knapsack sandbox runs.
- It is not registered in the Python forecast-service and is intentionally blocked from the production Recalculate Forecast action.
- It is not eligible for Spring canonical publication, automatic min/max application, purchase-order creation, or approved slotting moves.
- The blocker is not API plumbing. The blocker is that its material identities, BOMs, production plans and history are generated (`synthetic_ratio = 1.0`).
- Production promotion requires substituting real operational data into the same feature contract, retraining, nested rolling validation, calibrated intervals, shadow-mode planning validation and explicit approval.

Forecasts frontend wording corrected:

- Stock projection is now labelled as an inventory-policy simulation rather than observed future stock.
- Model KPI cards no longer claim old M5/static metrics as current evidence.
- Residual guidance no longer assumes Gaussian noise.
- Threshold scorecards now say `Threshold pass` or `Review required`, not `Deployed`.

## Dashboard Status

### Working

- Forecasts page can call:
  - `/api/ai/gateway/models`
  - `/api/ai/forecasts`
  - `/api/ai/forecast-dashboard-summary`
  - `/api/ai/forecast-metrics`
  - `/api/ai/inventory-recommendations`
  - `/api/ai/raw-material-requirements`

- Canonical forecast rows can now appear in the dashboard through Spring instead of requiring manual SQLite sync.
- Forecast chart data can render from forward forecast rows with `p10`, `p50`, and `p90`.
- The page no longer has to be empty when `forecast_results` has canonical v7 rows.

### Frontend Gaps

The dashboard still mixes real v7 runtime data with incomplete evidence surfaces.

Known gaps:

- Model display name is still too technical in places (`V7_RM_PM_DIRECT`). User-facing label should be `LightGBM RM/PM Global Forecast`; technical id can stay in metadata.
- `/api/ai/forecast-metrics` still comes from the older forecast-service path, not from v7 backtest artifacts.
- Dashboard summary from `forecast_results` returns forecast rows but not v7 backtest metrics.
- Inventory recommendation and raw-material-requirement calls still route through the existing service path, not fully through the v7 `forecast_results` planning source.
- Some dashboard panels imply statistical validation but do not yet have the required v7 backtest data behind them.
- `y_true` is normally null for forward published forecast rows, so actual-vs-forecast and residual charts cannot be honestly produced from live forecast rows alone.

## Chart And Evidence Gaps

Current chart issues:

- Residual chart is mostly empty because forward forecast rows do not include actuals.
- Error distribution chart is empty for the same reason.
- Seasonality radar/index can be empty because the online dashboard reads H+1 forecast labels, not full historical monthly actuals.
- Green dot scatter chart is visually noisy and not statistically meaningful enough yet; it needs class labels, sample counts, and a clearer interpretation.
- Forecast accuracy card can show a metric, but the current source must be labeled as v7 rolling backtest/static artifact, not live forward actuals.
- Stock projection and days-of-cover charts are planning simulations, not measured future truth. They must be labeled as policy simulation based on forecast demand, on-hand stock, reorder point, and replenishment assumptions.
- Current confidence interval display is forecast interval output, but coverage cannot be claimed unless backtest rows with actuals are joined and evaluated.

Required chart fixes:

- Add a v7 evidence endpoint or static artifact loader for:
  - model leaderboard
  - per-material metrics
  - residual rows
  - interval calibration
  - backtest actual-vs-predicted rows
  - feature importance
  - data-quality summary

- Update dashboard panels so each chart states its evidence source:
  - `forward forecast`
  - `rolling backtest`
  - `inventory policy simulation`
  - `not available yet`

- Remove or hide charts that cannot be supported by current data.

## Notebook Status

### Previous v7 Problem

The earlier v7 notebooks were too shallow for a data-science/statistics evaluation.

Problems:

- Not enough dataset inspection.
- Not enough data-column and schema explanation.
- Not enough relationship mapping across materials, inventory, demand history, forecast results, and BOM.
- EDA is too light.
- Residual diagnostics are incomplete.
- Model evaluation is not presented with enough statistical rigor.
- Charting is mostly summary-level and does not match the richer v6 academic notebook flow.

### Implemented v7 Rebuild

The v7 notebooks have been rebuilt using v6 as the style/template source and the forecasting paper as the methodology guide.

Required notebook sequence:

1. `00_Methodology_And_Paper_Map.ipynb`
2. `01_Data_Lineage_Schema_And_Relationships.ipynb`
3. `02_Data_Quality_Profiling.ipynb`
4. `03_RM_PM_Demand_EDA.ipynb`
5. `04_Preprocessing_And_Feature_Engineering.ipynb`
6. `05_Baseline_And_Intermittent_Models.ipynb`
7. `06_LightGBM_Global_RM_PM_Model.ipynb`
8. `07_Rolling_Backtest_And_Model_Selection.ipynb`
9. `08_Residual_Diagnostics_And_Error_Analysis.ipynb`
10. `09_Prediction_Intervals_And_Calibration.ipynb`
11. `10_Forecast_To_Inventory_Policy.ipynb`
12. `11_Forecast_To_Slotting_And_Space.ipynb`
13. `12_Limitations_And_Executive_Evidence.ipynb`
14. `13_Corrected_High_Volume_LightGBM_Experiment.ipynb` (offline experiment; not published)

Required methods/evidence:

- data dictionary and schema map
- missing/duplicate/negative/zero checks
- demand distribution and concentration
- intermittent demand classification
- ABC/FMS/XYZ classification
- outlier detection and treatment policy
- seasonality/trend/decomposition where history supports it
- lag and rolling feature validation
- leakage gates
- rolling-origin backtest
- LightGBM vs statistical/intermittent baselines
- WAPE, MAE, RMSE, bias, under-forecast rate
- per-material and aggregate metrics
- residual histogram/KDE
- Q-Q plot
- residual vs fitted
- residual over time
- residual autocorrelation checks where meaningful
- interval coverage and calibration
- model limitations and deployment caveats

Implemented evidence artifacts:

- `data_dictionary.csv`
- `table_relationships.csv`
- `data_quality_report.csv`
- `outlier_report.csv`
- `feature_matrix_profile.csv`
- `feature_matrix_sample.csv`
- `rolling_origin_splits.csv`
- `backtest_residuals.csv`
- `selected_model_backtest_rows.csv`
- `per_material_metrics.csv`
- `interval_calibration.csv`
- `statistical_comparison.csv`
- `model_feature_importance.csv`

Implemented plots:

- `data_quality_missingness.png`
- `top_demand_materials.png`
- `abc_fms_heatmap.png`
- `seasonality_index.png`
- `model_wape_leaderboard.png`
- `selected_model_residual_diagnostics.png`
- `selected_model_actual_vs_predicted.png`
- `lightgbm_feature_importance.png`

Validation completed:

- v7 pipeline regenerated outputs from local PostgreSQL.
- v7 publish path upserted `3,456` `V7_RM_PM_DIRECT` rows into Spring/WMS `forecast_results`.
- Database verification returned `288` materials from `2026-02-01` to `2027-01-01`.
- All original 13 generated notebook code cells passed `ast.parse`.
- All original 13 generated notebooks passed a plain-Python execution smoke against the generated artifacts.
- The separate corrected experiment generated its leaderboard, demand-band metrics, paired tests, gain/permutation importance, residual plots, and high-volume comparison plots.

## What To Do Next

Priority order:

1. Obtain real RM/PM material-issue history with explicit lineage and rerun the corrected experiment before promotion.
2. Add production-plan, BOM, backorder, and shutdown features only where they are known at forecast creation time.
3. Calibrate prediction intervals and evaluate inventory service/cost outcomes for the corrected candidate.
4. Add v7 backtest/evidence artifacts to a Spring endpoint or static artifact route that the dashboard can read without pretending forward forecasts contain actuals.
5. Update the Forecasts dashboard labels:
   - show `LightGBM RM/PM Global Forecast` to users
   - keep `V7_RM_PM_DIRECT` only as technical lineage
   - label each chart by source and confidence level
6. Add or route a Spring endpoint for v7 evaluation evidence from artifacts or persisted evaluation tables.
7. Wire inventory policy and slotting planning to the same canonical `forecast_results` rows and expose provenance in the UI.
8. Keep BOM explosion as a secondary/demo path until BOM coverage is complete and validated.

## Safe Evaluator Statement

Use this wording:

> v6 proved a forecasting development path but was FG/bootstrap-oriented. v7 moves the operational planning layer to direct RM/PM demand forecasting from WMS PostgreSQL demand history. The current LightGBM global model is the best tested candidate by WAPE, but not a final production claim without caveat. We compare it against intermittent-demand and naive baselines, and the next evidence step is richer rolling-origin residual diagnostics, interval calibration, and per-material error analysis. BOM explosion is not claimed as production-ready because current BOM coverage is too low.

Updated wording after the corrected experiment:

> The corrected scale-normalized LightGBM candidate achieved 24.17% WAPE in a six-origin backtest, improving on the earlier 25.09% result while reducing feature-gain concentration. This remains offline evidence on Hemas-calibrated simulated history. It is not promoted until the same protocol is passed on real RM/PM issue history with calibrated intervals and planning-outcome validation.

Do not say:

- "The M5 model forecasts raw materials."
- "The dashboard residual charts prove production accuracy."
- "The LightGBM model is production-grade because it has 25.09% WAPE."
- "BOM explosion is complete."
- "The SQLite forecast-service table is the operational source of truth."

## 2026-07-11 Project-Operational Runtime Alignment

### Decision

The project has no externally supplied operational history. The controlled v8 dataset is therefore the coherent **project-operational simulation seed** for end-to-end demonstration. It is not renamed or presented as real customer history.

- Dataset: `PROJECT_OPERATIONAL_SIMULATION_V8`
- Quality tier: `PROJECT_OPERATIONAL_SIMULATION`
- Canonical planning dataset: `PROJECT_OPS_RM_PM`
- Canonical planning model: `PROJECT_OPS_EXTRA_TREES_CAUSAL`
- Training/evaluation source: `v8_controlled_synthetic_validation`
- Dataset hash: `bca1737627c9930c3c83df730c4a58a62ca869b9ab3debb08146e6a31ba92a13`

### Loaded PostgreSQL Scope

- 144 materials: 90 raw materials, 30 packaging materials, 24 finished goods.
- 12 project suppliers and 120 supplier-material relationships.
- 24 active BOM headers and 211 BOM components, with controlled coverage of all generated FGs and RM/PM components.
- 8,640 monthly demand-history rows across 72 months.
- 120 inventory policy rows with MOQ, lead time, min/max, ROP and safety stock.
- 1,440 twelve-month direct RM/PM forecast rows.
- 120 ABC/FMS issue-stat rollups used by slotting and demand-space planning.
- Two persisted evaluation rows: locked selection and untouched test.

### Evidence And Decision Gate

Database migration `V71` adds data quality/provenance and `decision_eligible` fields. Migration `V72` persists aggregate evaluation evidence.

- The local database schema was prepared with the idempotent migration SQL before the backend container start. `flyway_schema_history` will record `V71` and `V72` on the next successful Spring boot; do not manually insert Flyway history rows.

- Old v6/v7/bootstrap forecast rows remain in the database for traceability but have `decision_eligible = false`.
- The Spring forecast repository filters operational policy and slotting reads to `decision_eligible = true`.
- The Forecasts API serves canonical forecast rows, test metrics, inventory recommendations and direct RM/PM requirements from Spring/PostgreSQL. Python SQLite is no longer the operational source for these views.
- The dashboard displays a human-readable method name, not the internal model id.

Untouched-test evidence for the locked Extra Trees causal candidate:

| Metric | Result |
|---|---:|
| WAPE | 8.34% |
| MAE | 736.76 |
| RMSE | 1,408.46 |
| Bias | -0.15% |
| Under-forecast rate | 48.26% |
| Empirical 90% interval coverage | 92.08% |

### Verified In This Workspace

- The idempotent loader `scripts/load_project_operational_simulation.py` completed successfully against PostgreSQL.
- PostgreSQL validation returned: 144 materials, 120 inventory rows, 24 BOM headers, 211 BOM components, 8,640 demand rows, 1,440 eligible forecast rows, 120 supplier links and 120 issue-stat rollups.
- `./gradlew :core-api:compileJava :core-app:compileJava :infra:compileJava` passed after canonical-source changes.

### Remaining Before A Production Claim

- Obtain externally observed issue, inventory, supplier, BOM and production-plan data; rerun the protocol without changing the locked test design.
- Persist actuals after forecast publication to produce live residual, calibration and service-level monitoring.
- Run the full Docker browser/API smoke after the backend/frontend/AI containers are started. This workspace session verified the Docker database container, database load and local compilation; the backend image build was started but could not be completed because the execution environment stopped allowing further Docker build usage.
- A Recalculate action must be wired to a trained model refresh/publish job before it can truthfully regenerate project forecast rows. It must not pretend that a static seed reload is model inference.
