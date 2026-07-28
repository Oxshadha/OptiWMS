# Backend Class Documentation

Scope:
- `Entity` classes in `backend/infra/src/main/java/com/optiwms/infra`
- `CsvImportService` in `backend/core-app/src/main/java/com/optiwms/coreapp/imports`

## `AnomalyEntity`
- Package: `com.optiwms.infra.anomalies`
- File: `backend/infra/src/main/java/com/optiwms/infra/anomalies/AnomalyEntity.java`
- Table: `ai_anomaly_detections`
- Attributes (16): `id`, `anomalyType`, `materialId`, `warehouseId`, `locationId`, `detectedValue`, `expectedValue`, `variancePercentage`, `severity`, `confidenceScore`, `description`, `status`, `reviewedBy`, `reviewedAt`, `resolutionNotes`, `createdAt`
- Outgoing FK relations:
  - `material_id  -> materials.id`
  - `warehouse_id  -> warehouses.id`
  - `location_id  -> locations.id`
  - `reviewed_by  -> users.id`

## `CustomerEntity`
- Package: `com.optiwms.infra.master`
- File: `backend/infra/src/main/java/com/optiwms/infra/master/CustomerEntity.java`
- Table: `customers`
- Attributes (13): `id`, `code`, `name`, `email`, `phone`, `address`, `city`, `country`, `countryCode`, `currencyCode`, `priorityTier`, `status`, `createdAt`
- Outgoing FK relations: none

## `CycleCountAuditLogEntity`
- Package: `com.optiwms.infra.cyclecount`
- File: `backend/infra/src/main/java/com/optiwms/infra/cyclecount/CycleCountAuditLogEntity.java`
- Table: `cycle_count_audit_logs`
- Attributes (11): `id`, `cycleCountId`, `action`, `performedBy`, `fromStatus`, `toStatus`, `expectedQuantity`, `countedQuantity`, `variance`, `notes`, `createdAt`
- Outgoing FK relations:
  - `cycle_count_id  -> cycle_counts.id`
  - `performed_by  -> users.id`

## `CycleCountEntity`
- Package: `com.optiwms.infra.cyclecount`
- File: `backend/infra/src/main/java/com/optiwms/infra/cyclecount/CycleCountEntity.java`
- Table: `cycle_counts`
- Attributes (27): `id`, `countNumber`, `warehouseId`, `locationCode`, `scheduledDate`, `status`, `countedBy`, `countedAt`, `variance`, `materialId`, `expectedQuantity`, `countedQuantity`, `variancePercentage`, `anomalyLevel`, `anomalyDetected`, `approvalRequired`, `approvedBy`, `approvedAt`, `approvalNotes`, `notes`, `recountRequired`, `recountCount`, `previousVariance`, `varianceThreshold`, `finalVariance`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `warehouse_id  -> warehouses.id`
  - `counted_by  -> users.id`
  - `material_id  -> materials.id`
  - `approved_by  -> users.id`

## `CycleCountRecountEntity`
- Package: `com.optiwms.infra.cyclecount`
- File: `backend/infra/src/main/java/com/optiwms/infra/cyclecount/CycleCountRecountEntity.java`
- Table: `cycle_count_recounts`
- Attributes (8): `id`, `cycleCountId`, `recountNumber`, `countedQuantity`, `variance`, `countedBy`, `notes`, `countedAt`
- Outgoing FK relations:
  - `cycle_count_id  -> cycle_counts.id`
  - `counted_by  -> users.id`

## `CycleCountScheduleEntity`
- Package: `com.optiwms.infra.cyclecount`
- File: `backend/infra/src/main/java/com/optiwms/infra/cyclecount/CycleCountScheduleEntity.java`
- Table: `cycle_count_schedules`
- Attributes (12): `id`, `warehouseId`, `frequency`, `intervalDays`, `nextScheduledDate`, `locationPattern`, `autoCreate`, `autoAssignWorkers`, `active`, `createdBy`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `warehouse_id  -> warehouses.id`
  - `created_by  -> users.id`

