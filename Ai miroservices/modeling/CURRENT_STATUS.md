# OptiWMS Forecast - Current Status

> Last updated: 2026-08-14
> Scope: v8 project-operational synthetic population, evaluator-grade forecasting, inventory policy, physical warehouse geometry, PostgreSQL publication, ABC/FMS, multi-bin slotting, Docker runtime, and application evidence.

## Executive Status

`PROJECT_OPERATIONAL_SIMULATION_V8` is now the active project-operational source of truth for the OptiWMS demonstration. The older baseline and v6/v7 entries below are retained as an audit history, not as the current runtime claim.

- PostgreSQL is the business authority for material, BOM, demand, forecast, inventory, location, slotting and evidence rows. The Python forecast-service database is an inference/service cache, not the WMS system of record.
- The active forecasting dataset/model binding is `PROJECT_OPS_RM_PM` / `PROJECT_OPS_EXTRA_TREES_CAUSAL`; the live forecast service reports the v8 champion with no fallback.
- The served recursive H1-H12 test has WAPE `8.7452%`, MAE `772.95`, RMSE `1,559.64`, bias `-0.4877%`, and under-forecast rate `47.71%`.
- The Conv1D-attention challenger has WAPE `9.8996%`. Extra Trees is retained with an `11.66%` relative WAPE advantage, circular block-bootstrap monthly absolute-error CI `[-178.72, -16.07]`, and HAC/Holm `p=0.0197`.
- The v8 business population contains `144` active materials: `90` RM, `30` PM and `24` FG. It contains `24` BOM headers, `211` effective component rows, `10,368` monthly RM/PM/FG demand rows, `1,440` forward H1-H12 RM/PM forecasts, `15` model-evidence rows, `120` supplier-material links and `144` ABC/FMS rollups.
- Location-level inventory contains `2,921` occupied rows for all `144` materials and `2,426,780` rounded database units. There are no aggregate/null-location v8 inventory rows.
- The original generator evidence hash is `558c6ca5cea3c59a2014febb0a479893710ef37d69ebca71ace982a864122175`. The exact loader input-package hash used by bootstrap/runtime verification is `4c0e2e4f4166249456061fbf94facf41eaa36ccb6b2352f06954839e11d32619`; both meanings are kept explicit rather than conflated.
- Synthetic provenance is mandatory on the project evidence. External forecast population validity and confirmation by a physical warehouse survey remain `UNVERIFIED`; that boundary does not block using the internally consistent v8 population as the declared project dataset.

## 2026-08-13 Forecast Distribution And Inventory Intelligence Contract

The runtime and application now implement one governed path from a canonical
forecast through manager approval to worker-confirmed physical execution.

- `scripts/dev-bootstrap.sh` is the clean-clone entry point. It waits for
  PostgreSQL/Flyway, runs the transactional one-shot forecast bootstrap and
  verifies 144 materials, 1,440 H1-H12 rows, decision eligibility, the promoted
  `PROJECT_OPS_EXTRA_TREES_CAUSAL` registry row, 4,206 locations and the v8
  checksum before starting the remaining services and a clean frontend build.
- Spring's authenticated canonical-readiness and model-binding endpoints are
  the frontend source of truth. The ordinary UI no longer falls back to a
  legacy `XGBOOST`/Python result when canonical PostgreSQL data is absent. It
  reports the exact missing-population, registration, stale-publish or checksum
  failure and displays commit/dataset identity in development.
- GitHub Actions verifies the artifact/dataset/frontend binding contract and
  publishes versioned backend, frontend, forecast, slotting, orchestrator and assistant
  images to GHCR. The promoted model and deterministic loader are packaged in
  the forecast image; no PostgreSQL volume or dump is distributed.
- `/admin/inventory-intelligence` replaces the three exposed planning menus.
  Managers see ranked actions, current/proposed product policy, P50/P90 demand,
  MOQ/order multiples, draft-order quantity, target pallet positions, storage
  impact and execution status. Solver details are in an administrator
  disclosure rather than the normal decision path.
- Failed or rolled-back runs are excluded from pending work. Pallet capacity is
  persisted as an absolute target, not `abs(delta)`. Only `OPTIMAL` or accepted
  `FEASIBLE` slotting plans can be approved. Direct apply is removed: approval,
  scheduling, transfer release and worker completion are distinct states.
- `planning_cycle_id` links policy, space, slotting, transfer and worker work.
  Transfer lines explicitly reference slotting lines; scan completion updates
  transfer/slotting/cycle state. Estimated distance is not confirmed until the
  associated relocation lines complete.
- The default cadence generates a review-only forecast/policy refresh daily at
  02:15 Asia/Colombo and a 5% move-cap, low-disruption slotting review monthly.
  Neither scheduler approves a decision; major 3/6-month restructures remain a
  manager-initiated planning cycle.
- Live assistant data is read-only and Spring-owned. Authenticated typed tools
  expose SKU outlook, inventory risk, deterministic recommendation explanation
  and planning-cycle status with dataset/model identity, units, warnings,
  source references and correlation IDs. `/ask-data`, `/query-sql`, schema
  inspection and model-generated database access were removed. SOP RAG remains
  a separate Python document-answering concern; it validates the forwarded JWT
  against Spring, is rate-limited, and returns the same traceable assistant
  response contract.
- Canonical readiness distinguishes the full 144-material catalog from the
  120 RM/PM materials with published H1-H12 forecasts. A ready response now
  reports 1,440 rows, 1,440 decision-eligible rows, 144 catalog materials, 120
  forecast materials, matching dataset/model checksums and build identity.

The local implementation does not create a public/team cloud URL or a teammate
account by itself; `infra/deploy` contains the versioned Compose/Caddy template
for an operator with VM, DNS, GHCR and secret-management access.

## 2026-08-13 Forecast Decision-UI Clarification

The Forecasts surface was tightened so an operator cannot mistake a policy
simulation for confirmed purchasing or observed future stock.

- Both per-SKU WAPE views now label the `10%` planner-review threshold. The
  threshold text is black for readable contrast; bar colors use the same
  `<=10%`, `10-15%`, and `>15%` decision bands as the attention matrix.
- The former receipt bars and digital-looking step signals were replaced with
  continuous P50/P90 month-end stock curves and discrete green receipt-event
  diamonds. A missing diamond means no simulated receipt is due in that month,
  not zero stock.
- Receipt quantities are explicitly described as policy-simulation outputs.
  They are created by forecast consumption, reorder-point triggering, supplier
  lead time, and MOQ/order-multiple rounding. They are not confirmed purchase
  orders, observed future inventory, or arbitrary chart data.
- Inventory wording now uses `Proposed Releases`, `Simulated receipt`, and
  `Order proposed`. The monthly ledger remains the auditable source for the
  chart, projected P50/P90 fill, forward coverage, and release timing.
- Model Performance now uses four responsive KPI cards, a compact promoted
  model strip (`Extra Trees demand forecast`), and an operational-use panel.
  The promoted P10/P50/P90 rows feed inventory-policy calculation; approved
  policy runs may create manager-gated draft purchase suggestions; P50, stock
  delta, and pallet demand feed constrained slotting. Forecasts do not release
  purchase orders automatically.
- Authenticated in-app browser verification passed at `1440x900` and
  `1024x800` against the local Next development runtime and Docker-backed API.
  The SKU Analysis thresholds, Inventory simulation semantics, and responsive
  Model Performance layout were inspected visually.
- Frontend verification passed: `npx tsc --noEmit`,
  `npm run test:forecast-planning`, `git diff --check`, and the production
  build. All `69` routes were generated; `/admin/forecasts` compiled to a
  `28.8 kB` route (`231 kB` first load). Existing repository-wide lint/font
  warnings remain non-blocking.

## 2026-08-10 Forecast Planning Completion And Docker Database Consolidation

The Forecasts surface now uses the controlled v8 population as the ordinary
project-operational planning dataset. Operator and planner screens no longer
show synthetic/lineage/governance disclaimers as primary UI content; those
facts remain in model evidence and this status record so the project does not
make an unsupported external-customer claim.

### Docker PostgreSQL is the only local business database

- Docker PostgreSQL on `localhost:5434/optiwms` was queried before any local
  deletion. It is PostgreSQL `16.14` in the Debian container and retained
  `1,235` materials, `20,238` forecast rows and successful Flyway history
  through installed rank `87`.
- The active project model population is intact: model
  `PROJECT_OPS_EXTRA_TREES_CAUSAL`, quality tier
  `PROJECT_OPERATIONAL_SIMULATION`, `decision_eligible=true`, `1,440` rows,
  `120` RM/PM SKUs and complete H1-H12 coverage from January through December
  2026.
- The v8 inventory population has `2,921` located rows with positive MOQ and
  lead-time values across `144` materials. Material order multiples and unit
  costs are also present. Sample policies now resolve to meaningful catalogue
  descriptions such as `PET Bottle — Format A`, with live available stock,
  safety stock, reorder point, target maximum, MOQ, order multiple and lead
  time coming from the same PostgreSQL authority.
- The separately running Homebrew PostgreSQL 16 cluster was stopped cleanly.
  The exact local data directories `/opt/homebrew/var/postgresql@16` and
  `/opt/homebrew/var/postgresql@17` were then permanently removed. They used
  about `301 MB`; no Docker image, container, named volume or recovery backup
  was deleted. Free filesystem capacity increased to approximately `3.4 GiB`.
- Spring's host development profile already points to
  `jdbc:postgresql://localhost:5434/optiwms`; the container profile continues
  to use `jdbc:postgresql://db:5432/optiwms` inside the Docker network.

### Forecast-to-replenishment behavior

- The Forecasts page defaults, Spring proxy defaults and canonical forecast
  trigger now agree on `PROJECT_OPS_RM_PM` /
  `PROJECT_OPS_EXTRA_TREES_CAUSAL`. The Python route is `/v8/recalculate`;
  Spring/PostgreSQL remains the read authority.
- `ForecastResultReadService` now returns the planning inputs that were
  previously missing from the frontend contract: MOQ, material order
  multiple, lead-time days and unit cost, alongside on-hand, safety stock,
  reorder point, target maximum and average demand.
- `frontend/lib/forecast-planning.ts` is a deterministic, testable planning
  engine. Forecast P50/P90 demand consumes stock every month. A purchase
  release occurs only when projected inventory position reaches the reorder
  point; its receipt is delayed by lead time and rounded to MOQ/order multiple.
  Orders due beyond the displayed horizon remain in open pipeline so the UI
  cannot generate duplicate releases.
- The same monthly ledger calculates beginning stock, receipts, P10/P50/P90
  demand, fulfilled quantity, shortages, ending P50/P90 stock, pipeline,
  release quantity, receipt month, forward days of supply and action status.
  P50/P90 projected fill rates and coverage cards are derived from that ledger,
  not from unrelated decorative series.
- Inventory charts use continuous P50/P90 projected-stock curves, discrete
  simulated-receipt markers and explicit reorder/safety references. The
  replenishment ledger can be exported as CSV. Velocity/error visuals use
  action-oriented decision bands and labelled reference lines.
- Ordinary planner wording is `Demand & Replenishment Planning`; technical run
  detail remains available in a collapsed `Forecast run details` disclosure.

### Portable runtime and verification

- The forecast-service Docker image now copies the v8 pipeline, published
  outputs and loader into the image. Its Compose build context is the repository
  root and it no longer depends on host-only v8/repository bind mounts.
