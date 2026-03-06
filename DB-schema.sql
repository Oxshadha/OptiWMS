-- Generated SQL schema for OptiWMS (CREATE TABLE statements + FK constraints)
-- Types map: uuid, character varying, text, numeric, integer, date, timestamp without time zone (timestamp),
-- timestamp with time zone (timestamptz), jsonb, ARRAY -> text[], time without time zone -> time

-- CREATE TABLE statements (primary keys and unique constraints only)
CREATE TABLE ai_anomaly_detections (
  id uuid PRIMARY KEY,
  anomaly_type character varying,
  material_id uuid,
  warehouse_id uuid,
  location_id uuid,
  detected_value numeric,
  expected_value numeric,
  variance_percentage numeric,
  severity character varying,
  confidence_score numeric,
  description text,
  status character varying,
  reviewed_by uuid,
  reviewed_at timestamp,
  resolution_notes text,
  created_at timestamp
);

CREATE TABLE ai_demand_forecasts (
  id uuid PRIMARY KEY,
  material_id uuid,
  warehouse_id uuid,
  forecast_date date,
  predicted_quantity numeric,
  confidence_score numeric,
  model_version character varying,
  created_at timestamp,
  CONSTRAINT ai_demand_forecasts_material_id_warehouse_id_forecast_date_key UNIQUE(material_id, warehouse_id, forecast_date)
);

CREATE TABLE ai_path_recommendations (
  id uuid PRIMARY KEY,
  task_id uuid,
  task_type character varying,
  recommended_path jsonb,
  estimated_time_minutes numeric,
  estimated_distance_meters numeric,
  efficiency_score numeric,
  algorithm_used character varying,
  status character varying,
  created_at timestamp,
  applied_at timestamp
);

CREATE TABLE ai_slotting_recommendations (
  id uuid PRIMARY KEY,
  material_id uuid,
  warehouse_id uuid,
  recommended_location_code character varying,
  recommended_location_id uuid,
  ga_fitness_score numeric,
  space_utilization_improvement numeric,
  velocity_score numeric,
  compatibility_score numeric,
  status character varying,
  created_at timestamp,
  applied_at timestamp
);

CREATE TABLE ai_sourcing_recommendations (
  id uuid PRIMARY KEY,
  material_id uuid,
  warehouse_id uuid,
  trigger_event character varying,
  recommended_action character varying,
  recommended_quantity numeric,
  recommended_supplier_id uuid,
  calculated_roi numeric,
  space_freed_via_ga numeric,
  llm_justification text,
  status character varying,
  created_at timestamp,
  updated_at timestamp
);

CREATE TABLE customers (
  id uuid PRIMARY KEY,
  code character varying,
  name character varying,
  email character varying,
  phone character varying,
  address text,
  city character varying,
  country character varying,
  status character varying,
  created_at timestamp,
  postal_code character varying,
  country_code character varying,
  currency_code character varying,
  priority_tier character varying,
  lifetime_value numeric,
  tax_id character varying,
  CONSTRAINT customers_code_key UNIQUE(code)
);

CREATE TABLE cycle_count_audit_logs (
  id uuid PRIMARY KEY,
  cycle_count_id uuid,
  action character varying,
  performed_by uuid,
  from_status character varying,
  to_status character varying,
  expected_quantity numeric,
  counted_quantity numeric,
  variance numeric,
  notes text,
  created_at timestamptz
);

CREATE TABLE cycle_count_recounts (
  id uuid PRIMARY KEY,
  cycle_count_id uuid,
  recount_number integer,
  counted_quantity numeric,
  variance numeric,
  counted_by uuid,
  notes text,
  counted_at timestamp,
  CONSTRAINT unique_cycle_count_recount UNIQUE(cycle_count_id, recount_number)
);

CREATE TABLE cycle_count_schedules (
  id uuid PRIMARY KEY,
  warehouse_id uuid,
  frequency character varying,
  interval_days integer,
  next_scheduled_date date,
  location_pattern character varying,
  auto_create boolean,
  auto_assign_workers boolean,
  active boolean,
  created_by uuid,
  created_at timestamp,
  updated_at timestamp
);

