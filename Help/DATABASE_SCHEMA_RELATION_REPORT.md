# OptiWMS Database Schema Relation Report

Source of truth used: `backend/infra/src/main/resources/db/migration` (`V1` to `V38`).

## Summary

- Total tables: `46`
- Tables with no FK links at all (no incoming, no outgoing):
  - `delivery_partners`
  - `operation_events`
  - `sops`

## Table Attributes and Relations

### `locations`
- Attributes: `rack_status`, `description`, `notes`, `accessibility_rating`, `coordinate_x`, `coordinate_y`, `max_pallet_capacity`, `current_pallet_count`, `coordinate_z`, `id`, `warehouse_id`, `location_code`, `area`, `row_number`, `bay_number`, `level_number`, `bin_position`, `location_type`, `capacity`, `is_active`, `qr_code`, `created_at`, `zone_type`, `storage_condition`, `x_coord`, `y_coord`, `z_coord`, `max_weight_kg`, `ai_optimal_for_material_types`, `ai_velocity_score`
- FK relations:
  - `warehouse_id -> warehouses.id`

### `location_levels`
- Attributes: `id`, `location_id`, `level_number`, `weight_capacity_kg`, `pallet_capacity`, `height_cm`, `accessibility_rating`, `current_weight_kg`, `current_pallet_count`, `created_at`, `updated_at`
- FK relations:
  - `location_id -> locations.id`

### `users`
- Attributes: `blind_receiving_mode`, `id`, `username`, `email`, `password_hash`, `employee_id`, `first_name`, `last_name`, `role`, `warehouse_id`, `phone`, `avatar_url`, `status`, `device_id`, `last_login_at`, `created_at`, `updated_at`
- FK relations:
  - `warehouse_id -> warehouses.id`

### `materials`
- Attributes: `length_cm`, `width_cm`, `height_cm`, `weight_kg`, `volume_cm3`, `pallet_spaces`, `stackable`, `max_stack_height`, `temperature_controlled`, `hazardous`, `fragile`, `max_pallet_weight_kg`, `min_order_quantity`, `safety_stock_level`, `id`, `material_code`, `description`, `unit_type`, `storage_type`, `created_at`, `updated_at`, `abc_class`, `fms_class`, `preferred_zone`, `material_type`, `sku_id`, `shelf_life_days`, `reorder_method`, `static_min_stock`, `ai_min_stock`, `unit_cost_standard`, `storage_location_type`, `third_party_location`, `requires_pallet`, `buffer_days`, `future_average`, `lead_time_months`, `expected_value`, `variance_demand`, `variance_lead_time_demand`, `rop_days`, `order_delivery_days`, `order_quantity`, `pallet_requirement`
- FK relations: none

### `cycle_counts`
- Attributes: `recount_required`, `recount_count`, `previous_variance`, `variance_threshold`, `final_variance`, `id`, `count_number`, `warehouse_id`, `location_code`, `scheduled_date`, `assigned_workers`, `status`, `counted_by`, `counted_at`, `variance`, `notes`, `created_at`, `updated_at`, `material_id`, `expected_quantity`, `counted_quantity`, `variance_percentage`, `anomaly_level`, `anomaly_detected`, `approval_required`, `approved_by`, `approved_at`, `approval_notes`
- FK relations:
  - `warehouse_id -> warehouses.id`
  - `counted_by -> users.id`
  - `material_id -> materials.id`
  - `approved_by -> users.id`

### `cycle_count_recounts`
- Attributes: `id`, `cycle_count_id`, `recount_number`, `counted_quantity`, `variance`, `counted_by`, `notes`, `counted_at`
- FK relations:
  - `cycle_count_id -> cycle_counts.id`
  - `counted_by -> users.id`

### `cycle_count_schedules`
- Attributes: `id`, `warehouse_id`, `frequency`, `interval_days`, `next_scheduled_date`, `location_pattern`, `auto_create`, `auto_assign_workers`, `active`, `created_by`, `created_at`, `updated_at`
- FK relations:
  - `warehouse_id -> warehouses.id`
  - `created_by -> users.id`

