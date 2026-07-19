# OptiWMS Forecast - Current Status

> Last updated: 2026-07-19
> Scope: generated operational baseline, forecast evidence, inventory policy, warehouse geometry, ABC/FMS, multi-bin slotting, runtime alignment, and frontend evidence.

## Executive Status

The current operational baseline supersedes the earlier v6/v7 demo paths described later in this historical log. Repository implementation and the running Docker state are reported separately below.

- PostgreSQL is the business authority for forecasts, policy, slotting, transfers, and evidence. Python SQLite is not an operational source.
- `PROJECT_OPERATIONAL_BASELINE_V3` is the deterministic generated warehouse baseline, seed `20260715`, current artifact hash `ba12a1d46e221a5feefa890e10976ef0df76493dab75e1de7eeffd327b38aa22`.
- The selected champion method is **Extra Trees Responsive**, chosen over LightGBM and statistical baselines using `WAPE + 0.5 * |bias|` on expanding-window selection origins and an untouched final 12-month test; promotion remains manager-controlled.
- Current untouched-test evidence is WAPE `12.76%`, MAE `128.81`, RMSE `488.24`, bias `-1.74%`, under-forecast rate `48.44%`, empirical 90% interval coverage `89.15%`, and critical-class WAPE `11.39%`.
- The forward artifact contains `1,152` H1-H12 rows for all `96` FG/RM/PM SKUs. Spring/PostgreSQL remains the canonical publication target.
- Inventory policy is a forecast-informed stochastic `(s,S)` workflow with simulation and manager approval. Slotting is `ORTOOLS_MILP_FLOW_V3`: MILP for pick-face/move decisions plus integer min-cost flow for complete multi-bin reserve allocation. It is not relabelled as a separate knapsack algorithm.
- The current project proves reproducible system behavior on generated data. It does not prove accuracy on an external customer distribution.

## 2026-07-19 V3 Operational Baseline Verification

- Material hierarchy: `48` RM, `32` PM, and `16` FG, for `96` active catalogue and forecast SKUs.
- Warehouse geometry: `40` operational racks in zones A-E, `600` active storage positions, `6` route stations, and a connected `52`-node/`55`-edge metric aisle graph. F/G/H balancing zones are absent.
- Inventory: `169` material-location rows; every active SKU is stocked and larger holdings span multiple unique bins. Every row has a positive stacking quantity.
- BOM: all `16` realistic FG parents have effective, product-specific formula and pack-profile definitions, with `250` component lines and complete RM/PM coverage.
- Planning evidence: `6,912` monthly demand observations, `1,152` untouched-test backtest rows, and `1,152` H1-H12 forward forecast rows.
- Runtime load: `5,000` orders, `15,000` order lines, and `30,000` stock movements, tasks, and operation events each.
- Earlier generated warehouses were archived from operational views. The V3 load removed `2,850` stale generated locations rather than showing them as live racks.
- Product and API contracts now distinguish units per handling unit, units per pallet, maximum stack height, and physical pallet footprint. Inventory exposes populated stacking quantities.
- The canonical forecast SKU catalog lists RM first, PM second, and FG third. It does not expose forecast-only SKUs that are absent from the active material and inventory scope.
- Current V3 source verification passed: deterministic regeneration produced the same dataset hash, all generator validations are true, `11` baseline tests plus `130` notebook checks pass, frontend TypeScript passes, and `git diff --check` is clean. The final PostgreSQL reload, Spring rebuild, authenticated API check, and live browser regression are pending as stated below.

The V3 model passes the project promotion thresholds on statistically controlled generated data. Manager approval is still required before promotion, and no external-real-world accuracy claim is made.

Deployment note: the final V3 archived-assignment cleanup and rotated A-E desktop rack canvas are implemented in source, but the local PostgreSQL reload and final backend rebuild were blocked by the current local execution-approval quota. Until `./.venv/bin/python scripts/load_project_operational_baseline.py` and `./scripts/build_backend_runtime.sh` are rerun, the live browser can still show archived default-location counts or the previous rack geometry. No claim below overrides this deployment boundary.

## Historical Log (Superseded By The V3 Status Above)

## 2026-07-19 Superseded V1 Warehouse UI And Analytics Checkpoint

The final authenticated desktop smoke test used `admin@optiwms.com` against the rebuilt local stack. The backend is healthy on `8080`; PostgreSQL, forecast service, orchestrator, slotting service, and MLflow are also healthy. The frontend development runtime is available at `http://localhost:3000`.

