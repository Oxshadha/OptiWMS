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

Live inference entry:
- `/artifacts/infer-boosting-online`

Expected payload:
- Per-series history and static fields aligned to model feature contract.
- Service constructs feature rows using `model_cols` and predicts horizon-wise.

Important:
- If incoming payload does not match expected features/history depth, fallback path is used.

## 4) What ABC and split mean in system

- `A/B/C` are dataset tags used by training/artifacts/reports organization.
- `test/cv/train` are evaluation split labels in metrics tables.
- They are not automatic WMS warehouse partitions.

## 5) How to run for full dashboard output

For complete business dashboard rows (forecast + metrics + inventory), use:
- Trigger mode: `snapshot`

`online` mode is inference-path focused and may not produce full evaluation/report rows expected by Model Performance.

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

## 8) Current known limitation (still pending)

- Run publish can complete while metrics rows for `test` are missing for selected model/run, causing `N/A` cards in Model Performance.
- This must be closed by adding publish completeness checks (`predictions + metrics + inventory`) before marking run fully successful.
