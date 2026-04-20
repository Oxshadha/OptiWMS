# Forecast Shadow Mode Runbook

Last updated: 2026-04-21

## Objective
Run the selected forecast candidate in production-like conditions (no automatic procurement action), then measure real realized accuracy from WMS outbound demand.

Current candidate:
- Dataset: `PV2`
- Primary model: `CATBOOST`
- Fallback: `ARIMA`

## What Shadow Mode Means Here
- Forecast runs are executed and published normally.
- UI shows recommendations and KPIs.
- Operations team reviews outputs but does not fully automate purchasing based on them.
- We collect realized demand feedback and compute post-run accuracy evidence.

## Step 1: Trigger operational runs (daily/weekly)
```bash
curl -X POST "http://localhost:8092/jobs/forecast-run?dataset=B&model_name=CATBOOST&mode=online"
```

Recommended cadence:
- Daily for active warehouse environments.
- Weekly for low-volume environments.

## Step 2: Keep health + gates monitored
```bash
curl "http://localhost:8091/artifacts/inference-alerts?limit=200&dataset=B&model_name=CATBOOST"
curl "http://localhost:8091/artifacts/acceptance-gate?dataset=B&model_name=CATBOOST&split=test&inference_window=200"
curl "http://localhost:8091/artifacts/production-readiness?dataset=B&model_name=CATBOOST&split=test&inference_window=200&soak_hours=24"
```

## Step 3: Evaluate realized shadow feedback (new)
Script:
- `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/shadow_feedback_evaluator.py`

Command:
```bash
python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/shadow_feedback_evaluator.py \
  --forecast-db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --wms-db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --schema public \
  --dataset B \
  --model-name CATBOOST \
  --outbound-statuses shipped,delivered,completed \
  --forecast-base-url http://localhost:8091 \
  --inference-window 200 \
  --out-dir /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/evidence
```

Outputs:
- `shadow_feedback_<STAMP>_rows.csv` (prediction vs actual join rows)
- `shadow_feedback_<STAMP>_by_horizon.csv` (horizon-level KPI summary)
- `shadow_feedback_<STAMP>_summary.json` (overall KPI + coverage + inference summary)

## Key KPIs to Track During Shadow
- `coverage_pct_matured` (how many matured forecasts have actuals)
- `WAPE`
- `RMSE`
- `Bias`
- `under_forecast_rate`
- Serving side:
  - `fallback_rate`
  - `hard_error_rate`
  - `p95_latency_ms`

## Minimum Exit Criteria to Move Beyond Shadow
1. Acceptance gate remains `ready=true`.
2. Production readiness remains `ready=true` with soak window pass.
3. Shadow feedback has stable KPI trend for at least 2 consecutive periods.
4. No critical operational-health incidents in observed window.

## Notes
- If `rows_matched_actuals=0`, shadow window is too early or actual outbound data is missing for matured horizons.
- Keep immutable evidence snapshots in:
  - `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/evidence`
  - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/history/leaderboards`
