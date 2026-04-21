# Slotting Bootstrap Runbook (Real Data)

This uses your real files in:

- `/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/materials_import.csv`
- `/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/inventory_planning_import.csv`

## What was added

- Script: `/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/slotting_bootstrap_planner.py`
- Config: `/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/slotting_bootstrap_config.json`

## How to run

```bash
python3 "/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/slotting_bootstrap_planner.py" \
  --base-dir "/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan"
```

## Outputs

- `/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/slotting_material_plan.csv`
  - Per material: target stock, assumed units/bin, required bins, class (`AF/BM/CS`), preferred zone.
- `/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/slotting_zone_summary.csv`
  - Zone-level required bins vs existing capacity and gap.
- `/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/slotting_generation_recommendation.csv`
  - Suggested total rows/bays from required capacity.
- `/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/slotting_bulk_summary.csv`
  - Bulk-only requirement summary (excluded from rack/bin zone capacity).

## Current logic used

1. First-time bootstrap is rule-based (non-random).
2. `ABC` class uses storage volume proxy (target stock).
3. `FMS` class uses demand proxy (`max(reorder_point, quantity)`).
4. `Target stock` for storage sizing:
   - `max(max_stock, quantity + buffer_stock)`
5. Bulk materials are separated from rack/bin capacity planning.
6. Rack template defaults:
   - 5 levels, 2 bins per level.

## Important tuning

Before trusting final layout numbers, adjust these in:

- `/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/slotting_bootstrap_config.json`

Most important key:

- `default_units_per_bin_by_unit_type`

If this is wrong (especially `drum`, `bag`, `reel`), capacity estimates will be wrong.

## Recommended next step

Use these outputs to populate:

- material preferred zone/class (`VOL-A-MOV-F`, `VOL-B-MOV-M`, etc.)
- allowed location type (`bulk_bin`, `pallet_bin`, `rack_bin`)
- default putaway zone/bin rules in admin UI

Then we can connect this directly into DB/API as an import endpoint for one-click slotting assignment.

## Naming convention used

1. Physical zones:
- `ZONE-A`, `ZONE-B`, `ZONE-C`, `ZONE-D`

2. Volume class:
- `VOL-A` high volume
- `VOL-B` medium volume
- `VOL-C` low volume

3. Movement class:
- `MOV-F` fast moving
- `MOV-M` medium moving
- `MOV-S` slow moving

4. Combined slotting class:
- `VOL-A-MOV-F` style values

5. Final mapped zone field in output:
- `assigned_physical_zone`
