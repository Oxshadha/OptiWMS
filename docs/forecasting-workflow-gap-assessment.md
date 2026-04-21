# Forecasting Workflow Gap Assessment

## Implemented in this pass

- Notebook-first dataset audit and cleaning workflow for datasets A, B, and C.
- Cleaned dataset exports under `Ai miroservices/modeling/outputs/cleaned/`.
- Audit summaries and split summaries under `Ai miroservices/modeling/outputs/audit/`.
- Training-and-save workflow for forecasting models with artifact output under `Ai miroservices/modeling/outputs/artifacts/`.
- Leaderboard and deployment-registry-style report generation under `Ai miroservices/modeling/outputs/reports/`.

## Key gaps still present in the repo

### 1. Forecast microservice is snapshot-based, not model-serving

- `ai-services/forecast-service` ingests CSV outputs into SQLite.
- It does not load saved model artifacts and infer against live WMS data.
- There is no production feature-builder that recreates the training feature set from WMS records.

### 2. Split naming is inconsistent across the stack

- Modeling uses `train`, `val`, and `test`.
- Frontend filter currently exposes `train`, `cv`, and `test`.
- This should be aligned before product decisions are taken from the dashboard.

### 3. Saved artifacts are not yet consumed by backend inference

- Artifacts are now generated in the modeling workspace.
- No FastAPI route currently loads those artifacts for prediction.
- No model registry table exists in the backend database.

### 4. Frontend advertises unsupported models

- Admin forecasts page includes `NBEATS` and `TFT`.
- Those models are not implemented in the current modeling scripts.

### 5. M5 transfer test is not yet a strict synthetic-to-real artifact transfer test

- Classical models can be evaluated on M5, but they are fit at inference time unless artifact transfer logic is added.
- XGBoost/CatBoost M5 transfer requires compatible saved artifacts plus feature-schema adaptation.

## Recommended next implementation order

1. Align split semantics across notebooks, reports, backend, and frontend.
2. Add backend model-registry metadata and active champion/fallback selection.
3. Add inference endpoints that load artifacts and build features from WMS data.
4. Add monitoring outputs for drift, bias, and live forecast-vs-actual tracking.
5. Add a strict M5 transfer notebook that uses saved artifacts or clearly separates transfer vs refit experiments.
