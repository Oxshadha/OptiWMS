# Worker Routing And Live Route Control

> Current implementation: 2026-07-28
> Source of truth: `PROJECT_OPERATIONAL_SIMULATION_V8`

This document replaces the retired 72-rack browser demonstration. Production
worker/admin pages now use the authenticated Spring routing control plane under
`/api/routing`; they do not calculate independent routes in the browser.

## Active Physical Contract

- Warehouse: `WH-001`
- Layout version: `CMB_METRIC_AISLE_V8_EXPANSION`
- Routing graph: `CMB_METRIC_AISLE_V8_ROUTING`
- Storage positions: `4,200`
- Rack-bay obstacles: `280`
- Route nodes: `956`
- Directed route edges: `1,980`
- Rack access: explicit WEST/EAST faces
- Operational anchors: receiving, staging, packing, dispatch, quarantine,
  door and inbound/outbound forklift parking

Racks are obstacles. Route geometry uses orthogonal aisle and cross-aisle
edges, so the SVG arrows do not cross rack footprints.

## Runtime Workflow

### Inbound putaway

1. An authorized worker opens `/worker/putaway` and enters/selects the inbound
   order.
2. The WMS resolves the ordered destination location codes.
3. Spring creates a `PUTAWAY` route from inbound forklift parking/staging,
   orders the stops, reserves timed aisle edges/nodes and returns route version
   1.
4. The worker map shows the current segment and ordered stops.
5. Completing a WMS location scan submits `STOP_COMPLETED`.
6. Spring releases the old reservations, records the completed stop and returns
   the next route version from the reached rack face.
7. The final route returns to the configured parking/station anchor.

### Outbound picking

Picking uses the same lifecycle from `/worker/picking`, with outbound order
locations and a final packing destination.

### Concurrent workers

- Spring holds a warehouse advisory lock while planning.
- Canonical undirected edge reservations serialize opposite-direction travel
  through the same aisle segment.
- Destination-node windows and a three-second safety headway prevent tested
  time overlaps.
- Route versions reject stale device progress with HTTP `409`.
- Idempotent client-event IDs make retries safe.
- A five-minute lease and one-minute heartbeat detect lost/offline sessions.
- A disconnected worker is instructed to stop before entering another narrow
  aisle; the device cannot issue itself a new conflict-safe route offline.

## User Interfaces

- Worker PWA: `http://localhost:3000/worker`
- Putaway: `http://localhost:3000/worker/putaway`
- Picking: `http://localhost:3000/worker/picking`
- Admin control: `http://localhost:3000/admin/pathfinding`
- Warehouse detail control: `http://localhost:3000/admin/warehouses`

The PWA identity and start URL are `/worker`. The service worker caches the
worker shell and critical task pages, but routing mutations always require the
server.

The admin control displays the same active graph, worker positions, route
versions, stops, reservations, distance, planned wait and event stream used by
worker devices. It uses authenticated SSE with recovery polling.

## API Surface

- `GET /api/routing/graph?warehouseId={id}&ensure=true`
- `POST /api/routing/graph/rebuild?warehouseId={id}`
- `POST /api/routing/sessions`
- `GET /api/routing/sessions/{sessionId}`
- `POST /api/routing/sessions/{sessionId}/progress`
- `POST /api/routing/sessions/{sessionId}/cancel`
- `GET /api/routing/fleet?warehouseId={id}`
- `GET /api/routing/stats?warehouseId={id}`
- `GET /api/routing/events?warehouseId={id}`

Workers are restricted to their assigned warehouse and own sessions.
Warehouse-wide fleet/stat/event and rebuild operations require manager/admin
authority.

## Verification

Run the repeatable live test after the Docker backend/database are healthy:

```bash
./scripts/test_worker_routing_runtime.sh
```

The test asserts the exact v8 graph, creates two competing worker routes,
proves zero overlapping database reservations, completes one stop and replans,
checks stale-version and active-rebuild conflicts, then cancels its temporary
sessions.

Algorithm evidence and the executed evaluator notebook are under:

```text
Ai miroservices/modeling/warehouse_routing_evaluation/
```

Full implementation history, evidence, limitations and runtime results are in
`docs/WORKER_ROUTING_IMPLEMENTATION_LOG.md`.

## Safety Boundary

This is a complete controlled-synthetic project workflow, not a physical-site
forklift safety certification. A real deployment still requires surveyed
aisle/rack/vehicle geometry, one-way and right-of-way rules, RTLS accuracy
validation, calibrated speeds, shadow-mode testing and formal site safety
approval.
