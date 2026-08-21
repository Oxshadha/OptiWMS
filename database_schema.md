================================================================================
DATABASE SCHEMA - OptiWMS
Total Tables: 98
================================================================================

---

## TABLE: ai_anomaly_detections

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
anomaly_type VARCHAR(255) NOT NULL
material_id UUID NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
location_id UUID NULL [FK -> locations(id)]
detected_value NUMERIC(15,2) NULL
expected_value NUMERIC(15,2) NULL
variance_percentage NUMERIC(10,4) NULL
severity VARCHAR(255) NULL
confidence_score NUMERIC(5,4) NULL
description TEXT NULL
status VARCHAR(255) NULL [DEFAULT: DETECTED]
reviewed_by UUID NULL [FK -> users(id)]
reviewed_at TIMESTAMP NULL
resolution_notes TEXT NULL
created_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: ai_demand_forecasts

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
material_id UUID NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
forecast_date DATE NOT NULL
predicted_quantity NUMERIC(15,2) NOT NULL
confidence_score NUMERIC(5,4) NULL
model_version VARCHAR(50) NULL
created_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: ai_path_recommendations

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
task_id UUID NULL [FK -> tasks(id)]
task_type VARCHAR(50) NULL
recommended_path JSONB NOT NULL
estimated_time_minutes NUMERIC(10,2) NULL
estimated_distance_meters NUMERIC(10,2) NULL
efficiency_score NUMERIC(5,2) NULL
algorithm_used VARCHAR(50) NULL
status VARCHAR(20) NULL [DEFAULT: PENDING]
created_at TIMESTAMP NULL [DEFAULT: now()]
applied_at TIMESTAMP NULL

---

## TABLE: ai_slotting_recommendations

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
material_id UUID NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
recommended_location_code VARCHAR(50) NULL
recommended_location_id UUID NULL [FK -> locations(id)]
ga_fitness_score NUMERIC(10,4) NULL
space_utilization_improvement NUMERIC(5,2) NULL
velocity_score NUMERIC(5,2) NULL
compatibility_score NUMERIC(5,2) NULL
status VARCHAR(20) NULL [DEFAULT: PENDING]
created_at TIMESTAMP NULL [DEFAULT: now()]
applied_at TIMESTAMP NULL

---

## TABLE: ai_sourcing_recommendations

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
material_id UUID NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
trigger_event VARCHAR(50) NULL
recommended_action VARCHAR(50) NULL
recommended_quantity NUMERIC(15,2) NULL
recommended_supplier_id UUID NULL [FK -> suppliers(id)]
calculated_roi NUMERIC(10,2) NULL
space_freed_via_ga NUMERIC(15,2) NULL
llm_justification TEXT NULL
status VARCHAR(20) NULL [DEFAULT: PENDING]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: backup_inventory_20260219

id UUID NULL
material_id UUID NULL
warehouse_id UUID NULL
location_code VARCHAR(50) NULL
quantity INTEGER NULL
available_quantity INTEGER NULL
reserved_quantity INTEGER NULL
buffer_stock NUMERIC(15,2) NULL
max_stock NUMERIC(15,2) NULL
min_stock NUMERIC(15,2) NULL
reorder_point NUMERIC(15,2) NULL
stacking_quantity INTEGER NULL
moq NUMERIC(15,2) NULL
lead_time_days INTEGER NULL
last_counted_at TIMESTAMP NULL
status VARCHAR(20) NULL
created_at TIMESTAMP NULL
updated_at TIMESTAMP NULL
batch_number VARCHAR(100) NULL
expiry_date DATE NULL
grn_id UUID NULL
last_movement_date DATE NULL
days_since_last_movement INTEGER NULL
ai_suggested_location_code VARCHAR(50) NULL
ai_confidence_score NUMERIC(5,4) NULL
ai_last_updated TIMESTAMP NULL
material_type VARCHAR(20) NULL
buffer_days INTEGER NULL
lead_time_months NUMERIC(5,2) NULL
rop_in_days NUMERIC(10,2) NULL
variance_demand NUMERIC(15,2) NULL
variance_lead_time_demand NUMERIC(15,2) NULL
difference NUMERIC(15,2) NULL
order_delivery_days INTEGER NULL
order_quantity NUMERIC(15,2) NULL
pallet_requirement NUMERIC(10,2) NULL
lpn_code VARCHAR(20) NULL

---

## TABLE: backup_inventory_pre_opening_20260219

id UUID NULL
material_id UUID NULL
warehouse_id UUID NULL
location_code VARCHAR(50) NULL
quantity INTEGER NULL
available_quantity INTEGER NULL
reserved_quantity INTEGER NULL
buffer_stock NUMERIC(15,2) NULL
max_stock NUMERIC(15,2) NULL
min_stock NUMERIC(15,2) NULL
reorder_point NUMERIC(15,2) NULL
stacking_quantity INTEGER NULL
moq NUMERIC(15,2) NULL
lead_time_days INTEGER NULL
last_counted_at TIMESTAMP NULL
status VARCHAR(20) NULL
created_at TIMESTAMP NULL
updated_at TIMESTAMP NULL
batch_number VARCHAR(100) NULL
expiry_date DATE NULL
grn_id UUID NULL
last_movement_date DATE NULL
days_since_last_movement INTEGER NULL
ai_suggested_location_code VARCHAR(50) NULL
ai_confidence_score NUMERIC(5,4) NULL
ai_last_updated TIMESTAMP NULL
material_type VARCHAR(20) NULL
buffer_days INTEGER NULL
lead_time_months NUMERIC(5,2) NULL
rop_in_days NUMERIC(10,2) NULL
variance_demand NUMERIC(15,2) NULL
variance_lead_time_demand NUMERIC(15,2) NULL
difference NUMERIC(15,2) NULL
order_delivery_days INTEGER NULL
order_quantity NUMERIC(15,2) NULL
pallet_requirement NUMERIC(10,2) NULL
lpn_code VARCHAR(20) NULL

---

## TABLE: backup_material_defaults_pre_opening_20260219

id UUID NULL
material_id UUID NULL
warehouse_id UUID NULL
location_code VARCHAR(255) NULL
priority INTEGER NULL
material_type VARCHAR(255) NULL
notes TEXT NULL
created_at TIMESTAMP NULL
updated_at TIMESTAMP NULL

---

## TABLE: backup_materials_20260219

id UUID NULL
material_code VARCHAR(50) NULL
description TEXT NULL
unit_type VARCHAR(20) NULL
storage_type VARCHAR(20) NULL
created_at TIMESTAMP NULL
updated_at TIMESTAMP NULL
material_type VARCHAR(20) NULL
sku_id VARCHAR(50) NULL
length_cm NUMERIC(10,2) NULL
width_cm NUMERIC(10,2) NULL
height_cm NUMERIC(10,2) NULL
weight_kg NUMERIC(10,2) NULL
shelf_life_days INTEGER NULL
reorder_method VARCHAR(20) NULL
static_min_stock NUMERIC(15,2) NULL
ai_min_stock NUMERIC(15,2) NULL
unit_cost_standard NUMERIC(15,2) NULL
storage_location_type VARCHAR(20) NULL
third_party_location VARCHAR(200) NULL
requires_pallet BOOLEAN NULL
buffer_days INTEGER NULL
future_average NUMERIC(15,2) NULL
lead_time_months NUMERIC(5,2) NULL
expected_value NUMERIC(15,2) NULL
variance_demand NUMERIC(15,2) NULL
variance_lead_time_demand NUMERIC(15,2) NULL
rop_days NUMERIC(10,2) NULL
order_delivery_days INTEGER NULL
order_quantity NUMERIC(15,2) NULL
pallet_requirement NUMERIC(15,2) NULL
volume_cm3 NUMERIC(15,2) NULL
pallet_spaces NUMERIC(10,2) NULL
stackable BOOLEAN NULL
max_stack_height INTEGER NULL
temperature_controlled BOOLEAN NULL
hazardous BOOLEAN NULL
fragile BOOLEAN NULL
max_pallet_weight_kg NUMERIC(10,2) NULL
min_order_quantity NUMERIC(15,2) NULL
safety_stock_level NUMERIC(15,2) NULL
abc_class VARCHAR(1) NULL
fms_class VARCHAR(1) NULL
preferred_zone VARCHAR(1) NULL

---

## TABLE: backup_materials_pre_opening_20260219

id UUID NULL
material_code VARCHAR(50) NULL
description TEXT NULL
unit_type VARCHAR(20) NULL
storage_type VARCHAR(20) NULL
created_at TIMESTAMP NULL
updated_at TIMESTAMP NULL
material_type VARCHAR(20) NULL
sku_id VARCHAR(50) NULL
length_cm NUMERIC(10,2) NULL
width_cm NUMERIC(10,2) NULL
height_cm NUMERIC(10,2) NULL
weight_kg NUMERIC(10,2) NULL
shelf_life_days INTEGER NULL
reorder_method VARCHAR(20) NULL
static_min_stock NUMERIC(15,2) NULL
ai_min_stock NUMERIC(15,2) NULL
unit_cost_standard NUMERIC(15,2) NULL
storage_location_type VARCHAR(20) NULL
third_party_location VARCHAR(200) NULL
requires_pallet BOOLEAN NULL
buffer_days INTEGER NULL
future_average NUMERIC(15,2) NULL
lead_time_months NUMERIC(5,2) NULL
expected_value NUMERIC(15,2) NULL
variance_demand NUMERIC(15,2) NULL
variance_lead_time_demand NUMERIC(15,2) NULL
rop_days NUMERIC(10,2) NULL
order_delivery_days INTEGER NULL
order_quantity NUMERIC(15,2) NULL
pallet_requirement NUMERIC(15,2) NULL
volume_cm3 NUMERIC(15,2) NULL
pallet_spaces NUMERIC(10,2) NULL
stackable BOOLEAN NULL
max_stack_height INTEGER NULL
temperature_controlled BOOLEAN NULL
hazardous BOOLEAN NULL
fragile BOOLEAN NULL
max_pallet_weight_kg NUMERIC(10,2) NULL
min_order_quantity NUMERIC(15,2) NULL
safety_stock_level NUMERIC(15,2) NULL
abc_class VARCHAR(1) NULL
fms_class VARCHAR(1) NULL
preferred_zone VARCHAR(1) NULL

