# v7 RM/PM Forecast Planning

This package is the planning-grade raw-material and packaging-material forecast
track for OptiWMS.

It deliberately separates itself from the v6 LightGBM bootstrap/FG track:

- v6 remains useful as a model-development reference.
- v7 uses WMS PostgreSQL tables as the source of truth.
- BOM explosion is audited before use; direct RM/PM forecasting is the primary
  production-safe path until BOM coverage is complete.

## Source Tables

- `materials` and `inventory`: material master and stock position.
- `demand_history`: monthly raw-material / packaging-material demand history.
- `forecast_results`: canonical Spring/WMS planning forecast table.
- `bom_headers` and `bom_components`: audited only; not assumed complete.

## Run

```bash
cd "Ai miroservices/modeling/v7_rm_pm_forecast_planning"
PYTHONPATH=. python3 -m pipeline.run_all
```

Optional publication into Spring/WMS `forecast_results`:

```bash
PYTHONPATH=. python3 -m pipeline.run_all --publish
```

Offline corrected-model experiment (never publishes):

```bash
MPLCONFIGDIR=/tmp/optiwms-mpl-cache \
XDG_CACHE_HOME=/tmp/optiwms-xdg-cache \
PYTHONPATH=. \
/Users/k.e.oshada/Documents/OptiWMS/.venv/bin/python \
  -m pipeline.run_corrected_experiment
```

This experiment fixes the one-step target/feature alignment contract and compares
raw, log, Huber, Tweedie, Poisson, volume-weighted, and material-scale-normalized
LightGBM variants under expanding-window rolling origins. It writes only to
`outputs/corrected_experiment/`.

Optional sync into the Python forecast-service SQLite dashboard database:

```bash
PYTHONPATH=. python3 -m pipeline.sync_forecast_service \
  --forecast-service-db ../../../ai_services/forecast-service/forecast_service.db
```

## Outputs

The pipeline writes inspectable artifacts under `outputs/`:

- `data_lineage_summary.json`
- `material_inventory_snapshot.csv`
- `monthly_demand_panel.csv`
- `demand_classification.csv`
- `bom_coverage_audit.csv`
- `baseline_leaderboard.csv`
- `lightgbm_evaluation.csv`
- `model_leaderboard.csv`
- `forecast_results_v7.csv`
- `inventory_policy_recommendations_v7.csv`
- `slotting_readiness_v7.csv`
- `executive_summary.md`
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
- `plots/*.png`
- `corrected_experiment/corrected_model_leaderboard.csv`
- `corrected_experiment/corrected_demand_band_metrics.csv`
- `corrected_experiment/corrected_paired_comparisons.csv`
- `corrected_experiment/corrected_gain_importance.csv`
- `corrected_experiment/corrected_permutation_importance.csv`
- `corrected_experiment/plots/*.png`

## Notebook Sequence

The notebooks are generated from `pipeline/notebook_factory.py` so the sequence
is consistent and reproducible:

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
14. `13_Corrected_High_Volume_LightGBM_Experiment.ipynb` (separate offline experiment)
