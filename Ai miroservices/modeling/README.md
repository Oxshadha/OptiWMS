# WMS Forecast Modeling Workspace

This workspace trains and compares baseline forecasting models for datasets A/B/C and produces dashboard-ready outputs.

## Structure
- `configs/experiment_config.yaml`: experiment protocol and paths
- `scripts/common.py`: shared loaders, split logic, metrics, inventory outputs
- `scripts/run_classical.py`: ETS, ARIMA, SARIMA runs
- `scripts/run_boosting.py`: XGBoost, CatBoost runs (multi-horizon)
- `scripts/compare_models.py`: aggregates results and builds report tables
- `notebooks/01_classical_models.ipynb`: run classical models
- `notebooks/02_boosted_models.ipynb`: run boosting models
- `notebooks/03_model_comparison.ipynb`: compare all models and outputs
- `outputs/`: forecasts, metrics, inventory, reports

## Statistical Protocol
- Time split: Train / Validation / Test using 18/6/12 monthly holdout (for 36-month data).
- Multi-horizon: H+1 ... H+12 metrics and outputs.
- Dataset C: scenario-safe evaluation (`scenario_split=train` for fitting/validation and `scenario_split=test` for stress testing).
- No feature leakage: only lagged operational features are used for boosted models.

## Run
```bash
cd "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling"
python scripts/run_classical.py --datasets A B
python scripts/run_boosting.py --datasets A B C --sample-frac-c 0.5 --horizons 1,2,3,4,5,6,7,8,9,10,11,12
python scripts/compare_models.py
```

## Dashboard-ready Outputs
- `outputs/reports/dashboard_forecast_output.csv`
- `outputs/reports/dashboard_inventory_recommendations.csv`
- `outputs/reports/leaderboard_top5_per_dataset.csv`
- `outputs/reports/test_metrics_by_horizon.csv`

## References (method/protocol)
- FPP3 (rolling-origin CV, prediction intervals, accuracy): https://otexts.com/fpp3/
- Statsmodels SARIMAX docs: https://www.statsmodels.org/stable/generated/statsmodels.tsa.statespace.sarimax.SARIMAX.html
- Statsmodels ETS docs: https://www.statsmodels.org/stable/generated/statsmodels.tsa.holtwinters.ExponentialSmoothing.html
- XGBoost docs: https://xgboost.readthedocs.io/
- CatBoost docs: https://catboost.ai/docs/
- Pinball/quantile loss (sklearn): https://scikit-learn.org/stable/modules/generated/sklearn.metrics.mean_pinball_loss.html