### `inventory`
- Attributes: `material_type`, `id`, `material_id`, `warehouse_id`, `location_code`, `quantity`, `available_quantity`, `reserved_quantity`, `buffer_stock`, `max_stock`, `min_stock`, `reorder_point`, `stacking_quantity`, `moq`, `lead_time_days`, `last_counted_at`, `status`, `created_at`, `updated_at`, `buffer_days`, `lead_time_months`, `rop_in_days`, `variance_demand`, `variance_lead_time_demand`, `difference`, `order_delivery_days`, `order_quantity`, `pallet_requirement`, `batch_number`, `expiry_date`, `grn_id`, `last_movement_date`, `days_since_last_movement`, `ai_suggested_location_code`, `ai_confidence_score`, `ai_last_updated`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`
  - `location_code -> locations.location_code`
  - `grn_id -> grns.id`

### `warehouses`
- Attributes: `id`, `code`, `name`, `address`, `city`, `country`, `contact_person`, `phone`, `email`, `status`, `created_at`, `updated_at`
- FK relations: none

### `stock_movements`
- Attributes: `id`, `material_id`, `warehouse_id`, `location_code`, `movement_type`, `quantity`, `reference_type`, `reference_id`, `user_id`, `notes`, `created_at`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`

### `non_moving_items`
- Attributes: `id`, `material_id`, `warehouse_id`, `last_movement_date`, `days_since_last_movement`, `flagged_at`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`

### `customers`
- Attributes: `id`, `code`, `name`, `email`, `phone`, `address`, `city`, `country`, `status`, `created_at`, `postal_code`, `country_code`, `currency_code`, `priority_tier`, `lifetime_value`, `tax_id`
- FK relations: none

### `suppliers`
- Attributes: `id`, `code`, `name`, `contact_person`, `email`, `phone`, `address`, `country`, `lead_time_days`, `rating`, `status`, `created_at`, `city`, `postal_code`, `country_code`, `currency_code`, `tax_id`, `risk_category`, `ai_rating_score`
- FK relations: none

### `orders`
- Attributes: `id`, `order_number`, `order_type`, `customer_id`, `supplier_id`, `warehouse_id`, `status`, `priority`, `order_date`, `expected_date`, `total_amount`, `notes`, `created_by`, `created_at`, `updated_at`, `received_by`, `picked_by`, `packed_by`, `shipped_by`, `received_at`, `picked_at`, `packed_at`, `shipped_at`, `ai_suggested_priority_score`, `ai_suggested_date`, `ai_confidence`
- FK relations:
  - `customer_id -> customers.id`
  - `supplier_id -> suppliers.id`
  - `warehouse_id -> warehouses.id`
  - `created_by -> users.id`
  - `received_by -> users.id`
  - `picked_by -> users.id`
  - `packed_by -> users.id`
  - `shipped_by -> users.id`

### `order_items`
- Attributes: `id`, `order_id`, `material_id`, `quantity`, `unit_price`, `picked_quantity`, `packed_quantity`, `location_code`, `status`, `created_at`
- FK relations:
  - `order_id -> orders.id`
  - `material_id -> materials.id`

### `stock_transfers`
- Attributes: `id`, `transfer_number`, `transfer_type`, `material_id`, `source_warehouse_id`, `source_location_code`, `dest_warehouse_id`, `dest_location_code`, `quantity`, `status`, `notes`, `dispatched_by`, `dispatched_at`, `received_by`, `received_at`, `created_at`, `updated_at`, `created_by`, `released_by`, `released_at`
- FK relations:
  - `material_id -> materials.id`
  - `source_warehouse_id -> warehouses.id`
  - `dest_warehouse_id -> warehouses.id`
  - `dispatched_by -> users.id`
  - `received_by -> users.id`
  - `created_by -> users.id`
  - `released_by -> users.id`

### `packaging_types`
- Attributes: `id`, `type_name`, `category`, `length_cm`, `width_cm`, `height_cm`, `max_weight_kg`, `cost`, `is_active`, `created_at`
- FK relations: none

### `packing_records`
- Attributes: `id`, `order_id`, `order_number`, `packaging_type_id`, `box_type`, `box_dimensions`, `dunnage_materials`, `has_fragile_items`, `actual_weight_kg`, `dimensional_weight_kg`, `chargeable_weight_kg`, `tracking_number`, `shipping_label_url`, `packing_slip_url`, `packing_notes`, `packing_photos`, `packer_id`, `status`, `started_at`, `completed_at`, `created_at`, `updated_at`
- FK relations:
  - `order_id -> orders.id`
  - `packaging_type_id -> packaging_types.id`
  - `packer_id -> users.id`

### `tasks`
- Attributes: `id`, `task_number`, `task_type`, `warehouse_id`, `assigned_to`, `priority`, `status`, `due_date`, `completed_at`, `location_code`, `reference_type`, `reference_id`, `notes`, `created_at`, `updated_at`, `completed_by`, `started_at`, `ai_suggested_sequence_order`, `ai_suggested_path`, `ai_path_efficiency_score`
- FK relations:
  - `warehouse_id -> warehouses.id`
  - `assigned_to -> users.id`
  - `completed_by -> users.id`

### `shipments`
- Attributes: `id`, `shipment_number`, `order_id`, `carrier`, `tracking_number`, `destination`, `weight_kg`, `driver_name`, `driver_phone`, `vehicle_number`, `status`, `eta`, `shipped_at`, `delivered_at`, `created_at`, `delivery_confirmed_by`, `delivery_confirmed_at`
- FK relations:
  - `order_id -> orders.id`

### `returns`
- Attributes: `id`, `return_number`, `original_order_id`, `customer_id`, `warehouse_id`, `return_date`, `reason`, `status`, `resolution`, `received_by`, `inspected_by`, `created_at`, `return_flow`, `qc_outcome`, `supplier_response_status`, `supplier_response_notes`, `false_return_request`, `customer_care_flag`, `followup_order_id`, `closed_at`, `last_status_changed_at`
- FK relations:
  - `original_order_id -> orders.id`
  - `customer_id -> customers.id`
  - `warehouse_id -> warehouses.id`
  - `received_by -> users.id`
  - `inspected_by -> users.id`

### `material_default_locations`
- Attributes: `id`, `material_id`, `warehouse_id`, `location_code`, `priority`, `material_type`, `notes`, `created_at`, `updated_at`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`
  - `location_code -> locations.location_code`

