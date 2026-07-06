# Realistic Hemas Data Strategy for Forecast-to-Space Optimization

## Position

Do not generate a larger fully synthetic dataset as the main evidence base. Use the Hemas files as the operational anchor, then generate only the missing history needed to test models and workflows.

The current v6 notebook synthetic data is useful for engineering tests, but it is not enough for business approval because the decision changes money, production risk, pallet space, and service levels.

Synthetic rows may exist in the database, because the forecast pipeline needs them for bootstrap training, demos, regression tests, and a complete project WMS scenario. The important rule is that raw bootstrap rows must not silently collapse into the same decision path as validated operational seed rows.

For this project, because actual client transaction history is not available, the practical approach is to promote a carefully generated and Hemas-calibrated dataset as `SIMULATED_OPERATIONAL`. That lets the WMS run end-to-end as a realistic operational system without claiming the rows are actual production transactions.

## What the Hemas Files Already Give Us

Files under `Resources/Mavin sir resources WMS hemas` and the cleaned exports under `Resources/Data and Sloting plan` provide realistic anchors:

- Material codes and descriptions.
- Active stock supply plan columns for Jul-Nov.
- Buffer days.
- Future average demand.
- Lead time and lead-time months.
- Demand variance and lead-time demand variance.
- Reorder point and ROP in days.
- Buffer stock and maximum stock.
- Stacking quantity and MOQ.
- Order delivery and order quantity fields.
- Pallet requirement fields.
- Non-moving materials.
- Raw materials not stored in pallets.
- Cleaned import CSVs for materials, inventory planning, and slotting plans.

These are exactly the right fields for the core solution: forecast-driven min/max/ROP recommendations and space optimization under MOQ, lead time, expiry, pallet capacity, and compatibility constraints.

## What Is Still Missing

The files do not appear to contain a clean long historical demand table at daily or weekly granularity. That matters because a proper demand forecast model needs real issue/consumption history, not only future supply plan snapshots.

Missing or partial data:

- Actual historical daily/weekly material issues.
- Supplier order multiple and supplier maximum quantity.
- Supplier discount breakpoints.
- Actual receipt delay history by supplier/material.
- Expiry/shelf-life by batch for all materials.
- Rack/bin compatibility master data tied to all material constraints.
- Real storage cost by location or zone.
- Production criticality and service-level target by material.

## Proper Implementation Approach

1. Use Hemas-derived CSVs as source-of-truth seed data.
   - `materials_import.csv` for material master.
   - `inventory_planning_import.csv` for ROP, buffer, max stock, MOQ, lead time, and pallet requirement.
   - `slotting_material_plan.csv` and zone summaries for space planning calibration.
   - `Non Moving items.csv` and `Raw matrilas not store in pallets.csv` as special-case constraints.

2. Label every row by data source quality.
   - `REAL_ANCHOR`: directly from Hemas resource files.
   - `DERIVED_FROM_REAL`: calculated from Hemas fields, for example monthly demand derived from supply plan columns.
   - `SIMULATED_OPERATIONAL`: generated operational history calibrated to Hemas fields and approved for project/demo decision flows.
   - `SYNTHETIC_HISTORY`: generated only to create a forecast training/evaluation sequence.
   - `SYSTEM_LIVE`: imported from the running WMS database.

3. Keep forecast result lineage separate from demand history lineage.
   - `demand_history.source` identifies where each historical demand row came from.
   - `forecast_results.training_source` identifies the training source used by the model.
   - `forecast_results.data_quality_tier` identifies whether the forecast is real, anchored, derived, synthetic, bootstrap, or unverified.
   - `forecast_results.synthetic_ratio` estimates how much generated history contributed to the forecast.
   - `forecast_results.decision_eligible` controls whether policy and slotting services may consume the forecast.

4. Generate synthetic history only around real anchors.
   - Use real future average, supply plan months, variance, non-moving classification, MOQ, lead time, stacking quantity, and pallet requirement as constraints.
   - Generate daily or weekly issue history that aggregates back to the realistic monthly level.
   - Preserve intermittent demand patterns for non-moving and slow-moving SKUs.
   - Preserve high variance for volatile SKUs.
   - Do not generate synthetic pallet compatibility rules if real rack/material rules exist.

5. Keep approval decisions conservative.
   - A recommendation can be generated with partial data.
   - A recommendation should be marked `DATA_INSUFFICIENT`, `HIGH_RISK_REVIEW`, or `INFEASIBLE` when forecast, MOQ, lead-time, expiry, pallet, or compatibility coverage is weak.
   - The system should not auto-apply min/max or storage changes from synthetic-only evidence.

6. Use shadow mode before production.
   - Run the model against historical periods where actual consumption is known.
   - Compare current ROP/MOQ policy vs recommended policy.
   - Measure stockout days, expired/excess stock, pallet positions saved, and urgent order risk.
   - Only after shadow validation should the system move from recommendation to approved change.

## Decision Eligibility Rule

For the forecast-to-space optimizer, a forecast row should be eligible when:

- `decision_eligible = true`
- either:
  - `data_quality_tier IN ('REAL_WMS', 'REAL_ANCHOR', 'DERIVED_FROM_REAL')` and `synthetic_ratio <= 0.20`
  - or `data_quality_tier = 'SIMULATED_OPERATIONAL'`

Rows with `BOOTSTRAP`, `SYNTHETIC_HISTORY`, or `UNVERIFIED` quality can remain in the database, but they should be used for model development, tests, or unpromoted demos only.

Example promotion after validating a Hemas-derived forecast:

```sql
UPDATE forecast_results
SET training_source = 'hemas_anchor',
    data_quality_tier = 'REAL_ANCHOR',
    synthetic_ratio = 0.0000,
    decision_eligible = TRUE,
    source_lineage = jsonb_build_object(
        'source_file', 'Resources/Mavin sir resources WMS hemas/RM ROP and Pallet requirement - SEP.xlsx',
        'promotion_reason', 'validated against Hemas ROP/MOQ/lead-time anchors'
    )
WHERE mlflow_run_id = '<validated-run-id>';
```

Example promotion for the project operational seed dataset:

```sql
UPDATE forecast_results
SET training_source = 'project_operational_seed',
    data_quality_tier = 'SIMULATED_OPERATIONAL',
    synthetic_ratio = 1.0000,
    decision_eligible = TRUE,
    source_lineage = jsonb_build_object(
        'basis', 'Hemas-calibrated simulated operational dataset',
        'use_case', 'project WMS operations and forecast-space optimization',
        'source_files', jsonb_build_array(
            'Resources/Mavin sir resources WMS hemas/RM ROP and Pallet requirement - SEP.xlsx',
            'Resources/Data and Sloting plan/inventory_planning_import.csv',
            'Resources/Data and Sloting plan/slotting_material_plan.csv'
        )
    )
WHERE mlflow_run_id = '<project-seed-run-id>';
```

## Current Repo Direction

The new forecast-space implementation now has three layers:

- Inventory policy recommendation run: calculates proposed min stock, max stock, ROP, order quantity, stock delta, pallet-position delta, cost delta, and risk status.
- Space optimization run: converts policy deltas into released or required pallet positions and uses current placement compatibility logic.
- Readiness endpoint: reports whether a warehouse has enough decision-eligible forecast, inventory, pallet, MOQ, and lead-time coverage for reviewer confidence.

The right next data work is not "more random synthetic data." The right work is a Hemas import/calibration profile that loads the realistic CSVs into the database and then creates clearly labelled synthetic history only for fields that Hemas did not provide.
