# Industry Submission Position

## Objective

The objective of this work is to build a forecasting model and expose it as a microservice that can integrate with Core WMS in an enterprise setting.

The goal is not only to produce forecasts, but to produce forecasts in a way that is:

- reproducible
- auditable
- deployable through services
- technically honest about model capability and limitations

## What can be claimed honestly today

The current system can be presented as:

- a reproducible forecasting pipeline
- a portable transfer-evaluation workflow
- a service-oriented forecasting architecture prototype
- a system that shows measurable lift over a seasonal-naive monthly benchmark

The current system should **not** be presented as:

- a fully production-proven learned forecasting model
- a model that clearly dominates strong recent-history baselines
- a final enterprise forecasting engine ready for unrestricted rollout

## Best current result

Best current final forecast pipeline:

- dataset: `P`
- model path: `XGBOOST_recent_level_auto`
- report:
  - `outputs/reports/portable_m5_transfer_auto_summary.csv`

Key result:

- `WAPE = 0.1294`
- `RMSE = 3832.48`
- `Bias = -927.90`
- `MASE_mean = 1.1530`

Monthly seasonal-naive benchmark:

- report:
  - `outputs/reports/m5_dept_store_summary.csv`
- `WAPE = 0.1460`
- `RMSE = 4164.53`
- `Bias = -1309.70`
- `MASE_mean = 1.2766`

This means the current pipeline does beat the seasonal-naive benchmark.

## Critical honesty point

The strongest current score is achieved through automatic recent-history calibration.

Calibration analysis shows:

- file:
  - `outputs/reports/portable_m5_transfer_auto_compare_calibration.csv`
- finding:
  - every horizon selected `effective_weight = 1.0`

That means the current best result is driven primarily by the recent-history anchor, not by the learned model alone.

This is the most important technical limitation to disclose honestly.

## What the learned model currently adds

When the automatic calibration is capped to force model contribution:

- file:
  - `outputs/reports/portable_m5_transfer_auto_capped_summary.csv`
- method:
  - `XGBOOST_recent_level_auto_capped`
- result:
  - `WAPE = 0.1417`

This capped version still beats the seasonal-naive benchmark:

- naive:
  - `WAPE = 0.1460`
- capped:
  - `WAPE = 0.1417`

Interpretation:

- the learned model does add some value
- but the added value is still modest
- the current enterprise value is in the pipeline and architecture, more than in a fully mature learned-model advantage

## Enterprise-safe wording

Use wording like this:

“The current platform demonstrates a reproducible forecasting microservice workflow with measurable improvement over a seasonal-naive monthly benchmark. However, the strongest present performance depends heavily on recent-history calibration, which currently contributes most of the predictive strength. The learned model adds incremental value, but it is not yet the dominant source of forecast accuracy. Therefore, the current system should be positioned as a credible enterprise prototype and evaluation platform, rather than as a final fully validated forecasting model.”

## What is already enterprise-relevant

The following are already meaningful enterprise deliverables:

1. Real-source audit and canonical extraction
   - `notebooks/00a_real_source_active_stock_audit.ipynb`

2. Rule-based synthetic generation anchored to real planning data
   - `scripts/rule_based_synthetic_generator.py`

3. Train-and-save artifact workflow
   - `notebooks/02_global_model_training_and_artifact_save.ipynb`
   - `scripts/train_and_save_models.py`

4. Saved-artifact transfer workflow
   - `notebooks/05b_global_model_transfer_only.ipynb`
   - `scripts/m5_saved_artifact_transfer.py`

5. Forecast service integration path
   - artifact-loading and routing support in the forecast-service and backend proxy layers

These are real engineering assets and should be presented confidently.

## What is still missing before production claim

1. Strong learned-model justification
   - show clear value beyond recent-history anchor

2. Better portable data realism
   - improve external transfer relevance of synthetic history

3. Stability proof
   - repeatability across runs, categories, and horizons

4. Model governance
   - champion / fallback selection
   - monitoring thresholds
   - retraining triggers

5. Production operating policy
   - define when to use:
     - anchor-only
     - capped blend
     - learned model

## Recommended next work order

1. Improve the portable generator again with stronger transfer realism.
2. Re-evaluate raw model-only performance.
3. Re-evaluate capped calibration performance.
4. Quantify value by:
   - horizon
   - category
   - regime type
5. Build a formal enterprise decision rule:
   - if model confidence is weak, fall back to anchor-based forecast
   - if model proves strong enough, promote model-driven forecast

## Final position

For industry submission, the current project should be positioned as:

- a technically honest enterprise forecasting prototype
- a microservice-ready forecasting evaluation platform
- a system with promising model-assisted forecasting performance
- a platform that still requires more work before claiming a fully mature learned-model production solution
