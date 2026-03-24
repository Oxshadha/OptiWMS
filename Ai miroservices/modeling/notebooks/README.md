# Forecasting Notebook Execution Order

Use these notebooks in this order.

## Primary workflow

1. `00_dataset_audit_and_cleaning.ipynb`
   - audit A, B, C
   - apply conservative cleaning
   - export cleaned datasets

2. `01_split_protocol_validation.ipynb`
   - confirm train / validation / test split logic
   - confirm dataset C scenario handling
   - check for leakage

3. `02_global_model_training_and_artifact_save.ipynb`
   - train global models (`XGBOOST`, `CATBOOST`) on cleaned data
   - save artifacts
   - save leaderboard and registry outputs

4. `03_model_bias_overfit_analysis.ipynb`
   - inspect test metrics
   - inspect bias
   - inspect horizon degradation
   - review rolling CV outputs

5. `05a_classical_kaggle_csvs.ipynb`
   - generates separate Kaggle-format CSV files for classical models only
   - available outputs: `SNAIVE7.csv`, `SNAIVE28.csv`, `ETS.csv`, `ARIMA.csv`, `SARIMA.csv`
   - does not use saved global boosting artifacts

6. `05b_global_model_transfer_only.ipynb`
   - strict saved-artifact transfer test on M5
   - no retraining on M5
   - valid for global saved-model transfer evaluation
   - there is currently no valid `XGBOOST.csv` or `CATBOOST.csv` from unchanged saved monthly synthetic-trained weights

## Legacy notebooks

Older exploratory notebooks were moved into `notebooks/legacy/`.
They are kept for reference, but they are not the main execution path anymore.

## Important interpretation

- Dataset `A`: baseline demand-only benchmark
- Dataset `B`: main production candidate dataset
- Dataset `C`: robustness / stress dataset

Do **not** blindly merge A, B, and C into one raw dataset for the first pass.
Treat them as separate evaluation tracks.
