# External Signals Ingestion Runbook

Last updated: 2026-04-20

## Objective
Add external/context signals to the portable training dataset in a controlled way, without breaking the existing OptiWMS forecast pipeline.

This is for improving model realism and generalization.  
It does not replace WMS demand history as the target label.

## What This Step Produces
Input:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/rule_based_portable_monthly.csv`

Output:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/generated/p_v2_portable_monthly.csv`

New feature columns:
- `on_hand_inventory`
- `stockout_days`
- `promotion_flag`
- `price_or_discount`
- `lead_time_days`
- `supplier_otif`
- `inbound_po_qty`
- `open_sales_orders`
- `returns_qty`
- `holiday_flag`

Report:
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/external_signals_enrichment_report.json`

## Script
- `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/enrich_portable_with_external_signals.py`

## Run Commands
### 1) Enrich using deterministic fallback signals
```bash
python "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/enrich_portable_with_external_signals.py"
```

### 2) Enrich using your own monthly commodity CSV
Commodity CSV contract:
- columns: `month`, `value`
- month format: parseable date (monthly granularity)

```bash
python "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/enrich_portable_with_external_signals.py" \
  --commodity-csv "/absolute/path/to/commodity_monthly.csv"
```

### 3) Optional: Enrich from public CSV URL
```bash
python "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/enrich_portable_with_external_signals.py" \
  --commodity-url "https://example.com/commodity_monthly.csv"
```

## Downstream Model Training (fair-play)
Use dataset `PV2` after enrichment:

```bash
python "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/scripts/train_and_save_models.py" \
  --datasets PV2 \
  --boosting-models XGBOOST CATBOOST \
  --feature-profile full \
  --horizons 1,2,3,4,5,6,7,8,9,10,11,12 \
  --tag pv2_external_signals_round
```

## Guardrails
- Do not treat scraped external data as ground-truth demand.
- Keep labels from WMS/history pipeline only.
- Preserve fair split and identical evaluation protocol across models.
- Log each round into leaderboard log before reruns.

## Expected Benefit
- Better behavior under seasonality and demand shifts.
- Better portability when real WMS history is limited.
- More defensible experiment trace for supervisor review.