## `DeliveryPartnerEntity`
- Package: `com.optiwms.infra.master`
- File: `backend/infra/src/main/java/com/optiwms/infra/master/DeliveryPartnerEntity.java`
- Table: `delivery_partners`
- Attributes (20): `id`, `partnerCode`, `companyName`, `contactPerson`, `email`, `phone`, `address`, `city`, `country`, `countryCode`, `currencyCode`, `carrierType`, `serviceAreas`, `rating`, `costPerDelivery`, `status`, `totalShipments`, `onTimeDeliveryRate`, `createdAt`, `updatedAt`
- Outgoing FK relations: none

## `GrnEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/GrnEntity.java`
- Table: `grns`
- Attributes (11): `id`, `grnNumber`, `poId`, `supplierId`, `warehouseId`, `receivedDate`, `receivedBy`, `status`, `notes`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `supplier_id  -> suppliers.id`
  - `warehouse_id  -> warehouses.id`
  - `received_by  -> users.id`

## `InventoryItemEntity`
- Package: `com.optiwms.infra.inventory`
- File: `backend/infra/src/main/java/com/optiwms/infra/inventory/InventoryItemEntity.java`
- Table: `inventory`
- Attributes (31): `id`, `materialId`, `warehouseId`, `locationCode`, `lpnCode`, `quantity`, `availableQuantity`, `reservedQuantity`, `bufferStock`, `maxStock`, `minStock`, `reorderPoint`, `stackingQuantity`, `moq`, `leadTimeDays`, `lastCountedAt`, `status`, `batchNumber`, `daysSinceLastMovement`, `materialType`, `bufferDays`, `leadTimeMonths`, `ropInDays`, `varianceDemand`, `varianceLeadTimeDemand`, `difference`, `orderDeliveryDays`, `orderQuantity`, `palletRequirement`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `material_id  -> materials.id`
  - `warehouse_id  -> warehouses.id`
  - `location_code  -> locations.location_code`
  - `grn_id  -> grns.id`

## `LPNEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/LPNEntity.java`
- Table: `lpns`
- Attributes (11): `id`, `lpnCode`, `materialId`, `warehouseId`, `locationCode`, `quantity`, `status`, `createdAt`, `updatedAt`, `createdBy`, `notes`
- Outgoing FK relations: none

## `LocationEntity`
- Package: `com.optiwms.infra.master`
- File: `backend/infra/src/main/java/com/optiwms/infra/master/LocationEntity.java`
- Table: `locations`
- Attributes (19): `id`, `warehouseId`, `locationCode`, `area`, `rowNumber`, `bayNumber`, `levelNumber`, `binPosition`, `locationType`, `zoneType`, `isActive`, `qrCode`, `createdAt`, `rackStatus`, `description`, `notes`, `accessibilityRating`, `maxPalletCapacity`, `currentPalletCount`
- Outgoing FK relations:
  - `warehouse_id  -> warehouses.id`

## `LocationLevelEntity`
- Package: `com.optiwms.infra.master`
- File: `backend/infra/src/main/java/com/optiwms/infra/master/LocationLevelEntity.java`
- Table: `location_levels`
- Attributes (11): `id`, `locationId`, `levelNumber`, `weightCapacityKg`, `palletCapacity`, `heightCm`, `accessibilityRating`, `currentWeightKg`, `currentPalletCount`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `location_id  -> locations.id`

## `MaterialDefaultLocationEntity`
- Package: `com.optiwms.infra.master`
- File: `backend/infra/src/main/java/com/optiwms/infra/master/MaterialDefaultLocationEntity.java`
- Table: `material_default_locations`
- Attributes (9): `id`, `materialId`, `warehouseId`, `locationCode`, `priority`, `materialType`, `notes`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `material_id  -> materials.id`
  - `warehouse_id  -> warehouses.id`
  - `location_code  -> locations.location_code`

## `MaterialEntity`
- Package: `com.optiwms.infra.master`
- File: `backend/infra/src/main/java/com/optiwms/infra/master/MaterialEntity.java`
- Table: `materials`
- Attributes (15): `id`, `materialCode`, `description`, `unitType`, `storageType`, `materialType`, `storageLocationType`, `requiresPallet`, `stackable`, `maxStackHeight`, `temperatureControlled`, `hazardous`, `fragile`, `createdAt`, `updatedAt`
- Outgoing FK relations: none