- The detailed warehouse view loads the canonical `200` racks and `3,000` storage positions. Every rack renders all five physical levels (`L1` through `L5`) without label overlap. Door, receiving, quarantine, packing, and dispatch anchors are reserved for Forklift Routes rather than mixed into the detailed rack view.
- Physical rack suitability is persisted and visible as a nine-cell matrix: `AF 18`, `AM 18`, `AS 24`, `BF 21`, `BM 21`, `BS 28`, `CF 21`, `CM 21`, and `CS 28`. These are rack suitability bands consumed by slotting; material ABC/FMS remains demand-derived evidence.
- Inventory is globally sorted by SKU through the paginated Spring query, not sorted only inside the current browser page. The live screen starts `FG-0001`, `FG-0002`, and so on and reports `1,609` canonical material-location rows.
- Product Catalogue is globally sorted by SKU and reports exactly `866` materials. Its Assigned Locations column resolves the persisted primary and reserve location rows; multi-bin stock remains separate inventory records rather than being collapsed to one bin.
- Dashboard analytics now resolve the canonical warehouse before requesting every KPI/chart. Orders are also constrained to the warehouse dataset version plus future `OPERATIONAL_ENTRY` rows. The live dashboard reports exactly `25,000` baseline orders, `1,609` inventory rows, and `1,113` low-stock exceptions computed from quantity/availability/ROP/buffer thresholds instead of stale status strings.
- Inventory Policy & Space Planner uses a compact governance strip and a nine-column decision table with expandable input/evidence detail. The current readiness result is correctly `Review`: all `288` RM forecast series have passed statistical evaluation but await manager model promotion, so a new policy run cannot silently consume them.
- Slotting Demand Shift Insights no longer displays a fabricated uniform `45%` confidence. Each row identifies its evidence path (`Forecast backed`, `Partial forecast`, or `Historical fallback`). The existing `ORTOOLS_MILP_FLOW_V3 / OPTIMAL` plan remains a manager-controlled draft.

Final verification for this checkpoint:

- `./scripts/build_backend_runtime.sh`: backend JAR compiled, runtime image rebuilt, container healthy.
- `./gradlew test --no-daemon` with Gradle `8.10.2`: `BUILD SUCCESSFUL` across all backend modules.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed.
- Authenticated browser checks passed for Dashboard, Inventory, Product Catalogue, Warehouse Layout, rack suitability, Inventory Policy, and Slotting Planner.

The remaining operational action is governance, not missing data: a manager must promote the statistically eligible forecast release before new forecast-dependent policy and demand-shift recommendations become decision-eligible. Existing approved historical policy runs remain visible for audit and rollback.

## 2026-07-19 Implementation Checkpoint

### Canonical generated warehouse

- Material master: `120` FG + `288` RM + `458` PM = `866` SKUs.
- Warehouse geometry: `200` racks, `3,000` pallet/bin positions, and `6` operational stations (`3,006` location rows total).
- Current generated inventory: `1,609` material-location rows with one pick face plus zero or more reserve bins per SKU.
- BOM: `120/120` finished goods covered, `1,641` effective component rows, and every RM/PM material used by at least one BOM.
- History and load scale: `72` planning months, `25,000` orders, `100,000` order lines, `125,000` movements, `125,000` tasks, and `125,000` operation events.
- Physical validation now proves pallet gross weight `<= 1,200 kg` and pallet volume `<= 1,800,000 cm3` for every generated SKU.
- Material payloads now send true pallet weight and pallet volume to optimization; unit-level values are no longer misrepresented as pallet-level constraints.

### Forecast and policy evidence

- Champion: `EXTRA_TREES`, selected before opening the final 12-month test.
- Extra Trees WAPE `11.89%` versus seasonal-naive WAPE `19.59%`, a `39.32%` relative improvement.
- Aggregate bias `-0.21%`, P05-P95 empirical coverage `88.94%`, and critical `AF/AM/BF` WAPE `9.61%`; every configured promotion gate passes.
- Promotion status remains `PENDING_MANAGER_APPROVAL`; generated-data evidence is not an external production-validity claim.
- Policy output remains `(s,S)` with empirical lead-time demand, residual uncertainty, MOQ/order-multiple rounding, service-class targets, cost comparison, and capacity checks.

### Warehouse and slotting implementation

