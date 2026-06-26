# Forecast-Space Optimization Implementation Checklist

This checklist starts the implementation work for the core solution:

> Forecast-driven inventory policy and warehouse space optimization under MOQ, lead-time, expiry, capacity, compatibility, and service-level constraints.

Chatbot integration, pallet asset lifecycle, and manufacturing labeling workflow are intentionally out of scope for this first implementation.

## Implementation Goal

Build an end-to-end decision-support flow:

```text
forecast -> inventory policy -> stock reduce/increase recommendation -> pallet positions -> compatible space plan -> risk/confidence -> manager approval
```

## Current Repo Surfaces To Reuse

- Forecasting model/pipeline: `Ai miroservices/modeling/v6_academic_final`
- Forecast service: `ai_services/forecast-service`
- Replenishment service: `ai_services/replenishment-service`
- Backend forecast tables: `forecast_results`, `demand_history`
- Backend slotting tables: `slotting_plans`, `slotting_plan_lines`, `slotting_plan_reserve_lines`
- Backend ABC/FMS rollups: `material_issue_stats`, `material_issue_stats_rollup`
- Backend services to extend: `DemandSpacePlanningService`, `StockPlacementPlanner`, `SlottingPlanService`
- Admin UI pages to reuse:
  - `frontend/app/admin/forecasts/page.tsx`
  - `frontend/app/admin/replenishment/page.tsx`
  - `frontend/app/admin/replenishment/storage/page.tsx`
  - `frontend/app/admin/inventory/page.tsx`
  - `frontend/app/admin/slotting-plans/page.tsx`

## Phase 0 - Scope Lock

- [x] Confirm core problem is stock buffer reduction + space reallocation, not pallet asset lifecycle.
- [x] Confirm chatbot can wait until after functional recommendation engine.
- [x] Confirm recommendations must be manager-approved, not fully automated.
- [x] Confirm planning horizon should support 3 months and 6 months.
- [ ] Decide default horizon for MVP: `3 months` or `6 months`.
- [ ] Decide default service levels by item class: critical, normal, low-risk.
- [ ] Decide whether MVP operates on RM/PM only, FG only, or all material types.

## Phase 1 - Database

### 1.1 Recommendation Run Tables

Create migration after `V67`.

- [ ] Add `inventory_policy_recommendation_runs`.
- [ ] Add `inventory_policy_recommendation_lines`.
- [ ] Add `space_optimization_runs`.
- [ ] Add `space_optimization_lines`.
- [ ] Add `space_optimization_scenarios`.
- [ ] Add `recommendation_approvals` or reuse plan approval where practical.

Recommended `inventory_policy_recommendation_runs` fields:

- [ ] `id`
- [ ] `warehouse_id`
- [ ] `horizon_months`
- [ ] `status`
- [ ] `forecast_model_name`
- [ ] `forecast_run_id`
- [ ] `created_by`
- [ ] `created_at`
- [ ] `approved_by`
- [ ] `approved_at`
- [ ] `notes`

Recommended `inventory_policy_recommendation_lines` fields:

- [ ] `id`
- [ ] `run_id`
- [ ] `material_id`
- [ ] `material_code`
- [ ] `material_type`
- [ ] `current_stock`
- [ ] `current_min_stock`
- [ ] `current_max_stock`
- [ ] `current_reorder_point`
- [ ] `forecast_p10`
- [ ] `forecast_p50`
- [ ] `forecast_p90`
- [ ] `lead_time_days`
- [ ] `lead_time_std_days`
- [ ] `moq`
- [ ] `order_multiple`
- [ ] `expiry_limited_max_stock`
- [ ] `proposed_min_stock`
- [ ] `proposed_max_stock`
- [ ] `proposed_reorder_point`
- [ ] `proposed_target_stock`
- [ ] `proposed_order_qty`
- [ ] `stock_delta`
- [ ] `pallet_positions_delta`
- [ ] `holding_cost_delta`
- [ ] `stockout_risk_score`
- [ ] `expiry_risk_score`
- [ ] `confidence_score`
- [ ] `recommendation_status`
- [ ] `rationale`
- [ ] `constraint_snapshot JSONB`

Recommended `space_optimization_lines` fields:

- [ ] `id`
- [ ] `run_id`
- [ ] `material_id`
- [ ] `source_policy_line_id`
- [ ] `current_primary_location_code`
- [ ] `recommended_primary_location_code`
- [ ] `recommended_reserve_locations JSONB`
- [ ] `released_location_codes JSONB`
- [ ] `required_active_pick_pallet_positions`
- [ ] `required_reserve_pallet_positions`
- [ ] `compatible`
- [ ] `distance_saved_meters`
- [ ] `space_saved_pallet_positions`
- [ ] `move_cost_score`
- [ ] `recommendation_status`
- [ ] `rationale`
- [ ] `constraint_snapshot JSONB`

### 1.2 Data Quality Fields

- [ ] Verify material dimensions are present for all candidate SKUs.
- [ ] Verify `pallet_spaces` or units-per-pallet exists.
- [ ] Verify `max_pallet_weight_kg` exists for palletized items.
- [ ] Verify `lead_time_days` exists.
- [ ] Verify supplier constraints include MOQ and max order quantity.
- [ ] Verify expiry/lot dates exist where expiry risk matters.
- [ ] Verify locations have weight, volume, pallet capacity, and active status.
- [ ] Verify material storage compatibility data is sufficient.
- [x] Forecast-space recommendations consume the available forecast table directly.
- [x] Demand-space slotting profiles consume the available forecast table directly.

### 1.3 Migration Tests

- [ ] Run Flyway migration locally.
- [ ] Verify rollback strategy or forward-fix strategy.
- [x] Add indexes for `warehouse_id`, `run_id`, `material_id`, `status`.
- [x] Add constraints for scores between `0` and `100`.
- [x] Add status check constraints.

## Phase 2 - Backend Domain And Repositories

### 2.1 Entities

- [x] Create `InventoryPolicyRecommendationRunEntity`.
- [x] Create `InventoryPolicyRecommendationLineEntity`.
- [x] Create `SpaceOptimizationRunEntity`.
- [x] Create `SpaceOptimizationLineEntity`.
- [x] Create `SpaceOptimizationScenarioEntity`.

### 2.2 Repositories

- [x] Create repository for policy runs.
- [x] Create repository for policy lines.
- [x] Create repository for space runs.
- [x] Create repository for space lines.
- [x] Create repository for scenario results.

### 2.3 Domain DTOs

- [x] Create request DTO: `CreateInventoryPolicyRunRequest`.
- [x] Create response DTO: `InventoryPolicyRecommendationRunResponse`.
- [x] Create response DTO: `InventoryPolicyRecommendationLineResponse`.
- [x] Create request DTO: `CreateForecastSpaceOptimizationRequest`.
- [x] Create response DTO: `ForecastSpaceOptimizationRunResponse`.
- [x] Create response DTO: `ForecastSpaceOptimizationLineResponse`.
- [x] Create approval DTO: `ApproveRecommendationRunRequest`.

## Phase 3 - Backend Core Services

### 3.1 Inventory Policy Recommendation Service

Create:

- [x] `InventoryPolicyRecommendationService`

Responsibilities:

- [x] Load latest forecast results for horizon.
- [x] Load current inventory by material and warehouse.
- [x] Load supplier constraints.
- [x] Load expiry/lot details.
- [x] Load material pallet specs.
- [x] Calculate forecast cover for 1, 3, and 6 months.
- [x] Calculate lead-time demand.
- [x] Calculate safety stock.
- [x] Calculate ROP.
- [x] Calculate target stock.
- [x] Calculate max stock.
- [x] Apply expiry-safe stock cap.
- [x] Apply MOQ/order multiple.
- [x] Calculate stock delta.
- [x] Calculate pallet positions saved/needed.
- [x] Calculate holding cost impact.
- [x] Calculate confidence and risk scores.
- [x] Save recommendation run and lines.

Decision statuses:

- [x] `SAFE_TO_APPLY`
- [x] `APPLY_WITH_APPROVAL`
- [x] `HIGH_RISK_REVIEW`
- [x] `INFEASIBLE`
- [x] `DATA_INSUFFICIENT`

### 3.2 Constraint Evaluation Service

Create:

- [ ] `InventoryConstraintEvaluationService`

Hard constraints:

