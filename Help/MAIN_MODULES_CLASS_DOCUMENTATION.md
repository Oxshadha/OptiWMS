# Main Modules Class Documentation

Scope: core modules only (`Master`, `Inventory`, `Orders`, `Operations`).

## Master Module
- Entities:
  - `WarehouseEntity`: warehouse master record.
  - `LocationEntity`: physical storage location hierarchy under warehouse.
  - `MaterialEntity`: product/material master and planning attributes.
  - `SupplierEntity`: supplier master data.
  - `CustomerEntity`: customer master data.
  - `UserEntity`: system user/worker record.
- Services:
  - `WarehouseService`, `MaterialService`, `SupplierService`, `CustomerService`, `LocationService`, `UserService`.
- Main relationships:
  - `WarehouseEntity` is a parent for many operational records.
  - `UserEntity` is referenced in many audit/lifecycle fields.

## Inventory Module
- Entities:
  - `InventoryItemEntity`: stock by material, warehouse, and location.
  - `LPNEntity`: license plate level stock unit tracking.
  - `MaterialDefaultLocationEntity`: preferred location mapping for material + warehouse.
- Services:
  - `InventoryService`, `LPNService`.
- Main relationships:
  - `InventoryItemEntity` references `MaterialEntity`, `WarehouseEntity`, and `LocationEntity`.
  - `MaterialDefaultLocationEntity` references `MaterialEntity`, `WarehouseEntity`, and `LocationEntity`.

## Orders Module
- Entities:
  - `OrderEntity`: inbound/outbound order header.
  - `OrderItemEntity`: order line items.
- Services:
  - `OrderService`, `OrderItemService`.
- Main relationships:
  - `OrderEntity` references `CustomerEntity`/`SupplierEntity`/`WarehouseEntity`.
  - `OrderItemEntity` references `OrderEntity` and `MaterialEntity`.

## Operations Module
- Entities:
  - `GrnEntity`: goods receipt note.
  - `StockTransferEntity`: transfer header.
  - `StockTransferLineEntity`: transfer line details.
  - `ShipmentEntity`: shipment details for orders.
  - `ReturnEntity`: return process record.
  - `TaskEntity`: operational task.
  - `CycleCountEntity`: cycle count execution and approval.
  - `OperationEventEntity`: activity/event tracking.
- Services:
  - `GrnService`, `StockTransferService`, `ShipmentService`, `ReturnService`, `TaskService`, `CycleCountService`, `OperationEventService`.
- Main relationships:
  - `StockTransferLineEntity` references `StockTransferEntity`.
  - `ShipmentEntity` and `ReturnEntity` reference `OrderEntity`.
  - Multiple entities reference `UserEntity` for audit actions.

## Diagram File
- PlantUML code: `Help/MAIN_MODULES_CLASS_DIAGRAM.puml`
