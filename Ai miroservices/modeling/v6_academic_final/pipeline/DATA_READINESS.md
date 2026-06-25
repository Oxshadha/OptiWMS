# v6 Production Data Readiness

> Generated as part of Phase 0 inventory. Last run: bootstrap pipeline setup.

## Data sources

| Source | Status | Use |
|--------|--------|-----|
| `hemas_scenario_c_dataset_cleaned.csv` | Optional (may be absent locally) | Primary FG bootstrap |
| `pipeline/bootstrap_fg_monthly.csv` | Generated on demand | Synthetic FG panel (103 SKUs × 36 months) |
| `outputs/generated/rule_based_wms_monthly.csv` | Optional | RM / Croston path |
| WMS `forecast_outbound_history_backfill` | Future (`data_source=wms`) | Real outbound when ≥12 months |

## Legacy artifacts (pre-v6)

| Path | Action |
|------|--------|
| `v3_beverage/champion_model/model.pkl` | Archive after v6 promote |
| `v4_m5_proper/champion_model/model.pkl` | Archive after v6 promote |
| `v5_paper_compliant/data/03_lgbm_model.pkl` | Archive after v6 promote |
| `outputs/artifacts/P/*` | Replaced by v6 `promote.py` export |

## MLflow

- Local tracking: `file://` under `v6_academic_final/mlruns/` or `MLFLOW_TRACKING_URI`
- Experiment: `OptiWMS_v6_FG`
- Registered model: `optiwms-forecast-lightgbm`

## WMS transition gate

Training switches to `data_source=wms` when:

- `forecast_outbound_history_backfill` export has **≥12** distinct months and **≥20** SKUs, or
- `TRAINING_DATA_SOURCE=wms` env override.