- [ ] MOQ.
- [ ] Supplier max quantity.
- [ ] Order multiple.
- [ ] Expiry-safe stock.
- [ ] Minimum service stock.
- [ ] Storage type compatibility.
- [ ] Rack capacity.
- [ ] Weight capacity.
- [ ] Volume capacity.
- [ ] Pallet capacity.

Soft constraints:

- [ ] Holding cost.
- [ ] Stockout risk.
- [ ] Expiry risk.
- [ ] Relocation cost.
- [ ] Distance/travel cost.
- [ ] Discount benefit.
- [ ] Current-location stability.

### 3.3 Scenario Simulation Service

Create:

- [ ] `RecommendationScenarioSimulationService`

Scenarios:

- [x] Base demand with forecast `p50`.
- [x] High demand with forecast `p90`.
- [ ] Low demand with forecast `p10`.
- [ ] Supplier delay scenario.
- [ ] MOQ overstock scenario.
- [x] Expiry-limited demand scenario.
- [ ] No-relocation scenario.

Outputs:

- [x] `scenario_name`
- [x] `pass/fail`
- [x] `risk_score`
- [x] `stockout_days_estimate`
- [x] `expiry_excess_units`
- [x] `space_shortfall_pallet_positions`
- [x] `explanation`

### 3.4 Forecast Space Optimization Service

Create:

- [x] `ForecastSpaceOptimizationService`

Responsibilities:

- [x] Read policy recommendations.
- [x] Identify falling-demand SKUs with reclaimable excess stock.
- [x] Identify rising/high-demand SKUs needing more stock or better locations.
- [ ] Call or reuse `DemandSpacePlanningService`.
- [x] Call or reuse `StockPlacementPlanner.planPlacement`.
- [ ] Call or reuse `StockPlacementPlanner.planReclaim`.
- [ ] Call or reuse `SlottingPlanOptimizer`.
- [x] Produce draft space optimization run.
- [ ] Convert approved output into slotting plan lines or material default locations.

### 3.5 Approval And Application

- [x] Add approve endpoint for inventory policy run.
- [ ] Add reject endpoint for policy line.
- [ ] Add override endpoint for policy line.
- [x] Add approve endpoint for space optimization run.
- [ ] Add reject endpoint for space line.
- [ ] Add override endpoint for space line.
- [x] On approval, update inventory policy fields only for approved lines.
- [x] On approval, create slotting plan draft.
- [ ] Do not auto-apply final warehouse moves without manager action.

## Phase 4 - Backend API

Add controller package, likely under planning or optimization:

- [x] `ForecastSpaceOptimizationController`

Endpoints:

- [x] `POST /v1/forecast-space/policy-runs`
- [x] `GET /v1/forecast-space/policy-runs?warehouseId=...`
- [x] `GET /v1/forecast-space/policy-runs/{runId}`
- [x] `GET /v1/forecast-space/policy-runs/{runId}/lines`
- [x] `POST /v1/forecast-space/policy-runs/{runId}/approve`
- [ ] `PATCH /v1/forecast-space/policy-runs/{runId}/lines/{lineId}`
- [x] `POST /v1/forecast-space/space-runs`
- [x] `GET /v1/forecast-space/space-runs?warehouseId=...`
- [x] `GET /v1/forecast-space/space-runs/{runId}`
- [x] `GET /v1/forecast-space/space-runs/{runId}/lines`
- [x] `POST /v1/forecast-space/space-runs/{runId}/approve`
- [x] `GET /v1/forecast-space/readiness?warehouseId=...`

## Phase 5 - AI Services

### 5.1 Forecast Service

- [ ] Confirm latest v6 forecast artifacts can be served.
- [ ] Confirm forecasts include `p10`, `p50`, `p90`.
- [ ] Confirm material/SKU mapping from forecast SKU to WMS material.
- [ ] Add API or batch export to publish forecasts into backend `forecast_results`.
- [ ] Persist forecast lineage into `forecast_results` on export/import.
- [ ] Add batch export/import path from forecast model artifacts into backend `forecast_results`.
- [ ] Add health/readiness endpoint for artifact freshness.

### 5.2 Replenishment Service

Use existing math but harden contracts.

- [ ] Add response fields needed by backend policy service.
- [ ] Ensure MOQ and supplier constraints are explicit.
- [ ] Ensure lead-time variability can be represented.
- [ ] Ensure constrained order quantity handles order multiples.
- [ ] Add tests for high MOQ + low demand.
- [ ] Add tests for supplier max quantity lower than needed quantity.
- [ ] Add tests for discount threshold causing overstock risk.