CREATE TABLE cycle_counts (
  id uuid PRIMARY KEY,
  count_number character varying,
  warehouse_id uuid,
  location_code character varying,
  scheduled_date date,
  assigned_workers text[],
  status character varying,
  counted_by uuid,
  counted_at timestamp,
  variance numeric,
  notes text,
  created_at timestamp,
  updated_at timestamp,
  recount_required boolean,
  recount_count integer,
  previous_variance numeric,
  variance_threshold numeric,
  final_variance numeric,
  material_id uuid,
  expected_quantity numeric,
  counted_quantity numeric,
  variance_percentage numeric,
  anomaly_level character varying,
  anomaly_detected boolean,
  approval_required boolean,
  approved_by uuid,
  approved_at timestamp,
  approval_notes text,
  CONSTRAINT cycle_counts_count_number_key UNIQUE(count_number)
);

CREATE TABLE delivery_partners (
  id uuid PRIMARY KEY,
  partner_code character varying,
  company_name character varying,
  contact_person character varying,
  email character varying,
  phone character varying,
  address text,
  city character varying,
  country character varying,
  service_areas jsonb,
  rating numeric,
  cost_per_delivery numeric,
  status character varying,
  total_shipments integer,
  on_time_delivery_rate numeric,
  created_at timestamp,
  updated_at timestamp,
  postal_code character varying,
  country_code character varying,
  currency_code character varying,
  carrier_type character varying,
  international_coverage text[],
  tax_id character varying,
  CONSTRAINT delivery_partners_partner_code_key UNIQUE(partner_code)
);

CREATE TABLE dock_appointments (
  id uuid PRIMARY KEY,
  appointment_number character varying,
  dock_door_id uuid,
  warehouse_id uuid,
  appointment_type character varying,
  scheduled_start timestamp,
  scheduled_end timestamp,
  actual_start timestamp,
  actual_end timestamp,
  inbound_order_id uuid,
  outbound_order_id uuid,
  supplier_id uuid,
  carrier_name character varying,
  trailer_number character varying,
  status character varying,
  notes text,
  created_at timestamp,
  updated_at timestamp,
  CONSTRAINT dock_appointments_appointment_number_key UNIQUE(appointment_number)
);

CREATE TABLE dock_doors (
  id uuid PRIMARY KEY,
  door_number character varying,
  warehouse_id uuid,
  location character varying,
  status character varying,
  current_appointment_id uuid,
  created_at timestamp,
  updated_at timestamp,
  CONSTRAINT dock_doors_warehouse_id_door_number_key UNIQUE(warehouse_id, door_number)
);

CREATE TABLE flyway_schema_history (
  installed_rank integer PRIMARY KEY,
  version character varying,
  description character varying,
  type character varying,
  script character varying,
  checksum integer,
  installed_by character varying,
  installed_on timestamp,
  execution_time integer,
  success boolean
);

CREATE TABLE grns (
  id uuid PRIMARY KEY,
  grn_number character varying,
  po_id uuid,
  supplier_id uuid,
  warehouse_id uuid,
  received_date timestamp,
  received_by uuid,
  status character varying,
  notes text,
  created_at timestamp,
  updated_at timestamp,
  CONSTRAINT grns_grn_number_key UNIQUE(grn_number)
);

CREATE TABLE inventory (
  id uuid PRIMARY KEY,
  material_id uuid,
  warehouse_id uuid,
  location_code character varying,
  quantity integer,
  available_quantity integer,
  reserved_quantity integer,
  buffer_stock numeric,
  max_stock numeric,
  min_stock numeric,
  reorder_point numeric,
  stacking_quantity integer,
  moq numeric,
  lead_time_days integer,
  last_counted_at timestamp,
  status character varying,
  created_at timestamp,
  updated_at timestamp,
  batch_number character varying,
  expiry_date date,
  grn_id uuid,
  last_movement_date date,
  days_since_last_movement integer,
  ai_suggested_location_code character varying,
  ai_confidence_score numeric,
  ai_last_updated timestamp,
  material_type character varying,
  buffer_days integer,
  lead_time_months numeric,
  rop_in_days numeric,
  variance_demand numeric,
  variance_lead_time_demand numeric,
  difference numeric,
  order_delivery_days integer,
  order_quantity numeric,
  pallet_requirement numeric,
  lpn_code character varying
);

