# Forecasting Notebook Execution Order

Use these notebooks in this order.

## Current recommended workflow

1. `00a_real_source_active_stock_audit.ipynb`
   - audits the real Excel source
   - extracts the canonical `Active stock` seed table
   - confirms the real-data limitation before synthetic generation

2. `02_global_model_training_and_artifact_save.ipynb`
   - trains the current portable model track on dataset `P`
   - current default path is `P + XGBOOST/CATBOOST`
   - saves artifacts and leaderboard outputs

3. `05b_global_model_transfer_only.ipynb`
   - runs saved-artifact transfer on M5 monthly aggregates
   - current default path is `P + XGBOOST + recent_level_blend`
   - this is the main external-transfer validation notebook

## Secondary / diagnostic notebooks

4. `00_dataset_audit_and_cleaning.ipynb`
   - audits the older `A`, `B`, `C` synthetic datasets
   - still useful for comparison against the older workflow

5. `01_split_protocol_validation.ipynb`
   - confirms train / validation / test split logic
   - checks leakage assumptions

6. `03_model_bias_overfit_analysis.ipynb`
   - inspects bias and horizon degradation on the training workflow outputs
   - use this after a completed training run

7. `05_m5_submission_inference.ipynb`
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
