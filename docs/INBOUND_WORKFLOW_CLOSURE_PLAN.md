# Inbound Workflow Closure Plan (Admin + Worker + Backend + DB)

## Scope
Target flow:
1. Inbound order created by admin/manager.
2. Receiving task assignment or worker self-claim.
3. Worker receives by PO/ASN.
4. Quality check queue.
5. If rejected -> returns + reporting.
6. If approved -> putaway queue.
7. Putaway completion updates inventory + warehouse layout.
8. Notifications + worker performance/task history updates at each stage.

## Current Gaps (Confirmed)
1. Quality gate is not enforced before putaway task creation.
   - Putaway tasks are created immediately in receiving service.
2. Rejected quality path is not wired to returns workflow.
3. Workflow notifications are not auto-triggered by services.
4. Worker performance tracking is generic task-based only; inbound stage metrics are not explicitly captured.
5. Worker putaway task selection can mismatch item when multiple items exist in one order.
6. Real-time UX is mostly interval refresh; no event push.

## Phase 1: Fix Workflow Correctness (Must)
1. Enforce quality gate:
   - Receiving should create quality check records/tasks first.
   - Putaway task creation should happen only after quality approval.
2. Add explicit quality decisions:
   - Approve endpoint triggers putaway task generation.
   - Reject endpoint triggers return record + status update + report event.
3. Lock status transitions:
   - `pending -> receiving -> quality_pending -> quality_approved -> putaway -> put_away`
   - Rejection branch: `quality_pending -> quality_rejected -> return_initiated`.
4. Fix putaway task mapping:
   - Ensure putaway tasks are item-level (reference includes orderItem/material context), not order-only matching.

## Phase 2: Notifications + Worker Performance (Must)
1. Add domain event hooks in services:
   - receiving_confirmed
   - quality_approved / quality_rejected
   - putaway_completed
   - return_initiated
2. Auto-create notifications:
   - Target assigned worker, warehouse manager, and optional broadcast.
3. Worker performance updates:
   - Capture stage-level completion timestamps and actor IDs.
   - Track throughput and cycle-time per stage for inbound orders.
4. Task history:
   - Persist clear audit trail (who did what, when, against which order/item).

## Phase 3: UI/UX Alignment (Should)
1. Admin UI:
   - Inbound detail timeline with quality decision and return branch visibility.
   - Assign/reassign controls for receiving/quality/putaway tasks.
2. Worker UI:
   - Receiving queue, quality queue, putaway queue reflect correct gated status.
   - Clear blocked-state messages (e.g., "waiting quality approval").
3. Warehouse layout:
   - After putaway, confirm refreshed occupancy and material placement from live inventory/location data.

## Phase 4: Real-Time Behavior (Should)
1. Introduce push channel (SSE/WebSocket) for:
   - Task queue changes
   - Notification count updates
   - Order status transitions
2. Keep polling fallback where push is unavailable.

## Phase 5: Validation & Regression (Must before release)
1. End-to-end inbound scenario test:
   - receive -> quality approve -> putaway -> inventory/layout verification
   - receive -> quality reject -> return flow verification
2. API contract checks:
   - Ensure frontend models match backend DTOs for quality, tasks, analytics, and notifications.
3. Data integrity checks:
   - No duplicate task generation.
   - Correct per-item quantity movement.
   - Consistent order/item/task statuses.

## Implementation Order (Recommended)
1. Backend workflow correctness (Phase 1).
2. Backend notifications/performance hooks (Phase 2).
3. Frontend queue/status alignment (Phase 3).
4. Real-time integration (Phase 4).
5. End-to-end verification (Phase 5).

## Production Notes
1. Keep development default credentials only in local/dev seed config.
2. In production:
   - disable default admin credentials,
   - enforce password policy + reset flow,
   - keep notification channels and audit logs enabled,
   - monitor rejected-quality and return rates.
