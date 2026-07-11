# v8 Controlled Synthetic Validation

This package is an offline simulation benchmark for the RM/PM forecasting stack.
It does not publish forecasts and does not replace v7.

The generated data has known causal structure: FG production plans, complete BOMs,
yield/scrap, promotions, holidays, shocks, RM/PM usage, MOQ, order multiples and
supplier lead times. That allows the pipeline to test whether models recover known
signals under a leakage-safe time split.

Synthetic performance validates pipeline behavior only. It does not establish
production accuracy on real warehouse demand.

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
- `outputs/model_card.json`: approved/prohibited uses and promotion requirements.
- `outputs/integration_contract.json`: Python/Spring/frontend/downstream provenance contract.
- `outputs/deployment_decision.json`: explicit simulation-versus-production decision.
- `outputs/plots/*.png`: EDA, model, residual, high-volume and feature evidence.
- `00_Controlled_Data_Generation.ipynb` through `05_Statistical_Conclusion.ipynb`.
- `06_Final_Enterprise_Model_Decision_And_E2E.ipynb`: final research-guideline and integration decision.