CREATE TABLE location_levels (
  id uuid PRIMARY KEY,
  location_id uuid,
  level_number integer,
  weight_capacity_kg numeric,
  pallet_capacity integer,
  height_cm numeric,
  accessibility_rating integer,
  current_weight_kg numeric,
  current_pallet_count integer,
  created_at timestamp,
  updated_at timestamp,
  CONSTRAINT location_levels_location_id_level_number_key UNIQUE(location_id, level_number)
);

CREATE TABLE locations (
  id uuid PRIMARY KEY,
  warehouse_id uuid,
  location_code character varying,
  area character varying,
  row_number character varying,
  bay_number character varying,
  level_number integer,
  bin_position character varying,
  location_type character varying,
  capacity numeric,
  is_active boolean,
  qr_code text,
  created_at timestamp,
  zone_type character varying,
  storage_condition character varying,
  x_coord numeric,
  y_coord numeric,
  z_coord numeric,
  max_weight_kg numeric,
  ai_optimal_for_material_types text[],
  ai_velocity_score numeric,
  rack_status character varying,
  description text,
  notes text,
  accessibility_rating integer,
  coordinate_x numeric,
  coordinate_y numeric,
  max_pallet_capacity integer,
  current_pallet_count integer,
  coordinate_z numeric,
  CONSTRAINT locations_location_code_key UNIQUE(location_code)
);

CREATE TABLE lpns (
  id uuid PRIMARY KEY,
  created_at timestamptz,
  created_by uuid,
  location_code character varying,
  lpn_code character varying,
  material_id uuid,
  notes text,
  quantity integer,
  status character varying,
  updated_at timestamptz,
  warehouse_id uuid,
  CONSTRAINT lpns_lpn_code_key UNIQUE(lpn_code)
);

CREATE TABLE material_default_locations (
  id uuid PRIMARY KEY,
  material_id uuid,
  warehouse_id uuid,
  location_code character varying,
  priority integer,
  material_type character varying,
  notes text,
  created_at timestamp,
  updated_at timestamp,
  CONSTRAINT material_default_locations_material_id_warehouse_id_locatio_key UNIQUE(material_id, warehouse_id, location_code)
);

CREATE TABLE material_planning (
  id uuid PRIMARY KEY,
  material_id uuid,
  warehouse_id uuid,
  buffer_days integer,
  future_average numeric,
  lead_time_days integer,
  lead_time_months numeric,
  expected_value numeric,
  variance_demand numeric,
  variance_lead_time_demand numeric,
  rop_days numeric,
  order_delivery_days integer,
  order_quantity numeric,
  pallet_requirement numeric,
  updated_at timestamp,
  CONSTRAINT material_planning_material_id_warehouse_id_key UNIQUE(material_id, warehouse_id)
);

CREATE TABLE materials (
  id uuid PRIMARY KEY,
  material_code character varying,
  description text,
  unit_type character varying,
  storage_type character varying,
  created_at timestamp,
  updated_at timestamp,
  material_type character varying,
  sku_id character varying,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  weight_kg numeric,
  shelf_life_days integer,
  reorder_method character varying,
  static_min_stock numeric,
  ai_min_stock numeric,
  unit_cost_standard numeric,
  storage_location_type character varying,
  third_party_location character varying,
  requires_pallet boolean,
  buffer_days integer,
  future_average numeric,
  lead_time_months numeric,
  expected_value numeric,
  variance_demand numeric,
  variance_lead_time_demand numeric,
  rop_days numeric,
  order_delivery_days integer,
  order_quantity numeric,
  pallet_requirement numeric,
  volume_cm3 numeric,
  pallet_spaces numeric,
  stackable boolean,
  max_stack_height integer,
  temperature_controlled boolean,
  hazardous boolean,
  fragile boolean,
  max_pallet_weight_kg numeric,
  min_order_quantity numeric,
  safety_stock_level numeric,
  abc_class character varying,
  fms_class character varying,
  preferred_zone character varying,
  CONSTRAINT materials_material_code_key UNIQUE(material_code)
);

