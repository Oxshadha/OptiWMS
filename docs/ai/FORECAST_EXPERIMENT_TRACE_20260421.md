# Forecast Experiment Trace (2026-04-21)

## Scope
This file is the supervisor-facing trace for the latest forecast experiment cycle:
- what was changed,
- what data was used,
- what commands were run,
- what evidence files were generated,
- what decision was made.

## What Changed
1. Added external-signal enrichment step for portable dataset.
2. Produced enriched dataset variant `PV2` from base `P`.
3. Ran strict A/B fair-play experiment using the same model family and split protocol on both datasets.

Code added:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/enrich_portable_with_external_signals.py`

## Data Used
Base training data:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/rule_based_portable_monthly.csv` (`P`)

Enriched training data:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/p_v2_portable_monthly.csv` (`PV2`)

Enrichment report:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/external_signals_enrichment_report.json`

Signal source in this run:
- deterministic fallback commodity index (no external commodity CSV passed in command).

## Commands Executed
Enrichment:
```bash
python "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/enrich_portable_with_external_signals.py"
```

Fair-play A/B training:
```bash
python "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/train_and_save_models.py" \
  --datasets P PV2 \
  --boosting-models XGBOOST CATBOOST \
  --classical-models ETS ARIMA SARIMA \
  --feature-profile full \
  --horizons 1,2,3,4,5,6,7,8,9,10,11,12 \
  --tag pv2_external_ablation_full
```

## Evidence Artifacts
Primary leaderboard:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_leaderboard.csv`

Per-dataset metrics:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_p_metrics.csv`
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_pv2_metrics.csv`

Archived immutable snapshot:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/history/leaderboards/20260420T200411Z_pv2_external_ablation_full_leaderboard.csv`

Run metadata:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_run_metadata/metadata.json`
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_deployment_registry.json`

## Results Summary (`test`, `horizon=0`)
`P`:
- ARIMA: WAPE `0.269123`, RMSE `2745.101`, MASE `0.837422`
- CATBOOST: WAPE `0.320995`, RMSE `2971.725`, MASE `7.850909`
- XGBOOST: WAPE `0.321966`, RMSE `3190.205`, MASE `1.792354`

`PV2`:
- CATBOOST: WAPE `0.193944`, RMSE `465.608`, MASE `0.916691`
- ARIMA: WAPE `0.205663`, RMSE `506.522`, MASE `0.972827`
- XGBOOST: WAPE `0.207437`, RMSE `496.855`, MASE `0.972814`

## A/B Delta (PV2 - P)
- CATBOOST: `ΔWAPE -0.127051`, `ΔRMSE -2506.117`, `ΔMASE -6.934219`
- XGBOOST: `ΔWAPE -0.114529`, `ΔRMSE -2693.350`, `ΔMASE -0.819540`
- ARIMA: `ΔWAPE -0.063461`, `ΔRMSE -2238.578`, `ΔMASE +0.135404`

Interpretation:
- PV2 materially improves WAPE and RMSE versus P.
- Best current enriched-path model is CATBOOST.

## Decision
- Keep `PV2` as active training dataset variant.
- Champion candidate: `CATBOOST`.
- Fallback candidate: `ARIMA`.

## Remaining Validation Before Final Promotion
1. Re-run acceptance gate and production-readiness against selected candidate in serving path.
2. Refresh evidence bundle after latest online serving window.
3. Optionally run one additional enrichment variant with real commodity index CSV/API to confirm stability.
