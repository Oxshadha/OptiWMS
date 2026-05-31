# Team Workload Matrix (OptiWMS)

## Evaluator Scope and Constraints
- Dock management is excluded.
- AI supporting panels are excluded: `AIDashboardPanel`, `AIServiceStatus`, `AIFeedbackModal`.
- Offline/sync/indexeddb work is assigned to Member 3 (Manodya).
- Each member owns Admin UI + Worker UI + Backend API work.

## Team Members
- Member 1: **Anjana**
- Member 2: **Oshadha**
- Member 3: **Manodya**
- Member 4: **Yoonus**

## 1) Primary Module Ownership

| Member | Primary Responsibility |
|---|---|
| Anjana | Receiving, Putaway, Warehouse/Layout, Master data (materials/suppliers/warehouses/locations) |
| Oshadha | Picking, Tasks, Labor productivity/performance monitoring, worker performance flows |
| Manodya | Packing, Shipments, Returns, Stock Transfers, Offline/Sync/IndexedDB |
| Yoonus | Inventory, Cycle Count, Anomalies, Reports, Auth/Login, Users/Account/Settings/Notifications |

## 2) API Endpoint Ownership

### Anjana
- `ReceivingController` (`/api/operations/receiving`)
  - `GET /order/{orderNumber}`
  - `POST /receive`
  - `POST /blind-receive`
- `PutawayController` (`/api/operations/putaway`)
  - `POST /complete/{taskId}`
  - `POST /skip/{taskId}`
  - `POST /suggest-location`
  - `POST /split-plan`
- `MaterialController` (`/api/master/materials`)
  - `GET /`, `GET /paged`, `GET /{id}`, `GET /code/{materialCode}`
  - `POST /`, `PUT /{id}`, `DELETE /{id}`
  - `POST /import`, `POST /inventory/import`
- `SupplierController` (`/api/master/suppliers`)
  - `GET /`, `GET /paged`, `GET /{id}`
  - `POST /`, `PUT /{id}`, `DELETE /{id}`
  - `GET /{id}/materials`, `PUT /{id}/materials`
  - `POST /{id}/materials/{materialId}`, `DELETE /{id}/materials/{materialId}`
- `WarehouseController` (`/api/master/warehouses`)
  - `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}`
- `LocationController` (`/api/locations`, `/api/master/locations`)
  - `GET /`, `GET /{id}`, `GET /code/{locationCode}`, `GET /warehouse/{warehouseId}`
  - `GET /warehouse/{warehouseId}/storage-only`, `GET /available`, `GET /hierarchy`
  - `POST /`, `POST /bulk-racks`, `PUT /{id}`, `PUT /racks/{id}`
  - `DELETE /{id}`, `DELETE /racks`
- `MaterialDefaultLocationController` (`/api/master/material-default-locations`)
  - `POST /`
  - `GET /material/{materialId}/warehouse/{warehouseId}`
  - `GET /warehouse/{warehouseId}/materials`
  - `DELETE /material/{materialId}/warehouse/{warehouseId}/location/{locationCode}`
  - `POST /warehouse/{warehouseId}/assign-all`
  - `POST /warehouse/{warehouseId}/sync-inventory`

### Oshadha
- `PickingController` (`/api/operations/picking`)
  - `POST /complete/{taskId}`
  - `POST /issue/{taskId}`
- `TaskController` (`/api/tasks`)
  - `GET /`, `GET /paged`, `GET /{id}`, `POST /`
  - `PUT /{id}/status`
  - `POST /{id}/assign`, `POST /{id}/claim`, `POST /{id}/errors`
- `WorkerAchievementController` (`/api/workers`)
  - `GET /{workerId}/achievements`
  - `POST /{workerId}/achievements`
- `AnalyticsController` (`/api/analytics`)
  - `GET /worker-productivity`, `GET /leaderboard`
  - `GET /dashboard/kpis`, `GET /dashboard/orders-chart`, `GET /dashboard/top-products`
  - `GET /dashboard/inventory-overview`
  - `GET /workers/{workerId}/stats`, `GET /workers/{workerId}/achievements`
  - `GET /location-velocity`
