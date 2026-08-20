# OptiWMS Worker Routing Implementation Log

> Started and completed in source/runtime: 2026-07-28
> Scope: v8 physical graph, inbound putaway, outbound picking, mobile PWA
> guidance, multi-worker/forklift coordination, admin monitoring, evaluator
> evidence, PostgreSQL/Flyway and Docker verification.

## Outcome

The feature is implemented end-to-end for the controlled
`PROJECT_OPERATIONAL_SIMULATION_V8` project population.

- Spring is the sole route authority. Browser/Python path implementations are
  no longer used by the production worker or admin routes.
- The active v8 physical population is collapsed from 4,200 bin records to 280
  rack-bay obstacles with explicit WEST/EAST access faces.
- The persisted live graph contains 956 nodes and 1,980 directed edges. It
  includes aisle centers, cross aisles, rack faces, receiving/staging/packing/
  dispatch/quarantine/door stations and inbound/outbound forklift parking.
- Worker putaway and picking screens create route sessions against their real
  order/task/location codes. Completed scans release the old plan and trigger a
  new version from the reached rack face.
- Concurrent paths reserve canonical undirected edges and destination nodes by
  time. Opposite-direction use of the same aisle edge is therefore also
  serialized. Leases, heartbeats, client-event IDs and route versions protect
  stale/offline progress.
- Admin warehouse and `/admin/pathfinding` views consume the same graph,
  sessions and reservations through authenticated API/SSE. The former fake
  browser grid was removed from the operational route.
- The worker app is installable as the `OptiWMS Worker` PWA. Its service worker
  caches the worker shell and critical task pages, while deliberately refusing
  to grant a new conflict-safe route offline.

## Implementation Record

### 1. Persistence and graph versioning — `DONE`

- Added Flyway
  `V79__warehouse_worker_routing.sql`.
- Added graph, node, edge, location-access, session, stop, reservation and
  append-only event tables with foreign keys, check constraints and indexes.
- Graphs bind to warehouse, dataset version, layout version and SHA-256 graph
  hash. Only one graph can be active for a warehouse.
- Graph generation reads only active locations from the warehouse's active
  dataset version. Legacy, unversioned and archived locations cannot enter it.
- A graph cannot be rebuilt while a non-expired worker route is active.
- Flyway applied successfully; PostgreSQL is at schema version `79`.

### 2. Authoritative route lifecycle — `DONE`

- Added authenticated endpoints under `/api/routing` for graph ensure/rebuild,
  create/get/progress/cancel session, active fleet, stats and SSE events.
- Added global multi-stop ordering followed by earliest-arrival A* planning.
- Added 3-second safety headway, edge/node reservation windows and server-side
  advisory locking per warehouse.
- Added stop completion and return-to-packing/parking behavior.
- Added idempotent client event IDs, version increments after replanning,
  stale-version `409 Conflict`, five-minute leases and expired-route cleanup.
- Added warehouse/actor authorization:
  - workers can use their assigned warehouse and only their own sessions;
  - manager/admin roles control fleet views, stats, graph rebuild and SSE;
  - an unrestricted admin may operate across warehouses.
- Fixed the global exception handler so `ResponseStatusException` preserves its
  intended `401/403/404/409` status instead of being flattened to `400`.

### 3. Physical graph defect found during verification — `DONE`

The evaluator exposed a station-connectivity defect: when a station was exactly
aligned with the first aisle, a zero-length WAIT vertex could remain distinct
and disconnected. The Spring graph builder now links aligned stations directly
to the aisle. The deployed STG-01 start node is routable.

### 4. Worker PWA — `DONE`

- Replaced hard-coded route rendering in `WorkerRouteGuide` with graph/session
  APIs and `LiveWarehouseRouteMap`.
- Putaway and picking pass order/task/location identity into the route session.
- The mobile map supports route focus and overview, displays rack obstacles,
  station/parking anchors, 90-degree edge arrows, current worker position,
  ordered stops, released/dimmed segments, distance and planned wait.
- A completed WMS scan sends `STOP_COMPLETED`; Spring releases reservations,
  persists the completed stop and sends a new route version for the remainder.
- A one-minute heartbeat maintains the lease. An expired/offline route shows a
  stop-before-narrow-aisle safety instruction.
- Updated PWA manifest (`id/start_url=/worker`) and service-worker cache v3 for
  tasks, receiving, putaway, picking, packing and cycle count.

### 5. Admin live route control — `DONE`

- Both the warehouse detail and `/admin/pathfinding` now render the live v8
  route-control panel.
- Removed the operational-warehouse API's old
  `PROJECT_OPERATIONAL_BASELINE_V3`-only filter. Active
  `PROJECT_OPERATIONAL_SIMULATION_V8` warehouses are returned first, with
  baseline/manual entries retained as fallbacks. This makes `WH-001` the
  default admin routing scope without hiding the audit baseline.
- The panel shows all active worker positions, route versions, current/next
  nodes, stops, reservations, distance, planned wait, graph hash and a local
  overlap assertion.