- Layout uses physical rack/level/bin codes and generated coordinates relative to receiving, door, packing, and dispatch anchors.
- Product Catalog and Inventory use the same canonical SKU and location namespace. Product rows expose primary plus reserve assignment counts.
- ABC is annual issued-volume concentration; FMS is issue-event frequency within subtype. `AF`, `AM`, and `BF` remain critical classes.
- `ORTOOLS_MILP_FLOW_V3` plans one unique pick face per SKU and all reserve pallet positions across multiple bins.
- Objective terms include forecast-weighted travel, accessibility, vertical handling, relocation, carrying-space, and stockout-risk weights.
- Constraints include pallet count, one-pallet-per-bin contract, weight, volume, temperature, hazard, fragility, stackability, compatibility, unique primary bins, and relocation cap.
- Canonical-scale test result: all `866` SKUs and `2,578` target pallet positions solved and independently validated in about `10.6 s` at the `30%` relocation cap.
- Approval of `INFEASIBLE`, unavailable, abnormal, not-solved, or fallback plans is blocked in Spring and disabled in the frontend. Successful approvals create transfer work; stock changes only after execution unless an administrator explicitly chooses direct apply.

### Verification completed

- Baseline contract: `7 passed`, including `31` notebook syntax subtests.
- Slotting service: `5 passed`, including the full `866`-SKU canonical integration test.
- Full Spring test suite: `./gradlew test --no-daemon` passed after aligning physical capacity with the effective WMS max-stock policy and removing duplicate MOQ rounding.
- Frontend TypeScript: `npx tsc --noEmit` passed.
- `git diff --check` passed.
- Post-edit Spring verification completed successfully: `./gradlew :core-app:compileJava --no-daemon` and the Dockerfile-equivalent `./gradlew build -x test --no-daemon` both pass after mapping `materials.unit_cost_standard` in `MaterialEntity`.
- The canonical loader now archives prior generated artifact revisions outside the active dataset scope before upserting a new hash. The current load validated exact counts while preserving `OPERATIONAL_ENTRY` records.

### Live runtime status

- The Spring backend was rebuilt from the verified host boot JAR through `Dockerfile.runtime`; container `optiwms-backend` is healthy, `/actuator/health` returns `UP`, PostgreSQL remained intact, and Flyway validated schema version `78`.
- Forecast service `8091`, orchestrator `8092`, slotting service `8093`, PostgreSQL, backend, MLflow, and pgAdmin are running; all services with health contracts report healthy/`ok`.
- The forecast service runtime contract reports `mode=wms_db`, `reason=validated`, with no missing tables or columns. PostgreSQL remains the operational authority.
- The Python slotting image was rebuilt and the running container contains `ORTOOLS_MILP_FLOW_V3`.
- PostgreSQL load audit is `completed` for artifact hash `73b9c81b40342d4faf1247e87c8a4ec870cfa0bf0bc35c8f1a67eed03824fbb0`; post-load validation is `true` for `866` materials, `3,006` locations, `10,392` forecasts, `25,000` orders, `100,000` order lines, and all movement/task/event counts.
- End-to-end runtime plan `SLOT-2026-H2-v5` is persisted as `ORTOOLS_MILP_FLOW_V3 / OPTIMAL`: `866` SKU lines, `1,597` reserve pallet positions, objective `367069.7702`, and all physical, compatibility, accessibility, relocation, and complete-allocation constraints recorded.
- The forecast-to-space contract now uses the effective WMS max-stock policy for simultaneous physical capacity. Six-month cumulative demand remains a trend/risk/accessibility signal and is no longer incorrectly treated as six months of stock stored at once.
- Frontend port `3000` is reachable and returns the expected `307` authentication redirect. Final authenticated visual regression remains pending because the active browser policy rejected further localhost access; no bypass was attempted.
- The source-building `backend/Dockerfile` can fail in Docker Desktop when Maven Central terminates TLS handshakes. `scripts/build_backend_runtime.sh` is the deterministic local path: it builds `:core-api:bootJar` with the host Gradle cache and packages that JAR through `backend/Dockerfile.runtime`, without modifying PostgreSQL volumes.
- Earlier plans `SLOT-2026-H2-v2` through `v4` remain infeasible fallback evidence and cannot be approved. Only `v5` is the current feasible V3 draft.
- `SLOT-2026-H2-v5` is deliberately still `DRAFT`; manager approval is required before transfer work is created, and inventory moves only after execution.
- Generated coordinates remain a controlled project baseline pending a physical warehouse survey. External-real-world forecast and travel performance remain unvalidated.

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

## 2026-07-14 Synthetic Data Generation Proof

Added and executed `v8_controlled_synthetic_validation/07_Synthetic_Data_Generation_Methods_And_Proof.ipynb` as a standalone evaluator-facing notebook.

It now proves and visualizes:

- fixed-seed NumPy generation and a SHA-256 evidence digest;
- sinusoidal annual seasonality with randomized amplitude and phase;
- bounded annual trends, Bernoulli promotions and holidays;
- persistent structural shifts and rare disruption/surge shocks;
- autoregressive planned-versus-actual FG production;
- FG-to-RM/PM BOM explosion with scrap and yield;
- lognormal positive/skewed variables and scale-dependent process noise;
- master-data parameter distributions for MOQ, order multiples, cost and lead time;
- 100% controlled FG-parent and RM/PM component coverage, including the explicit coverage-repair rule;
- production-plan versus actual plots, BOM-degree plots, demand distributions, heteroscedasticity, autocorrelation and intermittency;
- database/workflow mapping for catalogue, BOM, demand history, inventory policy, slotting/MILP and supplier planning;
- supported and unsupported claims for project-operational use.

Validation completed: all eight v8 notebooks pass static Python syntax parsing. The new notebook executed all 11 code cells, embedded five plot outputs and produced no error outputs.

### Why Forecast Dashboard Charts Can Be Empty

Forward operational forecast rows contain future period, horizon, P10, P50 and P90. They correctly do not contain future actual demand (`y_true`). Therefore:

- residual-over-time and absolute-error charts require persisted rolling-backtest or matured forecast-versus-actual rows;
- empirical interval coverage requires actual demand joined to historical forecast intervals;
- seasonality charts require at least 12 calendar months of actual demand per selected material;
- promotion/weather/price-driver charts require those exogenous features and their provenance;
- online inference audit/fallback charts require actual inference events, not a static forecast seed.

The existing empty-state messages are statistically safer than generating decorative values. The next frontend evidence step is a separate backtest/history endpoint; forward forecasts and evaluation rows must remain separate datasets even when shown on the same page.

## 2026-07-15 Canonical Project Operational Baseline

### Operational Truth And Lineage

`PROJECT_OPERATIONAL_BASELINE_V1` is now the single deterministic project-operational dataset for the Colombo warehouse. It uses seed `20260715` and dataset hash `7356c0ba07bc6afa4edf91c12541d09bd64bc503d0ef5103690b852813f2fbd7`. It is generated data, not externally observed customer data; ordinary operator screens omit that distinction, while PostgreSQL lineage, administrator evidence, and evaluator notebooks retain it.

Loaded and idempotently reloaded into PostgreSQL:

- 120 FG, 288 RM, and 458 PM materials; 866 total catalogue rows.
- 3,000 typed warehouse locations.
- 120 versioned BOM headers and 1,641 component rows with complete FG coverage.
- 53,712 monthly RM/PM demand observations over 72 months.
- 25,000 orders, 100,000 order lines, 125,000 stock movements, 125,000 tasks, and 125,000 operation events.
- 746 RM/PM supplier links, ABC/FMS classifications, inventory records, and stochastic policy draft lines.

Migrations `V73` and `V74` provide evidence/job/provenance contracts and accept the generated two-digit location bay codes. The canonical loader supports validation-only, full idempotent load, and `--forecast-only` publication.

### Forecast Evidence

The selected champion is **Extra Trees**, selected against seasonal naive, moving average, Croston/SBA, ETS, and LightGBM on expanding-window origins. The final 12 months were untouched until model selection was locked.

| Untouched-test measure | Result |
|---|---:|
| WAPE | 12.51% |
| MAE | 97.07 |
| RMSE | 260.77 |
| Bias | 0.18% |
| Under-forecast rate | 51.42% |
| Empirical 90% interval coverage | 88.85% |
| Critical AF/AM/BF WAPE | 9.87% |
| Seasonal-naive WAPE | 20.25% |
| Relative WAPE improvement | 38.24% |

All configured evidence gates pass, but registry status remains `PENDING_MANAGER_APPROVAL`. Forward rows remain `decision_eligible=false`; recalculation publishes a draft and never auto-promotes it.

Eight evaluator notebooks execute without code-cell errors and separate lineage, EDA, BOM/classification proof, model selection, residual diagnostics, policy simulation, slotting evidence, and executive claims. Seven statistical plots are embedded across the evidence sequence.

### Runtime Wiring Verified

