# Hemas Pallet and WMS Inspection

Source PDFs:

- `Help/Pallet Project.pdf`
- `Help/Training Report (1).pdf`

This note identifies the operational problems and solutions described in the PDFs, then interprets them from four viewpoints: researcher, WMS domain expert, data scientist, and AI engineer.

## Executive Summary

The documents describe a warehouse improvement program around pallet reverse logistics, RM/PM inventory control, selective racking, space optimization, and labeling centralization at Hemas FMCG logistics operations.

The main business problem was not only pallet shortage or warehouse congestion. The deeper issue was weak operational visibility: pallet requirements were not forecast before lead time, damages and disposals were not controlled through ownership, inventory norms were not monitored tightly, SKU locations were not allocated by movement behavior, and labeling operations were decentralized with poor machine utilization.

The implemented or proposed solutions were practical warehouse engineering improvements:

- Build statistical inventory models for RM, PM, and FG pallet requirements.
- Calculate reorder points, maximum stock levels, and maximum pallet requirements.
- Use ABC and FMS analysis to redesign storage allocation.
- Increase racking capacity and propose within-aisle storage by SKU value and frequency.
- Control excess receipts using inventory norms.
- Centralize labeling and transfer suitable SKUs from manual labeling to machine labeling or supplier-labeled containers.
- Introduce pallet governance through ownership, reconciliation, color coding, breakage tracking, hiring during peaks, and supplier standardization.

## Problems Identified

| Area | Problem | Evidence From PDFs | Business Impact |
|---|---|---|---|
| Pallet cost | High annual pallet purchase cost and limited control over purchases | Pallet Project objective targets reduction of yearly pallet purchase cost, with total purchase cost shown as around 3 million per year | Unnecessary cash usage and repeated pallet buying |
| Pallet shortage | Shortage pallets occurred during 2018/2019 | Pallet Project mentions shortage instances and a shortage of 223 pallets on 02.12.2019 | Production and warehouse flow disruption |
| Pallet damage | 4,360 damaged pallets from April to November 2019 | Highest damages from CD Plant and Dankotuwa Stores | Loss of reusable assets and increased replacement cost |
| Pallet disposal | 1,945 disposed pallets from April to November 2019 | Highest disposals from Dankotuwa Stores and CD Plant | Waste, weak recovery control, higher new-pallet dependency |
| Weak ownership | Pallet ownership was centralized around Dankotuwa/Welisara instead of plant-level accountability | Operational bottleneck section says ownership is within Dankotuwa warehouse and supported by Welisara | Plants could consume, damage, or hold pallets without full accountability |
| Poor demand visibility | No proper mechanism to identify pallet requirements before lead time | Pallet Project operational bottlenecks | Late purchasing, supplier pressure, shortages |
| Poor allocation control | No mechanism to check whether plants used allocated pallets maximally | Pallet Project operational bottlenecks | Idle pallets in one area while shortages happen elsewhere |
| Volatile loading and storage | Loading, unloading, and storing issues were not monitored properly | Pallet Project operational bottlenecks | Operational instability and bottlenecks |
| Insufficient pallet positions | Existing warehouse had only 2,400 pallet positions before racking expansion | Training Report selective racking background | High third-party warehouse cost and congestion |
| Poor SKU location logic | Storage was not sufficiently aligned to SKU usage volume and frequency | Training Report proposed selective racking system | Longer picking travel, inefficient space use |
| Excess inventory | Actual pallet positions exceeded ideal requirements in several periods | Inventory Optimization project | Excess space consumption and avoidable working capital |
| Limited RM control | Raw materials were harder to control because many were imported | Inventory Optimization outcome | Optimization impact was stronger for PM than RM |
| Decentralized labeling | Labeling occurred across Dankotuwa stores, PC plant, Welisara manual labeling, and third party locations | Labeling section and centralization project | Extra transport, weak standardization, poor visibility |
| Poor machine utilization | Premier machine utilization was low, around 23-24% before improvement | Centralization of labeling process | Higher manual labor cost and underused asset |
| Long labeling lead time | Value-added time was around 10 seconds, but total lead time was around 18 days | VSM for existing labeling operation | Large waiting time compared with actual process time |
| Manual labeling cost | Manual labeling required excessive labor and had turnover issues | Cause-effect analysis | Higher cost and unstable labor availability |
| Supplier/process mismatch | Labels, containers, and machines did not always match | Cause-effect analysis | Machine constraints and failed transfer from manual to machine labeling |
| Scrap sales complexity | Scrap process required dummy materials, PGI, and additional system work | Scrap sales section | Extra administrative workload |

## Solutions Made Or Proposed

