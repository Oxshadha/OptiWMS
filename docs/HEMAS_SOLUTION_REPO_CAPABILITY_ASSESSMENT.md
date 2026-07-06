# Hemas Solution vs OptiWMS Repo Capability Assessment

Source business inspection:

- `docs/HEMAS_PALLET_AND_WMS_INSPECTION.md`

Repo areas inspected:

- `Ai miroservices/modeling/v6_academic_final`
- `ai_services/forecast-service`
- `ai_services/replenishment-service`
- `ai_services/slotting-service`
- `ai_services/path-optimization-service`
- `backend/core-app`
- `backend/core-domain`
- `backend/infra/src/main/resources/db/migration`
- `frontend/app/admin`
- `frontend/lib/api`

## Short Answer

Yes, OptiWMS can deliver a large part of the Hemas PDF solution today, and for forecasting, replenishment, demand-space planning, and slotting it can deliver a better solution than the PDF.

But OptiWMS cannot yet deliver the full pallet reverse-logistics solution end to end because the repo does not have a first-class pallet asset lifecycle module. It has pallet capacity, pallet requirement, units-per-pallet, rack capacity, receiving weight checks, and slotting pallet positions, but not tracked empty pallet assets with purchase, repair, damage, disposal, reconciliation, plant ownership, and breakage accountability.

The other missing area is the labeling centralization workflow. The repo has packing/shipping labels, but not manufacturing labeling operations such as labeling machines, machine utilization, SKU-machine compatibility, supplier-labeled container decisions, or labeling work orders.

## Capability Matrix

| Hemas Requirement | Current Repo Capability | Assessment | Better Than PDF? |
|---|---|---|---|
| Statistical inventory model for RM/PM/FG | Inventory planning fields, ROP, lead time, safety stock, max stock, pallet requirement, v6 forecast pipeline, replenishment service | Mostly available | Yes, if integrated with v6 forecasts |
| Pallet requirement calculation | `InventoryCalculationService`, material `palletSpaces`, slotting max/active/reserve pallet positions | Available for pallet positions | Partially better |
| Forecast-driven planning | v6 pipeline, forecast results table, forecast gateway docs, demand-space planning service | Available/scaffolded | Yes |
| ROP and safety stock | Inventory fields plus replenishment service probabilistic math | Available | Yes |
| ABC/FMS classification | `material_issue_stats_rollup` with `abc_class`, `fms_class`, `amalgamated_class` | Available | Same or better |
| Selective racking and slotting | Backend slotting plans, reserve lines, within-aisle heuristic, capacity-aware placement, frontend API | Available | Better |
| Path/travel optimization | A* path optimization service | Available | Better |
| Inventory norm enforcement at receiving | Receiving exists, capacity/weight validation exists, but hard block against forecast/norm is not clear | Partial | Can be better with small work |
| Pallet purchase cost control | No pallet purchase/reconciliation module found | Missing | Not yet |
| Pallet damage/disposal/repair tracking | No pallet lifecycle tables/services found | Missing | Not yet |
| Plant-level pallet ownership | Warehouse/location exists, but no pallet-owner plant accountability workflow | Missing | Not yet |
| Monthly pallet reconciliation | SOP text exists, but no transactional reconciliation workflow | Missing | Not yet |
| Frozen/non-movable pallet color coding | No pallet freeze state found | Missing | Not yet |
| Labeling centralization | Packing/shipping labels exist, but no production labeling operation module | Missing | Not yet |
| Label machine utilization | No machine/SKU labeling model found | Missing | Not yet |
| Supplier-labeled container optimization | Supplier constraints exist for replenishment, but not labeling supplier decisions | Missing/partial | Not yet |
| AI copilot/document intelligence | AI agent and SOP RAG exist | Partial | Can be better |

## What OptiWMS Already Does Well

### 1. Forecasting

The v6 forecast work is in `Ai miroservices/modeling/v6_academic_final`.

Strong points:

- Reproducible pipeline structure exists.
- `pipeline.inventory` checks legacy artifacts and WMS readiness.
- `pipeline.train` supports bootstrap and WMS data sources.
- `pipeline.promote` exports model artifacts.
- `pipeline.export_wms` normalizes WMS/backfill CSV for training.
- Forecast gateway contract supports `p10`, `p50`, `p90`, horizons, warehouse scope, latest forecasts, and live inference.