CREATE TABLE non_moving_items (
  id uuid PRIMARY KEY,
  material_id uuid,
  warehouse_id uuid,
  last_movement_date date,
  days_since_last_movement integer,
  flagged_at timestamp
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  user_id uuid,
  title character varying,
  message text,
  notification_type character varying,
  read boolean,
  action_url character varying,
  metadata jsonb,
  created_at timestamp
);

CREATE TABLE operation_events (
  id uuid PRIMARY KEY,
  operation_type character varying,
  worker_id uuid,
  task_id uuid,
  order_id uuid,
  order_item_id uuid,
  warehouse_id uuid,
  material_id uuid,
  quantity integer,
  started_at timestamp,
  completed_at timestamp,
  duration_minutes integer,
  status character varying,
  metadata text,
  created_at timestamp
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY,
  order_id uuid,
  material_id uuid,
  quantity integer,
  unit_price numeric,
  picked_quantity integer,
  packed_quantity integer,
  location_code character varying,
  status character varying,
  created_at timestamp
);

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  order_number character varying,
  order_type character varying,
  customer_id uuid,
  supplier_id uuid,
  warehouse_id uuid,
  status character varying,
  priority character varying,
  order_date date,
  expected_date date,
  total_amount numeric,
  notes text,
  created_by uuid,
  created_at timestamp,
  updated_at timestamp,
  ai_suggested_priority_score integer,
  ai_suggested_date date,
  ai_confidence numeric,
  received_by uuid,
  picked_by uuid,
  packed_by uuid,
  shipped_by uuid,
  received_at timestamp,
  picked_at timestamp,
  packed_at timestamp,
  shipped_at timestamp,
  CONSTRAINT orders_order_number_key UNIQUE(order_number)
);

CREATE TABLE packaging_types (
  id uuid PRIMARY KEY,
  type_name character varying,
  category character varying,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  max_weight_kg numeric,
  cost numeric,
  is_active boolean,
  created_at timestamp
);

CREATE TABLE packing_records (
  id uuid PRIMARY KEY,
  order_id uuid,
  order_number character varying,
  packaging_type_id uuid,
  box_type character varying,
  box_dimensions jsonb,
  dunnage_materials jsonb,
  has_fragile_items boolean,
  actual_weight_kg numeric,
  dimensional_weight_kg numeric,
  chargeable_weight_kg numeric,
  tracking_number character varying,
  shipping_label_url text,
  packing_slip_url text,
  packing_notes text,
  packing_photos jsonb,
  packer_id uuid,
  status character varying,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp,
  updated_at timestamp
);

CREATE TABLE quality_check_logs (
  id uuid PRIMARY KEY,
  grn_id uuid,
  material_id uuid,
  qty_received numeric,
  qty_passed numeric,
  qty_rejected numeric,
  rejection_reason text,
  checked_by uuid,
  check_date timestamp,
  approval_status character varying,
  approved_by uuid,
  approved_at timestamp
);

CREATE TABLE reports (
  id uuid PRIMARY KEY,
  report_name character varying,
  report_type character varying,
  description text,
  report_config jsonb,
  generated_at timestamp,
  file_size_bytes bigint,
  file_path character varying,
  created_by uuid,
  created_at timestamp
);

CREATE TABLE return_status_history (
  id uuid PRIMARY KEY,
  return_id uuid,
  from_status character varying,
  to_status character varying,
  changed_by uuid,
  notes text,
  changed_at timestamptz
);