- Frontend planning unit test: passed, including consumption, delayed receipt,
  MOQ/multiple rounding, shortage/fill-rate behavior, days of supply and the
  outside-horizon duplicate-release guard.
- Forecast service: `13 passed` (four existing FastAPI `on_event` deprecation
  warnings).
- Full Spring suite: `BUILD SUCCESSFUL`, 15 tasks; the affected API, application
  and infrastructure modules also compile together.
- Frontend `npx tsc --noEmit`: passed.
- Frontend production build: passed; all `68` routes were generated and
  `/admin/forecasts` compiled to a `27.2 kB` route (`229 kB` first load). The
  build retains existing repository-wide React hook/font/lint warnings.
- `ai_services/docker-compose.ai.yml` and `infra/docker-compose.db.yml` both
  pass Compose configuration validation. The database Compose file retains an
  obsolete `version` warning only.
- Spring `/actuator/health` reported `UP`; the verified production Next runtime
  is reachable on port `3001`. The stale local development process on port
  `3000` returned `500` after its build cache was replaced and was excluded from
  acceptance.

### Verification boundary for this session

The environment approval quota blocked starting a new local forecast-service
listener on `8091` and then blocked the authenticated curl smoke. The in-app
browser security review also denied localhost navigation. Those restrictions
were not bypassed. Consequently, this checkpoint does **not** claim a new
authenticated screenshot or live `Recalculate -> publish -> refresh` browser
run. The database-backed path is supported by the populated Docker SQL checks,
the full Spring tests, the 13 forecast-service tests, frontend type checks and
the successful production render/build. Repeat the authenticated desktop and
mobile Forecasts smoke, and the live recalculate job, when localhost/browser
execution approval is available.

## 2026-07-28 Final Report And README Handoff

The repository now has a root `report.md` aligned to the supplied final-report
and viva structure: Abstract, Chapters 1-8, References, a complete test
catalogue and an evidence/notebook appendix. The root `README.md` has been
rewritten to describe v8 as the current project-operational source rather than
the superseded V3 runtime. The modeling workspace README now also identifies
v8 as current and separates V3 regression evidence from v1-v7 research history.

The handoff indexes all authoritative v8, shared evaluator and routing
notebooks; forecast, statistical, physical-layout and routing evidence
artifacts; implementation files; runtime commands; and the exact isolated test
commands. All local Markdown file links resolve.
All code cells in the indexed v8, shared evaluator and routing notebooks have
non-null execution counts.

The final README/report were then rebalanced to present the full solution,
rather than over-emphasizing forecasting and routing:

- inventory min/max now has a dedicated policy section covering 120 RM/PM
  rows, reorder point, safety stock, proposed min/max, MOQ/order-multiple
  rounding, 1,000-trial simulation, approval, draft purchase suggestions and
  rollback;
- OR-Tools MILP/flow slotting now has a dedicated section covering all 144
  materials, 3,257 required positions, 14/14 validation, the `OPTIMAL` result
  and objective `109468.4609`;
- the worker/admin warehouse assistant is documented as a sixth solution
  pillar, including its eight SOP documents, Chroma/MiniLM/Gemini RAG,
  read-only SQL analytics, tables/charts, frontend surfaces, startup and API
  links.

The assistant is correctly labelled as an optional advisory controlled-demo
service. It is not part of the forecast, policy, MILP or routing decision
engine, and production exposure remains gated on Spring JWT, role/warehouse
scoping, SQL/audit/rate controls and automated agent tests.

Documentation verification also reconfirmed:

- Spring: `22` JUnit methods, full Gradle suite successful;
- forecast service: `13 passed`;
- slotting service: `6 passed`;
- v8 forecast/physical contracts: `4 passed`;
- V3 regression/notebook contract: `14 passed`, `156 subtests passed`;
- shared time-series/neural evaluator: `8 passed`;
- routing evaluator: `5 passed`;
- frontend TypeScript and production build: passed;
- live routing acceptance and Docker/browser evidence: passed as recorded
  below.

The report explicitly states two coverage boundaries: there is no checked-in
automated Playwright/Cypress suite yet, and the old `scripts/smoke_test.sh`
checks legacy v1/MLflow artifacts rather than the v8 acceptance path.

The final documentation was subsequently expanded through a repository-wide
core-WMS/PWA audit and authoritative web/literature review:

- `README.md` now contains the complete feature/maturity map for authentication,
  masters, BOM, inbound, receiving/GRN, quality/quarantine,
  putaway, inventory/LPN, cycle count, min/max, slotting, transfer, outbound,
  picking, packing, shipping, returns, tasks, SOP/assistant, analytics,
  reports, notifications and anomalies.
- All eight worker PWA operations and their actual offline boundaries are
  documented. Returns intake and new shipment creation are identified as
  online-only; cached route display is not described as offline routing
  authority.
- The report now contains an overall architecture and separate Mermaid flows
  for inbound, inventory/cycle/replenishment/transfer, outbound/returns,
  forecast-to-policy-to-MILP, concurrent routing, PWA synchronization and the
  assistant.
- Chapter 2 now compares OptiWMS feature-by-feature with current official SAP
  EWM, Oracle WMS Cloud, Manhattan Active WM, Blue Yonder WMS and Microsoft
  Dynamics 365 Warehouse Management documentation, supported by warehouse
  operations/Industry 4.0 research.
- The comparison explicitly rejects commercial-enterprise parity claims.
  Missing HA/DR, SSO/MFA, multi-company isolation, wave/labor/TMS/
  EDI/MHE depth, localization, real-site validation and vendor operations are
  recorded.
- Appendix A now separates the 73 passing top-level controlled-project tests
  from a required non-AI/PWA regression backlog. Inbound-to-putaway,
  cycle-count adjustment, transfer, allocation-to-delivery, returns,
  service-worker replay and full role/warehouse authorization do not
  yet have dedicated automated end-to-end suites.
- Forecast and optimization governance was re-expanded in the root README and
  final report: controlled generation/lineage, data quality, leakage guards,
  sin/cos and spectral evidence, residual diagnostics, hypothesis tests,
  calibration, cost sensitivity and MILP physical acceptance are all linked
  to their current notebooks and persisted artifacts.
- Correction verification passed: all 23 Spring tests, frontend
  `npx tsc --noEmit`, frontend production build, root README/report local link
  and anchor validation, and `git diff --check`.
- GitHub Actions forecast inference gate corrected on 2026-07-28: CI now uses
  Python 3.12, matching the forecast-service package constraint and container
  image. A clean temporary Python 3.12 installation succeeded; the exact CI
  subset passed 10/10 tests and the complete forecast-service suite passed
  13/13 tests.

## 2026-07-28 Worker PWA And Conflict-Aware Routing Completion

The v8 physical population is now wired to a single server-authoritative
worker-routing control plane for inbound putaway and outbound picking.

- Flyway schema version `79` persists versioned route graphs, nodes, edges,
  location access faces, worker sessions, ordered stops, node/edge time
  reservations and events.
- The active `PROJECT_OPERATIONAL_SIMULATION_V8` route graph contains `956`
  nodes, `1,980` directed edges, `280` rack-bay obstacles and mappings for all
  `4,200` storage positions. It is generated only from the active warehouse
  dataset version.
- Every rack is treated as a physical obstacle. Storage locations map to
  explicit WEST/EAST rack-face nodes; paths follow aisle/cross-aisle edges and
  display 90-degree arrow segments rather than crossing racks.
- Spring owns multi-stop ordering, A* route geometry, 3-second edge/node
  headway, opposite-direction edge serialization, leases, heartbeats,
  idempotent client events, stale-version rejection and stop-triggered
  replanning.
- Worker putaway/picking pages use the authoritative graph and route session.
  The map provides focused/overview modes, stations/parking, current position,
  ordered stops, planned wait and dimmed released segments. No new
  conflict-safe reservation is issued while offline.
- Admin warehouse and `/admin/pathfinding` screens display the same live
  sessions through authenticated SSE plus recovery polling. The former fake
  browser-only grid is no longer the operational screen.
- The operational warehouse endpoint now returns active v8 `WH-001` first
  instead of being hard-coded to the V3 baseline. Authenticated browser
  verification selected `WH-001` and rendered all `280` rack footprints with
  graph totals of `956` nodes and `1,980` edges and no page-level error.
- Access is scoped: workers can access only their own sessions and assigned
  warehouse; fleet views, stats, graph rebuild and event streaming require
  warehouse manager/admin authority.
- The installable worker PWA uses `/worker` as its app identity/start URL and
  caches task, receiving, putaway, picking, packing and cycle-count shells.

Evaluator evidence is in
`Ai miroservices/modeling/warehouse_routing_evaluation/`. Across `160` paired
routes, A* matched Dijkstra distance in `100%` of cases, reduced mean expansions
by `265.23` (bootstrap 95% CI `[237.31, 293.92]`) and reduced mean runtime by
`0.0959 ms` (bootstrap 95% CI `[0.0737, 0.1189]`, paired Wilcoxon
`p=1.76e-15`). Eight replicates at each of `1/5/10/25/50` workers found
independent A* conflicts from five workers onward, while reservation A* had
zero tested conflicts through 50 workers. The executed notebook has `10/10`
code cells with visible tables/plots, assumption registry and claim–evidence
matrix.

Live acceptance passed: first competing route wait `0`, second wait about
`21.1 s`, database reservation overlaps `0`, stop completion incremented route
version `1 → 2`, stale progress returned `409`, and graph rebuild with active
routes returned `409`. The repeatable check is
`scripts/test_worker_routing_runtime.sh`; it cancels its temporary sessions.
Full Spring tests, frontend TypeScript, frontend production build, five routing
evaluator tests and clean notebook execution pass.
PostgreSQL, the Spring backend and the frontend Docker services are healthy.
The frontend is packaged from verified Next standalone output; its health
probe uses `127.0.0.1` to match the runtime's IPv4 bind.

This completes the controlled synthetic project workflow, not external
forklift safety certification. Aisle widths, rack/vehicle envelopes, one-way
rules, RTLS accuracy, actual travel speeds, long-running fairness, shadow-mode
performance and site safety approval remain `UNVERIFIED`. The existing
Next.js `14.2.5` dependency also emits a published security warning during
Docker build and requires a separate framework upgrade/test cycle.

## 2026-07-28 v8 Physical Storage And Slotting Completion

The former statement that v8 physical storage/slotting was gated is superseded. The missing physical population has been generated, loaded and validated.

### Physical material and layout population

- `physical_materials.csv` defines positive L/W/H, unit weight/volume, handling-unit type, units per handling unit, units per pallet, pallet footprint, pallet weight, stackability, maximum stack height, temperature, hazard, fragility and shelf-life fields for `144/144` materials.
- Existing material codes inherit compatible deterministic physical templates from the canonical generated baseline. Additional v8 codes use deterministic same-type template matching under seed `20260711`; provenance is `PROJECT_OPERATIONAL_SYNTHETIC_TEMPLATE_MATCH`.
- The existing Colombo A-E metric-aisle footprint is preserved and expanded under layout version `CMB_METRIC_AISLE_V8_EXPANSION`.
- The active layout has `4,206` rows: `4,200` storage positions plus receiving, staging, door, packing, dispatch and quarantine stations.
- The expansion was necessary because the 600-position V3 layout could not honestly hold the simultaneous v8 current/max physical load. It was expanded rather than falsely reducing forecast-derived stock or overloading bins.
- The original 600 storage positions retain their level-specific beam limits. Expansion positions are engineered for one pallet, up to `1,200 kg` and `1,800,000 cm3`, with explicit ambient/controlled and hazard-compatible bands.
- `190,726` stale pre-v8 null-lineage locations were archived as `ARCHIVED_PRE_V8_LAYOUT`; they were not deleted. Exactly `4,206` v8 locations are now active in `WH-001`.