Why this is better than the PDF:

- The PDF assumes constant lead time and random demand.
- OptiWMS can use forecast uncertainty through `p10/p50/p90`.
- This allows risk-aware planning, not only point-estimate planning.

### 2. Replenishment And Inventory Policy

The replenishment service has a stronger model than the report's spreadsheet formulas.

Available logic:

- ABC/XYZ-style classification.
- Forecast consumption through forecast service.
- Probabilistic safety stock.
- ROP calculation.
- EOQ calculation.
- Supplier constraints.
- Supplier split optimization.

This can provide a better replenishment solution than the original report because it considers:

- Demand variability.
- Lead-time variability.
- Service level.
- MOQ.
- Supplier limits.
- Bulk discount economics.

### 3. Slotting And Racking

The repo is strong in slotting.

Backend capability includes:

- `slotting_plans`
- `slotting_plan_lines`
- `slotting_plan_reserve_lines`
- `material_issue_stats`
- `material_issue_stats_rollup`
- ABC/FMS/amalgamated classification.
- Plan approval and execution.
- Relocation budget.
- Active pick and reserve pallet positions.
- Demand-space planning from forecast results.

This is better than the PDF's proposed within-aisle layout because OptiWMS can turn it into a repeatable workflow with versioned plans, manager overrides, active plans, and execution.

### 4. Warehouse Capacity And Putaway

The repo includes:

- Rack/location capacity.
- `max_pallet_capacity`.
- `current_pallet_count`.
- Location levels.
- Material dimensions.
- Units per pallet.
- Max pallet weight.
- Putaway planning.
- Receiving pallet weight validation.

This supports storage and pallet-position optimization, but it does not yet track actual pallet assets.

### 5. Path Optimization

The path optimization service provides A* pathfinding for warehouse movement. This is not in the PDF and is a clear improvement opportunity for picking, putaway, and slotting validation.

## Main Gaps

### Gap 1: No Pallet Asset Lifecycle Module

The repo has pallet position calculations, but the Hemas problem is also about pallet asset control.

Missing entities:

- Pallet asset.
- Pallet type/specification.
- Pallet condition.
- Pallet owner plant.
- Pallet current location.
- Pallet transaction ledger.
- Pallet repair order.
- Pallet disposal record.
- Pallet purchase request.
- Pallet reconciliation run.
- Pallet damage reason code.
- Pallet freeze/non-movable state.

Without these, the system can answer:

- "How many pallet positions do I need?"
- "Can this material fit in this rack?"

But it cannot fully answer:

- "Which plant damaged the most pallets?"
- "How many usable empty pallets are available?"
- "Which pallets are frozen?"
- "Do we repair, transfer, hire, or purchase?"
- "Who is accountable for pallet breakage?"

### Gap 2: Labeling Centralization Is Missing

The PDF has a major project around labeling operations. The repo currently has packing/shipping label features, but not manufacturing labeling process optimization.

Missing entities:

- Labeling machine.
- Labeling job/work order.
- SKU-machine compatibility.
- Container-label-machine compatibility.
- Manual vs machine vs supplier-labeled decision.
- Machine utilization history.
- Labeling lead time.
- Labeling shuttle/trip cost.
- Labeling supplier capability.

### Gap 3: Forecast Output Integration Needs Hardening

The repo has forecast results and a forecast service, but the practical decision layer should be tightened:

- Forecast publish into `forecast_results`.
- Forecast-to-RM/BOM explosion.
- Forecast-to-pallet-position requirement.
- Forecast-to-receiving gate.
- Forecast-to-slotting plan.
- Forecast-to-replenishment recommendation.

Some of this exists in pieces, but the repo should treat it as one connected planning workflow.

### Gap 4: Python Slotting Service Has Mixed Maturity

The backend Java slotting workflow is strong.

The Python slotting service has useful endpoints under `/api/v1/slotting`, including GA and plan optimization paths, but the root-level `/recommendations/slotting` endpoint in `app/main.py` is explicitly a stub returning `not_implemented`.