CREATE TABLE returns (
  id uuid PRIMARY KEY,
  return_number character varying,
  original_order_id uuid,
  customer_id uuid,
  warehouse_id uuid,
  return_date date,
  reason text,
  status character varying,
  resolution character varying,
  received_by uuid,
  inspected_by uuid,
  created_at timestamp,
  return_flow character varying,
  qc_outcome character varying,
  supplier_response_status character varying,
  supplier_response_notes text,
  false_return_request boolean,
  customer_care_flag boolean,
  followup_order_id uuid,
  closed_at timestamp,
  last_status_changed_at timestamp,
  CONSTRAINT returns_return_number_key UNIQUE(return_number)
);

CREATE TABLE scheduled_reports (
  id uuid PRIMARY KEY,
  report_type character varying,
  frequency character varying,
  scheduled_time time,
  email_recipients text[],
  is_active boolean,
  last_generated_at timestamp,
  next_generation_at timestamp,
  created_by uuid,
  created_at timestamp,
  updated_at timestamp
);

CREATE TABLE shipments (
  id uuid PRIMARY KEY,
  shipment_number character varying,
  order_id uuid,
  carrier character varying,
  tracking_number character varying,
  destination text,
  weight_kg numeric,
  driver_name character varying,
  driver_phone character varying,
  vehicle_number character varying,
  status character varying,
  eta date,
  shipped_at timestamp,
  delivered_at timestamp,
  created_at timestamp,
  delivery_confirmed_by uuid,
  delivery_confirmed_at timestamp,
  CONSTRAINT shipments_shipment_number_key UNIQUE(shipment_number)
);

CREATE TABLE sops (
  id uuid PRIMARY KEY,
  title character varying,
  category character varying,
  content text,
  version character varying,
  status character varying,
  created_by character varying,
  applicable_roles text,
  created_at timestamp,
  updated_at timestamp
);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY,
  material_id uuid,
  warehouse_id uuid,
  location_code character varying,
  movement_type character varying,
  quantity integer,
  reference_type character varying,
  reference_id uuid,
  user_id uuid,
  notes text,
  created_at timestamp
);

CREATE TABLE stock_transfer_line_events (
  id uuid PRIMARY KEY,
  transfer_line_id uuid,
  event_type character varying,
  worker_id uuid,
  quantity integer,
  source_scan_location character varying,
  dest_scan_location character varying,
  notes text,
  created_at timestamptz
);

CREATE TABLE stock_transfer_lines (
  id uuid PRIMARY KEY,
  transfer_id uuid,
  line_number integer,
  material_id uuid,
  source_warehouse_id uuid,
  source_location_code character varying,
  dest_warehouse_id uuid,
  dest_location_code character varying,
  requested_quantity integer,
  moved_quantity integer,
  status character varying,
  assigned_worker_id uuid,
  notes text,
  created_at timestamp,
  updated_at timestamp,
  CONSTRAINT uq_transfer_line_number UNIQUE(transfer_id, line_number)
);

CREATE TABLE stock_transfers (
  id uuid PRIMARY KEY,
  transfer_number character varying,
  transfer_type character varying,
  material_id uuid,
  source_warehouse_id uuid,
  source_location_code character varying,
  dest_warehouse_id uuid,
  dest_location_code character varying,
  quantity integer,
  status character varying,
  notes text,
  dispatched_by uuid,
  dispatched_at timestamp,
  received_by uuid,
  received_at timestamp,
  created_at timestamp,
  updated_at timestamp,
  created_by uuid,
  released_by uuid,
  released_at timestamp,
  CONSTRAINT stock_transfers_transfer_number_key UNIQUE(transfer_number)
);