### Assignment and solver evidence

- `3,257` unique policy-capacity assignments cover all `144` materials: one unique pick face per material plus all required reserve positions.
- `2,921` location inventory rows represent current occupancy; assignment capacity uses the larger of current on-hand and proposed maximum stock.
- All `14/14` artifact checks pass: dimensions, layout continuity, capacity margin, assignment completeness, unique bins, one pick face, weight, volume, ABC compatibility, temperature, hazard and inventory-total reconciliation.
- Minimum observed assignment headroom is `19.968 kg` by weight and `340,740 cm3` by volume.
- Independent `ORTOOLS_MILP_FLOW_V3` evaluation returned `OPTIMAL` for `144` materials and all `3,257` pallet positions. The verified objective was `109468.4609`.
- Spring live readiness returns `ready=true`, `materialsReadyPct=100.0` (`144/144`), `locationsReadyPct=100.0` (`4,206/4,206`) and no blockers.
- Spring warehouse integrity returns `144` total materials, `144` assigned defaults, zero missing defaults, `2,921` inventory rows, zero null locations, zero inactive/blocked defaults, zero duplicate primary locations and zero storage-type mismatches.

### PostgreSQL and application alignment

- `scripts/load_project_operational_simulation.py` now atomically publishes physical material attributes, the active layout, FG demand, location inventory, primary/reserve assignments and artifact-backed ABC/FMS evidence.
- PostgreSQL post-load validation is `passed=true`: `144` materials, `4,206` locations, `3,257` assignments, `2,921` inventory rows, zero missing physical attributes, zero inventory capacity violations and zero assignment-class violations.
- Spring operational filters now include `PROJECT_OPERATIONAL_SIMULATION` for material catalogue, inventory, BOM, location analytics, slotting readiness, issue statistics and plan optimization.
- Spring forecast reads now bind to `PROJECT_OPS_RM_PM`, `PROJECT_OPS_EXTRA_TREES_CAUSAL`, `project_ops_v8` and `PROJECT_OPERATIONAL_SIMULATION_V8`.
- The PostgreSQL model registry now records this evidence-gated v8 release as `PROMOTED`; both Spring and the Python gateway report `is_champion=true`.
- `deployment_decision.json` now records `storage_slotting_population_ready=true`; the integration contract allows project slotting against the validated v8 layout.

### Live Docker state and verification

- Running healthy containers: PostgreSQL `5434`, Spring backend `8080`, forecast service `8091`, orchestrator `8092`, and slotting service `8093`.
- Spring `/actuator/health` is `UP`; the forecast gateway reports the v8 champion without fallback; orchestrator and slotting health endpoints report `ok`.
- The Spring backend was rebuilt from the verified host boot JAR and Flyway reports schema version `78`.
- Python 3.12 evaluator: v8 tests `4 passed`; the final enterprise notebook executes top-to-bottom and visibly includes storage/slotting evidence.
- Slotting service: `6 passed`, including canonical V3 and full v8 OR-Tools integration tests.
- Forecast service: `13 passed`.
- Canonical operational-baseline regression: `14 passed`, including `156` notebook subtests.
- Full Spring `./gradlew test --no-daemon`: `BUILD SUCCESSFUL`.

### Remaining boundary

There is no remaining synthetic-project storage/slotting population blocker. A site survey is still required before claiming that generated coordinates, rack capacities or travel distances describe an external physical warehouse. Manager approval and transfer execution remain required before any slotting plan physically moves stock.

## 2026-07-19 V3 Operational Baseline Verification

- Material hierarchy: `48` RM, `32` PM, and `16` FG, for `96` active catalogue and forecast SKUs.
- Warehouse geometry: `40` operational racks in zones A-E, `600` active storage positions, `6` route stations, and a connected `52`-node/`55`-edge metric aisle graph. F/G/H balancing zones are absent.
- Inventory: `169` material-location rows; every active SKU is stocked and larger holdings span multiple unique bins. Every row has a positive stacking quantity.
- BOM: all `16` realistic FG parents have effective, product-specific formula and pack-profile definitions, with `250` component lines and complete RM/PM coverage.
- Planning evidence: `6,912` monthly demand observations, `1,152` untouched-test backtest rows, and `1,152` H1-H12 forward forecast rows.
- Runtime load: `5,000` orders, `15,000` order lines, and `30,000` stock movements, tasks, and operation events each.
- Earlier generated warehouses were archived from operational views. The V3 load removed `2,850` stale generated locations rather than showing them as live racks.
- Product and API contracts now distinguish units per handling unit, units per pallet, maximum stack height, and physical pallet footprint. Inventory exposes populated stacking quantities.
- The canonical forecast SKU catalog lists RM first, PM second, and FG third. It does not expose forecast-only SKUs that are absent from the active material and inventory scope.
- Current V3 source verification passed: deterministic regeneration produced the same dataset hash, all generator validations are true, `11` baseline tests plus `130` notebook checks pass, frontend TypeScript passes, and `git diff --check` is clean. The final PostgreSQL reload, Spring rebuild, authenticated API check, and live browser regression are pending as stated below.

The V3 model passes the project promotion thresholds on statistically controlled generated data. Manager approval is still required before promotion, and no external-real-world accuracy claim is made.

Deployment note: the final V3 archived-assignment cleanup and rotated A-E desktop rack canvas are implemented in source, but the local PostgreSQL reload and final backend rebuild were blocked by the current local execution-approval quota. Until `./.venv/bin/python scripts/load_project_operational_baseline.py` and `./scripts/build_backend_runtime.sh` are rerun, the live browser can still show archived default-location counts or the previous rack geometry. No claim below overrides this deployment boundary.

## Historical Log (Superseded By The V3 Status Above)

## 2026-07-19 Superseded V1 Warehouse UI And Analytics Checkpoint

The final authenticated desktop smoke test used `admin@optiwms.com` against the rebuilt local stack. The backend is healthy on `8080`; PostgreSQL, forecast service, orchestrator, slotting service, and MLflow are also healthy. The frontend development runtime is available at `http://localhost:3000`.

- The detailed warehouse view loads the canonical `200` racks and `3,000` storage positions. Every rack renders all five physical levels (`L1` through `L5`) without label overlap. Door, receiving, quarantine, packing, and dispatch anchors are reserved for Forklift Routes rather than mixed into the detailed rack view.
- Physical rack suitability is persisted and visible as a nine-cell matrix: `AF 18`, `AM 18`, `AS 24`, `BF 21`, `BM 21`, `BS 28`, `CF 21`, `CM 21`, and `CS 28`. These are rack suitability bands consumed by slotting; material ABC/FMS remains demand-derived evidence.
- Inventory is globally sorted by SKU through the paginated Spring query, not sorted only inside the current browser page. The live screen starts `FG-0001`, `FG-0002`, and so on and reports `1,609` canonical material-location rows.
- Product Catalogue is globally sorted by SKU and reports exactly `866` materials. Its Assigned Locations column resolves the persisted primary and reserve location rows; multi-bin stock remains separate inventory records rather than being collapsed to one bin.
- Dashboard analytics now resolve the canonical warehouse before requesting every KPI/chart. Orders are also constrained to the warehouse dataset version plus future `OPERATIONAL_ENTRY` rows. The live dashboard reports exactly `25,000` baseline orders, `1,609` inventory rows, and `1,113` low-stock exceptions computed from quantity/availability/ROP/buffer thresholds instead of stale status strings.
- Inventory Policy & Space Planner uses a compact governance strip and a nine-column decision table with expandable input/evidence detail. The current readiness result is correctly `Review`: all `288` RM forecast series have passed statistical evaluation but await manager model promotion, so a new policy run cannot silently consume them.
- Slotting Demand Shift Insights no longer displays a fabricated uniform `45%` confidence. Each row identifies its evidence path (`Forecast backed`, `Partial forecast`, or `Historical fallback`). The existing `ORTOOLS_MILP_FLOW_V3 / OPTIMAL` plan remains a manager-controlled draft.

Final verification for this checkpoint:

- `./scripts/build_backend_runtime.sh`: backend JAR compiled, runtime image rebuilt, container healthy.
- `./gradlew test --no-daemon` with Gradle `8.10.2`: `BUILD SUCCESSFUL` across all backend modules.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed.
- Authenticated browser checks passed for Dashboard, Inventory, Product Catalogue, Warehouse Layout, rack suitability, Inventory Policy, and Slotting Planner.

The remaining operational action is governance, not missing data: a manager must promote the statistically eligible forecast release before new forecast-dependent policy and demand-shift recommendations become decision-eligible. Existing approved historical policy runs remain visible for audit and rollback.

## 2026-07-19 Implementation Checkpoint

### Canonical generated warehouse

- Material master: `120` FG + `288` RM + `458` PM = `866` SKUs.
- Warehouse geometry: `200` racks, `3,000` pallet/bin positions, and `6` operational stations (`3,006` location rows total).
- Current generated inventory: `1,609` material-location rows with one pick face plus zero or more reserve bins per SKU.
- BOM: `120/120` finished goods covered, `1,641` effective component rows, and every RM/PM material used by at least one BOM.
- History and load scale: `72` planning months, `25,000` orders, `100,000` order lines, `125,000` movements, `125,000` tasks, and `125,000` operation events.
- Physical validation now proves pallet gross weight `<= 1,200 kg` and pallet volume `<= 1,800,000 cm3` for every generated SKU.
- Material payloads now send true pallet weight and pallet volume to optimization; unit-level values are no longer misrepresented as pallet-level constraints.

### Forecast and policy evidence

- Champion: `EXTRA_TREES`, selected before opening the final 12-month test.
- Extra Trees WAPE `11.89%` versus seasonal-naive WAPE `19.59%`, a `39.32%` relative improvement.
- Aggregate bias `-0.21%`, P05-P95 empirical coverage `88.94%`, and critical `AF/AM/BF` WAPE `9.61%`; every configured promotion gate passes.
- Promotion status remains `PENDING_MANAGER_APPROVAL`; generated-data evidence is not an external production-validity claim.
- Policy output remains `(s,S)` with empirical lead-time demand, residual uncertainty, MOQ/order-multiple rounding, service-class targets, cost comparison, and capacity checks.

### Warehouse and slotting implementation

- Layout uses physical rack/level/bin codes and generated coordinates relative to receiving, door, packing, and dispatch anchors.
- Product Catalog and Inventory use the same canonical SKU and location namespace. Product rows expose primary plus reserve assignment counts.
- ABC is annual issued-volume concentration; FMS is issue-event frequency within subtype. `AF`, `AM`, and `BF` remain critical classes.
- `ORTOOLS_MILP_FLOW_V3` plans one unique pick face per SKU and all reserve pallet positions across multiple bins.
- Objective terms include forecast-weighted travel, accessibility, vertical handling, relocation, carrying-space, and stockout-risk weights.
- Constraints include pallet count, one-pallet-per-bin contract, weight, volume, temperature, hazard, fragility, stackability, compatibility, unique primary bins, and relocation cap.
- Canonical-scale test result: all `866` SKUs and `2,578` target pallet positions solved and independently validated in about `10.6 s` at the `30%` relocation cap.
- Approval of `INFEASIBLE`, unavailable, abnormal, not-solved, or fallback plans is blocked in Spring and disabled in the frontend. Successful approvals create transfer work; stock changes only after execution unless an administrator explicitly chooses direct apply.

