# Forecasting Status

## Strict model-family comparison on dataset P (equal-ground)

After adding `04_fair_play_model_comparison.ipynb` and `04c_strict_equal_ground_comparison.ipynb`, the strict apples-to-apples result is:

- winner: `ARIMA`
- file: `outputs/reports/portable_fair_play_strict_overall.csv`
- strict winner metrics:
  - `WAPE = 0.269123`
  - `RMSE = 2745.10`
  - `Bias = 60.65`
  - `MASE_mean = 0.971265`

Important:

- this strict comparison is model-family benchmarking on dataset `P`
- this does **not** replace transfer-stage champion selection on M5
- transfer champion remains `XGBOOST + recent_level_auto_capped`

## Current best defended setup

- Dataset: `P`
- Model: `XGBOOST`
- Transfer mode: `recent_level_auto_capped`
- Horizon-aware caps:
  - short horizons: `0.85`
  - long horizons: `0.90`
  - long horizon start: `9`

Best validated `dept_store` result:

- source file:
  - `outputs/reports/portable_m5_transfer_hscan_s85_l90_h9_summary.csv`
- result:
  - `WAPE = 0.129971`
  - `RMSE = 3797.58`
  - `Bias = -1022.97`
  - `MASE_mean = 1.15957`

## Baseline comparison

`dept_store` seasonal naive:

- file:
  - `outputs/reports/m5_dept_store_summary.csv`
- result:
  - `WAPE = 0.145962`
  - `RMSE = 4164.53`
  - `Bias = -1309.70`
  - `MASE_mean = 1.27655`

Outcome:

- tuned capped model is better than naive on all main aggregate metrics

## Cross-granularity stability

`cat_store` tuned result:

- file:
  - `outputs/reports/portable_m5_transfer_hcap_tuned_catstore_summary.csv`
- result:
  - `WAPE = 0.117985`
  - `RMSE = 7568.97`
  - `Bias = -3017.99`
  - `MASE_mean = 0.85426`

`cat_store` seasonal naive:

- file:
  - `outputs/reports/m5_cat_store_summary.csv`
- result:
  - `WAPE = 0.123906`
  - `RMSE = 8035.79`
  - `Bias = -3055.98`
  - `MASE_mean = 0.97348`

Outcome:

- tuned capped model also beats naive on `cat_store` overall

## Honest interpretation

- This is a credible and reproducible forecasting pipeline.
- Results are strong enough to defend technically for industry submission.
- This is still a calibrated blend system, not a pure raw-model win.
- Keep claims precise:
  - model + calibration beats naive baseline
  - avoid claiming model alone dominates accuracy

## Current notebook default

`05b_global_model_transfer_only.ipynb` is set to the tuned setup:

- tag: `portable_m5_transfer_hcap_tuned`
- model: `XGBOOST`
- calibration:
  - `recent_level_auto_capped`
  - `--calibration-max-weight-short 0.85`
  - `--calibration-max-weight-long 0.9`
  - `--calibration-long-horizon-start 9`

## Important run note

If `outputs/reports/portable_m5_transfer_hcap_tuned_summary.csv` is missing after a notebook run, rerun all cells in `05b` from the top once to regenerate the tuned-tag outputs.

## Recommended immediate next step

1. Regenerate and freeze tuned `dept_store` outputs under the tuned tag.
2. Run diagnostics notebook (`05c`) using tuned predictions.
3. Keep this tuned capped config as the microservice v1 champion until a raw-model-only path surpasses it.