- Authenticated fetch-stream SSE shares authoritative route events with a
  15-second recovery poll. Workers do not subscribe to warehouse-wide events.
- Graph rebuild is disabled in the UI and rejected by Spring while routes are
  active.

### 6. Runtime configuration — `DONE`

- Browser-facing `NEXT_PUBLIC_API_URL` now defaults to
  `http://localhost:8080/api`; it no longer exposes Docker's internal
  `backend` hostname to the browser.
- Backend runtime is rebuilt from the host Gradle boot JAR and runs through
  `backend/Dockerfile.runtime`.
- Backend and PostgreSQL containers are healthy.
- The frontend production source build passes and its standalone output is
  packaged by `frontend/Dockerfile.runtime`, without resolving npm packages
  again inside Docker.
- Corrected the frontend health check to probe `127.0.0.1`; Alpine resolved
  `localhost` to IPv6 while the standalone Next server intentionally binds to
  IPv4.

### 7. Final project report and repository handoff — `DONE`

- Added root [`report.md`](../report.md) using the evaluator's required
  Abstract, Chapters 1-8, References, Appendix A and Appendix B structure.
- Added an evaluator coverage table that replaces fixed page numbers with
  direct Markdown section links.
- Replaced the stale V3-centered root [`README.md`](../README.md) with the
  current v8 project population, champion decision, physical layout, worker
  routing, Docker startup and governance contract.
- Replaced the legacy A/B/C-focused modeling workspace README with a current
  v8/V3/evaluator/routing index and an explicit historical-directory boundary.
- Indexed every authoritative v8, shared evaluator and routing notebook.
- Added test commands and case-by-file links for Spring, forecast service,
  slotting service, v8 contracts, V3 regression/notebook contracts, the shared
  time-series evaluator, routing evaluator, frontend and live runtime tests.
- Rebalanced both final documents around all six solution pillars: WMS
  execution, forecasting, inventory min/max, OR-Tools MILP/flow slotting,
  worker routing and the worker/admin warehouse assistant.
- Added dedicated inventory-policy coverage for reorder point, safety stock,
  min/max, MOQ/order multiples, 1,000-trial simulation, approval and rollback.
- Added dedicated MILP coverage for complete 144-material/3,257-position
  allocation, all physical constraints, 14/14 validation and the optimal
  objective.
- Added the assistant architecture, worker/admin UI, eight SOP sources, Chroma/
  MiniLM/Gemini RAG, guarded read-only SQL analytics, startup/API instructions
  and implementation links.
- Kept the assistant boundary explicit: it is advisory and optional; JWT,
  role/warehouse scoping, audit/rate limits and automated agent tests remain
  required before production data exposure.
- Documented that Python services must run in isolated pytest processes because
  they use the same top-level `app` package name.
- Marked `scripts/smoke_test.sh` as legacy rather than presenting it as a v8
  acceptance test.
- Verified that every local Markdown link in `README.md` and `report.md`
  resolves.
- Verified that every code cell in the indexed v8, shared evaluator and routing
  notebooks has a non-null execution count.
- Performed a repository-wide core-WMS/PWA audit and added a maturity matrix
  covering masters, BOM, inbound/GRN, quality/quarantine, putaway,
  inventory/LPN, cycle count, replenishment, transfer, outbound, packing,
  shipping, returns, tasks, notifications, analytics, reports and SOPs.
- Documented all eight role-filtered worker PWA operation areas and their real
  offline limits; no offline device is described as route authority.
- Added report architecture diagrams for the overall platform and each major
  operation chain: inbound, inventory/replenishment/transfer, outbound/returns,
  forecast-policy-MILP, concurrent routing, offline synchronization and the
  warehouse assistant.
- Added an authoritative enterprise benchmark using official SAP EWM, Oracle
  WMS Cloud, Manhattan Active WM, Blue Yonder WMS and Microsoft Dynamics 365
  documentation, plus peer-reviewed warehouse/Industry 4.0 research.
- Added feature-by-feature gaps without claiming enterprise parity, including
  HA/DR, SSO/MFA, row scoping, wave/labor/TMS/EDI/MHE depth,
  localization and support.
- Added the missing non-AI/PWA test backlog to Appendix A. Core WMS feature
  presence is no longer presented as uniform automated end-to-end proof.
- Restored explicit data-generation, data-quality, leakage, time/frequency,
  residual, hypothesis, calibration, decision-cost and MILP guard evidence in
  `README.md` and `report.md`, with direct notebook/CSV/JSON links.
- Verified the correction with the complete 23-test Spring suite, TypeScript,
  the Next.js production build, root report/README link and anchor checks, and
  `git diff --check`.
- Corrected the forecast inference GitHub Actions environment from Python 3.11
  to Python 3.12 so it matches `pyproject.toml` and the service image. The exact
  CI test subset passes 10/10 and the complete forecast-service suite passes
  13/13 in a clean Python 3.12 environment.

## Evaluator Evidence

Location:
`Ai miroservices/modeling/warehouse_routing_evaluation/`