### Verification completed

- Baseline contract: `7 passed`, including `31` notebook syntax subtests.
- Slotting service: `5 passed`, including the full `866`-SKU canonical integration test.
- Full Spring test suite: `./gradlew test --no-daemon` passed after aligning physical capacity with the effective WMS max-stock policy and removing duplicate MOQ rounding.
- Frontend TypeScript: `npx tsc --noEmit` passed.
- `git diff --check` passed.
- Post-edit Spring verification completed successfully: `./gradlew :core-app:compileJava --no-daemon` and the Dockerfile-equivalent `./gradlew build -x test --no-daemon` both pass after mapping `materials.unit_cost_standard` in `MaterialEntity`.
- The canonical loader now archives prior generated artifact revisions outside the active dataset scope before upserting a new hash. The current load validated exact counts while preserving `OPERATIONAL_ENTRY` records.

### Live runtime status

- The Spring backend was rebuilt from the verified host boot JAR through `Dockerfile.runtime`; container `optiwms-backend` is healthy, `/actuator/health` returns `UP`, PostgreSQL remained intact, and Flyway validated schema version `78`.
- Forecast service `8091`, orchestrator `8092`, slotting service `8093`, PostgreSQL, backend, MLflow, and pgAdmin are running; all services with health contracts report healthy/`ok`.
- The forecast service runtime contract reports `mode=wms_db`, `reason=validated`, with no missing tables or columns. PostgreSQL remains the operational authority.
- The Python slotting image was rebuilt and the running container contains `ORTOOLS_MILP_FLOW_V3`.
- PostgreSQL load audit is `completed` for artifact hash `73b9c81b40342d4faf1247e87c8a4ec870cfa0bf0bc35c8f1a67eed03824fbb0`; post-load validation is `true` for `866` materials, `3,006` locations, `10,392` forecasts, `25,000` orders, `100,000` order lines, and all movement/task/event counts.
- End-to-end runtime plan `SLOT-2026-H2-v5` is persisted as `ORTOOLS_MILP_FLOW_V3 / OPTIMAL`: `866` SKU lines, `1,597` reserve pallet positions, objective `367069.7702`, and all physical, compatibility, accessibility, relocation, and complete-allocation constraints recorded.
- The forecast-to-space contract now uses the effective WMS max-stock policy for simultaneous physical capacity. Six-month cumulative demand remains a trend/risk/accessibility signal and is no longer incorrectly treated as six months of stock stored at once.
- Frontend port `3000` is reachable and returns the expected `307` authentication redirect. Final authenticated visual regression remains pending because the active browser policy rejected further localhost access; no bypass was attempted.
- The source-building `backend/Dockerfile` can fail in Docker Desktop when Maven Central terminates TLS handshakes. `scripts/build_backend_runtime.sh` is the deterministic local path: it builds `:core-api:bootJar` with the host Gradle cache and packages that JAR through `backend/Dockerfile.runtime`, without modifying PostgreSQL volumes.
- Earlier plans `SLOT-2026-H2-v2` through `v4` remain infeasible fallback evidence and cannot be approved. Only `v5` is the current feasible V3 draft.
- `SLOT-2026-H2-v5` is deliberately still `DRAFT`; manager approval is required before transfer work is created, and inventory moves only after execution.
- Generated coordinates remain a controlled project baseline pending a physical warehouse survey. External-real-world forecast and travel performance remain unvalidated.

## What Is Wired To The Application

### Spring/WMS API

Implemented runtime alignment:

- `backend/core-api/src/main/java/com/optiwms/coreapi/ai/ForecastResultReadService.java`
  - Reads latest rows from `forecast_results`.
  - Uses canonical dataset `RM_PM`.
  - Prefers canonical model id `V7_RM_PM_DIRECT` when rows exist.
  - Returns dashboard-compatible forecast rows with `p10`, `p50`, `p90`, `horizon`, `month`, `sku`, `category`, `warehouse_id`, and optional `y_true`.

- `backend/core-api/src/main/java/com/optiwms/coreapi/ai/AiProxyController.java`
  - `/api/ai/forecasts` checks Spring `forecast_results` first, then falls back to the Python forecast-service path.
  - `/api/ai/forecast-dashboard-summary` checks Spring `forecast_results` first, then falls back.
  - `/api/ai/gateway/models` returns Spring canonical model metadata when canonical rows exist.

This is the correct enterprise direction: Spring/PostgreSQL is the business source of truth; Python remains useful for model training, inference, governance, and publish jobs.

### Python Forecast Service

Current role:

- Still exists and still serves older ML-service endpoints.
- Should not be treated as the business source of truth for planning.
- Its SQLite `forecast_predictions` table should be considered an optional local/demo cache, not the operational planning database.

Current helper:

- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/pipeline/sync_forecast_service.py`
  - Exists as a temporary bridge if a local demo requires syncing v7 CSV output into forecast-service SQLite.
  - This should not be the long-term enterprise path.

### v7 Modeling Pipeline

Current location:

- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/`

Current source tables:

- `materials`
- `inventory`
- `demand_history`
- `forecast_results`
- `bom_headers`
- `bom_components`

Current output facts from v7 artifacts:

- RM/PM demand rows: `10,368`
- RM/PM demand materials: `288`
- Demand window: `2023-02-01` to `2026-01-01`
- BOM headers/components: `3` headers, `2` component rows
- BOM parent-product coverage: `0.0%`
- Forecast rows generated: `3,456`
- Policy recommendation rows: `288`
- Slotting readiness rows: `288`
- Published Spring rows: `3,456` under model id `V7_RM_PM_DIRECT`

Current model leaderboard:

| Model | WAPE | MAE | RMSE | Bias | Under-forecast rate |
|---|---:|---:|---:|---:|---:|
| LightGBM global RM/PM | 25.09% | 433.24 | 2421.59 | 1.58% | 50.64% |
| Croston/SBA | 25.84% | 446.17 | 2401.37 | 3.11% | 43.46% |
| Moving average 6 | 28.29% | 488.43 | 2752.24 | 8.23% | 39.53% |
| Moving average 3 | 28.98% | 500.50 | 2724.77 | 6.53% | 40.05% |
| Seasonal naive | 34.82% | 601.35 | 3386.66 | 7.53% | 37.44% |

Model interpretation:

- LightGBM is currently the best WAPE model among the tested candidates.
- Croston/SBA has similar RMSE and a lower under-forecast rate, so it must remain visible as a serious baseline for intermittent demand.
- The system should not claim LightGBM is statistically sufficient without caveat. The rebuilt notebooks now expose residual behavior, rolling-origin stability, interval calibration, and per-material error distribution for review.

### Corrected Offline Experiment

Locations:

- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/13_Corrected_High_Volume_LightGBM_Experiment.ipynb`
- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/pipeline/corrected_experiment.py`
- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/pipeline/run_corrected_experiment.py`
- `Ai miroservices/modeling/v7_rm_pm_forecast_planning/outputs/corrected_experiment/`

Defect corrected:

- Previous training rows used a `t+1` target while lag/rolling features were indexed and shifted differently from future inference.
- The corrected contract defines target month `t` using demand observed only through `t-1`; future inference follows the same rule.

Experiment design:

- Six expanding-window, one-step-ahead forecast origins.
- `288` materials and `1,728` held-out material-month rows per candidate.
- Compared aligned log-L2, log-Huber, raw-L1, Tweedie, Poisson, volume-weighted log-L2, and material-scale-normalized variants.
- No forecasts were published by this experiment.

| Model | WAPE | MAE | RMSE | Bias | Under-forecast rate |
|---|---:|---:|---:|---:|---:|
| Scale-normalized LightGBM (`lgb_ratio_log_l2`) | 24.17% | 417.41 | 2331.47 | 3.63% | 45.60% |
| Previous v7 LightGBM evaluation | 25.09% | 433.24 | 2421.59 | 1.58% | 50.64% |

High-volume evidence:

- Highest-demand quintile WAPE: `22.96%`.
- Highest-demand quintile MAE: `1,891.63` units.
- Highest-demand quintile RMSE: `5,194.35` units.
- Extreme observations still dominate business risk even though relative WAPE improved.

Feature evidence:

- Previous gain importance assigned `86.73%` to `roll_mean_12`.
- Corrected gain importance is less concentrated: `roll_std_6` is largest at `43.56%`, while `roll_mean_12` falls to `2.61%`.
- Held-out permutation importance is also generated because correlated lag/rolling inputs can distort gain rankings.

Statistical interpretation:

- Scale normalization improved more than raw volume weighting or objective changes alone.
- The corrected champion significantly reduced paired absolute error versus ordinary aligned log-L2, raw-L1, Tweedie, Poisson, and weighted candidates in this simulated backtest.
- Its advantage over scale-normalized L1 is not statistically conclusive (`p = 0.2173`).
- Production validity is still unproven because the history is simulated and lacks real production-plan, validated BOM, issue, backorder, and shutdown signals.

## v8 Controlled Synthetic Validation Harness

Location:

- `Ai miroservices/modeling/v8_controlled_synthetic_validation/`

Purpose:

- Test the complete forecasting method against a known causal data-generating process.
- Determine whether the pipeline can recover production-plan and BOM signals when they are complete.
- Compare direct-history forecasting with deterministic BOM explosion and causal ML.
- The v8 outputs are now also loaded as the explicit project-operational seed dataset. This is for integrated WMS demonstration, not a claim of external production history.

Controlled dataset:

- Seed: `20260711`
- History: `72` monthly periods
- Finished goods: `24`
- Raw materials: `90`
- Packaging materials: `30`
- Effective BOM component rows: `211`
- Controlled FG-parent coverage: `100%`
- Controlled material-component coverage: `100%`; every generated RM/PM material appears in at least one BOM.
- Material policies include MOQ, order multiple, lead time, service level and unit cost.
- Demand generation includes trend, seasonality, promotions, holidays, structural shifts, production-plan error, yield, scrap, heteroscedastic noise and discrete shocks.
- Every row is labelled `CONTROLLED_SYNTHETIC_GROUND_TRUTH`; none is represented as real Hemas history.

Leakage-safe protocol:

- Target month `t` uses observed demand only through `t-1`.
- Known production-plan/BOM requirement for `t` is available only to causal candidates.
- Six rolling months are used for LightGBM hyperparameter tuning.
- A different six rolling months lock the champion.
- The final twelve rolling origins are untouched until final scoring.
- All candidates are compared on the same `1,440` material-month test rows.

Candidate families:

- Seasonal naive, moving average, Croston/SBA and damped Holt/ETS.
- Deterministic production-plan BOM explosion.
- Ridge and Elastic Net.
- Random Forest and Extra Trees.
- Direct scale-normalized LightGBM.
- Causal scale-normalized LightGBM.
- Causal Tweedie LightGBM.

Locked champion and untouched test:

| Model | WAPE | MAE | RMSE | Bias | Shock WAPE |
|---|---:|---:|---:|---:|---:|
| Random Forest causal | 8.24% | 728.08 | 1368.54 | 0.69% | 8.07% |
| Extra Trees causal (locked champion) | 8.34% | 736.76 | 1408.46 | -0.15% | 8.57% |
| BOM plan | 8.51% | 752.43 | 1347.60 | 1.84% | 8.31% |
| LightGBM causal Tweedie | 8.63% | 762.45 | 1533.57 | -0.67% | 8.74% |
| LightGBM causal ratio | 9.23% | 815.41 | 1547.04 | 0.15% | 8.85% |
| LightGBM direct ratio | 10.33% | 912.84 | 1667.26 | 0.09% | 9.86% |
| Holt damped | 10.67% | 943.24 | 1803.29 | -1.17% | 10.46% |

Statistical comparison:

- Extra Trees was locked from the selection window; Random Forest scored slightly lower WAPE on the untouched test, but the difference is not significant (`paired t p = 0.3918`; monthly DM-style `p = 0.6607`).
- Extra Trees versus BOM plan: no significant mean-error difference (`paired t p = 0.3634`; monthly DM-style `p = 0.6358`).
- Extra Trees versus causal Tweedie LightGBM: no significant difference (`paired t p = 0.1479`; monthly DM-style `p = 0.3580`).
- Extra Trees versus direct LightGBM: Extra Trees is better (`paired t p < 0.0001`; monthly DM-style `p < 0.0001`).
- Extra Trees versus causal ratio LightGBM: Extra Trees is better (`paired t p < 0.0001`; monthly DM-style `p = 0.0002`).
- The DM-style test has only twelve aggregate monthly loss differences and is explicitly treated as low-power evidence.

Residual and uncertainty evidence:

- Jarque-Bera rejects Gaussian residuals (`p < 0.001`).
- Breusch-Pagan rejects constant variance (`p < 0.001`).
- Absolute residual magnitude rises with fitted scale (`Spearman rho = 0.732`, `p < 0.001`).
- Monthly mean residual autocorrelation is not detected by the tested Ljung-Box lag (`p = 0.334`).
- Split-conformal nominal 90% interval coverage is `92.08%` on the untouched test rows.

Interpretation:

- The pipeline can recover a known RM/PM causal process and correctly benefits from production-plan/BOM inputs.
- The result supports the architecture and experimental implementation.
- It does not prove that every v7 error is exclusively a data problem.
- It does not prove production accuracy because the generated BOM, production and demand rows are synthetic controls.
- Real material issues, production orders and validated effective-dated BOMs must pass the same protocol before operational promotion.

Generated notebooks:

1. `00_Controlled_Data_Generation.ipynb`
2. `01_Controlled_Demand_EDA.ipynb`
3. `02_Features_Models_And_Tuning.ipynb`
4. `03_Untouched_Test_And_Hypothesis_Tests.ipynb`
5. `04_Residuals_Intervals_And_Policy.ipynb`
6. `05_Statistical_Conclusion.ipynb`
7. `06_Final_Enterprise_Model_Decision_And_E2E.ipynb`

Final deployment artifacts:

- `outputs/model_card.json`
- `outputs/integration_contract.json`
- `outputs/deployment_decision.json`

Final deployment decision:

- `V8_CONTROLLED_EXTRA_TREES_CAUSAL` is approved for offline validation, simulation UI work, inventory-policy integration tests, and MILP/knapsack sandbox runs.
- It is not registered in the Python forecast-service and is intentionally blocked from the production Recalculate Forecast action.
- It is not eligible for Spring canonical publication, automatic min/max application, purchase-order creation, or approved slotting moves.
- The blocker is not API plumbing. The blocker is that its material identities, BOMs, production plans and history are generated (`synthetic_ratio = 1.0`).
- Production promotion requires substituting real operational data into the same feature contract, retraining, nested rolling validation, calibrated intervals, shadow-mode planning validation and explicit approval.

Forecasts frontend wording corrected:

- Stock projection is now labelled as an inventory-policy simulation rather than observed future stock.
- Model KPI cards no longer claim old M5/static metrics as current evidence.
- Residual guidance no longer assumes Gaussian noise.
- Threshold scorecards now say `Threshold pass` or `Review required`, not `Deployed`.

## Dashboard Status

### Working

- Forecasts page can call:
  - `/api/ai/gateway/models`
  - `/api/ai/forecasts`
  - `/api/ai/forecast-dashboard-summary`
  - `/api/ai/forecast-metrics`
  - `/api/ai/inventory-recommendations`
  - `/api/ai/raw-material-requirements`

- Canonical forecast rows can now appear in the dashboard through Spring instead of requiring manual SQLite sync.
- Forecast chart data can render from forward forecast rows with `p10`, `p50`, and `p90`.
- The page no longer has to be empty when `forecast_results` has canonical v7 rows.

### Frontend Gaps

The dashboard still mixes real v7 runtime data with incomplete evidence surfaces.

Known gaps:

- Model display name is still too technical in places (`V7_RM_PM_DIRECT`). User-facing label should be `LightGBM RM/PM Global Forecast`; technical id can stay in metadata.
- `/api/ai/forecast-metrics` still comes from the older forecast-service path, not from v7 backtest artifacts.
- Dashboard summary from `forecast_results` returns forecast rows but not v7 backtest metrics.
- Inventory recommendation and raw-material-requirement calls still route through the existing service path, not fully through the v7 `forecast_results` planning source.
- Some dashboard panels imply statistical validation but do not yet have the required v7 backtest data behind them.
- `y_true` is normally null for forward published forecast rows, so actual-vs-forecast and residual charts cannot be honestly produced from live forecast rows alone.

## Chart And Evidence Gaps

Current chart issues:

- Residual chart is mostly empty because forward forecast rows do not include actuals.
- Error distribution chart is empty for the same reason.
- Seasonality radar/index can be empty because the online dashboard reads H+1 forecast labels, not full historical monthly actuals.
- Green dot scatter chart is visually noisy and not statistically meaningful enough yet; it needs class labels, sample counts, and a clearer interpretation.
- Forecast accuracy card can show a metric, but the current source must be labeled as v7 rolling backtest/static artifact, not live forward actuals.
- Stock projection and days-of-cover charts are planning simulations, not measured future truth. They must be labeled as policy simulation based on forecast demand, on-hand stock, reorder point, and replenishment assumptions.
- Current confidence interval display is forecast interval output, but coverage cannot be claimed unless backtest rows with actuals are joined and evaluated.

Required chart fixes:

- Add a v7 evidence endpoint or static artifact loader for:
  - model leaderboard
  - per-material metrics
  - residual rows
  - interval calibration
  - backtest actual-vs-predicted rows
  - feature importance
  - data-quality summary

- Update dashboard panels so each chart states its evidence source:
  - `forward forecast`
  - `rolling backtest`
  - `inventory policy simulation`
  - `not available yet`

- Remove or hide charts that cannot be supported by current data.

## Notebook Status

### Previous v7 Problem

The earlier v7 notebooks were too shallow for a data-science/statistics evaluation.

Problems:

- Not enough dataset inspection.
- Not enough data-column and schema explanation.
- Not enough relationship mapping across materials, inventory, demand history, forecast results, and BOM.
- EDA is too light.
- Residual diagnostics are incomplete.
- Model evaluation is not presented with enough statistical rigor.
- Charting is mostly summary-level and does not match the richer v6 academic notebook flow.

### Implemented v7 Rebuild

The v7 notebooks have been rebuilt using v6 as the style/template source and the forecasting paper as the methodology guide.

Required notebook sequence:

1. `00_Methodology_And_Paper_Map.ipynb`
2. `01_Data_Lineage_Schema_And_Relationships.ipynb`
3. `02_Data_Quality_Profiling.ipynb`
4. `03_RM_PM_Demand_EDA.ipynb`
5. `04_Preprocessing_And_Feature_Engineering.ipynb`
6. `05_Baseline_And_Intermittent_Models.ipynb`
7. `06_LightGBM_Global_RM_PM_Model.ipynb`
8. `07_Rolling_Backtest_And_Model_Selection.ipynb`
9. `08_Residual_Diagnostics_And_Error_Analysis.ipynb`
10. `09_Prediction_Intervals_And_Calibration.ipynb`
11. `10_Forecast_To_Inventory_Policy.ipynb`
12. `11_Forecast_To_Slotting_And_Space.ipynb`
13. `12_Limitations_And_Executive_Evidence.ipynb`
14. `13_Corrected_High_Volume_LightGBM_Experiment.ipynb` (offline experiment; not published)

Required methods/evidence:

- data dictionary and schema map
- missing/duplicate/negative/zero checks
- demand distribution and concentration
- intermittent demand classification
- ABC/FMS/XYZ classification
- outlier detection and treatment policy
- seasonality/trend/decomposition where history supports it
- lag and rolling feature validation
- leakage gates
- rolling-origin backtest
- LightGBM vs statistical/intermittent baselines
- WAPE, MAE, RMSE, bias, under-forecast rate
- per-material and aggregate metrics
- residual histogram/KDE
- Q-Q plot
- residual vs fitted
- residual over time
- residual autocorrelation checks where meaningful
- interval coverage and calibration
- model limitations and deployment caveats

Implemented evidence artifacts:

- `data_dictionary.csv`
- `table_relationships.csv`
- `data_quality_report.csv`
- `outlier_report.csv`
- `feature_matrix_profile.csv`
- `feature_matrix_sample.csv`
- `rolling_origin_splits.csv`
- `backtest_residuals.csv`
- `selected_model_backtest_rows.csv`
- `per_material_metrics.csv`
- `interval_calibration.csv`
- `statistical_comparison.csv`
- `model_feature_importance.csv`

Implemented plots:

- `data_quality_missingness.png`
- `top_demand_materials.png`
- `abc_fms_heatmap.png`
- `seasonality_index.png`
- `model_wape_leaderboard.png`
- `selected_model_residual_diagnostics.png`
- `selected_model_actual_vs_predicted.png`
- `lightgbm_feature_importance.png`

Validation completed:

- v7 pipeline regenerated outputs from local PostgreSQL.
- v7 publish path upserted `3,456` `V7_RM_PM_DIRECT` rows into Spring/WMS `forecast_results`.
- Database verification returned `288` materials from `2026-02-01` to `2027-01-01`.
- All original 13 generated notebook code cells passed `ast.parse`.
- All original 13 generated notebooks passed a plain-Python execution smoke against the generated artifacts.
- The separate corrected experiment generated its leaderboard, demand-band metrics, paired tests, gain/permutation importance, residual plots, and high-volume comparison plots.

## What To Do Next

Priority order:

1. Obtain real RM/PM material-issue history with explicit lineage and rerun the corrected experiment before promotion.
2. Add production-plan, BOM, backorder, and shutdown features only where they are known at forecast creation time.
3. Calibrate prediction intervals and evaluate inventory service/cost outcomes for the corrected candidate.
4. Add v7 backtest/evidence artifacts to a Spring endpoint or static artifact route that the dashboard can read without pretending forward forecasts contain actuals.
5. Update the Forecasts dashboard labels:
   - show `LightGBM RM/PM Global Forecast` to users
   - keep `V7_RM_PM_DIRECT` only as technical lineage
   - label each chart by source and confidence level
6. Add or route a Spring endpoint for v7 evaluation evidence from artifacts or persisted evaluation tables.
7. Wire inventory policy and slotting planning to the same canonical `forecast_results` rows and expose provenance in the UI.
8. Keep BOM explosion as a secondary/demo path until BOM coverage is complete and validated.

## Safe Evaluator Statement

Use this wording:

> v6 proved a forecasting development path but was FG/bootstrap-oriented. v7 moves the operational planning layer to direct RM/PM demand forecasting from WMS PostgreSQL demand history. The current LightGBM global model is the best tested candidate by WAPE, but not a final production claim without caveat. We compare it against intermittent-demand and naive baselines, and the next evidence step is richer rolling-origin residual diagnostics, interval calibration, and per-material error analysis. BOM explosion is not claimed as production-ready because current BOM coverage is too low.

Updated wording after the corrected experiment:

> The corrected scale-normalized LightGBM candidate achieved 24.17% WAPE in a six-origin backtest, improving on the earlier 25.09% result while reducing feature-gain concentration. This remains offline evidence on Hemas-calibrated simulated history. It is not promoted until the same protocol is passed on real RM/PM issue history with calibrated intervals and planning-outcome validation.

Do not say:

- "The M5 model forecasts raw materials."
- "The dashboard residual charts prove production accuracy."
- "The LightGBM model is production-grade because it has 25.09% WAPE."
- "BOM explosion is complete."
- "The SQLite forecast-service table is the operational source of truth."

## 2026-07-11 Project-Operational Runtime Alignment

### Decision

The project has no externally supplied operational history. The controlled v8 dataset is therefore the coherent **project-operational simulation seed** for end-to-end demonstration. It is not renamed or presented as real customer history.

- Dataset: `PROJECT_OPERATIONAL_SIMULATION_V8`
- Quality tier: `PROJECT_OPERATIONAL_SIMULATION`
- Canonical planning dataset: `PROJECT_OPS_RM_PM`
- Canonical planning model: `PROJECT_OPS_EXTRA_TREES_CAUSAL`
- Training/evaluation source: `v8_controlled_synthetic_validation`
- Dataset hash: `bca1737627c9930c3c83df730c4a58a62ca869b9ab3debb08146e6a31ba92a13`

### Loaded PostgreSQL Scope

- 144 materials: 90 raw materials, 30 packaging materials, 24 finished goods.
- 12 project suppliers and 120 supplier-material relationships.
- 24 active BOM headers and 211 BOM components, with controlled coverage of all generated FGs and RM/PM components.
- 8,640 monthly demand-history rows across 72 months.
- 120 inventory policy rows with MOQ, lead time, min/max, ROP and safety stock.
- 1,440 twelve-month direct RM/PM forecast rows.
- 120 ABC/FMS issue-stat rollups used by slotting and demand-space planning.
- Two persisted evaluation rows: locked selection and untouched test.

### Evidence And Decision Gate

Database migration `V71` adds data quality/provenance and `decision_eligible` fields. Migration `V72` persists aggregate evaluation evidence.

- The local database schema was prepared with the idempotent migration SQL before the backend container start. `flyway_schema_history` will record `V71` and `V72` on the next successful Spring boot; do not manually insert Flyway history rows.

- Old v6/v7/bootstrap forecast rows remain in the database for traceability but have `decision_eligible = false`.
- The Spring forecast repository filters operational policy and slotting reads to `decision_eligible = true`.
- The Forecasts API serves canonical forecast rows, test metrics, inventory recommendations and direct RM/PM requirements from Spring/PostgreSQL. Python SQLite is no longer the operational source for these views.
- The dashboard displays a human-readable method name, not the internal model id.

Untouched-test evidence for the locked Extra Trees causal candidate:

| Metric | Result |
|---|---:|
| WAPE | 8.34% |
| MAE | 736.76 |
| RMSE | 1,408.46 |
| Bias | -0.15% |
| Under-forecast rate | 48.26% |
| Empirical 90% interval coverage | 92.08% |

### Verified In This Workspace

- The idempotent loader `scripts/load_project_operational_simulation.py` completed successfully against PostgreSQL.
- PostgreSQL validation returned: 144 materials, 120 inventory rows, 24 BOM headers, 211 BOM components, 8,640 demand rows, 1,440 eligible forecast rows, 120 supplier links and 120 issue-stat rollups.
- `./gradlew :core-api:compileJava :core-app:compileJava :infra:compileJava` passed after canonical-source changes.

### Remaining Before A Production Claim

- Obtain externally observed issue, inventory, supplier, BOM and production-plan data; rerun the protocol without changing the locked test design.
- Persist actuals after forecast publication to produce live residual, calibration and service-level monitoring.
- Run the full Docker browser/API smoke after the backend/frontend/AI containers are started. This workspace session verified the Docker database container, database load and local compilation; the backend image build was started but could not be completed because the execution environment stopped allowing further Docker build usage.
- A Recalculate action must be wired to a trained model refresh/publish job before it can truthfully regenerate project forecast rows. It must not pretend that a static seed reload is model inference.

## 2026-07-14 Synthetic Data Generation Proof

Added and executed `v8_controlled_synthetic_validation/07_Synthetic_Data_Generation_Methods_And_Proof.ipynb` as a standalone evaluator-facing notebook.

It now proves and visualizes:

- fixed-seed NumPy generation and a SHA-256 evidence digest;
- sinusoidal annual seasonality with randomized amplitude and phase;
- bounded annual trends, Bernoulli promotions and holidays;
- persistent structural shifts and rare disruption/surge shocks;
- autoregressive planned-versus-actual FG production;
- FG-to-RM/PM BOM explosion with scrap and yield;
- lognormal positive/skewed variables and scale-dependent process noise;
- master-data parameter distributions for MOQ, order multiples, cost and lead time;
- 100% controlled FG-parent and RM/PM component coverage, including the explicit coverage-repair rule;
- production-plan versus actual plots, BOM-degree plots, demand distributions, heteroscedasticity, autocorrelation and intermittency;
- database/workflow mapping for catalogue, BOM, demand history, inventory policy, slotting/MILP and supplier planning;
- supported and unsupported claims for project-operational use.

Validation completed: all eight v8 notebooks pass static Python syntax parsing. The new notebook executed all 11 code cells, embedded five plot outputs and produced no error outputs.

### Why Forecast Dashboard Charts Can Be Empty

Forward operational forecast rows contain future period, horizon, P10, P50 and P90. They correctly do not contain future actual demand (`y_true`). Therefore:

- residual-over-time and absolute-error charts require persisted rolling-backtest or matured forecast-versus-actual rows;
- empirical interval coverage requires actual demand joined to historical forecast intervals;
- seasonality charts require at least 12 calendar months of actual demand per selected material;
- promotion/weather/price-driver charts require those exogenous features and their provenance;
- online inference audit/fallback charts require actual inference events, not a static forecast seed.

The existing empty-state messages are statistically safer than generating decorative values. The next frontend evidence step is a separate backtest/history endpoint; forward forecasts and evaluation rows must remain separate datasets even when shown on the same page.

## 2026-07-15 Canonical Project Operational Baseline

### Operational Truth And Lineage

`PROJECT_OPERATIONAL_BASELINE_V1` is now the single deterministic project-operational dataset for the Colombo warehouse. It uses seed `20260715` and dataset hash `7356c0ba07bc6afa4edf91c12541d09bd64bc503d0ef5103690b852813f2fbd7`. It is generated data, not externally observed customer data; ordinary operator screens omit that distinction, while PostgreSQL lineage, administrator evidence, and evaluator notebooks retain it.

Loaded and idempotently reloaded into PostgreSQL:

- 120 FG, 288 RM, and 458 PM materials; 866 total catalogue rows.
- 3,000 typed warehouse locations.
- 120 versioned BOM headers and 1,641 component rows with complete FG coverage.
- 53,712 monthly RM/PM demand observations over 72 months.
- 25,000 orders, 100,000 order lines, 125,000 stock movements, 125,000 tasks, and 125,000 operation events.
- 746 RM/PM supplier links, ABC/FMS classifications, inventory records, and stochastic policy draft lines.

Migrations `V73` and `V74` provide evidence/job/provenance contracts and accept the generated two-digit location bay codes. The canonical loader supports validation-only, full idempotent load, and `--forecast-only` publication.

### Forecast Evidence

The selected champion is **Extra Trees**, selected against seasonal naive, moving average, Croston/SBA, ETS, and LightGBM on expanding-window origins. The final 12 months were untouched until model selection was locked.

| Untouched-test measure | Result |
|---|---:|
| WAPE | 12.51% |
| MAE | 97.07 |
| RMSE | 260.77 |
| Bias | 0.18% |
| Under-forecast rate | 51.42% |
| Empirical 90% interval coverage | 88.85% |
| Critical AF/AM/BF WAPE | 9.87% |
| Seasonal-naive WAPE | 20.25% |
| Relative WAPE improvement | 38.24% |

All configured evidence gates pass, but registry status remains `PENDING_MANAGER_APPROVAL`. Forward rows remain `decision_eligible=false`; recalculation publishes a draft and never auto-promotes it.

Eight evaluator notebooks execute without code-cell errors and separate lineage, EDA, BOM/classification proof, model selection, residual diagnostics, policy simulation, slotting evidence, and executive claims. Seven statistical plots are embedded across the evidence sequence.

### Runtime Wiring Verified

- Spring/PostgreSQL `forecast_results` is the canonical dashboard and planning store; SQLite is not an operational authority.
- Canonical APIs return 8,952 forward rows, 8,952 untouched-test rows, metrics, actual history, interval calibration, generation provenance, and 746 deduplicated inventory recommendations.
- Forecast-only publication was run directly against PostgreSQL and returned 8,952 forward rows, 8,952 backtest rows, and one registry row without rebuilding orders, inventory, BOMs, or policies.
- `POST /api/ai/jobs/forecast-run` is asynchronous in Spring. Canonical requests now bypass the legacy v6 orchestrator and call `/canonical/recalculate`; legacy dataset/model defaults were replaced by `PROJECT_OPERATIONAL_BASELINE_RM_PM` and `EXTRA_TREES`.
- The Python canonical route refreshes the controlled feature contract from PostgreSQL `demand_history`, requires complete one-to-one coverage, reruns statistical evidence, and then invokes only the forecast-only PostgreSQL publisher. XGBoost and CatBoost were moved to an optional `legacy-boosting` dependency group so the core ARM service does not download CUDA/NCCL.
- The Forecasts frontend displays “RM/PM Demand Forecast”, “Extra Trees”, the untouched-test metrics, canonical release status, supported charts only, and no decorative residual, market-driver, inference-success, or stock values.
- Desktop and 375 px mobile checks found no horizontal overflow, no blank chart SVGs, and three populated overview charts. The header was made responsive.

### Current Verification Boundary

The canonical generator tests, forecast recalculation, forecast-only PostgreSQL publication, Java compile/controller tests, TypeScript checks, API reads, and desktop/mobile browser checks passed during this implementation. A first forecast-service Docker rebuild exhausted disk while the old dependency set attempted a 303 MB CUDA/NCCL download. Docker Desktop then became unresponsive and PostgreSQL stopped. The dependency defect is fixed in source, but the final rebuilt Docker image and live Spring `202 -> worker -> published_draft` poll could not be rerun after the daemon failure. Do not claim that final Docker-chain proof until Docker storage is healthy and that smoke is repeated.

### Defensible Evaluator Claim

OptiWMS demonstrates a reproducible, statistically controlled single-warehouse operation on generated data with complete catalogue, BOM, history, forecast, policy, classification, and workflow records. The Extra Trees champion passes the project evidence gates on an untouched generated-data test period and remains manager-gated. This is evidence of project-system correctness under the controlled baseline, not evidence of accuracy on an external customer distribution.

## 2026-07-15 Final Docker And End-To-End Verification

### Docker Recovery And Runtime Fix

Disk space was recovered without deleting or resetting application containers, images, or named volumes. The persisted PostgreSQL data remained intact. The final runtime defect was cross-compose service discovery: Spring and the AI services run on different Docker networks, but Spring was trying to resolve `forecast-service` as though it were on the same network.

Fixed runtime configuration:

- Spring uses `host.docker.internal:8091`, `:8092`, and `:8093` for forecast, orchestrator, and slotting services.
- The forecast container uses explicit PostgreSQL authority `host.docker.internal:5434/optiwms` for canonical recalculation.
- No SQLite copy or Docker-volume database edit is required.
- Flyway schema is at `V75`.

Live health after the non-destructive rebuild:

- Spring backend `8080`: healthy.
- Forecast service `8091`: healthy; runtime contract reports `wms_db` and no missing tables/columns.
- Orchestrator `8092`: healthy.
- Slotting service `8093`: healthy.
- PostgreSQL `5434`: healthy.
- Frontend is running at `http://localhost:3000` for local verification.