## `NotificationEntity`
- Package: `com.optiwms.infra.notifications`
- File: `backend/infra/src/main/java/com/optiwms/infra/notifications/NotificationEntity.java`
- Table: `notifications`
- Attributes (9): `id`, `userId`, `title`, `message`, `notificationType`, `read`, `actionUrl`, `metadata`, `createdAt`
- Outgoing FK relations:
  - `user_id  -> users.id`

## `OperationEventEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/OperationEventEntity.java`
- Table: `operation_events`
- Attributes (15): `id`, `operationType`, `workerId`, `taskId`, `orderId`, `orderItemId`, `warehouseId`, `materialId`, `quantity`, `startedAt`, `completedAt`, `durationMinutes`, `status`, `metadata`, `createdAt`
- Outgoing FK relations: none

## `OrderEntity`
- Package: `com.optiwms.infra.orders`
- File: `backend/infra/src/main/java/com/optiwms/infra/orders/OrderEntity.java`
- Table: `orders`
- Attributes (23): `id`, `orderNumber`, `orderType`, `customerId`, `supplierId`, `warehouseId`, `status`, `priority`, `orderDate`, `expectedDate`, `totalAmount`, `notes`, `createdBy`, `receivedBy`, `pickedBy`, `packedBy`, `shippedBy`, `receivedAt`, `pickedAt`, `packedAt`, `shippedAt`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `customer_id  -> customers.id`
  - `supplier_id  -> suppliers.id`
  - `warehouse_id  -> warehouses.id`
  - `created_by  -> users.id`
  - `received_by  -> users.id`
  - `picked_by  -> users.id`
  - `packed_by  -> users.id`
  - `shipped_by  -> users.id`

## `OrderItemEntity`
- Package: `com.optiwms.infra.orders`
- File: `backend/infra/src/main/java/com/optiwms/infra/orders/OrderItemEntity.java`
- Table: `order_items`
- Attributes (10): `id`, `orderId`, `materialId`, `quantity`, `unitPrice`, `pickedQuantity`, `packedQuantity`, `locationCode`, `status`, `createdAt`
- Outgoing FK relations:
  - `order_id  -> orders.id`
  - `material_id  -> materials.id`

## `PackingRecordEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/PackingRecordEntity.java`
- Table: `packing_records`
- Attributes (22): `id`, `orderId`, `orderNumber`, `packagingTypeId`, `boxType`, `boxDimensions`, `dunnageMaterials`, `hasFragileItems`, `actualWeightKg`, `dimensionalWeightKg`, `chargeableWeightKg`, `trackingNumber`, `shippingLabelUrl`, `packingSlipUrl`, `packingNotes`, `packingPhotos`, `packerId`, `status`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `order_id  -> orders.id`
  - `packaging_type_id  -> packaging_types.id`
  - `packer_id  -> users.id`

## `QualityCheckEntity`
- Package: `com.optiwms.infra.quality`
- File: `backend/infra/src/main/java/com/optiwms/infra/quality/QualityCheckEntity.java`
- Table: `quality_check_logs`
- Attributes (12): `id`, `grnId`, `materialId`, `qtyReceived`, `qtyPassed`, `qtyRejected`, `rejectionReason`, `approvalStatus`, `approvedBy`, `approvedAt`, `checkedBy`, `checkDate`
- Outgoing FK relations:
  - `approved_by  -> users.id`
  - `grn_id  -> grns.id`
  - `material_id  -> materials.id`
  - `checked_by  -> users.id`

## `ReportEntity`
- Package: `com.optiwms.infra.reports`
- File: `backend/infra/src/main/java/com/optiwms/infra/reports/ReportEntity.java`
- Table: `reports`
- Attributes (10): `id`, `reportName`, `reportType`, `description`, `reportConfig`, `generatedAt`, `fileSizeBytes`, `filePath`, `createdBy`, `createdAt`
- Outgoing FK relations:
  - `created_by  -> users.id`

