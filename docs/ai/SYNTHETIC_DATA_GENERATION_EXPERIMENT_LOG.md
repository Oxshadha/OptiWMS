# Synthetic Data Generation Experiment Log

Last updated: 2026-04-20

Purpose: maintain an auditable history of synthetic-data attempts, failures, metric outcomes, and improvement actions.

## How to use this log
- Add one entry per generation/training cycle.
- Never delete failed attempts; mark them with explicit failure reasons.
- Link evidence files (CSV/JSON) and commands used.
- Record decision (`continue` or `stop`) with reasons.

## Entry template

```md
### [EXP-YYYYMMDD-XX] <short title>
- Date:
- Owner:
- Goal:
- Inputs:
  - Anchor data:
  - BOM version:
  - Runtime snapshot:
- Generation method:
- Command(s):
- Output artifacts:
- Quality checks:
  - Anchor alignment:
  - Runtime readiness:
  - Acceptance gate:
  - Production readiness:
- Model comparison highlights:
- Failure modes observed:
- Decision:
- Next changes:
```

## Experiment history

### [EXP-20260420-01] Kaggle dataset fit check
- Date: 2026-04-20
- Owner: OptiWMS Forecast Team
- Goal: evaluate whether Kaggle logistics dataset can replace current synthetic bridge.
- Inputs:
  - Source CSV: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/Kaggle warehouse data/logistics_dataset.csv`
  - Source metadata: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/Kaggle warehouse data/logistics-warehouse-dataset-metadata.json`
- Generation method: schema and contract profiling only (no load to runtime contract).
- Output artifacts:
  - Assessment doc: `/Users/k.e.oshada/Documents/OptiWMS/docs/ai/EXTERNAL_DATASET_FIT_ASSESSMENT.md`
- Quality checks:
  - Historical demand contract fit: failed
  - Two-layer BOM demand compatibility: failed for direct use
- Failure modes observed:
  - dataset is KPI/snapshot style, not true time-series demand history
  - contains forecast field, not actual demand label
  - no direct runtime-contract compatibility for `forecast_outbound_history_backfill`
- Decision: stop using this dataset for primary training/evaluation; keep only for optional stress testing.
- Next changes:
  - continue anchor-constrained BOM-dependent synthetic generation
  - improve realism controls and rerun fair-play comparison

### [EXP-20260420-02] Current synthetic behavior review
- Date: 2026-04-20
- Goal: decide whether current synthetic generation is good enough to continue model tuning.
- Evidence files:
  - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/portable_fair_play_leaderboard.csv`
  - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/portable_fair_play_p_metrics.csv`
  - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/synthetic_anchor_alignment_summary.csv`
  - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/synthetic_anchor_alignment_metadata.json`
- Model comparison highlights (test horizon=0):
  - ARIMA WAPE `0.2691`
  - ETS WAPE `0.2797`
  - RandomForest WAPE `0.2974`
  - CatBoost WAPE `0.3210`
  - XGBoost WAPE `0.3220`
  - LightGBM WAPE `0.5316`
- Failure modes observed:
  - high WAPE/Bias for production-oriented ML models
  - unrealistic behavior signs in synthetic dynamics (boosting models not benefiting from features)
- Decision: stop further model tuning on current synthetic version.
- Next changes:
  - improve data realism first (level/variance/seasonality/promo/stockout/lead-lag controls)
  - rerun EDA + fair-play after regeneration

### [EXP-20260420-03] Strict realism gate generation (anchor-constrained + BOM dependent)
- Date: 2026-04-20
- Goal: enforce hard data realism gate before any downstream training.
- Command:
  - `python /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/generate_excel_constrained_bom_dependent_history.py --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms --schema public --excel-path "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/Forecast model train data optiwms/RM ROP and Pallet requirement  4- SEP.xlsx" --months 36 --source-tag excel_bom_dependent_synth --strict-realism --min-anchor-coverage 0.70 --max-weighted-anchor-ape 0.40 --min-matched-skus 40 --independent-tail-top-n 260 --out-csv /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/synthetic_bom_dependent_history.csv --no-load`
- Output artifacts:
  - CSV: `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/synthetic_bom_dependent_history.csv`
  - Report: `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/synthetic_bom_dependent_history.report.json`
- Gate result:
  - `status=ok`, `reason=ok`, `realism_gate_pass=true`
  - `anchor_coverage_pct=0.902778`
  - `matched_sku_count=260`
  - `weighted_abs_anchor_pct_err=0.022492`
  - `median_ratio_gen_to_anchor=1.01792` (p10=`1.005858`, p90=`1.033875`)
- Decision: proceed to load + full fair-play retraining/evaluation pipeline.