### Forecast Recalculation And Governance Proof

The same Spring endpoint used by the frontend was exercised:

- `POST /api/ai/jobs/forecast-run` returned `202` and persisted job `b3010b3a-9913-43ea-9064-f3a2c9ca3ea2`.
- The job moved from `running/inference_publish` to `succeeded/published` in about one minute.
- Canonical recalculation refreshed model evidence, republished PostgreSQL rows as draft, and preserved the generated operational dataset.
- Manager/admin approval promoted `EXTRA_TREES` and marked all `8,952` forecast rows decision-eligible.
- `/api/ai/forecasts?page=0&size=5` returned canonical, paginated PostgreSQL rows with P10/P50/P90.
- `/api/ai/forecast-metrics` returned aggregate and H1-H12 untouched-test evidence separately from forward forecasts.

Current model evidence after recalculation:

| Untouched-test measure | Result |
|---|---:|
| WAPE | 12.48% |
| MAE | 96.87 |
| RMSE | 260.49 |
| Bias | 0.24% |
| Under-forecast rate | 51.43% |
| Empirical 90% interval coverage | 89.21% |
| Critical AF/AM/BF WAPE | 9.84% |
| Seasonal-naive WAPE | 20.25% |
| Relative WAPE improvement | 38.36% |

The live Forecasts page was browser-verified after authentication. It displays `RM/PM Demand Forecast`, `Extra Trees`, `PROMOTED`, populated forecast/history/inventory panels, and supported residual, error-distribution, bias, RMSE, and interval-coverage evidence. It does not obtain residuals from future forecast rows.