### `quality_check_logs`
- Attributes: `approval_status`, `approved_by`, `approved_at`, `id`, `grn_id`, `material_id`, `qty_received`, `qty_passed`, `qty_rejected`, `rejection_reason`, `checked_by`, `check_date`
- FK relations:
  - `approved_by -> users.id`
  - `grn_id -> grns.id`
  - `material_id -> materials.id`
  - `checked_by -> users.id`

### `sops`
- Attributes: `id`, `title`, `category`, `content`, `version`, `status`, `created_by`, `applicable_roles`, `created_at`, `updated_at`
- FK relations: none

### `operation_events`
- Attributes: `id`, `operation_type`, `worker_id`, `task_id`, `order_id`, `order_item_id`, `warehouse_id`, `material_id`, `quantity`, `started_at`, `completed_at`, `duration_minutes`, `status`, `metadata`, `created_at`
- FK relations: none

### `return_status_history`
- Attributes: `id`, `return_id`, `from_status`, `to_status`, `changed_by`, `notes`, `changed_at`
- FK relations:
  - `return_id -> returns.id`

### `cycle_count_audit_logs`
- Attributes: `id`, `cycle_count_id`, `action`, `performed_by`, `from_status`, `to_status`, `expected_quantity`, `counted_quantity`, `variance`, `notes`, `created_at`
- FK relations:
  - `cycle_count_id -> cycle_counts.id`
  - `performed_by -> users.id`

### `stock_transfer_lines`
- Attributes: `id`, `transfer_id`, `line_number`, `material_id`, `source_warehouse_id`, `source_location_code`, `dest_warehouse_id`, `dest_location_code`, `requested_quantity`, `moved_quantity`, `status`, `assigned_worker_id`, `notes`, `created_at`, `updated_at`
- FK relations:
  - `transfer_id -> stock_transfers.id`
  - `material_id -> materials.id`
  - `source_warehouse_id -> warehouses.id`
  - `dest_warehouse_id -> warehouses.id`
  - `assigned_worker_id -> users.id`

### `stock_transfer_line_events`
- Attributes: `id`, `transfer_line_id`, `event_type`, `worker_id`, `quantity`, `source_scan_location`, `dest_scan_location`, `notes`, `created_at`
- FK relations:
  - `transfer_line_id -> stock_transfer_lines.id`
  - `worker_id -> users.id`

### `delivery_partners`
- Attributes: `id`, `partner_code`, `company_name`, `contact_person`, `email`, `phone`, `address`, `city`, `country`, `service_areas`, `rating`, `cost_per_delivery`, `status`, `total_shipments`, `on_time_delivery_rate`, `created_at`, `updated_at`, `postal_code`, `country_code`, `currency_code`, `carrier_type`, `international_coverage`, `tax_id`
- FK relations: none

### `supply_plans`
- Attributes: `id`, `material_id`, `warehouse_id`, `plan_year`, `plan_month`, `planned_quantity`, `actual_quantity`, `variance`, `created_at`, `updated_at`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`

### `material_planning`
- Attributes: `id`, `material_id`, `warehouse_id`, `buffer_days`, `future_average`, `lead_time_days`, `lead_time_months`, `expected_value`, `variance_demand`, `variance_lead_time_demand`, `rop_days`, `order_delivery_days`, `order_quantity`, `pallet_requirement`, `updated_at`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`