### 5.3 Slotting Service

Use backend Java slotting as primary path for MVP. Python slotting can remain optional.

- [ ] Do not depend on root `/recommendations/slotting` stub.
- [ ] Use `/api/v1/slotting/plan/optimize` only if needed.
- [ ] Keep backend `SlottingPlanService` as source of truth.
- [ ] Align Python service response with backend plan line fields if used.

### 5.4 AI Service Contract Tests

- [ ] Add sample forecast response contract.
- [ ] Add sample replenishment recommendation contract.
- [ ] Add sample space optimization payload.
- [ ] Add integration fixture for 3 SKUs:
  - [ ] Item 1: falling demand, reduce buffer.
  - [ ] Item 2: rising demand, needs released space.
  - [ ] Item 3: high MOQ/expiry conflict.

## Phase 6 - Frontend API Clients

Add:

- [x] `frontend/lib/api/forecast-space.ts`

Methods:

- [x] `createPolicyRun`
- [x] `listPolicyRuns`
- [x] `getPolicyRun`
- [x] `getPolicyRunLines`
- [x] `approvePolicyRun`
- [ ] `updatePolicyLine`
- [x] `createSpaceRun`
- [x] `listSpaceRuns`
- [x] `getSpaceRun`
- [x] `getSpaceRunLines`
- [x] `approveSpaceRun`
- [x] `getReadiness`

Types:

- [x] `PolicyRecommendationRun`
- [x] `PolicyRecommendationLine`
- [x] `SpaceOptimizationRun`
- [x] `SpaceOptimizationLine`
- [x] `ScenarioResult`
- [x] `RecommendationStatus`
- [x] `ForecastSpaceReadiness`

## Phase 7 - Frontend UI

### 7.1 Navigation

Reuse existing replenishment/storage area.

- [x] Add route: `frontend/app/admin/replenishment/forecast-space/page.tsx`
- [x] Add link from replenishment hub workspace strip.
- [ ] Add link from `frontend/app/admin/replenishment/page.tsx`.
- [ ] Add link from `frontend/app/admin/replenishment/storage/page.tsx`.
- [ ] Optionally add link from forecasts page.

### 7.2 Page Layout

The page should be operational, not marketing.

Sections:

- [x] Header with warehouse selector and horizon selector.
- [x] Readiness panel.
- [x] Run controls.
- [x] Summary KPI strip.
- [x] Policy recommendations table.
- [x] Space reallocation table.
- [x] Scenario/risk panel.
- [ ] Approval controls.
- [x] Apply min/max action for approved policy run.
- [x] Create slotting draft action for approved space run.

### 7.3 KPI Cards

- [ ] Total stock value reduction.
- [x] Pallet positions released.
- [x] Pallet positions needed.
- [x] Net space gain/loss.
- [x] High-risk recommendations count.
- [x] Data-insufficient SKUs count.
- [ ] Estimated holding cost saving.
- [ ] Estimated stockout risk exposure.

### 7.4 Policy Recommendation Table

Columns:

- [x] SKU/material.
- [x] Current stock.
- [ ] Forecast p50/p90.
- [ ] Current min/max/ROP.
- [x] Proposed min/max/ROP.
- [x] Stock delta.
- [x] Pallet positions delta.
- [ ] MOQ impact.
- [ ] Expiry risk.
- [ ] Confidence.
- [x] Status.
- [ ] Action.

### 7.5 Space Optimization Table

Columns:

- [ ] SKU/material.
- [ ] Current location.
- [ ] Recommended location.
- [ ] Active pick pallet positions.
- [ ] Reserve pallet positions.
- [ ] Released locations.
- [ ] Compatibility status.
- [ ] Distance saved.
- [ ] Move cost score.
- [ ] Status.
- [ ] Action.

### 7.6 Charts

Use existing chart style from admin pages.

- [ ] Before/after stock policy chart.
- [ ] Forecast p10/p50/p90 band chart.
- [ ] Before/after pallet positions chart.
- [ ] Risk distribution chart.
- [ ] Space released vs space consumed chart.

### 7.7 Approval UX

