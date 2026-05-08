# OptiWMS Forecast v2 — Clean M5 Pipeline

## Overview

This pipeline trains a global demand forecasting model on the **M5 Forecasting Competition dataset** (real Walmart retail data) for use as a pre-trained foundation model in OptiWMS deployments.

### Why M5?
- 30,490 real product SKUs × 1,941 days (~5.3 years) of actual retail demand
- Includes prices, calendar events, and cross-sectional structure
- Demand patterns (seasonality, trend, intermittency) are transferable across retail/warehouse domains
- Academically vetted dataset used in published research

### Architecture
```
M5 Dataset → 01_prepare → 02_train → 03_evaluate → artifacts/
                                                         ↓
                                            Forecast Service reads
                                            (via docker volume mount)
                                                         ↓
                                            Frontend shows forecasts
                                            for WMS materials
```

## Scripts

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `01_prepare_m5.py` | Load M5, aggregate to monthly, engineer features, split | Raw M5 CSVs | `m5_monthly_panel.parquet` |
| `02_train_global_model.py` | Train XGBoost/CatBoost/LightGBM per horizon | Prepared panel | Model artifacts |
| `03_evaluate.py` | Evaluate on test set, compare vs seasonal naive | Panel + artifacts | Report CSVs |
| `04_fine_tune.py` | Fine-tune on WMS data (Phase 3, future) | WMS DB + pre-trained model | Updated artifacts |

## How to Run

```bash
# Install dependencies (if not already)
pip install xgboost catboost lightgbm pandas numpy pyyaml pyarrow

# Step 1: Prepare data (~2 min)
python 01_prepare_m5.py

# Step 2: Train models (~5-10 min)
python 02_train_global_model.py

# Step 3: Evaluate (~2 min)
python 03_evaluate.py
```

## Configuration

All parameters are in `config.yaml`. Key settings:

- **Aggregation level**: `dept_store` (~70 series) — maps well to WMS material categories
- **Features**: 12 lags, 3 rolling means, 2 rolling stds, calendar features, price
- **Split**: 12 months test, 6 months validation, 18+ months train
- **Dataset tag**: `P` — matches existing service configuration

## Output Compatibility

All outputs write to `../outputs/` which is the **same directory** mounted by docker-compose:
- `../outputs/artifacts/P/xgboost_h{1..12}/production/model.json`
- `../outputs/reports/test_metrics_by_horizon.csv`
- `../outputs/reports/dashboard_forecast_output.csv`
- `../outputs/reports/dashboard_inventory_recommendations.csv`

The forecast service (`artifact_service.py`) reads these artifacts unchanged.

## v1 Legacy

Previous notebooks and scripts are preserved in `../v1_legacy/` for reference.
The v1 approach used synthetic data generation → model training → calibration blending.
This v2 approach uses real M5 data → global model → transfer to WMS.
