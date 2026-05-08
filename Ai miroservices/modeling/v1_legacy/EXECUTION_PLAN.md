# Forecasting Execution Plan (Honest Model Track)

This plan is for enterprise-grade execution without inflated claims.

## 1) Freeze Baseline (Already Done)

Baseline snapshot folder:

- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/frozen_baseline_2026-04-03`

Included:

- `m5_dept_store_summary.csv`
- `portable_m5_transfer_auto_summary.csv`
- `portable_m5_transfer_auto_capped_summary.csv`
- `portable_m5_transfer_auto_compare_calibration.csv`
- `portable_models_leaderboard.csv`

## 2) Notebook Run Order

Run exactly in this order:

1. `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/notebooks/00a_real_source_active_stock_audit.ipynb`
2. `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/notebooks/02b_portable_feature_ablation.ipynb`
3. `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/notebooks/05b_global_model_transfer_only.ipynb`
4. `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/notebooks/05c_transfer_diagnostics.ipynb`

## 3) Default Evaluation Mode (Critical)

`05b_global_model_transfer_only.ipynb` must use:

- `--calibration recent_level_auto_capped`
- `--calibration-max-weight 0.8`

Reason: unconstrained `recent_level_auto` selected anchor weight `1.0` for all horizons, which hides learned-model contribution.

## 4) Decision Gates

Use these gates after each full run:

- Gate A: `auto_capped` must beat `SNAIVE12` on `WAPE` and `RMSE`.
- Gate B: `auto_capped` should not degrade badly in worst family/category diagnostics.
- Gate C: calibration weights should not drift to fully anchor-like behavior in capped mode.

If any gate fails: continue data/model iteration, no production claim.

## 5) Production Claim Rules

Allowed today:

- pipeline is reproducible
- service architecture is viable
- forecast quality beats naive baseline in current benchmark

Not allowed today:

- "model alone is strong enough for enterprise deployment"
- "learned model is primary source of accuracy"

## 6) Immediate Next Experiment Loop

In `02b_portable_feature_ablation.ipynb`, compare:

- `lags_only`
- `lags_roll`
- `lags_roll_seasonal`
- `lags_roll_seasonal_category`
- `full`

For the best profile, rerun `05b` and `05c`, then compare to frozen baseline.