### `ai_demand_forecasts`
- Attributes: `id`, `material_id`, `warehouse_id`, `forecast_date`, `predicted_quantity`, `confidence_score`, `model_version`, `created_at`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`

### `ai_sourcing_recommendations`
- Attributes: `id`, `material_id`, `warehouse_id`, `trigger_event`, `recommended_action`, `recommended_quantity`, `recommended_supplier_id`, `calculated_roi`, `space_freed_via_ga`, `llm_justification`, `status`, `created_at`, `updated_at`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`
  - `recommended_supplier_id -> suppliers.id`

### `ai_slotting_recommendations`
- Attributes: `id`, `material_id`, `warehouse_id`, `recommended_location_code`, `recommended_location_id`, `ga_fitness_score`, `space_utilization_improvement`, `velocity_score`, `compatibility_score`, `status`, `created_at`, `applied_at`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`
  - `recommended_location_id -> locations.id`

### `ai_path_recommendations`
- Attributes: `id`, `task_id`, `task_type`, `recommended_path`, `estimated_time_minutes`, `estimated_distance_meters`, `efficiency_score`, `algorithm_used`, `status`, `created_at`, `applied_at`
- FK relations:
  - `task_id -> tasks.id`

### `ai_anomaly_detections`
- Attributes: `id`, `anomaly_type`, `material_id`, `warehouse_id`, `location_id`, `detected_value`, `expected_value`, `variance_percentage`, `severity`, `confidence_score`, `description`, `status`, `reviewed_by`, `reviewed_at`, `resolution_notes`, `created_at`
- FK relations:
  - `material_id -> materials.id`
  - `warehouse_id -> warehouses.id`
  - `location_id -> locations.id`
  - `reviewed_by -> users.id`

### `supplier_product_links`
- Attributes: `id`, `supplier_id`, `material_id`, `moq`, `lead_time_days`, `unit_price`, `currency_code`, `is_preferred`, `created_at`
- FK relations:
  - `supplier_id -> suppliers.id`
  - `material_id -> materials.id`

### `grns`
- Attributes: `id`, `grn_number`, `po_id`, `supplier_id`, `warehouse_id`, `received_date`, `received_by`, `status`, `notes`, `created_at`, `updated_at`
- FK relations:
  - `supplier_id -> suppliers.id`
  - `warehouse_id -> warehouses.id`
  - `received_by -> users.id`

### `reports`
- Attributes: `id`, `report_name`, `report_type`, `description`, `report_config`, `generated_at`, `file_size_bytes`, `file_path`, `created_by`, `created_at`
- FK relations:
  - `created_by -> users.id`

### `scheduled_reports`
- Attributes: `id`, `report_type`, `frequency`, `scheduled_time`, `email_recipients`, `is_active`, `last_generated_at`, `next_generation_at`, `created_by`, `created_at`, `updated_at`
- FK relations:
  - `created_by -> users.id`

### `worker_achievements`
- Attributes: `id`, `worker_id`, `achievement_type`, `earned_at`, `metadata`
- FK relations:
  - `worker_id -> users.id`

### `notifications`
- Attributes: `id`, `user_id`, `title`, `message`, `notification_type`, `read`, `action_url`, `metadata`, `created_at`
- FK relations:
  - `user_id -> users.id`

## Columns That Look Relational But Have No FK Constraint Yet

- `cycle_counts.location_code`
- `stock_movements.location_code`
- `stock_movements.user_id`
- `stock_movements.reference_id` (polymorphic reference; may be intentional)
- `order_items.location_code`
- `stock_transfers.source_location_code`
- `stock_transfers.dest_location_code`
- `tasks.location_code`
- `tasks.reference_id` (polymorphic reference; may be intentional)
- `returns.followup_order_id`
- `operation_events.worker_id`
- `operation_events.task_id`
- `operation_events.order_id`
- `operation_events.order_item_id`
- `operation_events.warehouse_id`
- `operation_events.material_id`
- `stock_transfer_lines.source_location_code`
- `stock_transfer_lines.dest_location_code`
- `ai_slotting_recommendations.recommended_location_code` (parallel to constrained `recommended_location_id`)
- `grns.po_id`
## Notes

- This report is built from migration SQL definitions and constraints.
- Some columns listed above are identifiers but may be intentionally unconstrained (e.g., polymorphic references or cached denormalized codes).