### [EXP-20260420-04] Refresh modeling dataset P from strict runtime backfill
- Date: 2026-04-20
- Goal: ensure notebook `04_fair_play_model_comparison.ipynb` runs on updated realistic synthetic data, not stale rule-based data.
- Script:
  - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/prepare_portable_from_runtime_backfill.py`
- Command:
  - `python /Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/prepare_portable_from_runtime_backfill.py`
- Input:
  - `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/backfill/synthetic_bom_dependent_history.csv`
- Output:
  - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/rule_based_portable_monthly.csv`
  - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/p_runtime_refresh_report.json`
- Result:
  - rows_out=`9396`, sku_count=`261`, month_count=`36`, date range=`2023-05-01` to `2026-04-01`
- Decision: rerun fair-play notebook now; compare leaderboard deltas against archived prior round.

### [EXP-20260420-05] Realism v2 generator behavior upgrade
- Date: 2026-04-20
- Goal: break metric plateau by introducing more realistic dynamics before fair-play rerun.
- Code updated:
  - `/Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/generate_excel_constrained_bom_dependent_history.py`
- Added behaviors:
  - deterministic regime shifts (multi-phase demand levels),
  - intermittent low-demand months for sparse SKUs,
  - stock-stress suppression + rebound pattern,
  - category-tuned seasonality/promo probabilities,
  - component-type lead-time variability and scrap spikes.
- Strict generation result:
  - `dataset_version=af7f89a5a6268685`
  - `rows_daily=9384`, `sku_count=261`, `months_min=28`
  - `anchor_coverage_pct=0.902778`
  - `weighted_abs_anchor_pct_err=0.049882`
  - `realism_gate_pass=true`
- Modeling dataset refresh result:
  - output rows=`9384`, demand_sum=`20,328,833.013`
  - dataset hash changed to `97443351c6d6738923882252a43f06a71ffbabc57dc0447072cc117eba690681`
- Decision: fair-play rerun required to measure whether new data behavior improves model ranking and absolute errors.

### [EXP-20260421-01] External-signals enrichment + strict A/B ablation (P vs PV2)
- Date: 2026-04-21
- Goal: test whether adding external/context signals improves fair-play model quality versus base portable dataset.
- Inputs:
  - Base dataset: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/rule_based_portable_monthly.csv` (`P`)
  - Enriched dataset target: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/p_v2_portable_monthly.csv` (`PV2`)
  - Enrichment report: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/external_signals_enrichment_report.json`
- Generation/enrichment method:
  - script: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/enrich_portable_with_external_signals.py`
  - added columns: `on_hand_inventory`, `stockout_days`, `promotion_flag`, `price_or_discount`, `lead_time_days`, `supplier_otif`, `inbound_po_qty`, `open_sales_orders`, `returns_qty`, `holiday_flag`
  - commodity source used in this run: deterministic fallback index (no external commodity CSV provided).
- Training command:
  - `python /Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/train_and_save_models.py --datasets P PV2 --boosting-models XGBOOST CATBOOST --classical-models ETS ARIMA SARIMA --feature-profile full --horizons 1,2,3,4,5,6,7,8,9,10,11,12 --tag pv2_external_ablation_full`
- Output artifacts:
  - Leaderboard: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_leaderboard.csv`
  - Metrics:  
    - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_p_metrics.csv`  
    - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_pv2_metrics.csv`
  - Forecast outputs:
    - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_p_forecasts.csv`
    - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_pv2_forecasts.csv`
  - Archived leaderboard snapshot:
    - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/history/leaderboards/20260420T200411Z_pv2_external_ablation_full_leaderboard.csv`
- Model comparison highlights (`test`, `horizon=0`):
  - `P` winner: `ARIMA` (WAPE `0.269123`, RMSE `2745.101`)
  - `PV2` winner: `CATBOOST` (WAPE `0.193944`, RMSE `465.608`)
- A/B deltas (PV2 minus P):
  - `CATBOOST`: WAPE `-0.127051`, RMSE `-2506.117`, MASE `-6.934219`
  - `XGBOOST`: WAPE `-0.114529`, RMSE `-2693.350`, MASE `-0.819540`
  - `ARIMA`: WAPE `-0.063461`, RMSE `-2238.578`, MASE `+0.135404`
  - `ETS`: WAPE `-0.044620`, RMSE `-2309.659`, MASE `+0.212394`
- Failure modes observed:
  - OpenMP/XGBoost SHM error in sandboxed run; full A/B completed successfully using non-sandbox execution path.
- Decision:
  - Continue with `PV2` as current training dataset.
  - Champion recommendation for enriched path: `CATBOOST`.
  - Fallback recommendation: `ARIMA`.
- Next changes:
  - run one commodity-index-driven variant (non-fallback source) and compare against this baseline.
  - finalize promotion decision only after acceptance-gate + serving-window evidence refresh on selected champion.