- Spring/PostgreSQL `forecast_results` is the canonical dashboard and planning store; SQLite is not an operational authority.
- Canonical APIs return 8,952 forward rows, 8,952 untouched-test rows, metrics, actual history, interval calibration, generation provenance, and 746 deduplicated inventory recommendations.
- Forecast-only publication was run directly against PostgreSQL and returned 8,952 forward rows, 8,952 backtest rows, and one registry row without rebuilding orders, inventory, BOMs, or policies.
- `POST /api/ai/jobs/forecast-run` is asynchronous in Spring. Canonical requests now bypass the legacy v6 orchestrator and call `/canonical/recalculate`; legacy dataset/model defaults were replaced by `PROJECT_OPERATIONAL_BASELINE_RM_PM` and `EXTRA_TREES`.
- The Python canonical route refreshes the controlled feature contract from PostgreSQL `demand_history`, requires complete one-to-one coverage, reruns statistical evidence, and then invokes only the forecast-only PostgreSQL publisher. XGBoost and CatBoost were moved to an optional `legacy-boosting` dependency group so the core ARM service does not download CUDA/NCCL.
- The Forecasts frontend displays “RM/PM Demand Forecast”, “Extra Trees”, the untouched-test metrics, canonical release status, supported charts only, and no decorative residual, market-driver, inference-success, or stock values.
- Desktop and 375 px mobile checks found no horizontal overflow, no blank chart SVGs, and three populated overview charts. The header was made responsive.

### Current Verification Boundary

The canonical generator tests, forecast recalculation, forecast-only PostgreSQL publication, Java compile/controller tests, TypeScript checks, API reads, and desktop/mobile browser checks passed during this implementation. A first forecast-service Docker rebuild exhausted disk while the old dependency set attempted a 303 MB CUDA/NCCL download. Docker Desktop then became unresponsive and PostgreSQL stopped. The dependency defect is fixed in source, but the final rebuilt Docker image and live Spring `202 -> worker -> published_draft` poll could not be rerun after the daemon failure. Do not claim that final Docker-chain proof until Docker storage is healthy and that smoke is repeated.

### Defensible Evaluator Claim

OptiWMS demonstrates a reproducible, statistically controlled single-warehouse operation on generated data with complete catalogue, BOM, history, forecast, policy, classification, and workflow records. The Extra Trees champion passes the project evidence gates on an untouched generated-data test period and remains manager-gated. This is evidence of project-system correctness under the controlled baseline, not evidence of accuracy on an external customer distribution.

## 2026-07-15 Final Docker And End-To-End Verification

### Docker Recovery And Runtime Fix

Disk space was recovered without deleting or resetting application containers, images, or named volumes. The persisted PostgreSQL data remained intact. The final runtime defect was cross-compose service discovery: Spring and the AI services run on different Docker networks, but Spring was trying to resolve `forecast-service` as though it were on the same network.

Fixed runtime configuration:

- Spring uses `host.docker.internal:8091`, `:8092`, and `:8093` for forecast, orchestrator, and slotting services.
- The forecast container uses explicit PostgreSQL authority `host.docker.internal:5434/optiwms` for canonical recalculation.
- No SQLite copy or Docker-volume database edit is required.
- Flyway schema is at `V75`.

Live health after the non-destructive rebuild:

- Spring backend `8080`: healthy.
- Forecast service `8091`: healthy; runtime contract reports `wms_db` and no missing tables/columns.
- Orchestrator `8092`: healthy.
- Slotting service `8093`: healthy.
- PostgreSQL `5434`: healthy.
- Frontend is running at `http://localhost:3000` for local verification.

### Forecast Recalculation And Governance Proof

The same Spring endpoint used by the frontend was exercised:

- `POST /api/ai/jobs/forecast-run` returned `202` and persisted job `b3010b3a-9913-43ea-9064-f3a2c9ca3ea2`.
- The job moved from `running/inference_publish` to `succeeded/published` in about one minute.
- Canonical recalculation refreshed model evidence, republished PostgreSQL rows as draft, and preserved the generated operational dataset.
- Manager/admin approval promoted `EXTRA_TREES` and marked all `8,952` forecast rows decision-eligible.
- `/api/ai/forecasts?page=0&size=5` returned canonical, paginated PostgreSQL rows with P10/P50/P90.
- `/api/ai/forecast-metrics` returned aggregate and H1-H12 untouched-test evidence separately from forward forecasts.

Current model evidence after recalculation:

| Untouched-test measure | Result |
|---|---:|
| WAPE | 12.48% |
| MAE | 96.87 |
| RMSE | 260.49 |
| Bias | 0.24% |
| Under-forecast rate | 51.43% |
| Empirical 90% interval coverage | 89.21% |
| Critical AF/AM/BF WAPE | 9.84% |
| Seasonal-naive WAPE | 20.25% |
| Relative WAPE improvement | 38.36% |