### Inventory Policy Proof

Approved policy run `be9477fe-e321-414f-8eda-1012a2b14361` contains `288` RM lines:

- `216` lines passed the service/cost/capacity simulation gate and were approved.
- `72` lines remain `HIGH_RISK_REVIEW`; they were not silently applied.
- Expected stock delta: `-843,773.40` units.
- Expected pallet-position delta: `-262.85`.
- Expected holding-cost delta: `-151,879.20`.
- All `288` lines have persisted simulation evidence; `216` satisfy fill-rate target, cost improvement, and capacity feasibility together.
- No purchase suggestions were created because current stock is above the proposed reorder triggers. That is a valid no-order result, not a missing integration.

The implemented policy is a class-aware stochastic `(s,S)` method. It uses P10/P50/P90 forecast demand, empirical lead-time demand and calibrated residual uncertainty, EOQ economics, MOQ/order multiples, handling-unit rounding, shelf life, and storage capacity. Target service levels are `98%` for AF/AM/BF, `97%` for other A, `95%` for B, and `92%` for C. A deterministic 1,000-trial inventory simulation blocks proposals that miss service, increase expected cost, or violate capacity. Approval creates draft purchasing suggestions only; it never creates purchase orders automatically.

### MILP Slotting And Transfer Proof

Approved space run `8fa46a69-f43b-470d-8062-64ca419f005c` completed with:

- algorithm `ORTOOLS_MILP_V2`;
- solver status `OPTIMAL`;
- objective `32,864.6778`;
- `0` infeasible and `0` high-risk assignments;
- exactly `64` relocations, matching the configured 30% relocation cap;
- estimated travel reduction `2,625.85 m`.

Approved plan `d3a450f7-61e3-49d1-91a6-4208df98ea78` (`FSO-2026-07-14-v2`) is `ACTIVE`. Approval created released stock transfer `1c3373c7-92ba-4e2e-bb20-8e06b11d6ecc` (`TF-1784073487622`) with `64` open lines and `64` pending transfer tasks. Moved quantity remains `0`; inventory changes only after worker scan/execution. All source lines currently have sufficient inventory.

The integer assignment model subsumes the requested multidimensional knapsack decision. It considers pallet positions, weight, cubic volume, compatibility, temperature/hazard/fragile rules, stackability, pick-face and reserve assignment, current occupancy, handling-unit multiples, accessibility, travel, relocation cost, overflow, and forecast-weighted risk. A separate feature labelled "Knapsack" would be misleading.

### Comparison With The Two Hemas Documents

The Training Report's core method is covered and extended: 288 RM/458 PM scale, subtype-specific ABC by annual issued volume excluding returns, FMS by issue frequency, AF/AM/BF critical treatment, forecast-informed ROP/min-max, and warehouse allocation. OptiWMS adds reproducible generation, uncertainty intervals, model backtesting, simulation gates, constraints, approvals, audit evidence, APIs, and executable transfer tasks.

The Pallet Project covers a different scope: reverse pallet circulation, reuse, occupancy, damage, repair, recycling/disposal, and shortage triggers. OptiWMS currently optimizes material pallet-position allocation and relocation, but it does **not** implement that complete reverse-pallet asset lifecycle.

### Explicit Remaining Gaps

- **Cannibalization:** correlated demand and promotions exist in the generator, but no validated causal product-substitution/cannibalization model is implemented. Do not claim one.
- **Reverse pallet logistics:** pallet damage, repair, return, reuse, recycling, and disposal workflows from the Pallet Project remain a separate module.
- **External validity:** all model and policy evidence is generated-baseline evidence. No external customer performance claim is defensible.
- **Execution boundary:** the approved relocation transfer is intentionally pending worker scans; the verification did not fake physical movement.
- **Frontend debt:** the production build passes, but existing React hook/image/font warnings remain. They do not block compilation or the verified Forecasts workflow.

### Final Automated Verification

- Full backend `./gradlew test`: `BUILD SUCCESSFUL`.
- Forecast service: `11 passed`.
- OR-Tools slotting service: `2 passed`.
- Operational baseline: `6 passed`, `31 subtests passed`; all generated notebook code cells parse.
- Frontend production build: successful, all `68` routes generated.
- Live browser: authenticated Forecasts overview and Model Performance views populated from the running services.

### Current Evaluator Claim

OptiWMS is complete enough to demonstrate a manager-gated forecast-to-policy-to-slotting-to-transfer workflow for one generated Colombo warehouse. The correct claim is controlled system validity: deterministic data, complete BOMs, statistically separated model selection/test evidence, calibrated uncertainty, stochastic policy simulation, constrained optimal slotting, and executable approval workflows. It is not evidence of deployment performance on an external warehouse, and it does not yet include causal cannibalization or reverse-pallet lifecycle optimization.

## 2026-07-15 FG/RM/PM Forecast And Operational Scope Correction

### Root Causes Corrected

- The one-point forecast chart was a dashboard pagination defect. The initial API page contained one period for many SKUs; it was not evidence that PostgreSQL held only one horizon.
- Selecting a SKU now performs dedicated paginated reads for that SKU's forward forecasts, actual history, and backtest rows. H1-H12 is no longer inferred from the mixed first page.
- A canonical forecast SKU endpoint now returns the complete forecast catalogue with material type and horizon count. The Forecast page provides Raw Material, Packaging, and Finished Good selectors.
- The exposed `(poll/60)` value was a timeout counter, not pipeline progress. The UI now displays explicitly estimated progress while the synchronous inference stage runs and reports 100% only after publication.
- Inventory and Product Catalogue totals mixed the generated baseline with unclassified legacy rows. Default paged and reference-material reads now include only `GENERATED_OPERATIONAL_BASELINE` and `OPERATIONAL_ENTRY`; `includeLegacy=true` preserves explicit audit access. No legacy records were deleted.
- New material and inventory records receive `OPERATIONAL_ENTRY` provenance through JPA and database defaults. V76 adds covering indexes for the operational scope.
- BOM Master now reports canonical FG/RM/PM counts, provides searchable finished-good records with descriptions, retains component add/edit/delete, and moves legacy forecast-SKU mapping behind an Advanced disclosure.

### Expanded Forecast Evidence And PostgreSQL Publication

The leakage-safe forecasting panel now combines the generated 72-month finished-good production history with direct RM/PM demand history. Purchasing policy remains restricted to RM/PM; FG forecasts are exposed for production/BOM planning and do not create FG replenishment proposals.

Current untouched-test evidence across 866 SKUs:

| Measure | Result |
|---|---:|
| Forecast scope | 120 FG + 288 RM + 458 PM |
| Forward forecast rows | 10,392 |
| H1-H12 test rows | 10,392 |
| WAPE | 12.22% |
| MAE | 104.58 |
| RMSE | 258.50 |
| Bias | 0.05% |
| Under-forecast rate | 50.39% |
| Empirical 90% interval coverage | 89.22% |
| Critical AF/AM/BF WAPE | 9.78% |
| Seasonal-naive WAPE | 20.12% |
| Relative WAPE improvement | 39.25% |

The planning-only transactional loader committed:

- `62,352` FG/RM/PM monthly history rows;
- `871` canonical inventory rows;
- `10,392` H1-H12 forward forecast rows;
- `10,392` untouched-test/backtest rows;
- one model-registry row.

### Verification And Runtime Boundary

- Full backend Gradle tests: passed.
- Frontend production build: passed; all 68 routes generated.
- Operational baseline: `6 passed`, `31 subtests passed`.
- The frontend build warned that the filesystem had only 115 MiB free and could not persist its webpack cache. The disposable `.next` directory was removed, restoring about 1 GiB.
- Docker Desktop then stopped responding during the backend image rebuild. A normal non-destructive restart could not terminate stuck Docker helper processes, and ports 8080/3000 were no longer reachable. Containers and named volumes were not deleted; PostgreSQL publication had already committed before Docker stopped.
- Therefore the new V76 migration, rebuilt Spring image, and final browser screenshots are **not yet live-verified**. Start Docker Desktop successfully, run `docker compose up -d --build backend` from `infra`, and repeat the authenticated Forecast/BOM/Inventory browser smoke before claiming the correction is deployed.

## 2026-07-18 Canonical Colombo Dataset Deployment

### Live Scope Correction

The V76/V77 operational-scope changes are now deployed. Spring/PostgreSQL defaults no longer mix the project baseline with M5/bootstrap, simulation, or unclassified legacy rows.

