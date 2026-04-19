# WMS Forecast Data Onboarding Runbook (Enterprise)

Last updated: 2026-04-18

## Objective
Provide production-grade runtime data for forecast inference from WMS DB, with strict controls, repeatable validation, and audit evidence.

## Scope
- Runtime source: `orders`, `order_items`, `materials`, `inventory` (schema `public` unless configured otherwise).
- Serving requirement: outbound finished-good demand history + finished-good inventory snapshot with non-zero on-hand coverage.

## Model and Data Plug Contract
Model artifact root:
- Host path: `Ai miroservices/modeling/outputs/artifacts`
- Container path: `/model-artifacts`

Folder contract (per dataset/model/horizon):
- `<ARTIFACT_ROOT>/<DATASET>/<model>_h<horizon>/production/`

Required files:
- XGBOOST: `model.json` + `metadata.json`
- CATBOOST: `model.cbm` + `metadata.json`
- LIGHTGBM/RANDOM_FOREST: `model.pkl` + `metadata.json`

`metadata.json` minimum:
- `model_cols` (required)
- feature metadata required by online inference

Runtime source switching (env-only):
- `RUNTIME_DATA_SOURCE_MODE=csv|wms_db|auto`
- `WMS_RUNTIME_DATABASE_URL=<postgres-url>`
- `WMS_RUNTIME_OUTBOUND_STATUSES=shipped,delivered,completed`

Mode behavior:
- `snapshot` mode: best for complete dashboard rows (forecast + inventory + metrics)
- `online` mode: best for live inference path validation and serving health
- `auto` mode: online first, then snapshot fallback

Fallback inference behavior:
- primary boosting model first
- classical fallback model next
- final naive fallback (`snaive12` or `last_value`) if needed

UI deployment binding:
- `NEXT_PUBLIC_FORECAST_DEPLOYED_DATASET` (example: `B` or `PV2`)
- `NEXT_PUBLIC_FORECAST_DEPLOYED_MODEL` (example: `CATBOOST`)

Terminology:
- `A/B/C` are dataset tags
- `train/cv/test` are evaluation split labels
- They are not warehouse partitions

## Required Data Contract
Tables and required columns:
- `orders`: `id`, `order_date`, `order_type`, `status`, `warehouse_id`
- `order_items`: `order_id`, `material_id`, `quantity`
- `materials`: `id`, `material_code`, `description`, `material_type`
- `inventory`: `material_id`, `warehouse_id`, `quantity`, `reorder_point`, `max_stock`, `buffer_stock`

Semantic requirements:
- Finished goods must be labeled as `materials.material_type='product'` (case-insensitive).
- Forecast history uses outbound orders with statuses in `WMS_RUNTIME_OUTBOUND_STATUSES`.
- `order_items` must contain SKU-level quantities for outbound orders.

## Onboarding Workflow
1. Enable runtime DB mode.
2. Validate schema contract.
3. Validate runtime data readiness.
4. Run online forecast publish.
5. Validate acceptance gate + promotion gate.

## Commands
Set AI runtime source:
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/ai-services
```

Ensure `.env` has:
```env
RUNTIME_DATA_SOURCE_MODE=wms_db
WMS_RUNTIME_DATABASE_URL=postgresql://optiwms:optiwms@host.docker.internal:5434/optiwms
```

Rebuild services:
```bash
docker compose -f docker-compose.ai.yml up -d --build
```

Contract + readiness checks:
```bash
curl "http://localhost:8091/health/runtime-contract?force=true"
curl "http://localhost:8091/health/runtime-data-readiness"
curl "http://localhost:8091/health/runtime-data-readiness?warehouse_id=<WAREHOUSE_ID>"
```

Machine-readable readiness audit:
```bash
python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/runtime_data_readiness_check.py \
  --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --strict
```

Historical export + DQ artifact generation:
```bash
python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/export_outbound_history_and_dq.py \
  --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --schema public \
  --outbound-statuses delivered,packed,picking \
  --out-dir /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill
```

Load exported history into idempotent backfill table:
```bash
python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/load_outbound_history_backfill.py \
  --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --input-csv /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/<STAMP>_<DATASET_VERSION>/outbound_demand_daily.csv \
  --dataset-version <DATASET_VERSION> \
  --source-tag initial_backfill
```

One-command pipeline (recommended for operations):
```bash
python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/run_outbound_backfill_pipeline.py \
  --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --schema public \
  --outbound-statuses delivered,packed,picking \
  --out-dir /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill \
  --source-tag pipeline_backfill
```

One-command pipeline with runtime depth augmentation (recommended when lag features require deeper history):
```bash
python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/run_outbound_backfill_pipeline.py \
  --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --schema public \
  --outbound-statuses delivered,packed,picking \
  --out-dir /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill \
  --source-tag pipeline_backfill \
  --augment-runtime-history \
  --augment-months 36