Decision:

- Use backend Java slotting plan workflow as the primary implementation.
- Keep Python slotting service as optional advanced optimizer, not the core dependency.

## Recommended Better Solution

OptiWMS should not simply copy the PDF solution. It should deliver a stronger digital version:

1. Use v6 forecasting to generate `p10/p50/p90` demand by SKU and warehouse.
2. Convert forecasts to RM/PM/FG requirements through BOM and inventory policy.
3. Convert requirements into pallet positions using material pallet specs.
4. Run demand-space planning to calculate active pick, reserve, and max pallet positions.
5. Run slotting plan optimization using ABC-FMS, demand trend, distance, capacity, and relocation budget.
6. Enforce receiving gates against max stock, available pallet slots, quality status, and supplier constraints.
7. Add pallet lifecycle module for actual empty pallet control.
8. Add pallet reconciliation and damage accountability workflow.
9. Add labeling operations module for machine utilization and supplier-labeled decisions.
10. Add dashboards and alerts for pallet shortfall, damage, frozen pallets, slotting moves, stockout risk, and labeling bottlenecks.

## Implementation Backlog

### P0: Close The Pallet Lifecycle Gap

Add backend schema:

- `pallet_assets`
- `pallet_transactions`
- `pallet_damage_reports`
- `pallet_repair_orders`
- `pallet_disposals`
- `pallet_reconciliations`
- `pallet_purchase_requests`

Core statuses:

- `USABLE_EMPTY`
- `LOADED`
- `IN_TRANSIT`
- `AT_PLANT`
- `FROZEN`
- `DAMAGED`
- `IN_REPAIR`
- `DISPOSED`
- `HIRED`

Core event types:

- `PURCHASED`
- `RECEIVED`
- `ISSUED_TO_PLANT`
- `RETURNED_EMPTY`
- `TRANSFERRED`
- `DAMAGED`
- `SENT_TO_REPAIR`
- `REPAIRED`
- `DISPOSED`
- `RECONCILED`
- `HIRED_IN`
- `HIRED_OUT`

### P0: Connect Forecast To Pallet Requirement

Create a planning service that calculates:

- Forecast demand by SKU.
- RM/PM requirements through BOM.
- Required units.
- Required pallet positions.
- Standard requirement.
- Actual requirement.
- Maximum requirement.
- Shortfall.
- Recommended action: transfer, repair, hire, purchase, or hold.

### P1: Forecast-Gated Receiving

At receiving time, enforce:

- Current stock.
- ROP.
- Max stock.
- Forecast p90 requirement.
- Available pallet positions.
- Supplier MOQ.
- Exception approval if receipt exceeds norm.

### P1: Labeling Operations Module

Add:

- Labeling machines.
- Labeling work orders.
- SKU-machine compatibility.
- Manual labeling option.
- Supplier-labeled option.
- Utilization dashboard.
- Labeling cost and shuttle cost.

### P1: Pallet And Labeling Dashboards

Dashboards:

- Pallet pool by status/location/plant.
- Damage and disposal by plant.
- Repair vs purchase economics.
- Frozen pallets.
- Monthly reconciliation variance.
- Forecasted pallet shortfall.
- Labeling machine utilization.
- Manual vs machine vs supplier cost.

### P2: AI Layer

After transaction data is clean:

- Pallet shortfall predictor.
- Damage anomaly detector.
- Repair-vs-purchase optimizer.
- Labeling decision optimizer.
- Natural-language manager assistant over pallet and WMS data.

## Final Assessment

OptiWMS is already capable of delivering a better forecasting, replenishment, inventory-policy, slotting, and path-optimization solution than the Hemas PDFs.

OptiWMS is not yet capable of delivering the full pallet reverse-logistics and labeling centralization solution without new modules.

The fastest credible path is:

1. Use existing v6 forecasting, replenishment, slotting, and capacity services as the foundation.
2. Add pallet lifecycle and reconciliation as the missing domain core.
3. Add labeling operations after pallet lifecycle, because labeling is a separate non-core process optimization module.
4. Integrate all of it through dashboards, alerts, and exception workflows.