## `ReturnEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/ReturnEntity.java`
- Table: `returns`
- Attributes (21): `id`, `returnNumber`, `originalOrderId`, `customerId`, `warehouseId`, `returnDate`, `reason`, `status`, `resolution`, `receivedBy`, `inspectedBy`, `returnFlow`, `qcOutcome`, `supplierResponseStatus`, `supplierResponseNotes`, `falseReturnRequest`, `customerCareFlag`, `followupOrderId`, `closedAt`, `lastStatusChangedAt`, `createdAt`
- Outgoing FK relations:
  - `original_order_id  -> orders.id`
  - `customer_id  -> customers.id`
  - `warehouse_id  -> warehouses.id`
  - `received_by  -> users.id`
  - `inspected_by  -> users.id`

## `ReturnStatusHistoryEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/ReturnStatusHistoryEntity.java`
- Table: `return_status_history`
- Attributes (7): `id`, `returnId`, `fromStatus`, `toStatus`, `changedBy`, `notes`, `changedAt`
- Outgoing FK relations:
  - `return_id  -> returns.id`

## `ScheduledReportEntity`
- Package: `com.optiwms.infra.reports`
- File: `backend/infra/src/main/java/com/optiwms/infra/reports/ScheduledReportEntity.java`
- Table: `scheduled_reports`
- Attributes (10): `id`, `reportType`, `frequency`, `scheduledTime`, `isActive`, `lastGeneratedAt`, `nextGenerationAt`, `createdBy`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `created_by  -> users.id`

## `ShipmentEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/ShipmentEntity.java`
- Table: `shipments`
- Attributes (17): `id`, `shipmentNumber`, `orderId`, `carrier`, `trackingNumber`, `destination`, `weightKg`, `driverName`, `driverPhone`, `vehicleNumber`, `status`, `eta`, `shippedAt`, `deliveredAt`, `deliveryConfirmedBy`, `deliveryConfirmedAt`, `createdAt`
- Outgoing FK relations:
  - `order_id  -> orders.id`

## `SopEntity`
- Package: `com.optiwms.infra.sops`
- File: `backend/infra/src/main/java/com/optiwms/infra/sops/SopEntity.java`
- Table: `sops`
- Attributes (10): `id`, `title`, `category`, `content`, `version`, `status`, `createdBy`, `applicableRoles`, `createdAt`, `updatedAt`
- Outgoing FK relations: none

## `StockTransferEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/StockTransferEntity.java`
- Table: `stock_transfers`
- Attributes (20): `id`, `transferNumber`, `transferType`, `materialId`, `sourceWarehouseId`, `sourceLocationCode`, `destWarehouseId`, `destLocationCode`, `quantity`, `status`, `notes`, `createdBy`, `releasedBy`, `releasedAt`, `dispatchedBy`, `dispatchedAt`, `receivedBy`, `receivedAt`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `material_id  -> materials.id`
  - `source_warehouse_id  -> warehouses.id`
  - `dest_warehouse_id  -> warehouses.id`
  - `dispatched_by  -> users.id`
  - `received_by  -> users.id`
  - `created_by  -> users.id`
  - `released_by  -> users.id`

## `StockTransferLineEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/StockTransferLineEntity.java`
- Table: `stock_transfer_lines`
- Attributes (15): `id`, `transferId`, `lineNumber`, `materialId`, `sourceWarehouseId`, `sourceLocationCode`, `destWarehouseId`, `destLocationCode`, `requestedQuantity`, `movedQuantity`, `status`, `assignedWorkerId`, `notes`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `transfer_id  -> stock_transfers.id`
  - `material_id  -> materials.id`
  - `source_warehouse_id  -> warehouses.id`
  - `dest_warehouse_id  -> warehouses.id`
  - `assigned_worker_id  -> users.id`