CREATE TABLE supplier_product_links (
  id uuid PRIMARY KEY,
  supplier_id uuid,
  material_id uuid,
  moq numeric,
  lead_time_days integer,
  unit_price numeric,
  currency_code character varying,
  is_preferred boolean,
  created_at timestamp,
  CONSTRAINT supplier_product_links_supplier_id_material_id_key UNIQUE(supplier_id, material_id)
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY,
  code character varying,
  name character varying,
  contact_person character varying,
  email character varying,
  phone character varying,
  address text,
  country character varying,
  lead_time_days integer,
  rating numeric,
  status character varying,
  created_at timestamp,
  city character varying,
  postal_code character varying,
  country_code character varying,
  currency_code character varying,
  tax_id character varying,
  risk_category character varying,
  ai_rating_score numeric,
  CONSTRAINT suppliers_code_key UNIQUE(code)
);

CREATE TABLE supply_plans (
  id uuid PRIMARY KEY,
  material_id uuid,
  warehouse_id uuid,
  plan_year integer,
  plan_month integer,
  planned_quantity numeric,
  actual_quantity numeric,
  variance numeric,
  created_at timestamp,
  updated_at timestamp,
  CONSTRAINT supply_plans_material_id_warehouse_id_plan_year_plan_month_key UNIQUE(material_id, warehouse_id, plan_year, plan_month)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  task_number character varying,
  task_type character varying,
  warehouse_id uuid,
  assigned_to uuid,
  priority character varying,
  status character varying,
  due_date timestamp,
  completed_at timestamp,
  location_code character varying,
  reference_type character varying,
  reference_id uuid,
  notes text,
  created_at timestamp,
  updated_at timestamp,
  ai_suggested_sequence_order integer,
  ai_suggested_path jsonb,
  ai_path_efficiency_score numeric,
  completed_by uuid,
  started_at timestamp,
  CONSTRAINT tasks_task_number_key UNIQUE(task_number)
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  username character varying,
  email character varying,
  password_hash character varying,
  employee_id character varying,
  first_name character varying,
  last_name character varying,
  role character varying,
  warehouse_id uuid,
  phone character varying,
  avatar_url text,
  status character varying,
  device_id character varying,
  last_login_at timestamp,
  created_at timestamp,
  updated_at timestamp,
  blind_receiving_mode boolean,
  CONSTRAINT users_username_key UNIQUE(username),
  CONSTRAINT users_email_key UNIQUE(email),
  CONSTRAINT users_employee_id_key UNIQUE(employee_id)
);

CREATE TABLE warehouses (
  id uuid PRIMARY KEY,
  code character varying,
  name character varying,
  address text,
  city character varying,
  country character varying,
  contact_person character varying,
  phone character varying,
  email character varying,
  status character varying,
  created_at timestamp,
  updated_at timestamp,
  CONSTRAINT warehouses_code_key UNIQUE(code)
);

CREATE TABLE worker_achievements (
  id uuid PRIMARY KEY,
  worker_id uuid,
  achievement_type character varying,
  earned_at timestamp,
  metadata jsonb
);

CREATE TABLE yard_trailers (
  id uuid PRIMARY KEY,
  trailer_number character varying,
  warehouse_id uuid,
  carrier_name character varying,
  inbound_order_id uuid,
  supplier_id uuid,
  arrived_at timestamp,
  wait_time_minutes integer,
  status character varying,
  assigned_dock_door_id uuid,
  created_at timestamp,
  updated_at timestamp,
  CONSTRAINT yard_trailers_trailer_number_key UNIQUE(trailer_number)
);

-- FOREIGN KEY constraints (added after table creation to avoid ordering issues)
ALTER TABLE ai_anomaly_detections
  ADD CONSTRAINT ai_anomaly_detections_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT ai_anomaly_detections_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT ai_anomaly_detections_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id),
  ADD CONSTRAINT ai_anomaly_detections_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id);

ALTER TABLE ai_demand_forecasts
  ADD CONSTRAINT ai_demand_forecasts_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT ai_demand_forecasts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE ai_path_recommendations
  ADD CONSTRAINT ai_path_recommendations_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id);