| Problem | Solution Made/Proposed | Status From PDFs | Expected Benefit |
|---|---|---|---|
| Unknown pallet requirement | Statistical inventory model for RM, PM, and FG | Phase 1 100% completed in Pallet Project | Calculates standard, actual, and maximum pallet needs |
| Excess pallet purchase | Compare standard, actual, and maximum pallet counts | Phase 2 100% completed | Identifies gaps and avoids blind purchasing |
| Peak pallet shortage | Keep benchmark buffer around 90% of maximum requirement | Proposed in Pallet Project | Supports smooth flow during demand peaks |
| November pallet gap | Outsource/hire about 800 pallets in November | Proposed by model | Covers seasonal or peak shortfall without permanent overbuying |
| Damage accountability | Give plant managers responsibility for pallet breakage and PR raising | Proposed in standardization model | Moves accountability closer to pallet use |
| Weak reconciliation | Monthly pallet reconciliation and monthly breakage percentage communication | Proposed | Creates control point for asset loss |
| Frozen pallets | Color coding system for non-movable pallets | Proposed | Improves visibility of stuck pallets |
| Supplier quality | Seek stronger, standardized pallets from direct suppliers | Proposed | Reduces breakage and improves racking compatibility |
| Lead-time planning | Planning and plants communicate lead-time pallet requirements to procurement | Proposed | Reduces last-minute purchasing |
| Warehouse congestion | Install selective racking system | Implemented | Net increase of 475 pallet positions |
| Poor storage layout | ABC analysis by issue volume and FMS analysis by issue frequency | Implemented as project analysis | Classifies fast, medium, slow, high-volume, and low-volume SKUs |
| Inefficient picking | Amalgamated ABC-FMS matrix and within-aisle storage | Proposed | Lower travel distance, better picking time, leaner layout |
| Excess PM inventory | Reject or delay deliveries when enough stock exists against norms | Implemented in monitoring project | PM actual pallet positions were brought close to ideal requirement |
| Excess RM inventory | Monitor RM, but acknowledge weaker control due to imports | Partially controlled | Makes RM exception visible even if not fully controllable |
| Underused Premier label machine | Transfer suitable manually labeled SKUs to Premier machine | Trialed/proposed | Increase Premier utilization toward 85-90% |
| Manual labeling overload | Outsource selected labeled containers to Phoenix and Polypack suppliers | Proposed/negotiated | Reduces internal non-core labeling workload |
| Kumarika labeling flow | Shift Top Print machine to FMJ supplier for Kumarika range | Proposed | Uses supplier proximity and avoids extra trips |
| Labeling transport cost | Track shuttle cost through HTMS | Proposed focus area | Adds cost visibility to labeling decisions |
| Labeling root causes | Use VSM, cause-effect diagram, 5 Why, SWOT, and trials | Implemented analysis method | Converts process issues into actionable focus areas |
| Scrap process complexity | Raise invoice without matching to inventory item where possible | Suggested | Avoids unnecessary sales order and PGI workload |

## Key Quantitative Findings

- Damaged pallets from April to November 2019: `4,360`.
- Highest damage sources: CD Plant `1,364`, Dankotuwa Stores `1,313`.
- Disposed pallets from April to November 2019: `1,945`.
- Highest disposal sources: Dankotuwa Stores `860`, CD Plant `565`.
- Repaired pallets from April to November 2019: `1,830`.
- Purchased pallets from April to November 2019: `2,072`.
- Total purchasing cost: about `1.3 million` rupees for the shown period.
- Total repair cost: about `0.12 million` rupees for the shown period.
- Maximum plant-wise daily pallet capacity/requirement total: `9,546`.
- Actual pallet count on 02.12.2019: `8,997`.
- Pallet shortage on 02.12.2019: `223`.
- Standard average pallet count: `7,324`.
- Actual average pallet count: `9,140`.
- Maximum average pallet count: `9,760`.
- Maximum scenario: standard `7,711`, actual `10,033`, maximum `10,253`.
- Existing warehouse pallet positions before racking project: `2,400`.
- Total pallet positions after racking: `2,875`.
- Net pallet position increase: `475`.
- Premier labeling machine utilization improved from about `23%` to proposed `85%`.

## Researcher Interpretation

The reports show a classic applied operations research case. The work combines deterministic warehouse engineering with statistical inventory control and lean process improvement.

The most important research contribution is the conversion of operational symptoms into measurable models:

- Pallet shortage becomes a capacity and buffer planning problem.
- Pallet damage becomes an ownership and reverse-logistics control problem.
- Excess inventory becomes a norm compliance and receipt-control problem.
- Labeling delay becomes a process-flow and asset-utilization problem.
- Warehouse congestion becomes a slotting and storage-layout problem.

The limitation is that most analysis is spreadsheet-based and uses simplified assumptions. For example, lead time variation is assumed to be zero, demand is assumed randomly distributed, and storage is planned for maximum stock situations. These assumptions are usable for a first improvement cycle, but they are risky for production-grade optimization because FMCG demand, supplier lead time, export demand, and promotional spikes are rarely stable.

## WMS Domain Expert Interpretation

