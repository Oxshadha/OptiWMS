# Two-Layer Forecasting and Raw-Material Planning

Last updated: 2026-04-18

## Architecture

The forecast stack now runs as a two-layer planning flow:

1. Layer 1 (Demand):
- Forecast finished-good demand by SKU and horizon.
- Output is stored in `forecast_predictions`.

2. Layer 2 (Requirements):
- Explode finished-good demand through BOM component mappings.
- Net against raw-material on-hand inventory.
- Output is stored in `raw_material_requirements`.

This is the enterprise pattern used in planning systems: demand forecast first, then dependent-demand calculation for components.

## New Forecast Service APIs

- `PUT /bom-mappings`
  - Upsert FG->RM component mappings.
  - Payload:
  ```json
  {
    "items": [
      {
        "fg_sku": "FG001",
        "rm_sku": "RM001",
        "qty_per_fg_unit": 1.25,
        "scrap_rate": 0.03,
        "lead_time_days": 14,
        "source": "manual",
        "is_active": true
      }
    ]
  }
  ```

- `GET /bom-mappings`
  - Query active mappings.

- `GET /raw-material-requirements`
  - Query computed RM requirements for latest or specific run.
  - Supports filters: `run_id`, `dataset`, `model`, `warehouse_id`, `rm_sku`.

## Runtime Behavior

During `online` publish:

- FG predictions are generated per horizon.
- Forecast service aggregates FG demand across selected horizons.
- Service applies active BOM mappings.
- Service reads raw-material inventory snapshot from WMS DB (`materials.material_type='raw_material'`).
- Service computes and persists:
  - `gross_requirement_qty`
  - `net_requirement_qty`
  - `suggested_procure_qty`
  - operational fields (`on_hand_inventory`, `reorder_point`, `safety_stock`)

During `snapshot` publish:

- After loading snapshot forecasts/metrics/inventory, service also computes RM requirements using the same BOM logic from the persisted FG predictions of that run.

## What You Must Maintain

1. Valid BOM mappings:
- Keep `bom_component_mappings` current and active.
- If FG SKUs change, mappings must be updated.

2. Raw-material inventory quality:
- Ensure raw materials are tagged as `material_type='raw_material'`.
- Ensure on-hand inventory is kept current.

3. Forecast SKU consistency:
- Forecast SKU IDs in layer 1 must match FG keys used in BOM mappings.

## Quick Verification Sequence

1. Run forecast:
```bash
curl -X POST "http://localhost:8092/jobs/forecast-run?dataset=B&model_name=CATBOOST&mode=online"
```

2. Check FG output:
```bash
curl "http://localhost:8091/forecasts?dataset=B&model=CATBOOST"
```

3. Check RM output:
```bash
curl "http://localhost:8091/raw-material-requirements?dataset=B&model=CATBOOST"
```

If step 3 is empty while step 2 has data, BOM mappings do not match FG SKUs.