ALTER TABLE ai_slotting_recommendations
  ADD CONSTRAINT ai_slotting_recommendations_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT ai_slotting_recommendations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT ai_slotting_recommendations_recommended_location_id_fkey FOREIGN KEY (recommended_location_id) REFERENCES locations(id);

ALTER TABLE ai_sourcing_recommendations
  ADD CONSTRAINT ai_sourcing_recommendations_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT ai_sourcing_recommendations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT ai_sourcing_recommendations_recommended_supplier_id_fkey FOREIGN KEY (recommended_supplier_id) REFERENCES suppliers(id);

ALTER TABLE cycle_count_audit_logs
  ADD CONSTRAINT cycle_count_audit_logs_cycle_count_id_fkey FOREIGN KEY (cycle_count_id) REFERENCES cycle_counts(id),
  ADD CONSTRAINT cycle_count_audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES users(id);

ALTER TABLE cycle_count_recounts
  ADD CONSTRAINT cycle_count_recounts_cycle_count_id_fkey FOREIGN KEY (cycle_count_id) REFERENCES cycle_counts(id),
  ADD CONSTRAINT cycle_count_recounts_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES users(id);

ALTER TABLE cycle_count_schedules
  ADD CONSTRAINT cycle_count_schedules_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT cycle_count_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE cycle_counts
  ADD CONSTRAINT cycle_counts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT cycle_counts_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES users(id),
  ADD CONSTRAINT cycle_counts_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT cycle_counts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id);

ALTER TABLE delivery_partners
  ADD CONSTRAINT delivery_partners_partner_code_key_fk FOREIGN KEY (country_code) REFERENCES NULL; -- placeholder: no referenced table for country_code

ALTER TABLE dock_appointments
  ADD CONSTRAINT dock_appointments_dock_door_id_fkey FOREIGN KEY (dock_door_id) REFERENCES dock_doors(id),
  ADD CONSTRAINT dock_appointments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT dock_appointments_inbound_order_id_fkey FOREIGN KEY (inbound_order_id) REFERENCES orders(id),
  ADD CONSTRAINT dock_appointments_outbound_order_id_fkey FOREIGN KEY (outbound_order_id) REFERENCES orders(id),
  ADD CONSTRAINT dock_appointments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

ALTER TABLE dock_doors
  ADD CONSTRAINT dock_doors_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE grns
  ADD CONSTRAINT grns_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  ADD CONSTRAINT grns_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT grns_received_by_fkey FOREIGN KEY (received_by) REFERENCES users(id);

ALTER TABLE inventory
  ADD CONSTRAINT inventory_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT inventory_location_code_fkey FOREIGN KEY (location_code) REFERENCES locations(location_code),
  ADD CONSTRAINT fk_inventory_grn FOREIGN KEY (grn_id) REFERENCES grns(id);

ALTER TABLE location_levels
  ADD CONSTRAINT location_levels_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id);

ALTER TABLE locations
  ADD CONSTRAINT locations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE lpns
  ADD CONSTRAINT lpns_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT lpns_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE material_default_locations
  ADD CONSTRAINT material_default_locations_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT material_default_locations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT material_default_locations_location_code_fkey FOREIGN KEY (location_code) REFERENCES locations(location_code);

ALTER TABLE material_planning
  ADD CONSTRAINT material_planning_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT material_planning_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE non_moving_items
  ADD CONSTRAINT non_moving_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT non_moving_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE operation_events
  ADD CONSTRAINT operation_events_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES users(id);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id),
  ADD CONSTRAINT order_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id);

ALTER TABLE orders
  ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id),
  ADD CONSTRAINT orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  ADD CONSTRAINT orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT orders_received_by_fkey FOREIGN KEY (received_by) REFERENCES users(id),
  ADD CONSTRAINT orders_picked_by_fkey FOREIGN KEY (picked_by) REFERENCES users(id),
  ADD CONSTRAINT orders_packed_by_fkey FOREIGN KEY (packed_by) REFERENCES users(id),
  ADD CONSTRAINT orders_shipped_by_fkey FOREIGN KEY (shipped_by) REFERENCES users(id);