- [ ] Approve full run.
- [ ] Approve selected lines.
- [ ] Reject selected lines.
- [ ] Override proposed min/max/ROP.
- [ ] Override recommended location.
- [ ] Require reason for override.
- [ ] Show final impact after overrides.

## Phase 8 - Validation And Tests

### 8.1 Backend Unit Tests

- [ ] Falling demand reduces max stock.
- [ ] Rising demand increases target stock.
- [ ] High MOQ can force overstock warning.
- [ ] Expiry caps max stock.
- [ ] Supplier max order quantity limits recommendation.
- [ ] Missing forecast marks `DATA_INSUFFICIENT`.
- [ ] Missing dimensions blocks space recommendation.
- [ ] Incompatible rack marks line `INFEASIBLE`.
- [ ] High p90 demand raises stockout risk.
- [ ] Approval updates inventory policy fields.

### 8.2 Integration Tests

- [ ] Create policy run from seeded forecasts.
- [ ] Create space run from policy run.
- [ ] Approve policy run and verify inventory changes.
- [ ] Approve space run and verify slotting plan draft/lines.
- [ ] Reject line and verify it is not applied.
- [ ] Override line and verify rationale is saved.

### 8.3 AI Service Tests

- [ ] Forecast service returns p10/p50/p90.
- [ ] Replenishment service handles MOQ and lead-time variability.
- [ ] Slotting optimizer rejects incompatible location.
- [ ] Contract test for backend-to-AI payload.

### 8.4 UI Tests

- [ ] Page loads with empty state.
- [ ] Readiness warnings display.
- [ ] Run can be created.
- [ ] Tables render recommendations.
- [ ] Filters work by status/risk.
- [ ] Override modal works.
- [ ] Approval action calls API.

## Phase 9 - Demo Scenario

Create a controlled demo with 3-5 SKUs.

Demo SKUs:

- [ ] Item 1: falling demand, current buffer too high, releases 2 pallet positions.
- [ ] Item 2: rising demand, needs 2 pallet positions, compatible with Item 1's released area.
- [ ] Item 3: low demand but high MOQ, recommendation warns overstock/expiry risk.
- [ ] Item 4: high demand but incompatible with released location, requires alternate zone.
- [ ] Item 5: production-critical item, conservative safety stock retained.

Expected demo narrative:

- [ ] "Traditional policy would keep all buffers."
- [ ] "Forecast-space optimizer reduces Item 1 buffer."
- [ ] "Released space is reassigned to Item 2 only because compatibility passes."
- [ ] "Item 3 is not increased blindly because MOQ + expiry creates risk."
- [ ] "Manager sees risk and approves only safe lines."

## Phase 10 - Documentation

- [ ] Update `docs/FORECAST_TO_SPACE_OPTIMIZATION_CORE_PLAN.md` after implementation details settle.
- [ ] Add API guide.
- [ ] Add data readiness guide.
- [ ] Add manager workflow guide.
- [ ] Add demo runbook.
- [ ] Add known limitations.

## Build Order

Recommended order:

1. [x] Database tables and entities.
2. [x] Backend policy recommendation service.
3. [x] Backend readiness endpoint.
4. [x] Backend space optimization service using existing planner/slotting services.
   - [x] Reuse released pallet positions from reduced-buffer SKUs before falling back to general placement.
   - [x] Check compatibility before assigning a growth SKU into released space.
5. [x] Scenario simulation.
6. [x] API endpoints.
7. [x] Frontend API client.
8. [x] Admin forecast-space page.
9. [ ] Approval workflow.
10. [ ] Demo dataset and tests.

## Definition Of Done

MVP is done when:

- [x] User can select warehouse and horizon.
- [x] System checks data readiness.
- [x] System generates stock policy recommendations.
- [x] System identifies stock reductions and stock increases.
- [x] System calculates pallet positions saved/needed.
- [x] System checks compatible storage.
- [x] System attempts released-space reallocation across SKUs.
- [ ] System generates a draft space plan.
- [x] System shows risk/confidence and explanation.
- [ ] Manager can approve/reject/override.
- [x] Approved policy changes update inventory planning fields.
- [x] Approved space changes create/update a slotting plan.
- [x] Inbound order UI calls putaway split planning and blocks impossible storage quantities.
- [ ] Tests cover the main dangerous edge cases.
