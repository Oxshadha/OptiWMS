# v6 Production Pipeline

Reproducible training and promotion for OptiWMS FG demand forecasting.

## Quick start

```bash
cd "Ai miroservices/modeling/v6_academic_final"
pip install lightgbm optuna mlflow pyyaml scikit-learn pandas numpy

# Phase 0 inventory
PYTHONPATH=. python3 -m pipeline.inventory

# Train (bootstrap data) + MLflow register
PYTHONPATH=. MLFLOW_ALLOW_FILE_STORE=true python3 -m pipeline.train --data-source bootstrap --register

# Export to forecast-service artifact layout
PYTHONPATH=. python3 -m pipeline.promote
```

## WMS data transition

```bash
PYTHONPATH=. python3 -m pipeline.export_wms --source-csv /path/to/backfill.csv
PYTHONPATH=. python3 -m pipeline.train --data-source auto --register
```

`auto` selects `wms` when export has ≥12 months and ≥20 SKUs (see `config.yaml`).

## Dependencies

See `requirements.txt` in this folder.
