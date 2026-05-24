# OptiWMS Forecast — Current Status

> **Last updated**: 2026-05-24 (Production Deployment Ready)

## Architecture

```
[v4 M5 Pipeline]                     [Forecast Service]              [Frontend]
01_prepare_m5_data.py                artifact_service.py              forecasts/page.tsx
03_model_comparison_m5.ipynb  ────→  runtime_data_source.py   ──────→ SKU charts
09_promote_champion.py               forecast_service.py              reorder table
                                           ↑
                                     WMS Database (PostgreSQL)
                                     + forecast_outbound_history_backfill
```

## Model Status

### Champion Models (All Trained on M5 Dataset - v4 Proper)

We compared 7 models on critical supply chain metrics: WAPE, MAPE, RMSE, MAE, MASE, and Bias.

| Model | Val WAPE | Val RMSE | Val Bias | Test WAPE | Test Bias | Status |
|-------|----------|----------|----------|-----------|-----------|--------|
| **Random Forest** | **0.0716** | **1883.9** | **50.7** | **0.0807** | **-212.1** | 🏆 **Champion (Deployed)** |
| LightGBM | 0.0699 | 2023.1 | 82.2 | 0.0847 | -309.8 | 🥈 Close second (Higher Bias/RMSE) |
| XGBoost | 0.0768 | 2153.1 | -18.1 | - | - | ✅ Lowest Absolute Bias |
| CatBoost | 0.0816 | 1929.7 | -73.3 | - | - | ✅ Good |
| Seasonal Naive | 0.1285 | 3705.5 | 124.3 | 0.1520 | 1332.1 | ⬜ **Fallback Baseline** |

**Why Random Forest was chosen as Champion:**
While LightGBM technically had a slightly better WAPE (0.0699 vs 0.0716), **Random Forest** was explicitly selected as the production champion due to critical warehouse priorities:
1. **Lowest RMSE**: It minimizes massive error spikes. In a warehouse, a massive prediction spike leads to catastrophic stockouts or overstock, making RMSE the most critical safety metric.
2. **Lower Bias**: It has a significantly lower bias tendency compared to LightGBM.

## System Integration & Live Deployment

The system is fully professionalized and actively deploying the best model:

### 1. Model Serialization & Promotion
- **Dynamic Promotion**: The `09_promote_champion.py` script automatically reads the champion model designation from `metadata.json` and deploys it to the correct production path (`outputs/artifacts/P/random_forest_h1/production`).
- **Generalization Tracking**: The comparison notebook now actively tracks Train vs Validation vs Test metrics to visualize and prevent overfitting.

### 2. Frontend UI / Dashboard Metrics
- **MAPE Calculation Fixed**: The frontend was previously incorrectly multiplying `WAPE * 100` and displaying it as MAPE (which caused a ~15% baseline fallback display).
- **True Metrics Rendered**: The dashboard now correctly extracts the exact `MAPE` metric (e.g. `9.65%` for Random Forest) directly from the backend API's payload, accurately reflecting true ML performance.
- **Reliability & Fallbacks**: The system falls back to `Seasonal Naive` if ML fails (e.g. missing features), ensuring the warehouse always has a demand baseline.

## Deployment Phases

| Phase | Data Source | Model | Status |
|-------|-----------|-------|--------|
| Phase 1: Pre-training | M5 dataset | 7 Models Compared | ✅ Complete |
| Phase 2: Live Deployment | **WMS PostgreSQL (Online)** | **Random Forest (Champion)** | ✅ **ACTIVE** |
| Phase 3: Fine-tuning | ≥12 months real WMS data | Warm-start from pre-trained | ⬜ Future |

## Repository Structure

```
Ai miroservices/modeling/
├── v4_m5_proper/         ← Current: complete M5 pipeline with full evaluation
│   ├── 03_model_comparison_m5.ipynb ← Trains models, Generalization Charts, Selects Champion
│   ├── 09_promote_champion.py       ← Deploys Champion to Backend Artifacts
│   ├── champion_model/              ← Local serialized `.pkl` and `metadata.json`
│   └── model_comparison_results.csv ← Static logging of run metrics
├── outputs/artifacts/P/  ← Production Deployment Target
│   ├── random_forest_h1/production/ ← Active Deployment
│   └── lightgbm_h1/production/      ← Previous Deployment
└── CURRENT_STATUS.md     ← This file
```