The live Forecasts page was browser-verified after authentication. It displays `RM/PM Demand Forecast`, `Extra Trees`, `PROMOTED`, populated forecast/history/inventory panels, and supported residual, error-distribution, bias, RMSE, and interval-coverage evidence. It does not obtain residuals from future forecast rows.

### Inventory Policy Proof

Approved policy run `be9477fe-e321-414f-8eda-1012a2b14361` contains `288` RM lines:

- `216` lines passed the service/cost/capacity simulation gate and were approved.
- `72` lines remain `HIGH_RISK_REVIEW`; they were not silently applied.
- Expected stock delta: `-843,773.40` units.
- Expected pallet-position delta: `-262.85`.
- Expected holding-cost delta: `-151,879.20`.
- All `288` lines have persisted simulation evidence; `216` satisfy fill-rate target, cost improvement, and capacity feasibility together.
- No purchase suggestions were created because current stock is above the proposed reorder triggers. That is a valid no-order result, not a missing integration.

The implemented policy is a class-aware stochastic `(s,S)` method. It uses P10/P50/P90 forecast demand, empirical lead-time demand and calibrated residual uncertainty, EOQ economics, MOQ/order multiples, handling-unit rounding, shelf life, and storage capacity. Target service levels are `98%` for AF/AM/BF, `97%` for other A, `95%` for B, and `92%` for C. A deterministic 1,000-trial inventory simulation blocks proposals that miss service, increase expected cost, or violate capacity. Approval creates draft purchasing suggestions only; it never creates purchase orders automatically.

### MILP Slotting And Transfer Proof

Approved space run `8fa46a69-f43b-470d-8062-64ca419f005c` completed with:

- algorithm `ORTOOLS_MILP_V2`;
- solver status `OPTIMAL`;
- objective `32,864.6778`;
- `0` infeasible and `0` high-risk assignments;
- exactly `64` relocations, matching the configured 30% relocation cap;
- estimated travel reduction `2,625.85 m`.

Approved plan `d3a450f7-61e3-49d1-91a6-4208df98ea78` (`FSO-2026-07-14-v2`) is `ACTIVE`. Approval created released stock transfer `1c3373c7-92ba-4e2e-bb20-8e06b11d6ecc` (`TF-1784073487622`) with `64` open lines and `64` pending transfer tasks. Moved quantity remains `0`; inventory changes only after worker scan/execution. All source lines currently have sufficient inventory.

The integer assignment model subsumes the requested multidimensional knapsack decision. It considers pallet positions, weight, cubic volume, compatibility, temperature/hazard/fragile rules, stackability, pick-face and reserve assignment, current occupancy, handling-unit multiples, accessibility, travel, relocation cost, overflow, and forecast-weighted risk. A separate feature labelled "Knapsack" would be misleading.

### Comparison With The Two Hemas Documents

The Training Report's core method is covered and extended: 288 RM/458 PM scale, subtype-specific ABC by annual issued volume excluding returns, FMS by issue frequency, AF/AM/BF critical treatment, forecast-informed ROP/min-max, and warehouse allocation. OptiWMS adds reproducible generation, uncertainty intervals, model backtesting, simulation gates, constraints, approvals, audit evidence, APIs, and executable transfer tasks.

The Pallet Project covers a different scope: reverse pallet circulation, reuse, occupancy, damage, repair, recycling/disposal, and shortage triggers. OptiWMS currently optimizes material pallet-position allocation and relocation, but it does **not** implement that complete reverse-pallet asset lifecycle.

### Explicit Remaining Gaps

- **Cannibalization:** correlated demand and promotions exist in the generator, but no validated causal product-substitution/cannibalization model is implemented. Do not claim one.
- **Reverse pallet logistics:** pallet damage, repair, return, reuse, recycling, and disposal workflows from the Pallet Project remain a separate module.
- **External validity:** all model and policy evidence is generated-baseline evidence. No external customer performance claim is defensible.
- **Execution boundary:** the approved relocation transfer is intentionally pending worker scans; the verification did not fake physical movement.
- **Frontend debt:** the production build passes, but existing React hook/image/font warnings remain. They do not block compilation or the verified Forecasts workflow.

### Final Automated Verification

- Full backend `./gradlew test`: `BUILD SUCCESSFUL`.
- Forecast service: `11 passed`.
- OR-Tools slotting service: `2 passed`.
- Operational baseline: `6 passed`, `31 subtests passed`; all generated notebook code cells parse.
- Frontend production build: successful, all `68` routes generated.
- Live browser: authenticated Forecasts overview and Model Performance views populated from the running services.