- `SupplyPlanController` (`/api/planning/supply-plans`)
  - `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}`
- `SopController` (`/api/sops`)
  - `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}`
- `OrderController` (task creation side, `/api/orders`)
  - `POST /number/{orderNumber}/create-tasks`
  - `POST /{id}/create-tasks`

### Manodya
- `PackingController` (`/api/packing`)
  - `GET /`, `GET /paged`, `GET /{id}`, `POST /`
  - `PUT /{id}`, `PUT /{id}/status`, `DELETE /{id}`
- `ShipmentController` (`/api/shipments`)
  - `GET /`, `GET /paged`, `GET /{id}`, `POST /`
  - `PUT /{id}`, `PUT /{id}/status`, `PUT /{id}/confirm-delivery`, `DELETE /{id}`
- `ReturnController` (`/api/returns`)
  - `GET /`, `GET /paged`, `GET /{id}`
  - `GET /metrics/suppliers`, `GET /metrics/customers`
  - `POST /`, `POST /intake/outbound`
  - `PUT /{id}`, `PUT /{id}/status`, `PUT /{id}/approve`
  - `PUT /{id}/inspection`, `PUT /{id}/reject`, `PUT /{id}/assign`
  - `DELETE /{id}`
- `StockTransferController` (`/api/operations/stock-transfers`)
  - `GET /`, `GET /paged`, `GET /{id}`, `GET /{id}/lines`, `GET /lines/executable`
  - `POST /`, `POST /multi`, `POST /{id}/release`
  - `POST /lines/{lineId}/assign`, `POST /lines/{lineId}/execute`, `POST /lines/{lineId}/skip`
  - `POST /{id}/dispatch`, `POST /{id}/receive`
  - `PUT /{id}/cancel`
- `QualityCheckController` (`/api/quality-checks`)
  - `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`
  - `PUT /{id}/approve`, `PUT /{id}/reject`, `DELETE /{id}`

### Yoonus
- `InventoryController` (`/api/inventory`)
  - `GET /`, `GET /paged`, `GET /{id}`
  - `GET /material/{materialId}`, `GET /warehouse/{warehouseId}`, `GET /location/{locationCode}`
  - `PATCH /{id}/quantity`
  - `GET /quarantined`, `POST /quarantined`, `POST /quarantined/{id}/release`
  - `POST /`, `PUT /{id}`
- `InventoryCalculationController` (`/api/inventory/calculate`)
  - `POST /missing-fields`, `POST /{inventoryId}`
- `CycleCountController` (`/api/operations/cycle-counts`)
  - `GET /`, `GET /paged`, `GET /{id}`, `POST /`, `PUT /{id}`
  - `PUT /{id}/cancel`, `PUT /{id}/review`
  - `POST /{id}/record`, `POST /{id}/approve-adjustment`, `POST /{id}/reject-adjustment`
- `CycleCountScheduleController` (`/api/operations/cycle-count-schedules`)
  - `GET /`, `GET /warehouse/{warehouseId}`, `POST /`, `PUT /{id}`, `DELETE /{id}`
- `AnomalyController` (`/api/anomalies`)
  - `GET /`, `GET /paged`, `GET /{id}`, `PUT /{id}/resolve`, `DELETE /{id}`
- `ReportsController` (`/api/reports`)
  - `GET /`, `GET /{id}`, `POST /generate`, `POST /export`, `GET /{id}/download`
  - `GET /scheduled`, `GET /scheduled/{id}`, `POST /schedule`, `PUT /scheduled/{id}`, `DELETE /scheduled/{id}`
  - `POST /custom`
- `AuthController` (`/api/auth`)
  - `POST /login`, `POST /refresh`, `GET /me`
  - `PUT /me/preferences`, `PUT /me/profile`, `PUT /me/password`
