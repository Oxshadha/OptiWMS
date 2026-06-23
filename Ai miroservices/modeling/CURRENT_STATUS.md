# OptiWMS Forecast — Current Status

> **Last updated**: 2026-06-23 (v6 LightGBM + MLflow production pipeline)

## Architecture

```
[v6 pipeline]                        [Forecast Service]              [Frontend]
pipeline/train.py                    artifact_service.py              forecasts/page.tsx
pipeline/promote.py           ────→  runtime_data_source.py   ──────→ SKU charts
MLflow (optiwms-forecast-lightgbm)   forecast_service.py              reorder table
                                           ↑
                                     WMS Database (PostgreSQL)
                                     + forecast_outbound_history_backfill

                                     ┌─────────────────────────┐
  [Chatbot / AI Services]  ────────→ │  Forecast Gateway API   │
                                     │  /api/v1/gateway/*      │
                                     └──────────┬──────────────┘
                                                ↓
                                     BoostingForecastProvider → LightGBM h1–h12
```

## Model Status

### Champion: v6 LightGBM (bootstrap-generated FG demand)

| Item | Value |
|------|-------|
| Model | **LightGBM** (Optuna-tuned when compatible; default params fallback) |
| Dataset | `P` (Colombo FG) |
| Horizons | 1–12 (`lightgbm_h1` … `lightgbm_h12`) |
| Training data | **Bootstrap** (`data/bootstrap_fg_monthly.csv`) until WMS ≥12 months |
| Registry | MLflow `optiwms-forecast-lightgbm` |
| Artifacts | `modeling/outputs/artifacts/P/lightgbm_hN/production/` |
| Log target | `use_log_target: true` in `metadata.json` |

Legacy Random Forest / M5 champion pickles are archived under `_archive/legacy_v1_v5/`.

## Training & promotion

```bash
cd "Ai miroservices/modeling/v6_academic_final"
PYTHONPATH=. python3 -m pipeline.train --data-source bootstrap --register
PYTHONPATH=. python3 -m pipeline.promote
```

WMS transition (when enough real outbound history):

```bash
PYTHONPATH=. python3 -m pipeline.export_wms --source-csv <backfill.csv>
PYTHONPATH=. python3 -m pipeline.train --data-source wms --register
```

## Deployment phases

| Phase | Data | Model | Status |
|-------|------|-------|--------|
| 1 Bootstrap | Generated Scenario C / `bootstrap_fg_monthly.csv` | v6 LightGBM h1–h12 | **ACTIVE** |
| 2 MLflow registry | Same + run lineage | `optiwms-forecast-lightgbm` | **ACTIVE** |
| 3 Real WMS | `forecast_outbound_history_backfill` (≥12 mo, ≥20 SKUs) | Retrain + promote if gates pass | Pending data |
| 4 UI | Live `forecast_results` only | No mock chart fallbacks | **ACTIVE** |

## Repository structure

```
Ai miroservices/modeling/
├── v6_academic_final/
│   ├── pipeline/          ← train.py, promote.py, feature_engineering.py
│   ├── forecast_utils.py
│   └── mlruns/mlflow.db
├── outputs/artifacts/P/   ← lightgbm_h1..h12/production
├── _archive/legacy_v1_v5/ ← retired champion pickles
└── CURRENT_STATUS.md
```