### Current Evaluator Claim

OptiWMS is complete enough to demonstrate a manager-gated forecast-to-policy-to-slotting-to-transfer workflow for one generated Colombo warehouse. The correct claim is controlled system validity: deterministic data, complete BOMs, statistically separated model selection/test evidence, calibrated uncertainty, stochastic policy simulation, constrained optimal slotting, and executable approval workflows. It is not evidence of deployment performance on an external warehouse, and it does not yet include causal cannibalization or reverse-pallet lifecycle optimization.

## 2026-07-15 FG/RM/PM Forecast And Operational Scope Correction

### Root Causes Corrected

- The one-point forecast chart was a dashboard pagination defect. The initial API page contained one period for many SKUs; it was not evidence that PostgreSQL held only one horizon.
- Selecting a SKU now performs dedicated paginated reads for that SKU's forward forecasts, actual history, and backtest rows. H1-H12 is no longer inferred from the mixed first page.
- A canonical forecast SKU endpoint now returns the complete forecast catalogue with material type and horizon count. The Forecast page provides Raw Material, Packaging, and Finished Good selectors.
- The exposed `(poll/60)` value was a timeout counter, not pipeline progress. The UI now displays explicitly estimated progress while the synchronous inference stage runs and reports 100% only after publication.
- Inventory and Product Catalogue totals mixed the generated baseline with unclassified legacy rows. Default paged and reference-material reads now include only `GENERATED_OPERATIONAL_BASELINE` and `OPERATIONAL_ENTRY`; `includeLegacy=true` preserves explicit audit access. No legacy records were deleted.
- New material and inventory records receive `OPERATIONAL_ENTRY` provenance through JPA and database defaults. V76 adds covering indexes for the operational scope.
- BOM Master now reports canonical FG/RM/PM counts, provides searchable finished-good records with descriptions, retains component add/edit/delete, and moves legacy forecast-SKU mapping behind an Advanced disclosure.

### Expanded Forecast Evidence And PostgreSQL Publication

The leakage-safe forecasting panel now combines the generated 72-month finished-good production history with direct RM/PM demand history. Purchasing policy remains restricted to RM/PM; FG forecasts are exposed for production/BOM planning and do not create FG replenishment proposals.

Current untouched-test evidence across 866 SKUs:

| Measure | Result |
|---|---:|
| Forecast scope | 120 FG + 288 RM + 458 PM |
| Forward forecast rows | 10,392 |
| H1-H12 test rows | 10,392 |
| WAPE | 12.22% |
| MAE | 104.58 |
| RMSE | 258.50 |
| Bias | 0.05% |
| Under-forecast rate | 50.39% |
| Empirical 90% interval coverage | 89.22% |
| Critical AF/AM/BF WAPE | 9.78% |
| Seasonal-naive WAPE | 20.12% |
| Relative WAPE improvement | 39.25% |

The planning-only transactional loader committed:

- `62,352` FG/RM/PM monthly history rows;
- `871` canonical inventory rows;
- `10,392` H1-H12 forward forecast rows;
- `10,392` untouched-test/backtest rows;
- one model-registry row.

### Verification And Runtime Boundary

- Full backend Gradle tests: passed.
- Frontend production build: passed; all 68 routes generated.
- Operational baseline: `6 passed`, `31 subtests passed`.
- The frontend build warned that the filesystem had only 115 MiB free and could not persist its webpack cache. The disposable `.next` directory was removed, restoring about 1 GiB.
- Docker Desktop then stopped responding during the backend image rebuild. A normal non-destructive restart could not terminate stuck Docker helper processes, and ports 8080/3000 were no longer reachable. Containers and named volumes were not deleted; PostgreSQL publication had already committed before Docker stopped.
- Therefore the new V76 migration, rebuilt Spring image, and final browser screenshots are **not yet live-verified**. Start Docker Desktop successfully, run `docker compose up -d --build backend` from `infra`, and repeat the authenticated Forecast/BOM/Inventory browser smoke before claiming the correction is deployed.

## 2026-07-18 Canonical Colombo Dataset Deployment

### Live Scope Correction

The V76/V77 operational-scope changes are now deployed. Spring/PostgreSQL defaults no longer mix the project baseline with M5/bootstrap, simulation, or unclassified legacy rows.