ALTER TABLE packing_records
  ADD CONSTRAINT packing_records_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id),
  ADD CONSTRAINT packing_records_packaging_type_id_fkey FOREIGN KEY (packaging_type_id) REFERENCES packaging_types(id),
  ADD CONSTRAINT packing_records_packer_id_fkey FOREIGN KEY (packer_id) REFERENCES users(id);

ALTER TABLE quality_check_logs
  ADD CONSTRAINT quality_check_logs_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES grns(id),
  ADD CONSTRAINT quality_check_logs_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT quality_check_logs_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES users(id),
  ADD CONSTRAINT quality_check_logs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id);

ALTER TABLE reports
  ADD CONSTRAINT reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE return_status_history
  ADD CONSTRAINT return_status_history_return_id_fkey FOREIGN KEY (return_id) REFERENCES returns(id);

ALTER TABLE returns
  ADD CONSTRAINT returns_original_order_id_fkey FOREIGN KEY (original_order_id) REFERENCES orders(id),
  ADD CONSTRAINT returns_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id),
  ADD CONSTRAINT returns_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT returns_received_by_fkey FOREIGN KEY (received_by) REFERENCES users(id),
  ADD CONSTRAINT returns_inspected_by_fkey FOREIGN KEY (inspected_by) REFERENCES users(id);

ALTER TABLE scheduled_reports
  ADD CONSTRAINT scheduled_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE shipments
  ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE stock_transfer_line_events
  ADD CONSTRAINT stock_transfer_line_events_transfer_line_id_fkey FOREIGN KEY (transfer_line_id) REFERENCES stock_transfer_lines(id),
  ADD CONSTRAINT stock_transfer_line_events_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES users(id);

ALTER TABLE stock_transfer_lines
  ADD CONSTRAINT stock_transfer_lines_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id),
  ADD CONSTRAINT stock_transfer_lines_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT stock_transfer_lines_source_warehouse_id_fkey FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT stock_transfer_lines_dest_warehouse_id_fkey FOREIGN KEY (dest_warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT stock_transfer_lines_assigned_worker_id_fkey FOREIGN KEY (assigned_worker_id) REFERENCES users(id);

ALTER TABLE stock_transfers
  ADD CONSTRAINT stock_transfers_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT stock_transfers_source_warehouse_id_fkey FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT stock_transfers_dest_warehouse_id_fkey FOREIGN KEY (dest_warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT stock_transfers_dispatched_by_fkey FOREIGN KEY (dispatched_by) REFERENCES users(id),
  ADD CONSTRAINT stock_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES users(id),
  ADD CONSTRAINT stock_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT stock_transfers_released_by_fkey FOREIGN KEY (released_by) REFERENCES users(id);

ALTER TABLE supplier_product_links
  ADD CONSTRAINT supplier_product_links_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  ADD CONSTRAINT supplier_product_links_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id);

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_code_key_fk FOREIGN KEY (country_code) REFERENCES NULL; -- placeholder: no referenced table for country_code

ALTER TABLE supply_plans
  ADD CONSTRAINT supply_plans_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id),
  ADD CONSTRAINT supply_plans_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE tasks
  ADD CONSTRAINT tasks_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id),
  ADD CONSTRAINT tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES users(id);

ALTER TABLE worker_achievements
  ADD CONSTRAINT worker_achievements_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES users(id);

ALTER TABLE yard_trailers
  ADD CONSTRAINT yard_trailers_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT yard_trailers_inbound_order_id_fkey FOREIGN KEY (inbound_order_id) REFERENCES orders(id),
  ADD CONSTRAINT yard_trailers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  ADD CONSTRAINT yard_trailers_assigned_dock_door_id_fkey FOREIGN KEY (assigned_dock_door_id) REFERENCES dock_doors(id);

-- Note: Some columns like country_code were not clearly linked to another table in the provided schema; placeholders were left where appropriate.

-- End of schema
