# External Dataset Fit Assessment

Last updated: 2026-04-20

Purpose: decide whether an external dataset can be used for OptiWMS forecasting runtime/training without breaking enterprise contract assumptions.

## Decision rubric (must pass all for direct use)
- Has transactional time-series rows (`sku`, `demand_date`, `demand_units`) not only static KPI snapshots.
- Can map to WMS identifiers (`warehouse_id`, `material_code`/`sku`) with low ambiguity.
- Contains realistic demand dynamics for your domain (Sri Lanka FMCG/raw+packing context).
- Compatible with two-layer planning design (independent demand + BOM dependent demand).
- Includes enough horizon depth and frequency for multi-horizon evaluation.

## Assessment record: Kaggle logistics warehouse dataset

### Source
- Path: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/Kaggle warehouse data/logistics_dataset.csv`
- Metadata: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/Kaggle warehouse data/logistics-warehouse-dataset-metadata.json`

### Profile
- Rows: `3,204`
- Columns: `23`
- Shape: mostly item-level operational/KPI snapshot columns (stock level, reorder point, handling cost, KPI score, etc.).
- No true outbound transaction history per day/week/month.

### Contract fit result
- `FAIL` direct runtime/training fit.

### Why fail
- Missing core historical target structure (`sku + date + actual demand units` over time).
- Contains a precomputed `forecasted_demand_next_7d` field; this is not ground-truth demand and cannot be treated as label.
- Domain mismatch risk: generic logistics categories may not reflect your raw/packing + BOM-dependent demand behavior.
- Cannot directly satisfy `forecast_outbound_history_backfill` semantics without synthetic assumptions.

### Allowed use
- Use only for:
  - UI prototyping,
  - non-production stress tests,
  - feature engineering experiments not used for final model selection.

### Not allowed use
- Do not use as primary training/evaluation dataset for production model decisions.
- Do not use as direct source for acceptance-gate quality claims.

## Recommended path
1. Keep your Excel anchor + WMS runtime tables as primary data contract.
2. Continue controlled synthetic generation constrained by anchor ranges + BOM rules.
3. Validate with alignment checks (`00h`) and fair-play model bakeoff before any model promotion.