- Product Catalogue default scope: `866` materials (`120` FG, `288` RM, `458` PM).
- Inventory default scope: `1,099` physical stock positions covering the same `866` materials and `1,202,451` total units.
- Inventory by type: `228` FG positions, `314` RM positions, and `557` PM positions.
- Warehouse default scope: one `PROJECT_OPERATIONAL_BASELINE_V1` Colombo warehouse. Four historical warehouses remain audit-only.
- Forecast scope: `10,392` PostgreSQL rows for all `866` SKUs, with complete H1-H12 coverage under `EXTRA_TREES`.
- History scope: `62,352` monthly observations, equal to `866 x 72` months.
- Location scope: `3,000` generated Colombo storage locations.
- BOM scope: exactly `120` generated baseline headers and `1,641` component lines. The default BOM API now excludes 24 older simulation headers and three unclassified legacy headers; administrators can request them explicitly with `includeLegacy=true`.

At ten rows per page, the expected default UI scale is approximately `87` Product Catalogue pages and `110` Inventory pages. Inventory has more rows because one SKU may occupy multiple bins, lots, or handling units. The previous `124` catalogue pages and `15,839` inventory pages were mixed-source defects, not the intended operational scale.

Legacy rows were retained rather than destructively deleted:

- `157,398` unclassified inventory rows;
- `120` `PROJECT_OPERATIONAL_SIMULATION` inventory rows;
- 24 `PROJECT_OPS_V8` BOM headers with 211 lines;
- three unclassified BOM headers.

They are excluded by indexed default repository queries and remain available only for explicit audit/migration work. New material, inventory, warehouse, and BOM records default to `OPERATIONAL_ENTRY`, so future warehouse operations remain visible without reopening the legacy scope.

### Generated Baseline And Model Evidence

The regenerated deterministic baseline hash is `2772ac61aec988b9f09021ce66192fd6a01e12570414bafec2bd5a72fd5adc68`. Determinism was verified by a repeated generation with an identical hash. The untouched-test evidence published with this baseline is:

| Measure | Result |
|---|---:|
| WAPE | 12.2818% |
| Bias | 0.1505% |
| Empirical P10-P90 coverage | 88.9723% |
| Critical AF/AM/BF WAPE | 9.8687% |
| Horizon coverage | H1-H12 |
| Promotion gates | All statistical gates pass; manager approval remains required |

The evidence supports controlled generated-baseline validity only. It does not establish performance on external customer data.

### Runtime And UI Wiring

- Inventory repositories, aggregate cards, warehouse lists, Product Catalogue, BOM Master, demand history, forecast publication, policy inputs, ABC/FMS inputs, and slotting inputs now share the same canonical material and warehouse identities.
- `GET /api/inventory/summary` computes whole-scope inventory totals instead of deriving cards from the current ten-row page. The live SQL result is `1,099` in-stock positions, `602` below their reorder point, and zero zero-quantity positions.
- Generated FG inventory is now loaded alongside RM and PM inventory. Loader reruns reconcile generated rows for the canonical warehouse while preserving manager-created `OPERATIONAL_ENTRY` records.
- Forecast charts have 12 future periods per selected FG/RM/PM SKU. History, seasonality, backtests, residuals, and stock projections remain separate evidence sources rather than fabricated chart series.
- Spring `forecast_results` remains the operational forecast authority. Python services remain responsible for model inference, artifacts, and optimization jobs rather than a second SQLite business truth.

### Docker And Verification

- Docker Desktop recovered without deleting PostgreSQL or any named volume.
- Disposable BuildKit cache was pruned after the disk-full failure; no business volume was pruned.
- Gradle Plugin Portal was unavailable inside the multi-stage Docker build. A verified offline host boot JAR was therefore packaged through `backend/Dockerfile.runtime` and `infra/docker-compose.runtime.yml`. The ordinary multi-stage Dockerfile remains available for CI/networked builds.
- Final backend container: `optiwms-backend`, image `infra-backend`, healthy.
- Actuator: `UP` for liveness and readiness.
- Forecast service `8091`: healthy; runtime contract is `wms_db/validated` with no missing tables or columns.
- Orchestrator `8092`: healthy.
- Slotting service `8093`: healthy.
- Frontend `3000`: reachable and redirects unauthenticated requests to `/admin/login`.
- Flyway: V76 and V77 successful; schema version `77`, all `77` migrations validated.
- Full backend test suite: `BUILD SUCCESSFUL`, 15 tasks.
- Frontend production build: successful before the final backend-only BOM scope adjustment.
- Operational baseline contract suite: `6 passed`.

An authenticated browser refresh is still required to replace any stale React Query/browser cache visible in an already-open tab. The backend serving the corrected defaults is live; no final authenticated screenshot was captured after the last BOM-only redeploy.