```

If history depth is too short for deployed lag features, generate controlled synthetic history coverage:
```bash
python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/generate_synthetic_history_for_runtime.py \
  --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --schema public \
  --months 36 \
  --out-csv /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/synthetic_runtime_history.csv
```

Verify load/audit:
```bash
psql postgresql://optiwms:optiwms@localhost:5434/optiwms \
  -c "select count(*) as backfill_rows from forecast_outbound_history_backfill;"

psql postgresql://optiwms:optiwms@localhost:5434/optiwms \
  -c "select id,status,row_count,inserted_rows,updated_rows,dataset_version,started_at from forecast_backfill_load_audit order by id desc limit 5;"
```

Trigger online publish:
```bash
curl -X POST "http://localhost:8092/jobs/forecast-run?dataset=B&model_name=CATBOOST&mode=online"
```

Gate checks:
```bash
curl "http://localhost:8091/artifacts/acceptance-gate?dataset=B&model_name=CATBOOST&split=test&inference_window=200"
curl "http://localhost:8091/artifacts/production-readiness?dataset=B&model_name=CATBOOST&split=test&inference_window=200&soak_hours=24"
```

Governance + evidence checks:
```bash
curl "http://localhost:8091/artifacts/governance/status"
curl -X POST "http://localhost:8091/artifacts/governance/tick"
curl "http://localhost:8091/artifacts/release-evidence?dataset=B&model_name=CATBOOST&split=test&inference_window=200&soak_hours=24&history_limit=50"
```

Optional non-soak validation (local/proving only):
```bash
curl "http://localhost:8091/artifacts/production-readiness?dataset=B&model_name=CATBOOST&split=test&inference_window=200&soak_hours=0"
```

One-command post-load validation + evidence bundle (recommended):
```bash
python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/post_load_validation_and_evidence.py \
  --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --schema public \
  --dataset B \
  --model-name CATBOOST \
  --split test \
  --inference-window 200 \
  --soak-hours 24 \
  --warmup-online-runs 8
```
This command performs:
- runtime contract/data validation
- acceptance gate + production readiness evidence capture
- release evidence snapshot export
- business plausibility checks on forecast and inventory recommendation outputs

## Go/No-Go Rules
Go only if all true:
- Runtime contract status = `ok`
- Runtime data readiness status = `ok`
- Online run publishes successfully
- Acceptance gate `ready=true`
- Production readiness `ready=true`

Strict promotion rule:
- Champion promotion is allowed only when `production-readiness` with `soak_hours=24` returns `ready=true`.
- `soak_hours=0` checks are allowed only for local proving/debug and must not be used for final promotion decisions.

No-go examples:
- `reason=no_order_items_rows`
- `reason=no_product_materials`
- `reason=no_outbound_product_history_rows`
- `reason=no_nonzero_on_hand_product_inventory`

## Data Team Action Items (Current Blocking Case)
Observed blockers in current local DB:
- `order_items_count=0`
- `product_materials_count=0` (only `raw_material`)

Minimum fix to unblock forecasting:
1. Load outbound order line items into `order_items`.
2. Ensure finished goods used in outbound orders are present in `materials` with `material_type='product'`.
3. Ensure product inventory rows exist and at least some SKUs have `quantity > 0`.
4. Re-run readiness audit and store output JSON as release evidence.

## Troubleshooting (Common Runtime Stops)
### Symptom: new endpoints return `{"detail":"Not Found"}`
Example:
- `/artifacts/governance/status`
- `/artifacts/release-evidence`

Root cause:
- forecast-service container is running an older image, not current source.

Fix:
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/ai-services
docker compose -f docker-compose.ai.yml down
docker compose -f docker-compose.ai.yml up -d --build
curl "http://localhost:8091/health"
curl "http://localhost:8091/artifacts/governance/status"
```

### Symptom: acceptance gate fails with `serving_window_count=0`
Root cause:
- service restarted and inference audit window is empty.

Fix:
```bash
for i in {1..8}; do
  curl -sS -X POST "http://localhost:8092/jobs/forecast-run?dataset=B&model_name=CATBOOST&mode=online" >/dev/null
done
curl -sS -X POST "http://localhost:8091/artifacts/operational-health/refresh"
curl -sS "http://localhost:8091/artifacts/acceptance-gate?dataset=B&model_name=CATBOOST&split=test&inference_window=200"
```

## Evidence to Attach per Release
- Contract check response JSON.
- Readiness check response JSON.
- Audit script output JSON.
- Online publish response with `status=published`.
- Acceptance gate JSON (`ready=true`).
- Production readiness JSON (`ready=true`).