- `UserController` (`/api/users`)
  - `GET /`, `GET /paged`, `GET /{id}`, `GET /username/{username}`, `GET /worker-task-summary`
  - `POST /`, `PUT /{id}`, `PUT /{id}/last-login`, `DELETE /{id}`
  - `PUT /{id}/preferences`, `PUT /{id}/assign-warehouse`
- `NotificationController` (`/api/notifications`)
  - `GET /`, `GET /unread-count`, `POST /`
  - `PUT /{id}/read`, `PUT /mark-all-read`, `DELETE /{id}`

## 3) Frontend File Ownership (Path Groups)

### Anjana
- `frontend/app/admin/orders/inbound/**`
- `frontend/app/worker/receiving/**`
- `frontend/app/worker/putaway/**`
- `frontend/app/admin/materials/**`
- `frontend/app/admin/suppliers/**`
- `frontend/app/admin/warehouses/**`
- `frontend/app/admin/raw-materials/page.tsx`
- `frontend/app/admin/products/page.tsx`
- `frontend/lib/api/materials.ts`
- `frontend/lib/api/suppliers.ts`
- `frontend/lib/api/warehouses.ts`
- `frontend/lib/api/locations.ts`
- `frontend/lib/api/materialDefaultLocations.ts`
- `frontend/lib/api/warehouse-layout.ts`
- `frontend/lib/types/warehouse-layout.ts`
- `frontend/lib/utils/location-helpers.ts`
- `frontend/lib/utils/location-to-layout.ts`
- `frontend/lib/utils/warehouse-layout-generator.ts`

### Oshadha
- `frontend/app/admin/tasks/**`
- `frontend/app/admin/orders/outbound/**`
- `frontend/app/admin/labor-productivity/page.tsx`
- `frontend/app/admin/workers/**`
- `frontend/app/worker/picking/**`
- `frontend/app/worker/tasks/**`
- `frontend/app/worker/leaderboard/page.tsx`
- `frontend/lib/api/tasks.ts`
- `frontend/lib/api/tasks-api.ts`
- `frontend/lib/api/workerAchievements.ts`
- `frontend/lib/api/analytics.ts`
- `frontend/lib/api/supply-plans.ts`
- `frontend/lib/api/sops.ts`
- `frontend/lib/task-assignment.ts`
- `frontend/hooks/useTaskAssignment.ts`
- `frontend/hooks/useTaskPreload.ts`

### Manodya
- `frontend/app/admin/packing/**`
- `frontend/app/admin/shipments/**`
- `frontend/app/admin/returns/**`
- `frontend/app/admin/stock-transfers/**`
- `frontend/app/admin/delivery-partners/**`
- `frontend/app/admin/customers/**`
- `frontend/app/admin/quality-checks/**`
- `frontend/app/worker/packing/**`
- `frontend/app/worker/shipments/page.tsx`
- `frontend/app/worker/returns/page.tsx`
- `frontend/app/worker/stock-transfer/page.tsx`
- `frontend/lib/api/packing.ts`
- `frontend/lib/api/shipments.ts`
- `frontend/lib/api/returns.ts`
- `frontend/lib/api/operations.ts`
- `frontend/lib/api/deliveryPartners.ts`
- `frontend/lib/api/customers.ts`
- `frontend/lib/api/qualityChecks.ts`
- `frontend/components/OfflineIndicator.tsx`
- `frontend/lib/indexeddb.ts`
- `frontend/lib/network.ts`
- `frontend/lib/sync.ts`

