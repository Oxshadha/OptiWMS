# v8 Controlled Synthetic Validation

This package is the controlled simulation benchmark for the RM/PM forecasting
stack. Its generated rows are also used as the explicitly labelled
project-operational seed for integrated WMS demonstrations. It does not replace
or represent externally observed warehouse history.

The generated data has known causal structure: FG production plans, complete BOMs,
yield/scrap, promotions, holidays, shocks, RM/PM usage, MOQ, order multiples and
supplier lead times. That allows the pipeline to test whether models recover known
signals under a leakage-safe time split.

Within OptiWMS, this is the declared project-operational population: the same
material master, BOM, demand, forecast and inventory-policy artifacts may drive
the forecasting API, min/max, quantity optimization, storage and slotting
workflows. The v8 physical population extends the same Colombo A-E metric aisle
geometry, assigns every SKU to one pick face plus policy-capacity reserve
positions, and is validated with the OR-Tools MILP/flow solver. Synthetic
provenance is retained; external real-world population validity and physical
survey confirmation remain `UNVERIFIED`.

## Run

```bash
cd "Ai miroservices/modeling/v8_controlled_synthetic_validation"
MPLCONFIGDIR=/tmp/optiwms-v8-mpl \
XDG_CACHE_HOME=/tmp/optiwms-v8-cache \
PYTHONPATH=. \
/Users/k.e.oshada/Documents/OptiWMS/.venv/bin/python -m pipeline.run_all
```

## Main Evidence

- `outputs/data/*.csv`: generated material, FG, BOM, production and demand tables.
- `outputs/model_leaderboard.csv`: untouched-test ranking.
- `outputs/hyperparameter_trials.csv`: inner-validation LightGBM tuning.
- `outputs/paired_model_tests.csv`: paired t, Wilcoxon and monthly DM-style tests.
- `outputs/residual_tests.csv`: residual normality, autocorrelation and heteroscedasticity tests.
- `outputs/interval_calibration.csv`: conformal interval coverage.
- `outputs/inventory_policy_simulation.csv`: MOQ/order-multiple constrained policy evidence.
- `outputs/physical_materials.csv`: 144 dimensioned RM/PM/FG material masters.
- `outputs/physical_layout.csv.gz`: 4,206-row Colombo layout (4,200 storage positions plus six stations).
- `outputs/location_assignments.csv.gz`: 3,257 capacity-safe primary/reserve assignments.
- `outputs/physical_inventory.csv.gz`: location-level inventory for all 144 materials.
- `outputs/storage_slotting_validation.csv`: physical, class and assignment acceptance checks.
- `outputs/operational_forecasts.csv`: correctly aligned recursive H1-H12 future snapshot.
- `outputs/operational_backtest_metrics.csv`: untouched-test evidence for the served recursive protocol.
- `outputs/operational_model_comparison.csv`: paired Extra Trees versus neural challenger block-bootstrap and HAC evidence.
- `outputs/serving_bundle/production/`: fitted locked champion and serving metadata.
- `outputs/model_card.json`: approved/prohibited uses and promotion requirements.
- `outputs/integration_contract.json`: Python/Spring/frontend/downstream provenance contract.
- `outputs/deployment_decision.json`: explicit simulation-versus-production decision.
- `outputs/plots/*.png`: EDA, model, residual, high-volume and feature evidence.
- `00_Controlled_Data_Generation.ipynb` through `05_Statistical_Conclusion.ipynb`.
- `06_Final_Enterprise_Model_Decision_And_E2E.ipynb`: final research-guideline and integration decision.
- `07_Synthetic_Data_Generation_Methods_And_Proof.ipynb`: standalone evaluator proof of the generator equations, distributions, causal structure, plots, integrity gates, reproducibility hash and WMS workflow mapping.

## Shared Neural Evaluator Replication

The canonical operational-baseline package owns the complete evaluator leaderboard.
v8 also runs an independent replication of the shared 24-month/H1-H12
Conv1D-attention contract against seasonal naive:

```bash
../../../.venv-evaluator/bin/python run_evaluator_upgrade.py
```

Outputs are written to `outputs/evaluator/` and are surfaced in
`02A_Conv1D_Attention_Challenger.ipynb`. This replication validates controlled
pipeline behavior and remains a challenger; it is not external-population
evidence and does not replace the lower-WAPE locked Extra Trees champion.

## Project-operational publish

With PostgreSQL running, the forecast service can refit and atomically publish
the same v8 population to both WMS and forecast-service stores:

```bash
curl -X POST "http://localhost:8091/v8/recalculate?warehouse_id=WH-001"
```