---

## TABLE: bom_audit_log

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
action VARCHAR(16) NOT NULL
entity_type VARCHAR(32) NOT NULL
entity_id UUID NULL
actor VARCHAR(128) NULL
payload_json TEXT NULL
created_at TIMESTAMP NOT NULL [DEFAULT: now()]

---

## TABLE: bom_components

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
bom_header_id UUID NOT NULL [FK -> bom_headers(id)]
component_material_id UUID NOT NULL [FK -> materials(id)]
component_type VARCHAR(32) NOT NULL
qty_per_parent NUMERIC(18,6) NOT NULL
scrap_rate NUMERIC(8,4) NOT NULL [DEFAULT: 0]
lead_time_days INTEGER NULL
uom VARCHAR(32) NULL
created_at TIMESTAMP NOT NULL [DEFAULT: now()]
updated_at TIMESTAMP NOT NULL [DEFAULT: now()]

---

## TABLE: bom_headers

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
parent_material_id UUID NOT NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
version VARCHAR(64) NOT NULL [DEFAULT: v1]
status VARCHAR(20) NOT NULL [DEFAULT: active]
effective_from DATE NULL
effective_to DATE NULL
notes TEXT NULL
created_at TIMESTAMP NOT NULL [DEFAULT: now()]
updated_at TIMESTAMP NOT NULL [DEFAULT: now()]
data_quality_tier VARCHAR(64) NULL
synthetic_ratio NUMERIC(6,5) NULL
decision_eligible BOOLEAN NOT NULL [DEFAULT: false]
source_lineage JSONB NULL

---

## TABLE: chat_messages

id VARCHAR(36) NOT NULL [PK]
session_id VARCHAR(36) NOT NULL [FK -> chat_sessions(id)]
sender VARCHAR(10) NOT NULL
text_content TEXT NULL
metadata JSON NULL
timestamp TIMESTAMP NULL

---

## TABLE: chat_sessions

id VARCHAR(36) NOT NULL [PK]
user_id VARCHAR(255) NOT NULL
title VARCHAR(500) NOT NULL
created_at TIMESTAMP NULL

---

## TABLE: customers

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
code VARCHAR(255) NULL
name VARCHAR(255) NOT NULL
email VARCHAR(255) NULL
phone VARCHAR(255) NULL
address TEXT NULL
city VARCHAR(255) NULL
country VARCHAR(255) NULL [DEFAULT: Sri Lanka]
status VARCHAR(255) NULL [DEFAULT: active]
created_at TIMESTAMP NULL [DEFAULT: now()]
postal_code VARCHAR(20) NULL
country_code VARCHAR(255) NULL
currency_code VARCHAR(255) NULL [DEFAULT: LKR]
priority_tier VARCHAR(255) NULL
lifetime_value NUMERIC(15,2) NULL [DEFAULT: 0]
tax_id VARCHAR(50) NULL
dataset_version VARCHAR(128) NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]

---

## TABLE: cycle_count_audit_logs

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
cycle_count_id UUID NOT NULL [FK -> cycle_counts(id)]
action VARCHAR(60) NOT NULL
performed_by UUID NULL [FK -> users(id)]
from_status VARCHAR(50) NULL
to_status VARCHAR(50) NULL
expected_quantity NUMERIC(15,2) NULL
counted_quantity NUMERIC(15,2) NULL
variance NUMERIC(15,2) NULL
notes TEXT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: cycle_count_recounts

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
cycle_count_id UUID NOT NULL [FK -> cycle_counts(id)]
recount_number INTEGER NOT NULL
counted_quantity NUMERIC(15,2) NOT NULL
variance NUMERIC(15,2) NOT NULL
counted_by UUID NULL [FK -> users(id)]
notes TEXT NULL
counted_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: cycle_count_schedules

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
frequency VARCHAR(20) NOT NULL [DEFAULT: quarterly]
interval_days INTEGER NULL
next_scheduled_date DATE NOT NULL
location_pattern VARCHAR(100) NULL
auto_create BOOLEAN NULL [DEFAULT: true]
auto_assign_workers BOOLEAN NULL [DEFAULT: false]
active BOOLEAN NULL [DEFAULT: true]
created_by UUID NULL [FK -> users(id)]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: cycle_counts

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
count_number VARCHAR(50) NOT NULL
warehouse_id UUID NULL [FK -> warehouses(id)]
location_code VARCHAR(50) NULL
scheduled_date DATE NULL
assigned_workers ARRAY NULL
status VARCHAR(50) NULL [DEFAULT: scheduled]
counted_by UUID NULL [FK -> users(id)]
counted_at TIMESTAMP NULL
variance NUMERIC(15,2) NULL
notes TEXT NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
recount_required BOOLEAN NULL [DEFAULT: false]
recount_count INTEGER NULL [DEFAULT: 0]
previous_variance NUMERIC(15,2) NULL
variance_threshold NUMERIC(15,2) NULL [DEFAULT: 5.0]
final_variance NUMERIC(15,2) NULL
material_id UUID NULL [FK -> materials(id)]
expected_quantity NUMERIC(15,2) NULL
counted_quantity NUMERIC(15,2) NULL
variance_percentage NUMERIC(10,4) NULL
anomaly_level VARCHAR(20) NULL
anomaly_detected BOOLEAN NULL [DEFAULT: false]
approval_required BOOLEAN NULL [DEFAULT: false]
approved_by UUID NULL [FK -> users(id)]
approved_at TIMESTAMP NULL
approval_notes TEXT NULL

---

## TABLE: data_integrity_snapshots

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
stage VARCHAR(20) NOT NULL
metric_name VARCHAR(120) NOT NULL
metric_value BIGINT NOT NULL
created_at TIMESTAMP NULL [DEFAULT: CURRENT_TIMESTAMP]

---

## TABLE: delivery_partners

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
partner_code VARCHAR(255) NOT NULL
company_name VARCHAR(255) NOT NULL
contact_person VARCHAR(255) NULL
email VARCHAR(255) NULL
phone VARCHAR(255) NULL
address TEXT NULL
city VARCHAR(255) NULL
country VARCHAR(255) NULL
service_areas JSONB NULL
rating NUMERIC(3,2) NULL
cost_per_delivery NUMERIC(10,2) NULL
status VARCHAR(255) NULL [DEFAULT: active]
total_shipments INTEGER NULL [DEFAULT: 0]
on_time_delivery_rate NUMERIC(5,2) NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
postal_code VARCHAR(20) NULL
country_code VARCHAR(255) NULL
currency_code VARCHAR(255) NULL [DEFAULT: LKR]
carrier_type VARCHAR(255) NULL
international_coverage ARRAY NULL
tax_id VARCHAR(50) NULL

---

## TABLE: demand_history

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
material_id UUID NOT NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
period DATE NOT NULL
demand_units NUMERIC(14,2) NOT NULL
promotion_flag BOOLEAN NULL [DEFAULT: false]
holiday_flag BOOLEAN NULL [DEFAULT: false]
lead_time_days NUMERIC(8,2) NULL
on_hand_inventory NUMERIC(14,2) NULL
source VARCHAR(32) NULL [DEFAULT: synthetic]
created_at TIMESTAMP NOT NULL [DEFAULT: now()]
data_quality_tier VARCHAR(64) NULL
synthetic_ratio NUMERIC(6,5) NULL
decision_eligible BOOLEAN NOT NULL [DEFAULT: false]
source_lineage JSONB NULL

---