The executed
`01_Warehouse_Routing_Algorithm_Evaluation.ipynb` contains ten executed code
cells, tables, plots, an assumption registry and a claim–evidence matrix.

### Static route selection

| Algorithm | Paired cases | Median runtime | Median expanded nodes | Dijkstra distance match |
| --- | ---: | ---: | ---: | ---: |
| A* | 160 | 0.205 ms | 181.0 | 100% |
| Dijkstra | 160 | 0.351 ms | 485.5 | reference |

- Mean paired runtime saved by A*: `0.0959 ms`, paired bootstrap 95% CI
  `[0.0737, 0.1189]`, one-sided paired Wilcoxon
  `p=1.76e-15`.
- Mean node expansions saved: `265.23`, paired bootstrap 95% CI
  `[237.31, 293.92]`.
- A* is selected for static single-route geometry.

### Concurrent route selection

Eight deterministic replicates were run at each of 1, 5, 10, 25 and 50
simultaneous workers.

| Workers | Independent A* max conflicts | Reservation A* max conflicts | Mean reservation planning P95 |
| ---: | ---: | ---: | ---: |
| 1 | 0 | 0 | 0.362 ms |
| 5 | 365 | 0 | 0.617 ms |
| 10 | 1,076 | 0 | 1.006 ms |
| 25 | 6,768 | 0 | 1.125 ms |
| 50 | 32,988 | 0 | 1.106 ms |

Independent A* is rejected for concurrent control. Prioritized
time-reservation A* is selected for the current operational control plane.

### Evidence artifacts

- `outputs/algorithm_leaderboard.csv`
- `outputs/static_route_cases.csv`
- `outputs/concurrency_results.csv`
- `outputs/statistical_tests.csv`
- `outputs/assumption_registry.csv`
- `outputs/claim_evidence_matrix.csv`
- `outputs/routing_algorithm_decision.json`

## Verification

| Check | Result |
| --- | --- |
| Full Spring `./gradlew test --no-daemon` | `BUILD SUCCESSFUL` |
| Frontend `npx tsc --noEmit` | Passed |
| Frontend `npm run build` | Passed; unrelated existing lint warnings remain |
| Routing evaluator unit tests | `5 passed` |
| Evaluator notebook clean execution | Passed; 10/10 code cells executed |
| Flyway migration | Version `79` applied |
| Live graph | 956 nodes, 1,980 directed edges, 280 rack bays, 4,200 mappings |
| Live competing two-worker routes | first wait `0`; second wait about `21.1 s` |
| Live DB overlapping reservations | `0` |
| Live stop completion | route version `1 → 2`; first stop completed |
| Live stale progress | `409 Conflict` |
| Live rebuild with active routes | `409 Conflict` |
| Repeatable runtime acceptance | `scripts/test_worker_routing_runtime.sh` passed and cancelled its test sessions |
| Operational warehouse API | `WH-001` v8 returned first; `CMB-MAIN` baseline retained |
| Authenticated admin browser | `WH-001` selected; 280 SVG rack rectangles; 956 nodes; 1,980 edges; no page error |
| Docker runtime | PostgreSQL, Spring backend and standalone frontend all `healthy`; frontend responds on port `3000` |

## Explicit Boundaries

This is complete for the internally consistent synthetic project population,
but it is not a real-site forklift safety certification.

- Real aisle clear widths, rack footprints, one-way rules, vehicle/load
  envelopes and positioning accuracy are still `UNVERIFIED`.
- The configured 1.5 m/s speed is a simulation value pending telemetry.
- Long-running fairness/starvation has not been proven; the current planner is
  prioritized and reports planned waiting. Aging/priority policy should be
  calibrated with operational SLAs.
- Operators must obey visibility, horns/spotters, stopping distance, marked
  rights-of-way and vehicle safety controllers even when the map grants a
  reservation.
- A real deployment still requires physical survey, RTLS integration, shadow
  operation, safety review and manager approval.
- The Docker build reports that the project's existing Next.js `14.2.5`
  dependency is outdated and has a published security warning. Framework
  upgrade/testing is a separate hardening task and is not hidden by this routing
  completion.

## 2026-07-29 Runtime Recovery

- Recreated PostgreSQL, Spring, Next.js, forecast, orchestration and slotting
  containers after the containers and locally built images were accidentally
  removed.
- Preserved and reused the existing PostgreSQL and AI-service named volumes;
  no dataset generator or loader was run.
- Verified PostgreSQL health, 92 public tables, all 79 migrations and the
  routing graph with 956 nodes and 1,980 edges.
- Rebuilt the backend JAR and frontend production bundle from current source.
- Verified the recovered application and AI services as healthy. The core
  runtime is on ports `5434`, `8080` and `3001`; AI services are on
  `8091`-`8093`, and the optional database console is on `5050`.
- Added configurable `FRONTEND_HOST_PORT` support because port `3000` was in
  use by an unrelated project; no unrelated process was stopped.
- Created validated PostgreSQL and SQLite recovery copies in the ignored
  `recovery_backups/` directory.