From a WMS perspective, the problems are mostly master-data, transaction-control, and visibility gaps.

Required WMS capabilities:

- Pallet master with pallet ID, type, condition, owner plant, location, and lifecycle status.
- Pallet transactions for issue, return, repair, disposal, purchase, transfer, freeze, and reconciliation.
- Plant-level pallet accountability with damage reason codes.
- Slotting logic using ABC-FMS class, SKU family, handling unit, pallet type, and velocity.
- Receipt control against inventory norms, open purchase orders, and available space.
- Labeling work-order module with machine capability, SKU compatibility, supplier option, labor requirement, and lead time.
- Alerts for pallet shortages before lead time, high damage rate, frozen pallets, and excessive stock.
- Dashboards for pallet pool, damage/disposal trends, third-party storage, racking occupancy, machine utilization, and shuttle cost.

The PDFs imply that many controls were handled through Excel and manual governance. In OptiWMS, these should become first-class workflow features instead of external spreadsheets.

## Data Scientist Interpretation

The work contains useful predictive and optimization data signals:

- Monthly demand plan and supply plan.
- 15th day closing stock.
- SKU issue frequency.
- SKU issue volume.
- Lead time.
- Average monthly consumption.
- Demand variance.
- Pallet positions consumed.
- Damage counts by plant/location.
- Disposal counts by plant/location.
- Repair and purchase counts.
- Labeling machine output and utilization.
- Shuttle cost and trips.

Recommended models:

| Use Case | Model Type | Target |
|---|---|---|
| Pallet demand forecast | Time-series forecasting or gradient boosting with calendar features | Required pallets by plant/material category |
| Shortage risk | Classification | Probability of pallet shortage within lead time |
| Damage prediction | Regression/classification | Expected pallet damage count by plant, route, and process |
| Inventory norm tuning | Simulation and stochastic inventory model | Lower stock while preserving service level |
| Slotting optimization | ABC-FMS plus travel-time minimization | Best SKU-to-location assignment |
| Labeling allocation | Constraint optimization | Best machine/manual/supplier labeling path |
| Supplier pallet quality | Scorecard model | Supplier durability and compatibility score |

Data quality requirements:

- Capture actual lead-time variability instead of assuming zero.
- Store demand, receipts, issues, and pallet movements at daily transaction level.
- Separate RM, PM, FG, empty usable, empty repair, in-transit, and frozen pallets.
- Use reason codes for damage and disposal.
- Maintain machine-SKU compatibility data for labeling.

## AI Engineer Interpretation

The PDF solutions can be converted into AI-assisted OptiWMS modules.

Recommended AI features:

- Pallet requirement assistant: predicts pallet shortfall and recommends buy, repair, transfer, or hire.
- Pallet anomaly detector: flags abnormal damage, disposal, or freeze patterns by plant.
- Slotting recommender: suggests SKU layout changes based on ABC-FMS, travel distance, and pick frequency.
- Inventory policy optimizer: recommends ROP, max stock, and safety stock updates with confidence intervals.
- Labeling decision engine: recommends supplier-labeled, machine-labeled, or manual-labeled option per SKU.
- Natural-language operations copilot: lets managers ask, "Why are we short by 223 pallets?" or "Which plant caused the highest damage this month?"
- Document intelligence: reads reports like these PDFs and extracts improvement actions into WMS tasks.

AI implementation should not replace transaction discipline. The first engineering priority is clean operational data capture. AI becomes valuable after pallet movements, inventory events, labeling jobs, and machine utilization are stored reliably.

## Recommended OptiWMS Backlog

| Priority | Feature | Reason |
|---|---|---|
| P0 | Pallet lifecycle module | Needed to control purchase, repair, damage, disposal, transfer, and freeze state |
| P0 | Pallet reconciliation workflow | Directly solves ownership and accountability gap |
| P0 | Inventory norm control at receiving | Prevents excess stock and space consumption |
| P1 | ABC-FMS slotting engine | Turns spreadsheet analysis into repeatable WMS logic |
| P1 | Pallet shortage forecast dashboard | Gives lead-time visibility before shortages happen |
| P1 | Labeling work-order and machine utilization module | Solves decentralized labeling and underused machine problem |
| P2 | Supplier pallet and labeling scorecards | Supports supplier standardization and outsourced labeling decisions |
| P2 | Damage root-cause analytics | Helps reduce recurring pallet loss |
| P2 | Shuttle and third-party storage cost analytics | Makes hidden logistics cost visible |

## Conclusion

The PDFs document a practical transformation from reactive warehouse operation to measured control. The strongest solutions are the statistical pallet requirement model, ABC-FMS slotting logic, inventory norm enforcement, and labeling centralization.

For OptiWMS, the main opportunity is to productize these spreadsheet and project-based practices into live workflows, dashboards, alerts, and optimization services. The system should first capture clean warehouse events, then apply forecasting, optimization, and AI recommendations on top of that transaction layer.