## TABLE: dock_appointments

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
appointment_number VARCHAR(50) NOT NULL
dock_door_id UUID NULL [FK -> dock_doors(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
appointment_type VARCHAR(20) NOT NULL
scheduled_start TIMESTAMP NOT NULL
scheduled_end TIMESTAMP NOT NULL
actual_start TIMESTAMP NULL
actual_end TIMESTAMP NULL
inbound_order_id UUID NULL [FK -> orders(id)]
outbound_order_id UUID NULL [FK -> orders(id)]
supplier_id UUID NULL [FK -> suppliers(id)]
carrier_name VARCHAR(200) NULL
trailer_number VARCHAR(50) NULL
status VARCHAR(20) NULL [DEFAULT: scheduled]
notes TEXT NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: dock_doors

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
door_number VARCHAR(50) NOT NULL
warehouse_id UUID NULL [FK -> warehouses(id)]
location VARCHAR(100) NULL
status VARCHAR(20) NULL [DEFAULT: available]
current_appointment_id UUID NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: forecast_backfill_load_audit

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
dataset_version VARCHAR(64) NOT NULL
source_file VARCHAR(1024) NOT NULL
source_file_sha256 VARCHAR(64) NULL
warehouse_id UUID NULL [FK -> warehouses(id)]
row_count INTEGER NOT NULL [DEFAULT: 0]
inserted_rows INTEGER NOT NULL [DEFAULT: 0]
updated_rows INTEGER NOT NULL [DEFAULT: 0]
status VARCHAR(32) NOT NULL
notes TEXT NULL
started_at TIMESTAMP NOT NULL [DEFAULT: now()]
finished_at TIMESTAMP NULL

---

## TABLE: forecast_backtest_rows

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
dataset VARCHAR(128) NOT NULL
model_name VARCHAR(128) NOT NULL
split VARCHAR(32) NOT NULL
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
material_id UUID NOT NULL [FK -> materials(id)]
origin_month DATE NOT NULL
horizon INTEGER NOT NULL [DEFAULT: 1]
y_true NUMERIC(20,6) NOT NULL
forecast_p05 NUMERIC(20,6) NULL
forecast_p50 NUMERIC(20,6) NOT NULL
forecast_p95 NUMERIC(20,6) NULL
residual NUMERIC(20,6) NOT NULL
absolute_error NUMERIC(20,6) NOT NULL
interval_covered BOOLEAN NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: forecast_jobs

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
run_id UUID NOT NULL [DEFAULT: gen_random_uuid()]
warehouse_id UUID NULL [FK -> warehouses(id)]
dataset VARCHAR(128) NOT NULL
requested_model VARCHAR(128) NULL
status VARCHAR(32) NOT NULL [DEFAULT: queued]
stage VARCHAR(64) NOT NULL [DEFAULT: queued]
progress_pct INTEGER NOT NULL [DEFAULT: 0]
message TEXT NULL
requested_by VARCHAR(128) NULL
started_at TIMESTAMPTZ NULL
finished_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: forecast_model_evidence

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
dataset VARCHAR(128) NOT NULL
model_name VARCHAR(128) NOT NULL
warehouse_id UUID NULL [FK -> warehouses(id)]
split VARCHAR(32) NOT NULL
horizon INTEGER NOT NULL [DEFAULT: 0]
evaluation_rows INTEGER NOT NULL
material_count INTEGER NOT NULL
wape NUMERIC(12,8) NULL
mae NUMERIC(18,6) NULL
rmse NUMERIC(18,6) NULL
bias NUMERIC(12,8) NULL
under_forecast_rate NUMERIC(12,8) NULL
interval_nominal_coverage NUMERIC(12,8) NULL
interval_empirical_coverage NUMERIC(12,8) NULL
data_quality_tier VARCHAR(64) NOT NULL
synthetic_ratio NUMERIC(6,5) NOT NULL [DEFAULT: 0]
decision_eligible BOOLEAN NOT NULL [DEFAULT: false]
source_lineage JSONB NOT NULL [DEFAULT: {}]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: forecast_model_registry

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
dataset VARCHAR(128) NOT NULL
model_name VARCHAR(128) NOT NULL
display_name VARCHAR(128) NOT NULL
algorithm VARCHAR(128) NOT NULL
version VARCHAR(64) NOT NULL
status VARCHAR(32) NOT NULL
promotion_eligible BOOLEAN NOT NULL [DEFAULT: false]
promotion_gate JSONB NOT NULL [DEFAULT: {}]
promoted_by VARCHAR(128) NULL
promoted_at TIMESTAMPTZ NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: forecast_outbound_history_backfill

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
warehouse_id UUID NULL [FK -> warehouses(id)]
sku VARCHAR(64) NOT NULL
category VARCHAR(255) NULL
demand_date DATE NOT NULL
demand_units NUMERIC(18,4) NOT NULL
dataset_version VARCHAR(64) NOT NULL
source_tag VARCHAR(64) NOT NULL [DEFAULT: manual_backfill]
source_file_sha256 VARCHAR(64) NULL
loaded_at TIMESTAMP NOT NULL [DEFAULT: now()]
updated_at TIMESTAMP NOT NULL [DEFAULT: now()]

---

## TABLE: forecast_results

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
material_id UUID NOT NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
forecast_period DATE NOT NULL
horizon INTEGER NOT NULL [DEFAULT: 1]
model_name VARCHAR(64) NOT NULL
forecast_p10 NUMERIC(14,2) NULL
forecast_p50 NUMERIC(14,2) NOT NULL
forecast_p90 NUMERIC(14,2) NULL
actual_demand NUMERIC(14,2) NULL
wape NUMERIC(8,6) NULL
method VARCHAR(32) NULL
mlflow_run_id VARCHAR(64) NULL
created_at TIMESTAMP NOT NULL [DEFAULT: now()]
training_source VARCHAR(128) NULL
data_quality_tier VARCHAR(64) NULL
synthetic_ratio NUMERIC(6,5) NULL
decision_eligible BOOLEAN NOT NULL [DEFAULT: false]
source_lineage JSONB NULL

---

## TABLE: forecast_sku_mapping

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
dataset VARCHAR(32) NULL
forecast_sku VARCHAR(64) NOT NULL
wms_material_id UUID NOT NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
is_active BOOLEAN NOT NULL [DEFAULT: true]
notes TEXT NULL
created_at TIMESTAMP NOT NULL [DEFAULT: now()]
updated_at TIMESTAMP NOT NULL [DEFAULT: now()]

---

## TABLE: grns

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
grn_number VARCHAR(50) NOT NULL
po_id UUID NULL
supplier_id UUID NULL [FK -> suppliers(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
received_date TIMESTAMP NOT NULL
received_by UUID NULL [FK -> users(id)]
status VARCHAR(20) NULL [DEFAULT: PENDING_QA]
notes TEXT NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: inbound_putaway_allocation

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
order_id UUID NOT NULL [FK -> orders(id)]
order_item_id UUID NOT NULL [FK -> order_items(id)]
warehouse_id UUID NOT NULL
material_id UUID NOT NULL
location_code VARCHAR(50) NOT NULL
quantity INTEGER NOT NULL
pallets INTEGER NOT NULL
status VARCHAR(20) NOT NULL [DEFAULT: planned]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: inventory

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
material_id UUID NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
location_code VARCHAR(50) NULL [FK -> locations(location_code)]
quantity INTEGER NOT NULL [DEFAULT: 0]
available_quantity INTEGER NOT NULL [DEFAULT: 0]
reserved_quantity INTEGER NOT NULL [DEFAULT: 0]
buffer_stock NUMERIC(15,2) NULL
max_stock NUMERIC(15,2) NULL
min_stock NUMERIC(15,2) NULL
reorder_point NUMERIC(15,2) NULL
stacking_quantity INTEGER NULL
moq NUMERIC(15,2) NULL
lead_time_days INTEGER NULL
last_counted_at TIMESTAMP NULL
status VARCHAR(20) NULL [DEFAULT: active]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
batch_number VARCHAR(100) NULL
expiry_date DATE NULL
grn_id UUID NULL [FK -> grns(id)]
last_movement_date DATE NULL
days_since_last_movement INTEGER NULL
ai_suggested_location_code VARCHAR(50) NULL
ai_confidence_score NUMERIC(5,4) NULL
ai_last_updated TIMESTAMP NULL
material_type VARCHAR(20) NULL
buffer_days INTEGER NULL
lead_time_months NUMERIC(5,2) NULL
rop_in_days NUMERIC(10,2) NULL
variance_demand NUMERIC(15,2) NULL
variance_lead_time_demand NUMERIC(15,2) NULL
difference NUMERIC(15,2) NULL
order_delivery_days INTEGER NULL
order_quantity NUMERIC(15,2) NULL
pallet_requirement NUMERIC(10,2) NULL
lpn_code VARCHAR(20) NULL
data_quality_tier VARCHAR(64) NULL [DEFAULT: OPERATIONAL_ENTRY]
source_lineage JSONB NULL

---

## TABLE: inventory_policy_recommendation_lines

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
run_id UUID NOT NULL [FK -> inventory_policy_recommendation_runs(id)]
material_id UUID NOT NULL [FK -> materials(id)]
material_code VARCHAR(50) NOT NULL
material_type VARCHAR(32) NULL
current_stock NUMERIC(15,2) NOT NULL [DEFAULT: 0]
current_available_stock NUMERIC(15,2) NOT NULL [DEFAULT: 0]
current_min_stock NUMERIC(15,2) NULL
current_max_stock NUMERIC(15,2) NULL
current_reorder_point NUMERIC(15,2) NULL
forecast_p10 NUMERIC(15,2) NULL
forecast_p50 NUMERIC(15,2) NULL
forecast_p90 NUMERIC(15,2) NULL
lead_time_days INTEGER NULL
lead_time_std_days NUMERIC(8,2) NULL
moq NUMERIC(15,2) NULL
order_multiple NUMERIC(15,2) NULL
unit_cost NUMERIC(15,2) NULL
expiry_limited_max_stock NUMERIC(15,2) NULL
proposed_min_stock NUMERIC(15,2) NULL
proposed_max_stock NUMERIC(15,2) NULL
proposed_reorder_point NUMERIC(15,2) NULL
proposed_target_stock NUMERIC(15,2) NULL
proposed_order_qty NUMERIC(15,2) NULL
stock_delta NUMERIC(15,2) NOT NULL [DEFAULT: 0]
pallet_positions_delta NUMERIC(12,2) NOT NULL [DEFAULT: 0]
holding_cost_delta NUMERIC(15,2) NOT NULL [DEFAULT: 0]
stockout_risk_score NUMERIC(6,2) NOT NULL [DEFAULT: 0]
expiry_risk_score NUMERIC(6,2) NOT NULL [DEFAULT: 0]
confidence_score NUMERIC(6,2) NOT NULL [DEFAULT: 0]
recommendation_status VARCHAR(32) NOT NULL [DEFAULT: DATA_INSUFFICIENT]
rationale TEXT NULL
constraint_snapshot JSONB NULL
manager_override BOOLEAN NOT NULL [DEFAULT: false]
override_reason TEXT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
units_per_handling_unit NUMERIC(15,2) NULL
current_buffer_stock NUMERIC(15,2) NULL
current_order_qty NUMERIC(15,2) NULL
current_pallet_requirement NUMERIC(15,2) NULL
approval_snapshot JSONB NULL
target_pallet_positions NUMERIC(12,2) NOT NULL [DEFAULT: 0]

---

## TABLE: inventory_policy_recommendation_runs

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
horizon_months INTEGER NOT NULL [DEFAULT: 3]
status VARCHAR(32) NOT NULL [DEFAULT: DRAFT]
forecast_model_name VARCHAR(128) NULL
forecast_run_id VARCHAR(128) NULL
created_by VARCHAR(128) NULL
approved_by VARCHAR(128) NULL
approved_at TIMESTAMPTZ NULL
notes TEXT NULL
total_stock_delta NUMERIC(15,2) NOT NULL [DEFAULT: 0]
total_pallet_positions_delta NUMERIC(12,2) NOT NULL [DEFAULT: 0]
estimated_holding_cost_delta NUMERIC(15,2) NOT NULL [DEFAULT: 0]
high_risk_count INTEGER NOT NULL [DEFAULT: 0]
data_insufficient_count INTEGER NOT NULL [DEFAULT: 0]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
planning_cycle_id UUID NULL [FK -> planning_cycles(id)]

---

## TABLE: inventory_policy_simulation_evidence

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
policy_run_id UUID NULL [FK -> inventory_policy_recommendation_runs(id)]
material_id UUID NOT NULL [FK -> materials(id)]
service_level_target NUMERIC(8,6) NOT NULL
simulated_fill_rate NUMERIC(8,6) NULL
current_expected_cost NUMERIC(20,4) NULL
proposed_expected_cost NUMERIC(20,4) NULL
expected_cost_delta NUMERIC(20,4) NULL
stockout_days_current INTEGER NULL
stockout_days_proposed INTEGER NULL
capacity_feasible BOOLEAN NOT NULL [DEFAULT: false]
simulation_method VARCHAR(128) NOT NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
demand_p5 NUMERIC(20,4) NULL
demand_p25 NUMERIC(20,4) NULL
demand_p50 NUMERIC(20,4) NULL
demand_p75 NUMERIC(20,4) NULL
demand_p95 NUMERIC(20,4) NULL
sensitivity_json JSONB NULL

---

## TABLE: location_levels

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
location_id UUID NULL [FK -> locations(id)]
level_number INTEGER NOT NULL
weight_capacity_kg NUMERIC(10,2) NOT NULL
pallet_capacity INTEGER NOT NULL
height_cm NUMERIC(10,2) NULL
accessibility_rating INTEGER NULL
current_weight_kg NUMERIC(10,2) NULL [DEFAULT: 0]
current_pallet_count INTEGER NULL [DEFAULT: 0]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: locations

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
warehouse_id UUID NULL [FK -> warehouses(id)]
location_code VARCHAR(255) NOT NULL
area VARCHAR(255) NOT NULL
row_number VARCHAR(255) NOT NULL
bay_number VARCHAR(255) NOT NULL
level_number INTEGER NOT NULL
bin_position VARCHAR(255) NOT NULL
location_type VARCHAR(255) NULL [DEFAULT: storage]
capacity NUMERIC(15,2) NULL
is_active BOOLEAN NULL [DEFAULT: true]
qr_code TEXT NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
zone_type VARCHAR(20) NULL [DEFAULT: STORAGE]
storage_condition VARCHAR(20) NULL
x_coord NUMERIC(10,2) NULL
y_coord NUMERIC(10,2) NULL
z_coord NUMERIC(10,2) NULL
max_weight_kg NUMERIC(15,2) NULL
ai_optimal_for_material_types ARRAY NULL
ai_velocity_score NUMERIC(5,2) NULL
rack_status VARCHAR(20) NULL [DEFAULT: active]
description TEXT NULL
notes TEXT NULL
accessibility_rating INTEGER NULL
coordinate_x NUMERIC(10,2) NULL
coordinate_y NUMERIC(10,2) NULL
max_pallet_capacity INTEGER NULL
current_pallet_count INTEGER NULL [DEFAULT: 0]
coordinate_z NUMERIC(10,2) NULL
amalgamated_class VARCHAR(2) NULL
max_volume_cm3 NUMERIC(18,2) NULL
max_lpn_count INTEGER NULL
dataset_version VARCHAR(128) NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]
temperature_zone VARCHAR(32) NOT NULL [DEFAULT: AMBIENT]
hazard_allowed BOOLEAN NOT NULL [DEFAULT: false]

---

## TABLE: lpns

id UUID NOT NULL [PK]
created_at TIMESTAMPTZ NULL
created_by UUID NULL
location_code VARCHAR(50) NULL
lpn_code VARCHAR(20) NOT NULL
material_id UUID NULL
notes TEXT NULL
quantity INTEGER NOT NULL
status VARCHAR(20) NULL
updated_at TIMESTAMPTZ NULL
warehouse_id UUID NULL

---

## TABLE: material_classification_history

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
run_id UUID NOT NULL [FK -> material_classification_runs(id)]
material_id UUID NOT NULL [FK -> materials(id)]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
issue_volume_12m NUMERIC(20,3) NOT NULL [DEFAULT: 0]
issue_count_12m INTEGER NOT NULL [DEFAULT: 0]
cumulative_usage_share NUMERIC(12,8) NULL
abc_class VARCHAR(1) NOT NULL
fms_class VARCHAR(1) NOT NULL
amalgamated_class VARCHAR(2) NOT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: material_classification_runs

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
dataset_version VARCHAR(128) NOT NULL
observation_start DATE NOT NULL
observation_end DATE NOT NULL
method VARCHAR(128) NOT NULL
status VARCHAR(32) NOT NULL [DEFAULT: completed]
source_event_count BIGINT NOT NULL [DEFAULT: 0]
source_lineage JSONB NOT NULL [DEFAULT: {}]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: material_classification_thresholds

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
run_id UUID NOT NULL [FK -> material_classification_runs(id)]
material_type VARCHAR(32) NOT NULL
category VARCHAR(64) NOT NULL
abc_a_cumulative_max NUMERIC(8,6) NOT NULL
abc_b_cumulative_max NUMERIC(8,6) NOT NULL
fms_slow_upper NUMERIC(18,6) NOT NULL
fms_fast_lower NUMERIC(18,6) NOT NULL
source_rows INTEGER NOT NULL
method VARCHAR(128) NOT NULL

---

## TABLE: material_default_locations

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
material_id UUID NOT NULL [FK -> materials(id)]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
location_code VARCHAR(255) NOT NULL [FK -> locations(location_code)]
priority INTEGER NULL [DEFAULT: 1]
material_type VARCHAR(255) NULL
notes TEXT NULL
created_at TIMESTAMP NULL [DEFAULT: CURRENT_TIMESTAMP]
updated_at TIMESTAMP NULL [DEFAULT: CURRENT_TIMESTAMP]

---

## TABLE: material_issue_stats

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
material_id UUID NOT NULL [FK -> materials(id)]
warehouse_id UUID NOT NULL
period_month DATE NOT NULL
issue_volume BIGINT NOT NULL [DEFAULT: 0]
issue_count INTEGER NOT NULL [DEFAULT: 0]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: material_issue_stats_rollup

material_id UUID NOT NULL [PK] [FK -> materials(id)]
warehouse_id UUID NOT NULL [PK]
issue_volume_12m BIGINT NOT NULL [DEFAULT: 0]
issue_count_12m INTEGER NOT NULL [DEFAULT: 0]
abc_class VARCHAR(1) NULL
fms_class VARCHAR(1) NULL
amalgamated_class VARCHAR(2) NULL
last_refreshed_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: material_planning

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
material_id UUID NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
buffer_days INTEGER NULL
future_average NUMERIC(15,2) NULL
lead_time_days INTEGER NULL
lead_time_months NUMERIC(5,2) NULL
expected_value NUMERIC(15,2) NULL
variance_demand NUMERIC(15,2) NULL
variance_lead_time_demand NUMERIC(15,2) NULL
rop_days NUMERIC(10,2) NULL
order_delivery_days INTEGER NULL
order_quantity NUMERIC(15,2) NULL
pallet_requirement NUMERIC(15,2) NULL
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: materials

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
material_code VARCHAR(50) NOT NULL
description TEXT NOT NULL
unit_type VARCHAR(20) NULL
storage_type VARCHAR(20) NULL [DEFAULT: pallet]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
material_type VARCHAR(20) NULL [DEFAULT: raw_material]
sku_id VARCHAR(50) NULL
length_cm NUMERIC(10,2) NULL
width_cm NUMERIC(10,2) NULL
height_cm NUMERIC(10,2) NULL
weight_kg NUMERIC(10,2) NULL
shelf_life_days INTEGER NULL
reorder_method VARCHAR(20) NULL [DEFAULT: STATIC]
static_min_stock NUMERIC(15,2) NULL
ai_min_stock NUMERIC(15,2) NULL
unit_cost_standard NUMERIC(15,2) NULL
storage_location_type VARCHAR(20) NULL [DEFAULT: warehouse]
third_party_location VARCHAR(200) NULL
requires_pallet BOOLEAN NULL [DEFAULT: true]
buffer_days INTEGER NULL
future_average NUMERIC(15,2) NULL
lead_time_months NUMERIC(5,2) NULL
expected_value NUMERIC(15,2) NULL
variance_demand NUMERIC(15,2) NULL
variance_lead_time_demand NUMERIC(15,2) NULL
rop_days NUMERIC(10,2) NULL
order_delivery_days INTEGER NULL
order_quantity NUMERIC(15,2) NULL
pallet_requirement NUMERIC(15,2) NULL
volume_cm3 NUMERIC(15,2) NULL
pallet_spaces NUMERIC(10,2) NULL
stackable BOOLEAN NULL [DEFAULT: true]
max_stack_height INTEGER NULL
temperature_controlled BOOLEAN NULL [DEFAULT: false]
hazardous BOOLEAN NULL [DEFAULT: false]
fragile BOOLEAN NULL [DEFAULT: false]
max_pallet_weight_kg NUMERIC(10,2) NULL
min_order_quantity NUMERIC(15,2) NULL
safety_stock_level NUMERIC(15,2) NULL
abc_class VARCHAR(1) NULL
fms_class VARCHAR(1) NULL
preferred_zone VARCHAR(1) NULL
category VARCHAR(64) NULL
units_per_pallet INTEGER NULL
hazard_class VARCHAR(20) NULL
forecast_p50 NUMERIC(14,2) NULL
forecast_p10 NUMERIC(14,2) NULL
forecast_p90 NUMERIC(14,2) NULL
forecast_updated_at TIMESTAMP NULL
handling_unit_type VARCHAR(20) NULL
units_per_handling_unit NUMERIC(15,2) NULL
order_multiple NUMERIC(15,2) NULL
data_quality_tier VARCHAR(64) NULL [DEFAULT: OPERATIONAL_ENTRY]
synthetic_ratio NUMERIC(6,5) NULL
decision_eligible BOOLEAN NOT NULL [DEFAULT: false]
source_lineage JSONB NULL

---

## TABLE: non_moving_items

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
material_id UUID NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
last_movement_date DATE NULL
days_since_last_movement INTEGER NULL
flagged_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: notifications

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
user_id UUID NULL [FK -> users(id)]
title VARCHAR(200) NOT NULL
message TEXT NOT NULL
notification_type VARCHAR(50) NOT NULL
read BOOLEAN NULL [DEFAULT: false]
action_url VARCHAR(500) NULL
metadata JSONB NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
audience_roles VARCHAR(255) NULL
warehouse_id UUID NULL [FK -> warehouses(id)]

---

## TABLE: operation_events

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
operation_type VARCHAR(50) NOT NULL
worker_id UUID NOT NULL
task_id UUID NULL
order_id UUID NULL
order_item_id UUID NULL
warehouse_id UUID NULL
material_id UUID NULL
quantity INTEGER NULL
started_at TIMESTAMP NULL
completed_at TIMESTAMP NOT NULL
duration_minutes INTEGER NULL
status VARCHAR(20) NOT NULL [DEFAULT: completed]
metadata TEXT NULL
created_at TIMESTAMP NOT NULL [DEFAULT: CURRENT_TIMESTAMP]
dataset_version VARCHAR(128) NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]

---

## TABLE: order_items

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
order_id UUID NULL [FK -> orders(id)]
material_id UUID NULL [FK -> materials(id)]
quantity INTEGER NOT NULL
unit_price NUMERIC(15,2) NULL
picked_quantity INTEGER NULL [DEFAULT: 0]
packed_quantity INTEGER NULL [DEFAULT: 0]
location_code VARCHAR(50) NULL
status VARCHAR(50) NULL [DEFAULT: pending]
created_at TIMESTAMP NULL [DEFAULT: now()]
batch_number VARCHAR(100) NULL
manufacture_date DATE NULL
expiry_date DATE NULL
weight_kg NUMERIC(10,2) NULL
height_cm NUMERIC(10,2) NULL
length_cm NUMERIC(10,2) NULL
width_cm NUMERIC(10,2) NULL
dataset_version VARCHAR(128) NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]
received_quantity INTEGER NOT NULL [DEFAULT: 0]

---

## TABLE: order_number_aliases

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
order_id UUID NOT NULL [FK -> orders(id)]
alias_order_number VARCHAR(80) NOT NULL
created_at TIMESTAMP NOT NULL [DEFAULT: CURRENT_TIMESTAMP]

---

## TABLE: orders

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
order_number VARCHAR(50) NOT NULL
order_type VARCHAR(20) NOT NULL
customer_id UUID NULL [FK -> customers(id)]
supplier_id UUID NULL [FK -> suppliers(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
status VARCHAR(50) NOT NULL [DEFAULT: pending]
priority VARCHAR(20) NULL [DEFAULT: normal]
order_date DATE NOT NULL
expected_date DATE NULL
total_amount NUMERIC(15,2) NULL
notes TEXT NULL
created_by UUID NULL [FK -> users(id)]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
ai_suggested_priority_score INTEGER NULL
ai_suggested_date DATE NULL
ai_confidence NUMERIC(5,4) NULL
received_by UUID NULL [FK -> users(id)]
picked_by UUID NULL [FK -> users(id)]
packed_by UUID NULL [FK -> users(id)]
shipped_by UUID NULL [FK -> users(id)]
received_at TIMESTAMP NULL
picked_at TIMESTAMP NULL
packed_at TIMESTAMP NULL
shipped_at TIMESTAMP NULL
dataset_version VARCHAR(128) NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]

---

## TABLE: packaging_types

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
type_name VARCHAR(100) NOT NULL
category VARCHAR(50) NULL
length_cm NUMERIC(10,2) NULL
width_cm NUMERIC(10,2) NULL
height_cm NUMERIC(10,2) NULL
max_weight_kg NUMERIC(10,2) NULL
cost NUMERIC(10,2) NULL
is_active BOOLEAN NULL [DEFAULT: true]
created_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: packing_records

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
order_id UUID NULL [FK -> orders(id)]
order_number VARCHAR(255) NULL
packaging_type_id UUID NULL [FK -> packaging_types(id)]
box_type VARCHAR(255) NULL
box_dimensions JSONB NULL
dunnage_materials JSONB NULL
has_fragile_items BOOLEAN NULL [DEFAULT: false]
actual_weight_kg NUMERIC(10,3) NULL
dimensional_weight_kg NUMERIC(10,3) NULL
chargeable_weight_kg NUMERIC(10,3) NULL
tracking_number VARCHAR(255) NULL
shipping_label_url TEXT NULL
packing_slip_url TEXT NULL
packing_notes TEXT NULL
packing_photos JSONB NULL
packer_id UUID NULL [FK -> users(id)]
status VARCHAR(255) NULL [DEFAULT: in_progress]
started_at TIMESTAMP NULL
completed_at TIMESTAMP NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: planning_cycles

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
lifecycle_status VARCHAR(32) NOT NULL [DEFAULT: CALCULATING]
cadence VARCHAR(32) NOT NULL [DEFAULT: DAILY_POLICY]
created_by VARCHAR(128) NULL
scheduled_for TIMESTAMPTZ NULL
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
failure_reason TEXT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: planning_decision_events

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
planning_cycle_id UUID NULL [FK -> planning_cycles(id)]
recommendation_id UUID NOT NULL
recommendation_type VARCHAR(48) NOT NULL
action VARCHAR(24) NOT NULL
actor VARCHAR(128) NOT NULL
reason TEXT NULL
deferred_until TIMESTAMPTZ NULL
previous_status VARCHAR(32) NULL
new_status VARCHAR(32) NOT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: policy_explanation_cache

line_id VARCHAR(36) NOT NULL [PK]
line_updated_at TIMESTAMP NOT NULL
explanation TEXT NOT NULL
model_used VARCHAR(64) NULL
created_at TIMESTAMP NULL

---

## TABLE: project_dataset_load_audit

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
dataset_version VARCHAR(128) NOT NULL
dataset_hash VARCHAR(64) NOT NULL
warehouse_id UUID NULL [FK -> warehouses(id)]
status VARCHAR(24) NOT NULL
row_counts JSONB NOT NULL [DEFAULT: {}]
validation JSONB NOT NULL [DEFAULT: {}]
notes TEXT NULL
started_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
finished_at TIMESTAMPTZ NULL

---

## TABLE: putaway_planning_jobs

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
order_id UUID NOT NULL [FK -> orders(id)]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
status VARCHAR(32) NOT NULL [DEFAULT: PENDING]
attempt_count INTEGER NOT NULL [DEFAULT: 0]
next_attempt_at TIMESTAMP NOT NULL [DEFAULT: now()]
locked_at TIMESTAMP NULL
last_error TEXT NULL
completed_at TIMESTAMP NULL
created_at TIMESTAMP NOT NULL [DEFAULT: now()]
updated_at TIMESTAMP NOT NULL [DEFAULT: now()]

---

## TABLE: quality_check_logs

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
grn_id UUID NULL [FK -> grns(id)]
material_id UUID NULL [FK -> materials(id)]
qty_received NUMERIC(15,2) NOT NULL
qty_passed NUMERIC(15,2) NOT NULL
qty_rejected NUMERIC(15,2) NOT NULL
rejection_reason TEXT NULL
checked_by UUID NULL [FK -> users(id)]
check_date TIMESTAMP NULL [DEFAULT: now()]
approval_status VARCHAR(20) NOT NULL [DEFAULT: PENDING]
approved_by UUID NULL [FK -> users(id)]
approved_at TIMESTAMP NULL

---

## TABLE: reports

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
report_name VARCHAR(200) NOT NULL
report_type VARCHAR(50) NOT NULL
description TEXT NULL
report_config JSONB NULL
generated_at TIMESTAMP NULL
file_size_bytes BIGINT NULL
file_path VARCHAR(500) NULL
created_by UUID NULL [FK -> users(id)]
created_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: return_status_history

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
return_id UUID NOT NULL [FK -> returns(id)]
from_status VARCHAR(50) NULL
to_status VARCHAR(50) NOT NULL
changed_by UUID NULL
notes TEXT NULL
changed_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: returns

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
return_number VARCHAR(255) NOT NULL
original_order_id UUID NULL [FK -> orders(id)]
customer_id UUID NULL [FK -> customers(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
return_date DATE NULL
reason TEXT NULL
status VARCHAR(255) NULL [DEFAULT: pending]
resolution VARCHAR(255) NULL
received_by UUID NULL [FK -> users(id)]
inspected_by UUID NULL [FK -> users(id)]
created_at TIMESTAMP NULL [DEFAULT: now()]
return_flow VARCHAR(20) NULL [DEFAULT: unknown]
qc_outcome VARCHAR(30) NULL
supplier_response_status VARCHAR(30) NULL
supplier_response_notes TEXT NULL
false_return_request BOOLEAN NULL [DEFAULT: false]
customer_care_flag BOOLEAN NULL [DEFAULT: false]
followup_order_id UUID NULL
closed_at TIMESTAMP NULL
last_status_changed_at TIMESTAMP NULL

---

## TABLE: scheduled_reports

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
report_type VARCHAR(50) NOT NULL
frequency VARCHAR(20) NOT NULL
scheduled_time TIME WITHOUT TIME ZONE NOT NULL
email_recipients ARRAY NOT NULL
is_active BOOLEAN NULL [DEFAULT: true]
last_generated_at TIMESTAMP NULL
next_generation_at TIMESTAMP NULL
created_by UUID NULL [FK -> users(id)]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: shipments

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
shipment_number VARCHAR(255) NOT NULL
order_id UUID NULL [FK -> orders(id)]
carrier VARCHAR(255) NULL
tracking_number VARCHAR(255) NULL
destination TEXT NULL
weight_kg NUMERIC(10,2) NULL
driver_name VARCHAR(255) NULL
driver_phone VARCHAR(255) NULL
vehicle_number VARCHAR(255) NULL
status VARCHAR(255) NULL [DEFAULT: label_created]
eta DATE NULL
shipped_at TIMESTAMP NULL
delivered_at TIMESTAMP NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
delivery_confirmed_by UUID NULL
delivery_confirmed_at TIMESTAMP NULL
delivery_partner_id UUID NULL

---

## TABLE: slotting_plan_lines

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
plan_id UUID NOT NULL [FK -> slotting_plans(id)]
material_id UUID NOT NULL [FK -> materials(id)]
material_code VARCHAR(50) NOT NULL
material_type VARCHAR(32) NULL
current_primary_location_code VARCHAR(128) NULL
recommended_primary_location_code VARCHAR(128) NULL
recommended_primary_location_id UUID NULL
final_primary_location_code VARCHAR(128) NULL
manager_override BOOLEAN NOT NULL [DEFAULT: false]
override_reason TEXT NULL
locked BOOLEAN NOT NULL [DEFAULT: false]
active_pick_pallet_positions INTEGER NOT NULL [DEFAULT: 1]
required_reserve_pallet_positions INTEGER NOT NULL [DEFAULT: 0]
max_stock_pallet_positions INTEGER NOT NULL [DEFAULT: 1]
rop NUMERIC(15,2) NULL
max_stock NUMERIC(15,2) NULL
distance_saved_meters NUMERIC(12,2) NULL
zone_upgrade VARCHAR(64) NULL
move_reason TEXT NULL
gain_score NUMERIC(10,4) NULL
relocation_applied BOOLEAN NOT NULL [DEFAULT: false]
objective_cost NUMERIC(12,4) NULL
relocation_flag BOOLEAN NOT NULL [DEFAULT: false]
constraint_snapshot JSONB NULL
status VARCHAR(32) NOT NULL [DEFAULT: PROPOSED]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: slotting_plan_reserve_lines

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
plan_line_id UUID NOT NULL [FK -> slotting_plan_lines(id)]
recommended_reserve_location_code VARCHAR(128) NOT NULL
final_reserve_location_code VARCHAR(128) NULL
reserve_pallet_positions INTEGER NOT NULL [DEFAULT: 1]
reserve_zone_hint VARCHAR(64) NULL
sequence_no INTEGER NOT NULL [DEFAULT: 1]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: slotting_plans

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
warehouse_id UUID NOT NULL
plan_code VARCHAR(64) NOT NULL
valid_from DATE NOT NULL
valid_to DATE NOT NULL
status VARCHAR(32) NOT NULL [DEFAULT: DRAFT]
version INTEGER NOT NULL [DEFAULT: 1]
algorithm VARCHAR(64) NOT NULL [DEFAULT: HEURISTIC_MILP_V1]
relocation_budget_pct NUMERIC(5,2) NOT NULL [DEFAULT: 30.00]
relocation_moves_applied INTEGER NOT NULL [DEFAULT: 0]
total_moves_proposed INTEGER NOT NULL [DEFAULT: 0]
total_distance_saved_meters NUMERIC(12,2) NOT NULL [DEFAULT: 0]
created_by VARCHAR(128) NULL
approved_by VARCHAR(128) NULL
approved_at TIMESTAMPTZ NULL
source_stats_at TIMESTAMPTZ NULL
notes TEXT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
execution_status VARCHAR(32) NULL [DEFAULT: NONE]
execution_transfer_id UUID NULL [FK -> stock_transfers(id)]
transfers_created INTEGER NOT NULL [DEFAULT: 0]
solver_status VARCHAR(32) NOT NULL [DEFAULT: NOT_RUN]
objective_value NUMERIC(18,4) NULL
infeasible_reason TEXT NULL
constraint_evidence TEXT NULL
planning_cycle_id UUID NULL [FK -> planning_cycles(id)]
scheduled_for TIMESTAMPTZ NULL
confirmed_distance_saved_meters NUMERIC(12,2) NOT NULL [DEFAULT: 0]

---

## TABLE: sops

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
title VARCHAR(200) NOT NULL
category VARCHAR(50) NOT NULL
content TEXT NOT NULL
version VARCHAR(20) NOT NULL [DEFAULT: 1.0]
status VARCHAR(20) NOT NULL [DEFAULT: draft]
created_by VARCHAR(100) NULL
applicable_roles TEXT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: space_optimization_lines

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
run_id UUID NOT NULL [FK -> space_optimization_runs(id)]
material_id UUID NOT NULL [FK -> materials(id)]
source_policy_line_id UUID NULL [FK -> inventory_policy_recommendation_lines(id)]
material_code VARCHAR(50) NOT NULL
material_type VARCHAR(32) NULL
current_primary_location_code VARCHAR(128) NULL
recommended_primary_location_code VARCHAR(128) NULL
recommended_reserve_locations JSONB NULL
released_location_codes JSONB NULL
required_active_pick_pallet_positions INTEGER NOT NULL [DEFAULT: 1]
required_reserve_pallet_positions INTEGER NOT NULL [DEFAULT: 0]
compatible BOOLEAN NOT NULL [DEFAULT: true]
distance_saved_meters NUMERIC(12,2) NOT NULL [DEFAULT: 0]
space_saved_pallet_positions NUMERIC(12,2) NOT NULL [DEFAULT: 0]
space_needed_pallet_positions NUMERIC(12,2) NOT NULL [DEFAULT: 0]
move_cost_score NUMERIC(8,2) NOT NULL [DEFAULT: 0]
recommendation_status VARCHAR(32) NOT NULL [DEFAULT: DATA_INSUFFICIENT]
rationale TEXT NULL
constraint_snapshot JSONB NULL
manager_override BOOLEAN NOT NULL [DEFAULT: false]
override_reason TEXT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: space_optimization_runs

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
policy_run_id UUID NULL [FK -> inventory_policy_recommendation_runs(id)]
horizon_months INTEGER NOT NULL [DEFAULT: 3]
status VARCHAR(32) NOT NULL [DEFAULT: DRAFT]
algorithm VARCHAR(64) NOT NULL [DEFAULT: FORECAST_SPACE_HEURISTIC_V1]
created_by VARCHAR(128) NULL
approved_by VARCHAR(128) NULL
approved_at TIMESTAMPTZ NULL
notes TEXT NULL
total_space_saved_pallet_positions NUMERIC(12,2) NOT NULL [DEFAULT: 0]
total_space_needed_pallet_positions NUMERIC(12,2) NOT NULL [DEFAULT: 0]
total_distance_saved_meters NUMERIC(12,2) NOT NULL [DEFAULT: 0]
infeasible_count INTEGER NOT NULL [DEFAULT: 0]
high_risk_count INTEGER NOT NULL [DEFAULT: 0]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
optimizer_metadata JSONB NULL
relocation_cap_pct NUMERIC(5,2) NULL
relocation_cap_skus INTEGER NULL
objective_value NUMERIC(15,4) NULL
planning_cycle_id UUID NULL [FK -> planning_cycles(id)]

---

## TABLE: space_optimization_scenarios

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
policy_line_id UUID NULL [FK -> inventory_policy_recommendation_lines(id)]
space_line_id UUID NULL [FK -> space_optimization_lines(id)]
scenario_name VARCHAR(64) NOT NULL
passed BOOLEAN NOT NULL [DEFAULT: true]
risk_score NUMERIC(6,2) NOT NULL [DEFAULT: 0]
stockout_days_estimate NUMERIC(8,2) NOT NULL [DEFAULT: 0]
expiry_excess_units NUMERIC(15,2) NOT NULL [DEFAULT: 0]
space_shortfall_pallet_positions NUMERIC(12,2) NOT NULL [DEFAULT: 0]
explanation TEXT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: stock_movements

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
material_id UUID NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
location_code VARCHAR(50) NULL
movement_type VARCHAR(20) NOT NULL
quantity INTEGER NOT NULL
reference_type VARCHAR(50) NULL
reference_id UUID NULL
user_id UUID NULL
notes TEXT NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
dataset_version VARCHAR(128) NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]

---

## TABLE: stock_transfer_line_events

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
transfer_line_id UUID NOT NULL [FK -> stock_transfer_lines(id)]
event_type VARCHAR(40) NOT NULL
worker_id UUID NULL [FK -> users(id)]
quantity INTEGER NULL
source_scan_location VARCHAR(50) NULL
dest_scan_location VARCHAR(50) NULL
notes TEXT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: stock_transfer_lines

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
transfer_id UUID NOT NULL [FK -> stock_transfers(id)]
line_number INTEGER NOT NULL
material_id UUID NOT NULL [FK -> materials(id)]
source_warehouse_id UUID NULL [FK -> warehouses(id)]
source_location_code VARCHAR(50) NULL
dest_warehouse_id UUID NULL [FK -> warehouses(id)]
dest_location_code VARCHAR(50) NULL
requested_quantity INTEGER NOT NULL
moved_quantity INTEGER NOT NULL [DEFAULT: 0]
status VARCHAR(30) NOT NULL [DEFAULT: open]
assigned_worker_id UUID NULL [FK -> users(id)]
notes TEXT NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
planning_cycle_id UUID NULL [FK -> planning_cycles(id)]
slotting_plan_line_id UUID NULL [FK -> slotting_plan_lines(id)]

---

## TABLE: stock_transfers

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
transfer_number VARCHAR(50) NOT NULL
transfer_type VARCHAR(20) NOT NULL
material_id UUID NULL [FK -> materials(id)]
source_warehouse_id UUID NULL [FK -> warehouses(id)]
source_location_code VARCHAR(50) NULL
dest_warehouse_id UUID NULL [FK -> warehouses(id)]
dest_location_code VARCHAR(50) NULL
quantity INTEGER NOT NULL
status VARCHAR(20) NULL [DEFAULT: draft]
notes TEXT NULL
dispatched_by UUID NULL [FK -> users(id)]
dispatched_at TIMESTAMP NULL
received_by UUID NULL [FK -> users(id)]
received_at TIMESTAMP NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
created_by UUID NULL [FK -> users(id)]
released_by UUID NULL [FK -> users(id)]
released_at TIMESTAMP NULL
planning_cycle_id UUID NULL [FK -> planning_cycles(id)]

---

## TABLE: supplier_constraints

id UUID NOT NULL [PK] [DEFAULT: gen_random_uuid()]
supplier_id UUID NOT NULL [FK -> suppliers(id)]
material_id UUID NULL [FK -> materials(id)]
min_order_qty DOUBLE NULL [DEFAULT: 0]
max_order_qty DOUBLE NULL
bulk_discount_threshold DOUBLE NULL
bulk_discount_percent DOUBLE NULL [DEFAULT: 0]
unit_price DOUBLE NULL
currency VARCHAR(3) NULL [DEFAULT: LKR]
avg_shipment_delay_days INTEGER NULL [DEFAULT: 0]
lead_time_std_dev_days INTEGER NULL [DEFAULT: 0]
supplier_otif_percent DOUBLE NULL [DEFAULT: 95.0]
ordering_cost_per_order DOUBLE NULL [DEFAULT: 1200.0]
is_active BOOLEAN NULL [DEFAULT: true]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: supplier_materials

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
supplier_id UUID NOT NULL [FK -> suppliers(id)]
material_id UUID NOT NULL [FK -> materials(id)]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
minimum_order_quantity NUMERIC(15,2) NULL
order_multiple NUMERIC(15,2) NULL
units_per_handling_unit NUMERIC(15,2) NULL
lead_time_days INTEGER NULL
preferred BOOLEAN NULL [DEFAULT: false]

---

## TABLE: supplier_product_links

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
supplier_id UUID NULL [FK -> suppliers(id)]
material_id UUID NULL [FK -> materials(id)]
moq NUMERIC(15,2) NULL
lead_time_days INTEGER NULL
unit_price NUMERIC(15,2) NULL
currency_code VARCHAR(3) NULL [DEFAULT: LKR]
is_preferred BOOLEAN NULL [DEFAULT: false]
created_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: suppliers

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
code VARCHAR(255) NULL
name VARCHAR(255) NOT NULL
contact_person VARCHAR(255) NULL
email VARCHAR(255) NULL
phone VARCHAR(255) NULL
address TEXT NULL
country VARCHAR(255) NULL
lead_time_days INTEGER NULL
rating NUMERIC(3,2) NULL
status VARCHAR(255) NULL [DEFAULT: active]
created_at TIMESTAMP NULL [DEFAULT: now()]
city VARCHAR(255) NULL
postal_code VARCHAR(20) NULL
country_code VARCHAR(255) NULL
currency_code VARCHAR(255) NULL [DEFAULT: LKR]
tax_id VARCHAR(50) NULL
risk_category VARCHAR(20) NULL
ai_rating_score NUMERIC(3,2) NULL
data_quality_tier VARCHAR(64) NULL
source_lineage JSONB NULL

---

## TABLE: supply_plans

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
material_id UUID NULL [FK -> materials(id)]
warehouse_id UUID NULL [FK -> warehouses(id)]
plan_year INTEGER NOT NULL
plan_month INTEGER NOT NULL
planned_quantity NUMERIC(15,2) NOT NULL
actual_quantity NUMERIC(15,2) NULL
variance NUMERIC(15,2) NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

## TABLE: tasks

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
task_number VARCHAR(50) NOT NULL
task_type VARCHAR(50) NOT NULL
warehouse_id UUID NULL [FK -> warehouses(id)]
assigned_to UUID NULL [FK -> users(id)]
priority VARCHAR(20) NULL [DEFAULT: normal]
status VARCHAR(50) NULL [DEFAULT: pending]
due_date TIMESTAMP NULL
completed_at TIMESTAMP NULL
location_code VARCHAR(50) NULL
reference_type VARCHAR(50) NULL
reference_id UUID NULL
notes TEXT NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
ai_suggested_sequence_order INTEGER NULL
ai_suggested_path JSONB NULL
ai_path_efficiency_score NUMERIC(5,2) NULL
completed_by UUID NULL [FK -> users(id)]
started_at TIMESTAMP NULL
dataset_version VARCHAR(128) NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]
handling_unit_seq INTEGER NULL [DEFAULT: 1]

---

## TABLE: users

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
username VARCHAR(255) NOT NULL
email VARCHAR(255) NULL
password_hash VARCHAR(255) NOT NULL
employee_id VARCHAR(255) NULL
first_name VARCHAR(255) NULL
last_name VARCHAR(255) NULL
role VARCHAR(255) NOT NULL
warehouse_id UUID NULL [FK -> warehouses(id)]
phone VARCHAR(255) NULL
avatar_url TEXT NULL
status VARCHAR(255) NULL [DEFAULT: active]
device_id VARCHAR(255) NULL
last_login_at TIMESTAMP NULL
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
blind_receiving_mode BOOLEAN NULL [DEFAULT: false]
dashboard_settings JSONB NULL [DEFAULT: {}]
dataset_version VARCHAR(128) NULL
source_lineage JSONB NOT NULL [DEFAULT: {}]

---

## TABLE: warehouse_location_route_access

graph_id UUID NOT NULL [PK] [FK -> warehouse_route_nodes(node_id)]
location_code VARCHAR(255) NOT NULL [PK]
access_node_id VARCHAR(160) NOT NULL [PK] [FK -> warehouse_route_nodes(node_id)]
access_side VARCHAR(16) NOT NULL
approach_distance_m NUMERIC(12,3) NOT NULL [DEFAULT: 0]
preferred BOOLEAN NOT NULL [DEFAULT: false]

---

## TABLE: warehouse_route_edges

graph_id UUID NOT NULL [PK] [FK -> warehouse_route_nodes(node_id)]
edge_id VARCHAR(220) NOT NULL [PK]
from_node_id VARCHAR(160) NOT NULL [FK -> warehouse_route_nodes(node_id)]
to_node_id VARCHAR(160) NOT NULL [FK -> warehouse_route_nodes(node_id)]
resource_key VARCHAR(220) NOT NULL
edge_type VARCHAR(32) NOT NULL
distance_m NUMERIC(12,3) NOT NULL
base_travel_seconds NUMERIC(12,3) NOT NULL
width_m NUMERIC(8,3) NULL
capacity INTEGER NOT NULL [DEFAULT: 1]
one_way BOOLEAN NOT NULL [DEFAULT: false]
turn_restricted BOOLEAN NOT NULL [DEFAULT: false]
metadata JSONB NOT NULL [DEFAULT: {}]

---

## TABLE: warehouse_route_graphs

id UUID NOT NULL [PK]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
dataset_version VARCHAR(128) NOT NULL
layout_version VARCHAR(128) NOT NULL
graph_hash VARCHAR(64) NOT NULL
status VARCHAR(24) NOT NULL [DEFAULT: ACTIVE]
node_count INTEGER NOT NULL [DEFAULT: 0]
edge_count INTEGER NOT NULL [DEFAULT: 0]
rack_footprint_count INTEGER NOT NULL [DEFAULT: 0]
generated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
retired_at TIMESTAMPTZ NULL

---

## TABLE: warehouse_route_nodes

graph_id UUID NOT NULL [PK] [FK -> warehouse_route_graphs(id)]
node_id VARCHAR(160) NOT NULL [PK]
node_type VARCHAR(32) NOT NULL
label VARCHAR(255) NULL
coordinate_x NUMERIC(12,3) NOT NULL
coordinate_y NUMERIC(12,3) NOT NULL
walkable BOOLEAN NOT NULL [DEFAULT: true]
metadata JSONB NOT NULL [DEFAULT: {}]

---

## TABLE: warehouses

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
code VARCHAR(50) NOT NULL
name VARCHAR(200) NOT NULL
address TEXT NULL
city VARCHAR(100) NULL
country VARCHAR(100) NULL [DEFAULT: Sri Lanka]
contact_person VARCHAR(200) NULL
phone VARCHAR(50) NULL
email VARCHAR(200) NULL
status VARCHAR(20) NULL [DEFAULT: active]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]
dataset_version VARCHAR(128) NULL [DEFAULT: OPERATIONAL_ENTRY]
source_lineage JSONB NOT NULL [DEFAULT: {}]

---

## TABLE: worker_achievements

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
worker_id UUID NULL [FK -> users(id)]
achievement_type VARCHAR(50) NOT NULL
earned_at TIMESTAMP NULL [DEFAULT: now()]
metadata JSONB NULL

---

## TABLE: worker_route_events

id BIGINT NOT NULL [PK] [DEFAULT: nextval('worker_route_events_id_seq']
session_id UUID NULL [FK -> worker_route_sessions(id)]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
worker_id UUID NULL [FK -> users(id)]
event_type VARCHAR(40) NOT NULL
node_id VARCHAR(160) NULL
location_code VARCHAR(255) NULL
route_version INTEGER NULL
payload JSONB NOT NULL [DEFAULT: {}]
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: worker_route_reservations

id UUID NOT NULL [PK]
session_id UUID NOT NULL [FK -> worker_route_sessions(id)]
route_version INTEGER NOT NULL
sequence_no INTEGER NOT NULL
resource_type VARCHAR(16) NOT NULL
resource_key VARCHAR(220) NOT NULL
from_node_id VARCHAR(160) NULL
to_node_id VARCHAR(160) NULL
reserved_from TIMESTAMPTZ NOT NULL
reserved_until TIMESTAMPTZ NOT NULL
status VARCHAR(16) NOT NULL [DEFAULT: RESERVED]
released_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: worker_route_sessions

id UUID NOT NULL [PK]
warehouse_id UUID NOT NULL [FK -> warehouses(id)]
graph_id UUID NOT NULL [FK -> warehouse_route_graphs(id)]
task_id UUID NULL [FK -> tasks(id)]
order_id UUID NULL [FK -> orders(id)]
worker_id UUID NOT NULL [FK -> users(id)]
operation_type VARCHAR(24) NOT NULL
vehicle_type VARCHAR(24) NOT NULL [DEFAULT: FORKLIFT]
status VARCHAR(24) NOT NULL [DEFAULT: PLANNED]
route_version INTEGER NOT NULL [DEFAULT: 1]
start_node_id VARCHAR(160) NOT NULL
current_node_id VARCHAR(160) NOT NULL
end_node_id VARCHAR(160) NULL
total_distance_m NUMERIC(14,3) NOT NULL [DEFAULT: 0]
estimated_travel_seconds NUMERIC(14,3) NOT NULL [DEFAULT: 0]
total_wait_seconds NUMERIC(14,3) NOT NULL [DEFAULT: 0]
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
cancelled_at TIMESTAMPTZ NULL
lease_expires_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]
updated_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: worker_route_stops

id UUID NOT NULL [PK]
session_id UUID NOT NULL [FK -> worker_route_sessions(id)]
sequence_no INTEGER NOT NULL
location_code VARCHAR(255) NOT NULL
access_node_id VARCHAR(160) NOT NULL
status VARCHAR(24) NOT NULL [DEFAULT: PENDING]
completed_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL [DEFAULT: now()]

---

## TABLE: yard_trailers

id UUID NOT NULL [PK] [DEFAULT: uuid_generate_v4()]
trailer_number VARCHAR(50) NOT NULL
warehouse_id UUID NULL [FK -> warehouses(id)]
carrier_name VARCHAR(200) NULL
inbound_order_id UUID NULL [FK -> orders(id)]
supplier_id UUID NULL [FK -> suppliers(id)]
arrived_at TIMESTAMP NULL
wait_time_minutes INTEGER NULL
status VARCHAR(20) NULL [DEFAULT: waiting]
assigned_dock_door_id UUID NULL [FK -> dock_doors(id)]
created_at TIMESTAMP NULL [DEFAULT: now()]
updated_at TIMESTAMP NULL [DEFAULT: now()]

---

================================================================================
FOREIGN KEY RELATIONSHIPS
================================================================================

ai_anomaly_detections:
location_id -> locations(id)
material_id -> materials(id)
reviewed_by -> users(id)
warehouse_id -> warehouses(id)

ai_demand_forecasts:
material_id -> materials(id)
warehouse_id -> warehouses(id)

ai_path_recommendations:
task_id -> tasks(id)

ai_slotting_recommendations:
material_id -> materials(id)
recommended_location_id -> locations(id)
warehouse_id -> warehouses(id)

ai_sourcing_recommendations:
material_id -> materials(id)
recommended_supplier_id -> suppliers(id)
warehouse_id -> warehouses(id)

bom_components:
bom_header_id -> bom_headers(id)
component_material_id -> materials(id)

bom_headers:
parent_material_id -> materials(id)
warehouse_id -> warehouses(id)

chat_messages:
session_id -> chat_sessions(id)

cycle_count_audit_logs:
cycle_count_id -> cycle_counts(id)
performed_by -> users(id)

cycle_count_recounts:
counted_by -> users(id)
cycle_count_id -> cycle_counts(id)

cycle_count_schedules:
created_by -> users(id)
warehouse_id -> warehouses(id)

cycle_counts:
approved_by -> users(id)
counted_by -> users(id)
material_id -> materials(id)
warehouse_id -> warehouses(id)

demand_history:
material_id -> materials(id)
warehouse_id -> warehouses(id)

dock_appointments:
dock_door_id -> dock_doors(id)
inbound_order_id -> orders(id)
outbound_order_id -> orders(id)
supplier_id -> suppliers(id)
warehouse_id -> warehouses(id)

dock_doors:
warehouse_id -> warehouses(id)

forecast_backfill_load_audit:
warehouse_id -> warehouses(id)

forecast_backtest_rows:
material_id -> materials(id)
warehouse_id -> warehouses(id)

forecast_jobs:
warehouse_id -> warehouses(id)

forecast_model_evidence:
warehouse_id -> warehouses(id)

forecast_outbound_history_backfill:
warehouse_id -> warehouses(id)

forecast_results:
material_id -> materials(id)
warehouse_id -> warehouses(id)

forecast_sku_mapping:
warehouse_id -> warehouses(id)
wms_material_id -> materials(id)

grns:
received_by -> users(id)
supplier_id -> suppliers(id)
warehouse_id -> warehouses(id)

inbound_putaway_allocation:
order_id -> orders(id)
order_item_id -> order_items(id)

inventory:
grn_id -> grns(id)
location_code -> locations(location_code)
material_id -> materials(id)
warehouse_id -> warehouses(id)

inventory_policy_recommendation_lines:
material_id -> materials(id)
run_id -> inventory_policy_recommendation_runs(id)

inventory_policy_recommendation_runs:
planning_cycle_id -> planning_cycles(id)
warehouse_id -> warehouses(id)

inventory_policy_simulation_evidence:
material_id -> materials(id)
policy_run_id -> inventory_policy_recommendation_runs(id)

location_levels:
location_id -> locations(id)

locations:
warehouse_id -> warehouses(id)

material_classification_history:
material_id -> materials(id)
run_id -> material_classification_runs(id)
warehouse_id -> warehouses(id)

material_classification_runs:
warehouse_id -> warehouses(id)

material_classification_thresholds:
run_id -> material_classification_runs(id)

material_default_locations:
location_code -> locations(location_code)
material_id -> materials(id)
warehouse_id -> warehouses(id)

material_issue_stats:
material_id -> materials(id)

material_issue_stats_rollup:
material_id -> materials(id)

material_planning:
material_id -> materials(id)
warehouse_id -> warehouses(id)

non_moving_items:
material_id -> materials(id)
warehouse_id -> warehouses(id)

notifications:
user_id -> users(id)
warehouse_id -> warehouses(id)

order_items:
material_id -> materials(id)
order_id -> orders(id)

order_number_aliases:
order_id -> orders(id)

orders:
created_by -> users(id)
customer_id -> customers(id)
packed_by -> users(id)
picked_by -> users(id)
received_by -> users(id)
shipped_by -> users(id)
supplier_id -> suppliers(id)
warehouse_id -> warehouses(id)

packing_records:
order_id -> orders(id)
packaging_type_id -> packaging_types(id)
packer_id -> users(id)

planning_cycles:
warehouse_id -> warehouses(id)

planning_decision_events:
planning_cycle_id -> planning_cycles(id)
warehouse_id -> warehouses(id)

project_dataset_load_audit:
warehouse_id -> warehouses(id)

putaway_planning_jobs:
order_id -> orders(id)
warehouse_id -> warehouses(id)

quality_check_logs:
approved_by -> users(id)
checked_by -> users(id)
grn_id -> grns(id)
material_id -> materials(id)

reports:
created_by -> users(id)

return_status_history:
return_id -> returns(id)

returns:
customer_id -> customers(id)
inspected_by -> users(id)
original_order_id -> orders(id)
received_by -> users(id)
warehouse_id -> warehouses(id)

scheduled_reports:
created_by -> users(id)

shipments:
order_id -> orders(id)

slotting_plan_lines:
material_id -> materials(id)
plan_id -> slotting_plans(id)

slotting_plan_reserve_lines:
plan_line_id -> slotting_plan_lines(id)

slotting_plans:
execution_transfer_id -> stock_transfers(id)
planning_cycle_id -> planning_cycles(id)

space_optimization_lines:
material_id -> materials(id)
run_id -> space_optimization_runs(id)
source_policy_line_id -> inventory_policy_recommendation_lines(id)

space_optimization_runs:
planning_cycle_id -> planning_cycles(id)
policy_run_id -> inventory_policy_recommendation_runs(id)
warehouse_id -> warehouses(id)

space_optimization_scenarios:
policy_line_id -> inventory_policy_recommendation_lines(id)
space_line_id -> space_optimization_lines(id)

stock_movements:
material_id -> materials(id)
warehouse_id -> warehouses(id)

stock_transfer_line_events:
transfer_line_id -> stock_transfer_lines(id)
worker_id -> users(id)

stock_transfer_lines:
assigned_worker_id -> users(id)
dest_warehouse_id -> warehouses(id)
material_id -> materials(id)
planning_cycle_id -> planning_cycles(id)
slotting_plan_line_id -> slotting_plan_lines(id)
source_warehouse_id -> warehouses(id)
transfer_id -> stock_transfers(id)

stock_transfers:
created_by -> users(id)
dest_warehouse_id -> warehouses(id)
dispatched_by -> users(id)
material_id -> materials(id)
planning_cycle_id -> planning_cycles(id)
received_by -> users(id)
released_by -> users(id)
source_warehouse_id -> warehouses(id)

supplier_constraints:
material_id -> materials(id)
supplier_id -> suppliers(id)

supplier_materials:
material_id -> materials(id)
supplier_id -> suppliers(id)

supplier_product_links:
material_id -> materials(id)
supplier_id -> suppliers(id)

supply_plans:
material_id -> materials(id)
warehouse_id -> warehouses(id)

tasks:
assigned_to -> users(id)
completed_by -> users(id)
warehouse_id -> warehouses(id)

users:
warehouse_id -> warehouses(id)

warehouse_location_route_access:
access_node_id -> warehouse_route_nodes(node_id)
graph_id -> warehouse_route_nodes(node_id)

warehouse_route_edges:
from_node_id -> warehouse_route_nodes(node_id)
graph_id -> warehouse_route_nodes(node_id)
to_node_id -> warehouse_route_nodes(node_id)

warehouse_route_graphs:
warehouse_id -> warehouses(id)

warehouse_route_nodes:
graph_id -> warehouse_route_graphs(id)

worker_achievements:
worker_id -> users(id)

worker_route_events:
session_id -> worker_route_sessions(id)
warehouse_id -> warehouses(id)
worker_id -> users(id)

worker_route_reservations:
session_id -> worker_route_sessions(id)

worker_route_sessions:
graph_id -> warehouse_route_graphs(id)
order_id -> orders(id)
task_id -> tasks(id)
warehouse_id -> warehouses(id)
worker_id -> users(id)

worker_route_stops:
session_id -> worker_route_sessions(id)

yard_trailers:
assigned_dock_door_id -> dock_doors(id)
inbound_order_id -> orders(id)
supplier_id -> suppliers(id)
warehouse_id -> warehouses(id)

================================================================================