- Product Catalogue default scope: `866` materials (`120` FG, `288` RM, `458` PM).
- Inventory default scope: `1,099` physical stock positions covering the same `866` materials and `1,202,451` total units.
- Inventory by type: `228` FG positions, `314` RM positions, and `557` PM positions.
- Warehouse default scope: one `PROJECT_OPERATIONAL_BASELINE_V1` Colombo warehouse. Four historical warehouses remain audit-only.
- Forecast scope: `10,392` PostgreSQL rows for all `866` SKUs, with complete H1-H12 coverage under `EXTRA_TREES`.
- History scope: `62,352` monthly observations, equal to `866 x 72` months.
- Location scope: `3,000` generated Colombo storage locations.
- BOM scope: exactly `120` generated baseline headers and `1,641` component lines. The default BOM API now excludes 24 older simulation headers and three unclassified legacy headers; administrators can request them explicitly with `includeLegacy=true`.

At ten rows per page, the expected default UI scale is approximately `87` Product Catalogue pages and `110` Inventory pages. Inventory has more rows because one SKU may occupy multiple bins, lots, or handling units. The previous `124` catalogue pages and `15,839` inventory pages were mixed-source defects, not the intended operational scale.

Legacy rows were retained rather than destructively deleted:

- `157,398` unclassified inventory rows;
- `120` `PROJECT_OPERATIONAL_SIMULATION` inventory rows;
- 24 `PROJECT_OPS_V8` BOM headers with 211 lines;
- three unclassified BOM headers.

They are excluded by indexed default repository queries and remain available only for explicit audit/migration work. New material, inventory, warehouse, and BOM records default to `OPERATIONAL_ENTRY`, so future warehouse operations remain visible without reopening the legacy scope.

### Generated Baseline And Model Evidence

The regenerated deterministic baseline hash is `2772ac61aec988b9f09021ce66192fd6a01e12570414bafec2bd5a72fd5adc68`. Determinism was verified by a repeated generation with an identical hash. The untouched-test evidence published with this baseline is:

| Measure | Result |
|---|---:|
| WAPE | 12.2818% |
| Bias | 0.1505% |
| Empirical P10-P90 coverage | 88.9723% |
| Critical AF/AM/BF WAPE | 9.8687% |
| Horizon coverage | H1-H12 |
| Promotion gates | All statistical gates pass; manager approval remains required |

The evidence supports controlled generated-baseline validity only. It does not establish performance on external customer data.

### Runtime And UI Wiring

- Inventory repositories, aggregate cards, warehouse lists, Product Catalogue, BOM Master, demand history, forecast publication, policy inputs, ABC/FMS inputs, and slotting inputs now share the same canonical material and warehouse identities.
- `GET /api/inventory/summary` computes whole-scope inventory totals instead of deriving cards from the current ten-row page. The live SQL result is `1,099` in-stock positions, `602` below their reorder point, and zero zero-quantity positions.
- Generated FG inventory is now loaded alongside RM and PM inventory. Loader reruns reconcile generated rows for the canonical warehouse while preserving manager-created `OPERATIONAL_ENTRY` records.
- Forecast charts have 12 future periods per selected FG/RM/PM SKU. History, seasonality, backtests, residuals, and stock projections remain separate evidence sources rather than fabricated chart series.
- Spring `forecast_results` remains the operational forecast authority. Python services remain responsible for model inference, artifacts, and optimization jobs rather than a second SQLite business truth.

### Docker And Verification

- Docker Desktop recovered without deleting PostgreSQL or any named volume.
- Disposable BuildKit cache was pruned after the disk-full failure; no business volume was pruned.
- Gradle Plugin Portal was unavailable inside the multi-stage Docker build. A verified offline host boot JAR was therefore packaged through `backend/Dockerfile.runtime` and `infra/docker-compose.runtime.yml`. The ordinary multi-stage Dockerfile remains available for CI/networked builds.
- Final backend container: `optiwms-backend`, image `infra-backend`, healthy.
- Actuator: `UP` for liveness and readiness.
- Forecast service `8091`: healthy; runtime contract is `wms_db/validated` with no missing tables or columns.
- Orchestrator `8092`: healthy.
- Slotting service `8093`: healthy.
- Frontend `3000`: reachable and redirects unauthenticated requests to `/admin/login`.
- Flyway: V76 and V77 successful; schema version `77`, all `77` migrations validated.
- Full backend test suite: `BUILD SUCCESSFUL`, 15 tasks.
- Frontend production build: successful before the final backend-only BOM scope adjustment.
- Operational baseline contract suite: `6 passed`.

An authenticated browser refresh is still required to replace any stale React Query/browser cache visible in an already-open tab. The backend serving the corrected defaults is live; no final authenticated screenshot was captured after the last BOM-only redeploy.

## 2026-07-29 Docker Container Recovery

All OptiWMS containers and locally built images were accidentally removed, but
the named data volumes survived. Recovery was completed without regenerating or
replacing the project dataset.

### Persistence Evidence

- `infra_db_data` was inspected read-only before startup. It contained a valid
  PostgreSQL 16 cluster, used approximately 2.7 GB, and retained its control,
  base and WAL files.
- PostgreSQL started with the existing cluster and explicitly skipped
  initialization. The container is healthy on port `5434`.
- The recovered database contains 92 public tables. All 79 Flyway migrations
  are successful and the current schema version is V79.
- Representative recovered row counts are: 1,235 materials, 64,972 orders,
  244,828 order items, 160,488 inventory rows, 185,000 stock movements,
  125,184 tasks, 83,088 demand-history rows, 20,238 forecast results, 2,571
  inventory-policy recommendation lines, 5,131 slotting plan lines, 956 route
  nodes and 1,980 route edges.
- The active `ai_services_forecast-service-data` volume retained its 56 MB
  SQLite database. SQLite integrity is `ok`; it contains 337,850 predictions,
  1,946 inventory recommendations, 273 metric rows, 21 forecast runs and one
  model-registry entry. The older AI volume was preserved unchanged.

### Rebuilt Runtime

- The Spring Boot JAR was rebuilt successfully from the current source and
  packaged into `infra-backend`.
- The backend is healthy on port `8080`; `/actuator/health` reports `UP`.
  Startup validated all 79 migrations and applied no migration.
- The Next.js production build completed successfully and generated all 68
  routes. Its Docker image was recreated and is healthy.
- Host port `3000` was already owned by an unrelated local project. The
  Compose frontend host port is now configurable through
  `FRONTEND_HOST_PORT`; this recovered instance is running on port `3001`
  without interrupting the other project.
- Forecast, orchestration and slotting images were rebuilt. Their services are
  healthy on ports `8091`, `8092` and `8093`. The forecast runtime contract
  reports `wms_db`, `validated`, with no missing tables or columns.
- The optional pgAdmin container was restored on port `5050` with its surviving
  `infra_pgadmin_data` settings volume.
- No data-generation or database-loader command was run during recovery.

### Recovery Backups

Validated local recovery copies were created under the ignored
`recovery_backups/` directory:

- `optiwms-2026-07-29.dump`: 95 MB PostgreSQL custom-format dump;
  SHA-256 `cdca54048f00aa81aa1c9338f8c8c06d382cec6531ee9f656b6015a5718da6a4`.
- `forecast-service-2026-07-29.db`: 56 MB consistent SQLite backup;
  SHA-256 `0deb79346e2de7db2aa64def1bf13a6dc2514b84b0d14ba1edf25c9a6b74bf04`.

Do not run `docker compose down -v`, `docker volume prune`, or another command
that removes named volumes unless a verified external backup exists.

## 2026-08-14 Inventory Intelligence Manager Workflow

The daily manager surface is now the unified `/admin/inventory-intelligence`
workspace. It intentionally separates calculation from authority:

- the promoted demand forecast supplies the demand distribution;
- the Spring policy service calculates dynamic minimum stock, reorder trigger,
  target maximum, MOQ/order-multiple rounding, receipt timing and pallet impact;
- ABC/FMS remains a statistical value/movement classification input;
- the six-month slotting plan remains a constrained MILP decision whose result
  must be `OPTIMAL` or explicitly accepted `FEASIBLE` before approval;
- approval creates controlled policy changes and draft replenishments only;
  procurement release and physical relocation execution remain separate.

The manager UI no longer exposes raw P50/P90 labels, long generated rationale,
the old approval-boundary panel or unchanged policy rows. The review table is
searchable and filterable by change type, ABC and FMS class. It has a sticky
header, selectable page size and real previous/next pagination. Product and
approval reviews open as centered, height-bounded dialogs on desktop instead
of side drawers. The product dialog exposes deterministic inputs and before /
after calculation while distinguishing currently occupied pallet positions
from future policy capacity.

Policy capacity is now calculated as a count of whole pallet positions. The
current and proposed target quantities are each divided by units per pallet
and rounded up independently; the displayed change is the difference between
those two whole-position values. This removes fractional negative zero and
prevents a future policy reduction from being presented as immediately empty
physical bins. Released and required future positions are separate positive
KPIs.

The manager can explicitly recalculate the six-month min/max policy and, after
policy approval, generate or review the constrained ABC/FMS location plan.
The location step continues to use demand/value class, movement frequency,
weight, volume, temperature, hazard compatibility and a relocation cap. A
policy approval creates draft replenishment suggestions only; procurement
release and worker-confirmed relocation remain separate controlled steps.

The Forecast Inventory simulation now evaluates the reorder trigger daily
inside each monthly forecast bucket. Demand is distributed across the days of
the month, a supply proposal is released when stock plus open supply reaches
the reorder point, and the receipt becomes available on the actual lead-time
due date after MOQ/order-multiple rounding. Reorder point is normalized to at
least safety stock and target maximum to at least reorder point. The chart uses
the existing blue visual language: planned receipts are bars and projected
available stock is a line. The decorative area fill, luminous green receipt
diamonds and duplicate explanation cards were removed.

Approve, defer and reject operations now write append-only
`planning_decision_events` records (Flyway V90). Deferral requires a reason and
return time; rejection requires a reason. A deferred item is removed from the
active queue until its return time, while the Decision history tab retains the
actor, timestamp, reason and status transition. An ineligible `NOT_RUN`
slotting draft is visible for diagnosis but its Approve action is disabled.

### Local Integration Verification

- PostgreSQL 16 remains the Docker-backed business database on port `5434`;
  Spring and Next.js are designed to run locally for the development loop.
- Flyway previously validated 90 migrations and applied V90 successfully.
- The frontend forecast-planning test passes with daily trigger timing,
  lead-time receipt timing, MOQ/order-multiple rounding and the safety-stock /
  reorder-point invariant.
- The Next.js production build succeeds and generates all 69 routes. Existing
  repository-wide lint and font warnings remain non-blocking.
- `git diff --check` passes for the current workspace changes.
- The Spring/Gradle suite could not be rerun after the latest whole-pallet and
  risk-threshold changes because this session's execution approval quota
  rejected Gradle access to its user cache. The restriction was not bypassed.
- A new localhost browser inspection was also denied by the in-app browser
  security review. The restriction was not bypassed, so this checkpoint does
  not claim a fresh visual browser acceptance run.
- Existing policy rows were calculated with the previous capacity arithmetic.
  Rebuild Spring and use `Recalculate policies` before evaluating the new
  released/required-position KPIs or approving a plan.

The generated project-operational dataset is the canonical demo/evaluator
population for this environment. These checks validate system integration and
decision arithmetic on that population; they do not claim measured accuracy on
an external customer's future demand.
