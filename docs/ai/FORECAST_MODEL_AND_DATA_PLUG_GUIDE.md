# Forecast Model and Data Plug Guide (No Confusion)

## Scope
This is the exact integration contract for OptiWMS Forecasting right now.

## 1) What is fixed in UI now

- Decision View:
  - Managers only set **Horizon** and view outputs.
  - No dataset/split/model selection.
- Model Performance:
  - Used to inspect deployed-model metrics by horizon.
  - No model comparison chart.
  - Evaluation split is fixed to `test`.
- Dataset and model are deployment-configured in frontend:
  - `NEXT_PUBLIC_FORECAST_DEPLOYED_DATASET` (default `PV2`)
  - `NEXT_PUBLIC_FORECAST_DEPLOYED_MODEL` (default `CATBOOST`)

## 2) Where to plug a trained model

Forecast service loads artifacts from:
- Host path: `Ai miroservices/modeling/outputs/artifacts`
- Container path: `/model-artifacts`

Folder contract (per dataset/model/horizon):
- `<ARTIFACT_ROOT>/<DATASET>/<model>_h<horizon>/production/`

Examples:
- `.../artifacts/PV2/xgboost_h1/production/model.json`
- `.../artifacts/PV2/catboost_h1/production/model.cbm`
- `.../artifacts/PV2/lightgbm_h1/production/model.pkl`

Required files:
- XGBOOST: `model.json` + `metadata.json`
- CATBOOST: `model.cbm` + `metadata.json`
- LIGHTGBM/RANDOM_FOREST: `model.pkl` + `metadata.json`

`metadata.json` must include:
- `model_cols` (required)
- feature column metadata used during online inference

## 3) Where live WMS data plugs in

Two runtime data sources now exist:

- `csv` mode (current demo-safe default):
  - Uses report files under `Ai miroservices/modeling/outputs/reports`.
  - Best for offline demonstration and reproducible notebook outputs.
- `wms_db` mode (production cutover path):
  - Uses live WMS PostgreSQL history and inventory state.
  - Demand history source: `orders` + `order_items` + `materials` (outbound product demand aggregated monthly).
  - Inventory context source: `inventory` + `materials`.
  - Keeps same model artifact loading path (`/model-artifacts`), only data source changes.

Switching mode is env-only:

- `RUNTIME_DATA_SOURCE_MODE=csv|wms_db|auto`
- `WMS_RUNTIME_DATABASE_URL=<postgres-url>`
- `WMS_RUNTIME_OUTBOUND_STATUSES=shipped,delivered,completed`

`auto` behavior:
- try `wms_db` first,
- if no usable history rows, fallback to `csv`.

Live inference entry remains:
- `/artifacts/infer-boosting-online`

Fallback behavior (real, not mock):
- Primary boosting model (for example `CATBOOST`) runs first.
- If inference fails per series, service tries configured classical fallback artifact (`ARIMA` by default).
- If that also fails, service uses naive fallback (`snaive12` or `last_value`).

## 4) What ABC and split mean in system

- `A/B/C` are dataset tags used by training/artifacts/reports organization.
- `test/cv/train` are evaluation split labels in metrics tables.
- They are not automatic WMS warehouse partitions.

## 5) How to run for full dashboard output

For complete business dashboard rows (forecast + metrics + inventory), use:
- Trigger mode: `snapshot`

`online` mode is inference-path focused and may not produce full evaluation/report rows expected by Model Performance.

For production-style demo with live history + live inventory:

1. Set `RUNTIME_DATA_SOURCE_MODE=wms_db`
2. Set `WMS_RUNTIME_DATABASE_URL` to WMS PostgreSQL
3. Publish run with `mode=online`
4. Optional: publish `snapshot` run to load precomputed evaluation metrics from reports until online evaluator is finalized.

## 6) Deployment commands (AI services)

From repo root:

```bash
cd ai-services
docker compose -f docker-compose.ai.yml down
docker compose -f docker-compose.ai.yml up -d --build
```

Then verify:

```bash
curl http://localhost:8091/health
curl http://localhost:8092/health
```

Frontend deploy env for locked production view:

```bash
NEXT_PUBLIC_FORECAST_DEPLOYED_DATASET=PV2
NEXT_PUBLIC_FORECAST_DEPLOYED_MODEL=CATBOOST
```

## 7) If you train a new best model tomorrow

1. Export artifacts into the folder contract above for dataset `PV2` (or your deployed dataset tag).
2. Ensure every horizon (`h1..h12`) has model + metadata.
3. Restart AI services.
4. Run forecast in `snapshot` mode and validate rows in UI.
5. Promote model in registry/champion flow (if enabled for your environment).

### Evaluator Q&A (enterprise checks)

- **Where are models stored?**
  - Versioned artifact folders under `Ai miroservices/modeling/outputs/artifacts`.
  - Mounted read-only into forecast-service as `/model-artifacts`.
- **Which model formats are used?**
  - CATBOOST `.cbm`, XGBOOST `.json`, classical/fallback `.pkl`, each with `metadata.json`.
- **Where is runtime forecast state stored?**
  - Forecast service DB (`forecast_service.db`) in Docker volume `forecast-service-data`.
- **Is it connected to inventory DB?**
  - Yes when `RUNTIME_DATA_SOURCE_MODE=wms_db`: service reads live WMS inventory and order history.
  - In `csv` mode it reads report snapshots.
- **Can we replace model/data later without code changes?**
  - Yes. Artifacts and runtime source are config-driven. Cutover is env + artifact publish.

## 8) Current known limitation (still pending)

- Run publish can complete while metrics rows for `test` are missing for selected model/run, causing `N/A` cards in Model Performance.
- This must be closed by adding publish completeness checks (`predictions + metrics + inventory`) before marking run fully successful.

## 9) Datascientist handoff checklist (final production cutover)

When DS final model is ready, execute this checklist in order:

1. Freeze artifact package
   - Export main model (`CATBOOST` or chosen champion) for all horizons `h1..h12`.
   - Export fallback artifact (`ARIMA` recommended) for all horizons `h1..h12`.
   - Ensure every horizon has `metadata.json` with correct `model_cols`.
2. Freeze metric package
   - Export evaluation metrics CSV from the final backtest (`test` split required for UI cards).
   - Confirm WAPE/RMSE/MASE/Bias rows exist for horizons `0..12` as applicable.
3. Publish artifacts to mounted path
   - Copy to `Ai miroservices/modeling/outputs/artifacts/<DATASET>/...`.
   - Verify files are visible in container under `/model-artifacts/<DATASET>/...`.
4. Set runtime mode
   - Demo mode: `RUNTIME_DATA_SOURCE_MODE=csv`.
   - Live mode: `RUNTIME_DATA_SOURCE_MODE=wms_db` + `WMS_RUNTIME_DATABASE_URL`.
5. Rebuild and restart services
   - `docker compose -f ai-services/docker-compose.ai.yml up -d --build`.
6. Publish validation run
   - Trigger `snapshot` and verify: forecasts + metrics + inventory rows are all populated.
   - Trigger `online` and verify inference audit has low fallback/error rates.
7. Sign-off gates
   - Check acceptance gates and alert endpoints.
   - Record final run IDs and artifact version in release notes.
