# OptiWMS Forecast — Current Status

> **Last updated**: 2026-05-05 (v2 M5 clean pipeline)

## Architecture

```
[v2 M5 Pipeline]                     [Forecast Service]              [Frontend]
01_prepare_m5.py                     artifact_service.py              forecasts/page.tsx
02_train_global_model.py  ──────→    runtime_data_source.py   ──────→ SKU charts
03_evaluate.py                       forecast_service.py              reorder table
                                           ↑
                                     WMS Database (PostgreSQL)
                                     + forecast_outbound_history_backfill
```

## Model Status

### Champion Models (All Trained on M5 Dataset)

| Model | Avg WAPE | Avg MASE | Avg Bias | Beats Naive | Status |
|-------|----------|----------|----------|-------------|--------|
| **LightGBM** | **0.1521** | **0.5763** | -98.4 | 10/11 horizons | ✅ Best overall |
| CatBoost | 0.1531 | 0.5812 | +210.0 | 10/11 horizons | ✅ Close second |
| XGBoost | 0.1540 | 0.5823 | -110.7 | 10/11 horizons | ✅ Consistent |
| **Seasonal Naive** | **0.1955** | 1.0000 | — | baseline | ⬜ Baseline |

**All three models beat seasonal naive on 10 out of 11 horizons** (H1-H10). At H11, model accuracy degrades
due to forecast horizon length — this is expected and consistent with forecasting literature.

### Per-Horizon Breakdown (XGBoost, Test Set)

| Horizon | WAPE | MASE | Bias | vs Naive |
|---------|------|------|------|----------|
| H1 | 0.0997 | 0.3925 | +266 | ✅ beats 0.1688 |
| H2 | 0.1049 | 0.4118 | +265 | ✅ beats 0.1839 |
| H3 | 0.1153 | 0.4496 | +390 | ✅ beats 0.1882 |
| H4 | 0.1211 | 0.4722 | +402 | ✅ beats 0.1975 |
| H5 | 0.1276 | 0.4938 | +385 | ✅ beats 0.1897 |
| H6 | 0.1410 | 0.5502 | +431 | ✅ beats 0.1883 |
| H7 | 0.1525 | 0.6011 | +481 | ✅ beats 0.1882 |
| H8 | 0.1588 | 0.6232 | +237 | ✅ beats 0.1842 |
| H9 | 0.1731 | 0.6754 | -113 | ✅ beats 0.2108 |
| H10 | 0.2079 | 0.7802 | -747 | ✅ beats 0.2223 |
| H11 | 0.2917 | 0.9559 | -3213 | ❌ naive wins |

### Feature Importance (Top 5, Consistent Across All Horizons)

1. `roll_mean_6` — 6-month rolling average (strongest signal)
2. `lag_1` — Previous month demand
3. `roll_mean_3` — 3-month rolling average
4. `lag_3` — Demand 3 months ago
5. `roll_mean_12` — 12-month rolling average

## Data Pipeline

### Training Data: M5 Forecasting Competition (Walmart)
- **Source**: Kaggle M5 Forecasting Accuracy Competition (2020)
- **Volume**: 30,490 SKUs × 1,941 days (5.3 years)
- **Aggregation**: Monthly at `dept × store` level → 70 series × 65 months
- **Split**: 35 months train / 6 months validation / 12 months test
- **Features**: 12 lags + 3 rolling means + 2 rolling stds + calendar + price = 23 features

### Runtime Data: WMS Database
- The forecast service queries the WMS PostgreSQL database for real outbound order history
- For demo/cold-start: `generate_synthetic_history_for_runtime.py` creates realistic backfill
  from the materials in the `inventory` table
- Synthetic data includes: per-product volatility, intermittent demand, promotional spikes,
  stockout censoring, phase-shifted seasonality

## Deployment Phases

| Phase | Data Source | Model | Status |
|-------|-----------|-------|--------|
| Phase 1: Pre-training | M5 dataset | XGBoost/CatBoost/LightGBM | ✅ Complete |
| Phase 2: Cold-start deploy | Synthetic backfill + growing real data | Pre-trained model | ✅ Ready |
| Phase 3: Fine-tuning | ≥12 months real WMS data | Warm-start from pre-trained | ⬜ Future |

## Repository Structure

```
Ai miroservices/modeling/
├── v2_m5_clean/          ← Current: clean M5 pipeline (4 scripts + config)
├── v1_legacy/            ← Previous: synthetic data approach (23 notebooks + 23 scripts)
├── outputs/              ← Shared: artifacts + reports (docker volume mount target)
│   ├── artifacts/P/      ← Model files (XGBoost/CatBoost/LightGBM × H1-H12)
│   ├── reports/          ← CSVs for frontend dashboard
│   └── m5_prepared/      ← Prepared M5 panel (parquet)
├── CURRENT_STATUS.md     ← This file
└── requirements.txt
```

## Key Decisions & Rationale

1. **M5 over synthetic data**: Real retail demand data produces unbiased models.
   The v1 synthetic approach created circular validation (trained on generated patterns,
   evaluated on the same patterns).

2. **Global model over per-series models**: With 70+ series sharing features,
   a global model learns cross-series patterns. This transfers better to new WMS
   deployments with different products.

3. **Direct multi-step over recursive**: One model per horizon avoids error accumulation
   from recursive forecasting. Standard practice in production systems.

4. **dept×store aggregation over item×store**: 70 series is cleaner to train, and the
   department-level patterns map well to WMS material categories. Item-level (30K series)
   adds noise without proportional accuracy gain for monthly forecasting.
