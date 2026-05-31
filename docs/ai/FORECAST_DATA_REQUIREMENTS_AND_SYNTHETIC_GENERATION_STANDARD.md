# Forecast Data Requirements and Synthetic Generation Standard

Last updated: 2026-04-19

## 1) Current reality (verified from your WMS DB + code)

### Verified DB facts (local `postgresql://optiwms:optiwms@localhost:5434/optiwms`)
- Tables include `orders`, `order_items`, `materials`, `inventory`, `material_planning`.
- Counts:
  - `orders`: 83
  - `order_items`: 102
  - `inventory`: 291
- `materials.material_type` distribution:
  - `raw_material`: 179
  - `product`: 120
- No BOM table exists in WMS DB (`information_schema` check for `%bom%` = none).
- `material_planning` exists but currently empty.

### Verified system behavior from code
- Forecast runtime demand history is filtered to `materials.material_type='product'` in:
  - `ai-services/forecast-service/app/services/runtime_data_source.py`
- Raw material requirements are computed through BOM explosion in forecast service using:
  - table `bom_component_mappings` (forecast-service DB, not WMS DB)
  - table `raw_material_requirements` (forecast-service DB)
- Core API exposes BOM endpoints:
  - `GET /api/ai/bom-mappings`
  - `PUT /api/ai/bom-mappings`
- Frontend currently has no admin BOM CRUD screen wired.

## 2) Enterprise architecture decision (for your use case)

Your target is correct:
- Forecast demand for materials that matter operationally in WMS.
- Not only finished goods.

Recommended design:
1. Primary demand forecasting target = independent-demand SKUs (usually FG or decoupling-point items).
2. Derive dependent demand for `raw_material` and `packing_material` via BOM explosion + lead-time shift.
3. For any raw/packing SKU with true independent demand, allow direct forecast as a separate stream.

This hybrid (independent + dependent demand) is enterprise-standard.

## 3) Required data model changes in WMS DB (high priority)

### 3.1 Material typing
Current types include only `product` and `raw_material`.

Add/standardize:
- `product`
- `raw_material`
- `packing_material` (or `packaging_material`, pick one canonical value)

Why:
- Packing demand must be explicitly classifiable and auditable.

### 3.2 BOM master in WMS DB (must have)
Create BOM tables in WMS DB (not only in forecast-service DB):
- `bom_headers`
  - `id`, `parent_sku`, `version`, `effective_from`, `effective_to`, `status`, `warehouse_id`, timestamps
- `bom_components`
  - `id`, `bom_header_id`, `component_sku`, `component_type`, `qty_per_parent`, `scrap_rate`, `lead_time_days`, `uom`, timestamps
- `bom_audit_log` (optional but recommended)
  - change actor, old/new values, timestamp

Why:
- BOM is master data; should be governed in core WMS domain and editable by admins.

### 3.3 BOM CRUD in admin UI
Add admin pages/API flow for:
- create/edit/deactivate BOM versions
- effective-dating
- warehouse scoping (if applicable)
- validation (no negative qty, circular refs, missing components)

Current gap:
- No frontend BOM CRUD exists.

## 4) Minimum required columns for forecasting datasets

## A) Historical demand fact (daily preferred)
Required columns:
- `date`
- `sku`
- `warehouse_id`
- `qty`
- `source_type` (`outbound`, `returns_adj`, etc.)

Recommended:
- `price`, `discount`, `promo_flag`
- `channel`, `customer_segment`
- `stockout_flag`
- `is_holiday`, `day_of_week`, `week_of_year`, `month`

## B) Inventory state fact
Required:
- `date` (snapshot date)
- `sku`
- `warehouse_id`
- `on_hand_qty`
- `available_qty`
- `reorder_point`
- `target_max` (or `max_stock`)

Recommended:
- `lead_time_days`
- `safety_stock`
- `days_since_last_movement`

## C) BOM master fact
Required:
- `parent_sku`
- `component_sku`
- `component_type` (`raw_material`/`packing_material`)
- `qty_per_parent`
- `scrap_rate`
- `lead_time_days`
- effective dates/version

## 5) If requesting real data from client/company (template)

Ask for:
1. 24-36 months outbound daily line-level history:
   - order date, SKU, warehouse, quantity, status
2. Inventory snapshots (daily or weekly):
   - SKU, warehouse, on-hand/available/reserved, ROP, max
3. BOM master with versions/effective dates:
   - FG -> RM/packing mapping with conversion qty and scrap
4. Promo/price/calendar events if available.
5. SKU master mapping:
   - SKU code changes, discontinued flags, replacements.

## 6) If generating synthetic data (allowed only as controlled bridge)

Do not generate naive random series only. Use statistically grounded generation:

1. Seasonality/trend decomposition-driven generation
- Use multiplicative seasonality for high-volume SKUs.
- Use additive for low-volume stable SKUs.

2. Intermittent demand modeling
- Use Croston-style or Bernoulli+Gamma process for sparse SKUs.

3. Regime and event effects
- Promotion uplift windows
- Holiday peaks
- Structural breaks (policy/price change)

4. Cross-SKU and hierarchy coherence
- Preserve category-level correlation.
- Reconcile SKU totals to category/warehouse totals.

5. Inventory realism constraints
- No persistent zero stock unless intentional stockout scenario.
- Enforce lead-time and reorder dynamics.

6. BOM-consistent dependent demand
- Generate FG independent demand first.
- Convert to RM/packing using BOM + scrap + lead-time shift.

Mandatory synthetic controls:
- fixed seed
- lineage metadata
- DQ report
- scenario labels (base/promo/stress)

## 7) Feature set baseline for model training

Must-have:
- lags: `1,2,3,6,12`
- rolling stats: `3,6,12`
- calendar: day/week/month seasonality
- inventory context: stockout proxy, on-hand coverage

Should-have:
- promo/price/event features
- warehouse-level signals
- category-level aggregate features

Model comparison must be fair:
- same split policy
- same feature policy (where applicable)
- same evaluation window

## 8) What to forecast in your current setup (no confusion)

Right now:
- Service forecasts `product` demand directly from WMS history.
- RM demand is derived through BOM mappings.

To meet your stated objective (“forecast what is in WMS, including raw + packing”):
- Keep direct forecast for independent-demand SKUs.
- Add/maintain proper BOM master in WMS.
- Derive RM and packing requirements from independent demand.
- Add direct raw/packing forecast only for items with independent demand.

## 9) Operational data flow (target)

1. WMS transactions (`orders`, `order_items`, `inventory`) update continuously.
2. Forecast run reads latest history and inventory.
3. Model inference generates multi-horizon demand forecast.
4. BOM explosion computes RM/packing requirement by horizon.
5. Recommendations persisted per run with traceability:
   - `run_id`
   - `model_version`
   - `dataset_version`
6. As new real history accumulates, retrain/re-evaluate/re-promote through gates.

## 10) Remaining gaps to close

- Add WMS-native BOM master tables and admin CRUD.
- Add canonical `packing_material` material type and clean classification.
- Add provenance fields in API/UI (run/model/dataset version).
- Separate dashboards clearly:
  - independent demand forecast
  - dependent RM/packing requirement plan.

These are the remaining structural items before final enterprise-grade maturity.