### Yoonus
- `frontend/app/admin/inventory/**`
- `frontend/app/admin/cycle-counts/**`
- `frontend/app/admin/anomalies/**`
- `frontend/app/admin/reports/page.tsx`
- `frontend/app/admin/dashboard/**`
- `frontend/app/admin/dashboard-settings/page.tsx`
- `frontend/app/admin/notifications/page.tsx`
- `frontend/app/admin/login/page.tsx`
- `frontend/app/admin/account-settings/page.tsx`
- `frontend/app/admin/admins/**`
- `frontend/app/admin/profile/page.tsx`
- `frontend/app/admin/settings/page.tsx`
- `frontend/app/worker/cycle-count/page.tsx`
- `frontend/app/worker/login/page.tsx`
- `frontend/app/worker/account-settings/page.tsx`
- `frontend/app/worker/app-settings/page.tsx`
- `frontend/app/worker/profile/page.tsx`
- `frontend/app/worker/settings/page.tsx`
- `frontend/lib/api/inventory.ts`
- `frontend/lib/api/anomalies.ts`
- `frontend/lib/api/reports.ts`
- `frontend/lib/api/notifications.ts`
- `frontend/lib/api/auth.ts`
- `frontend/lib/api/users.ts`
- `frontend/lib/api/account.ts`
- `frontend/lib/auth/**`
- `frontend/contexts/AdminContext.tsx`
- `frontend/contexts/WorkerContext.tsx`

## 4) Shared UI Components Ownership

| Component | Owner |
|---|---|
| `DataTable`, `Pagination`, `StatusChip`, `KpiTile`, `SummaryCards`, `ProductivityChart`, `Leaderboard` | Oshadha |
| `Modal`, `DetailModal`, `LocationCreateModal`, `LocationEditModal`, `RackEditModal`, `LocationPicker`, `RackElevationView`, `WarehouseLayout` | Anjana |
| `QRScanner`, `WorkerRouteGuide`, `OfflineIndicator` | Manodya |
| `Sidebar`, `Topbar`, `ToasterProvider`, `RolePermissions` | Yoonus |
| `AIDashboardPanel`, `AIServiceStatus`, `AIFeedbackModal` | Excluded from evaluator scope |

## 5) Backend Non-Controller Layer Coverage

- Anjana
  - `core-app/master/**`
  - `core-app/operations/*` (receiving/putaway/location planning related services)
  - `core-domain/master/**`
  - `infra/master/**`
- Oshadha
  - `core-app/tasks/**`, `core-app/analytics/**`, `core-app/workers/**`, `core-app/sops/**`
  - `core-domain/tasks/**`, `core-domain/workers/**`
  - `infra/tasks/**`, `infra/workers/**`
- Manodya
  - `core-app/operations/*` (picking/packing/shipment/returns/stock-transfer related services)
  - `core-domain/operations/**`, `core-domain/quality/**`
  - `infra/operations/**`, `infra/quality/**`
- Yoonus
  - `core-app/inventory/**`, cycle-count services, `anomalies/**`, `reports/**`, `users/**`, `notifications/**`
  - `core-domain/inventory/**`, `anomalies/**`, `reports/**`, `users/**`
  - `infra/inventory/**`, `infra/cyclecount/**`, `infra/anomalies/**`, `infra/reports/**`, `infra/users/**`, `infra/notifications/**`

## 6) Shared Files and Governance

Shared files:
- `frontend/app/layout.tsx`
- `frontend/app/admin/layout.tsx`
- `frontend/app/worker/layout.tsx`
- `frontend/app/providers.tsx`
- `frontend/app/globals.css`
- `frontend/lib/api/client.ts`
- `frontend/lib/api.ts`
- `frontend/lib/theme.ts`
- backend `core-api/config/**` and `core-api/common/**`

Rules:
- Any member can edit shared files.
- Impacted module owner gives final review/approval.

## 7) Backup Reviewer Matrix

| Primary | Backup |
|---|---|
| Anjana | Oshadha |
| Oshadha | Manodya |
| Manodya | Yoonus |
| Yoonus | Anjana |

## 8) Explicit Exclusions

- `frontend/app/admin/dock-management/**`
- `backend/core-api/src/main/java/com/optiwms/coreapi/dock/DockManagementController.java`
- `frontend/components/AIDashboardPanel.tsx`
- `frontend/components/AIServiceStatus.tsx`
- `frontend/components/AIFeedbackModal.tsx`