## `StockTransferLineEventEntity`
- Package: `com.optiwms.infra.operations`
- File: `backend/infra/src/main/java/com/optiwms/infra/operations/StockTransferLineEventEntity.java`
- Table: `stock_transfer_line_events`
- Attributes (9): `id`, `transferLineId`, `eventType`, `workerId`, `quantity`, `sourceScanLocation`, `destScanLocation`, `notes`, `createdAt`
- Outgoing FK relations:
  - `transfer_line_id  -> stock_transfer_lines.id`
  - `worker_id  -> users.id`

## `SupplierEntity`
- Package: `com.optiwms.infra.master`
- File: `backend/infra/src/main/java/com/optiwms/infra/master/SupplierEntity.java`
- Table: `suppliers`
- Attributes (15): `id`, `code`, `name`, `contactPerson`, `email`, `phone`, `address`, `country`, `city`, `countryCode`, `currencyCode`, `leadTimeDays`, `rating`, `status`, `createdAt`
- Outgoing FK relations: none

## `SupplyPlanEntity`
- Package: `com.optiwms.infra.planning`
- File: `backend/infra/src/main/java/com/optiwms/infra/planning/SupplyPlanEntity.java`
- Table: `supply_plans`
- Attributes (10): `id`, `materialId`, `warehouseId`, `planYear`, `planMonth`, `plannedQuantity`, `actualQuantity`, `variance`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `material_id  -> materials.id`
  - `warehouse_id  -> warehouses.id`

## `TaskEntity`
- Package: `com.optiwms.infra.tasks`
- File: `backend/infra/src/main/java/com/optiwms/infra/tasks/TaskEntity.java`
- Table: `tasks`
- Attributes (17): `id`, `taskNumber`, `taskType`, `warehouseId`, `assignedTo`, `priority`, `status`, `dueDate`, `completedAt`, `completedBy`, `startedAt`, `locationCode`, `referenceType`, `referenceId`, `notes`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `warehouse_id  -> warehouses.id`
  - `assigned_to  -> users.id`
  - `completed_by  -> users.id`

## `UserEntity`
- Package: `com.optiwms.infra.users`
- File: `backend/infra/src/main/java/com/optiwms/infra/users/UserEntity.java`
- Table: `users`
- Attributes (17): `id`, `username`, `email`, `passwordHash`, `employeeId`, `firstName`, `lastName`, `role`, `warehouseId`, `phone`, `avatarUrl`, `status`, `deviceId`, `blindReceivingMode`, `lastLoginAt`, `createdAt`, `updatedAt`
- Outgoing FK relations:
  - `warehouse_id  -> warehouses.id`

## `WarehouseEntity`
- Package: `com.optiwms.infra.master`
- File: `backend/infra/src/main/java/com/optiwms/infra/master/WarehouseEntity.java`
- Table: `warehouses`
- Attributes (12): `id`, `code`, `name`, `address`, `city`, `country`, `contactPerson`, `phone`, `email`, `status`, `createdAt`, `updatedAt`
- Outgoing FK relations: none

## `WorkerAchievementEntity`
- Package: `com.optiwms.infra.workers`
- File: `backend/infra/src/main/java/com/optiwms/infra/workers/WorkerAchievementEntity.java`
- Table: `worker_achievements`
- Attributes (5): `id`, `workerId`, `achievementType`, `earnedAt`, `metadata`
- Outgoing FK relations:
  - `worker_id  -> users.id`

## `CsvImportService`
- Package: `com.optiwms.coreapp.imports`
- File: `backend/core-app/src/main/java/com/optiwms/coreapp/imports/CsvImportService.java`
- Type: Application Service (`@Service`)
- Responsibilities:
  - Import materials CSV into domain objects and persist through `MaterialService`
  - Import inventory CSV into domain objects and persist through `InventoryService`
  - Resolve default warehouse through `WarehouseService`
  - Validate headers, parse lines, normalize values, and return `ImportResult`
- Fields: `materialService`, `inventoryService`, `warehouseService`
- Public methods:
  - `importMaterials(InputStream inputStream) : ImportResult`
  - `importInventory(InputStream inputStream) : ImportResult`

## Notes

- Relationships are derived from database FK mappings in `Help/DATABASE_SCHEMA_RELATION_REPORT.md`.
- Many associations are stored as UUID fields (`*_id`) rather than JPA object references.
