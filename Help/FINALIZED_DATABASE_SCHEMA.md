# Finalized Database Schema - OptiWMS

## 📋 Overview

This document describes the **finalized database schema** for OptiWMS that:
- ✅ Supports **international suppliers, couriers, and customers** (India, China, etc.)
- ✅ Manages **both Raw Materials and Finished Goods**
- ✅ Includes **AI service fields** (optional - core WMS works independently)
- ✅ Uses **actual CSV data as template** for synthetic generation
- ✅ Enables **AI model training** with real data

---

## 🎯 Key Design Principles

### 1. Core WMS Independence
- **Core WMS works without AI services**
- All AI fields are **optional** (can be NULL)
- AI tables are **separate** and can be ignored if AI services are unavailable
- Manual operations work perfectly without AI

### 2. International Support
- **Suppliers**: Can be from any country (India, China, Sri Lanka, etc.)
- **Couriers/Delivery Partners**: International carriers (DHL, FedEx) and local
- **Customers**: Can be from various countries (rarely, but supported)
- **Country codes**: ISO 3-letter codes (LKA, IND, CHN, etc.)
- **Currency codes**: Multi-currency support (LKR, USD, INR, CNY, etc.)

### 3. Material Type Support
- **Raw Materials**: Materials used in production
- **Finished Goods**: Completed products ready for sale
- **Components**: Sub-assemblies or intermediate products
- Both types managed in same `materials` table with `material_type` field

### 4. Actual Data as Template
- **Material codes**: Use actual 6-digit codes from CSV
- **Descriptions**: Use actual descriptions
- **Unit types**: Use actual types (Bags, Drum, Reel, Can, Box)
- **Supply plans**: Use actual monthly supply plan data
- **Inventory levels**: Use actual stock quantities
- **Synthetic data**: Generated based on actual data patterns

---

## 📊 Schema Structure

### Core Tables (Required for WMS)

#### 1. **materials** - Enhanced
```sql
-- Key Fields:
material_code VARCHAR(50) UNIQUE -- Actual 6-digit codes (100036, 101054)
material_type VARCHAR(20) -- raw_material, finished_good, component
description TEXT -- Actual descriptions from CSV
unit_type VARCHAR(20) -- Bags, Drum, Reel, Can, Box (from CSV)
storage_location_type VARCHAR(20) -- warehouse, tank, third_party
requires_pallet BOOLEAN -- TRUE for most, FALSE for tank storage

-- Planning Fields (from CSV):
buffer_days INTEGER
future_average DECIMAL(15,2)
lead_time_months DECIMAL(5,2)
expected_value DECIMAL(15,2)
variance_demand DECIMAL(15,2)
variance_lead_time_demand DECIMAL(15,2)
rop_days DECIMAL(10,2)
order_delivery_days INTEGER
order_quantity DECIMAL(15,2)
pallet_requirement DECIMAL(15,2)

-- AI Fields (Optional):
ai_min_stock DECIMAL(15,2) -- NULL if AI not used
reorder_method VARCHAR(20) -- STATIC (default) or AI_DYNAMIC
```

#### 2. **inventory** - Enhanced
```sql
-- Core Fields:
material_id UUID -- Links to materials
warehouse_id UUID
location_code VARCHAR(50) -- A-01-01-4-A format
quantity DECIMAL(15,2)
available_quantity DECIMAL(15,2)
reserved_quantity DECIMAL(15,2)

-- Planning Fields (from CSV):
buffer_stock DECIMAL(15,2)
max_stock DECIMAL(15,2)
min_stock DECIMAL(15,2)
reorder_point DECIMAL(15,2)
stacking_quantity INTEGER
moq DECIMAL(15,2)
lead_time_days INTEGER

-- Traceability:
batch_number VARCHAR(100) -- For FEFO
expiry_date DATE -- For FEFO
grn_id UUID -- Links to GRN for traceability
last_movement_date DATE
days_since_last_movement INTEGER

-- AI Fields (Optional):
ai_suggested_location_code VARCHAR(50) -- NULL if AI not used
ai_confidence_score DECIMAL(5,4) -- NULL if AI not used
```

#### 3. **suppliers** - International Support
```sql
-- Core Fields:
code VARCHAR(50) UNIQUE
name VARCHAR(200)
contact_person VARCHAR(200)
email VARCHAR(200)
phone VARCHAR(50)

-- International Support:
address TEXT
city VARCHAR(100)
country VARCHAR(100) -- Can be "India", "China", "Sri Lanka", etc.
country_code VARCHAR(3) -- ISO code: IND, CHN, LKA
postal_code VARCHAR(20)
currency_code VARCHAR(3) -- USD, INR, CNY, LKR
tax_id VARCHAR(50)

-- Business Fields:
lead_time_days INTEGER
rating DECIMAL(3,2) -- Manual rating

-- AI Fields (Optional):
risk_category VARCHAR(20) -- LOW, MEDIUM, HIGH (AI-calculated)
ai_rating_score DECIMAL(3,2) -- AI-calculated rating
```

#### 4. **delivery_partners** - International Courier Support
```sql
-- Core Fields:
partner_code VARCHAR(50) UNIQUE
company_name VARCHAR(200) -- "DHL", "FedEx", "Local Courier"
contact_person VARCHAR(200)
email VARCHAR(200)
phone VARCHAR(50)

-- International Support:
address TEXT
city VARCHAR(100)
country VARCHAR(100) -- Can be "India", "China", "Sri Lanka", etc.
country_code VARCHAR(3) -- ISO code
postal_code VARCHAR(20)
currency_code VARCHAR(3)
carrier_type VARCHAR(20) -- LOCAL, INTERNATIONAL, BOTH
international_coverage TEXT[] -- Array of countries served
tax_id VARCHAR(50)

-- Business Fields:
rating DECIMAL(3,2)
cost_per_delivery DECIMAL(10,2)
on_time_delivery_rate DECIMAL(5,2)
```

#### 5. **customers** - International Support
```sql
-- Core Fields:
code VARCHAR(50) UNIQUE
name VARCHAR(200)
email VARCHAR(200)
phone VARCHAR(50)

-- International Support:
address TEXT
city VARCHAR(100)
country VARCHAR(100) -- Can be various countries (rarely)
country_code VARCHAR(3) -- ISO code
postal_code VARCHAR(20)
currency_code VARCHAR(3) -- Default LKR, but can be other currencies
tax_id VARCHAR(50)

-- Business Fields:
priority_tier VARCHAR(20) -- GOLD, SILVER, BRONZE
lifetime_value DECIMAL(15,2)
```

#### 6. **supply_plans** - Monthly Supply Planning
```sql
-- Links to actual CSV monthly data:
material_id UUID
warehouse_id UUID
plan_year INTEGER -- 2024, 2025, etc.
plan_month INTEGER -- 1-12 (Jul=7, Aug=8, Sep=9, Oct=10, Nov=11)
planned_quantity DECIMAL(15,2) -- From CSV: Jul SP, Aug SP, etc.
actual_quantity DECIMAL(15,2) -- Actual received
variance DECIMAL(15,2) -- actual - planned
```

#### 7. **locations** - Warehouse Locations
```sql
-- Core Fields:
warehouse_id UUID
location_code VARCHAR(50) UNIQUE -- A-01-01-4-A format
area VARCHAR(10) -- A, B, C, D, R
row_number VARCHAR(10) -- 01, 02, etc.
bay_number VARCHAR(10) -- 01, 02, etc.
level_number INTEGER -- 1-4
bin_position VARCHAR(10) -- A, B, C
location_type VARCHAR(50) -- storage, picking, transit, quarantine

-- AI Pathfinding Support (Optional):
x_coord DECIMAL(10,2) -- For AI pathfinding algorithms
y_coord DECIMAL(10,2)
z_coord DECIMAL(10,2)

-- AI Slotting Support (Optional):
ai_optimal_for_material_types TEXT[] -- NULL if AI not used
ai_velocity_score DECIMAL(5,2) -- NULL if AI not used
```

### AI Service Tables (Optional)

#### 8. **ai_demand_forecasts**
```sql
-- For AI demand forecasting service:
material_id UUID
warehouse_id UUID
forecast_date DATE -- Future date being predicted
predicted_quantity DECIMAL(15,2)
confidence_score DECIMAL(5,4) -- 0.0-1.0
model_version VARCHAR(50)
```

#### 9. **ai_sourcing_recommendations**
```sql
-- For AI procurement agent:
material_id UUID
trigger_event VARCHAR(50) -- LOW_STOCK, DEMAND_SPIKE, LEAD_TIME_RISK
recommended_action VARCHAR(50) -- PURCHASE, TRANSFER, WAIT
recommended_quantity DECIMAL(15,2)
recommended_supplier_id UUID
calculated_roi DECIMAL(10,2)
space_freed_via_ga DECIMAL(15,2) -- Genetic Algorithm optimization
llm_justification TEXT -- Natural language explanation
status VARCHAR(20) -- PENDING, APPROVED, IGNORED, EXECUTED
```

#### 10. **ai_slotting_recommendations**
```sql
-- For AI optimal storage (GA-based):
material_id UUID
recommended_location_code VARCHAR(50)
ga_fitness_score DECIMAL(10,4) -- Genetic Algorithm fitness
space_utilization_improvement DECIMAL(5,2)
velocity_score DECIMAL(5,2)
compatibility_score DECIMAL(5,2)
status VARCHAR(20) -- PENDING, APPLIED, REJECTED
```

#### 11. **ai_path_recommendations**
```sql
-- For AI optimal picking/putaway paths:
task_id UUID
task_type VARCHAR(50) -- picking, putaway
recommended_path JSONB -- Array of location coordinates
estimated_time_minutes DECIMAL(10,2)
estimated_distance_meters DECIMAL(10,2)
efficiency_score DECIMAL(5,2)
algorithm_used VARCHAR(50) -- A_STAR, GENETIC_ALGORITHM
status VARCHAR(20) -- PENDING, APPLIED, REJECTED
```

#### 12. **ai_anomaly_detections**
```sql
-- For AI anomaly detection:
anomaly_type VARCHAR(50) -- INVENTORY_VARIANCE, DEMAND_SPIKE, etc.
material_id UUID
warehouse_id UUID
detected_value DECIMAL(15,2)
expected_value DECIMAL(15,2)
variance_percentage DECIMAL(10,4)
severity VARCHAR(20) -- LOW, MEDIUM, HIGH, CRITICAL
confidence_score DECIMAL(5,4)
status VARCHAR(20) -- DETECTED, REVIEWED, RESOLVED
```

---

## 🌍 International Support Examples

### Suppliers

**Sri Lankan Supplier:**
```sql
INSERT INTO suppliers (code, name, country, country_code, currency_code) VALUES
('SUP-LKA-001', 'Colombo Chemical Suppliers', 'Sri Lanka', 'LKA', 'LKR');
```

**Indian Supplier:**
```sql
INSERT INTO suppliers (code, name, country, country_code, currency_code) VALUES
('SUP-IND-001', 'Mumbai Raw Materials Ltd', 'India', 'IND', 'INR');
```

**Chinese Supplier:**
```sql
INSERT INTO suppliers (code, name, country, country_code, currency_code) VALUES
('SUP-CHN-001', 'Shanghai Chemical Co', 'China', 'CHN', 'CNY');
```

### Delivery Partners

**International Courier (DHL):**
```sql
INSERT INTO delivery_partners (partner_code, company_name, country, carrier_type, international_coverage) VALUES
('DP-DHL', 'DHL Express', 'Germany', 'INTERNATIONAL', ARRAY['LKA', 'IND', 'CHN', 'USA', 'GBR']);
```

**Local Courier:**
```sql
INSERT INTO delivery_partners (partner_code, company_name, country, carrier_type) VALUES
('DP-LOCAL-001', 'Colombo Express', 'Sri Lanka', 'LOCAL');
```

### Customers

**Sri Lankan Customer:**
```sql
INSERT INTO customers (code, name, country, country_code, currency_code) VALUES
('CUST-LKA-001', 'Kandy Supermarket', 'Sri Lanka', 'LKA', 'LKR');
```

**Foreign Customer (Rare):**
```sql
INSERT INTO customers (code, name, country, country_code, currency_code) VALUES
('CUST-IND-001', 'Mumbai Retail Chain', 'India', 'IND', 'INR');
```

---

## 📦 Material Type Management

### Raw Materials
```sql
-- Example: CAUSTIC SODA (from CSV)
INSERT INTO materials (material_code, description, material_type, unit_type) VALUES
('100036', 'CAUSTIC SODA', 'raw_material', 'Bags');
```

### Finished Goods
```sql
-- Example: Finished product
INSERT INTO materials (material_code, description, material_type, unit_type) VALUES
('FG-001', 'Baby Care Product - Packed', 'finished_good', 'Box');
```

### Querying by Type
```sql
-- Get all raw materials
SELECT * FROM materials WHERE material_type = 'raw_material';

-- Get all finished goods
SELECT * FROM materials WHERE material_type = 'finished_good';
```

---

## 🤖 AI Service Integration (Optional)

### How Core WMS Works Without AI

**Manual Inventory Management:**
```sql
-- Core WMS uses static_min_stock (manual)
UPDATE inventory SET 
    min_stock = 1000,
    max_stock = 5000
WHERE material_id = '...';

-- AI field (ai_suggested_location_code) is NULL - ignored
```

**Manual Task Assignment:**
```sql
-- Core WMS uses manual sequence
INSERT INTO tasks (task_type, assigned_to, ...) VALUES
('picking', user_id, ...);

-- AI field (ai_suggested_sequence_order) is NULL - ignored
```

### How AI Enhances (When Available)

**AI Suggests Optimal Location:**
```sql
-- AI service populates suggestion
UPDATE inventory SET
    ai_suggested_location_code = 'A-05-10-2-B',
    ai_confidence_score = 0.85
WHERE material_id = '...';

-- User can accept or reject
-- Core WMS still works if rejected
```

**AI Suggests Optimal Path:**
```sql
-- AI service creates path recommendation
INSERT INTO ai_path_recommendations (task_id, recommended_path, efficiency_score) VALUES
(task_id, '{"path": [{"x": 10, "y": 20}, ...]}', 92.5);

-- User can apply or ignore
-- Core WMS uses manual path if ignored
```

---

## 📊 Data Import Strategy

### 1. Import Actual Materials
```sql
-- From: Item code and descriptions.csv
-- Import all 300+ materials with actual codes
INSERT INTO materials (material_code, description, unit_type) VALUES
('100036', 'CAUSTIC SODA', 'Bags'),
('101054', 'CALCIUM CARBONATE ( GROUND )', 'Bags'),
-- ... all materials from CSV
```

### 2. Import Supply Plans
```sql
-- From: Active stock.csv (monthly columns)
-- Import Jul, Aug, Sep, Oct, Nov supply plans
INSERT INTO supply_plans (material_id, warehouse_id, plan_year, plan_month, planned_quantity) VALUES
(material_id, warehouse_id, 2024, 7, 116865), -- Jul SP
(material_id, warehouse_id, 2024, 8, 65374),  -- Aug SP
-- ... for all materials
```

### 3. Import Inventory Data
```sql
-- From: Active stock.csv
-- Import quantities, buffer stock, max stock, MOQ, etc.
INSERT INTO inventory (material_id, warehouse_id, quantity, buffer_stock, max_stock, moq, stacking_quantity) VALUES
(material_id, warehouse_id, 52110, 42109.76, 1000, 10000, 488),
-- ... for all materials
```

### 4. Flag Non-Moving Items
```sql
-- From: Non Moving items.csv
INSERT INTO non_moving_items (material_id, warehouse_id, flagged_at) VALUES
(material_id, warehouse_id, NOW());
```

### 5. Mark Non-Pallet Storage
```sql
-- From: Raw matrilas not store in pallets.csv
UPDATE materials SET
    requires_pallet = FALSE,
    storage_location_type = 'tank'
WHERE material_code IN ('100200', '100756', ...);
```

---

## 🔄 Synthetic Data Generation (Based on Actual Data)

### Generate Suppliers (International)
```java
// Use actual material codes to generate realistic suppliers
// Mix of Sri Lankan, Indian, Chinese suppliers
Supplier sriLankan = generateSupplier("Colombo Chemical", "Sri Lanka", "LKA", "LKR");
Supplier indian = generateSupplier("Mumbai Raw Materials", "India", "IND", "INR");
Supplier chinese = generateSupplier("Shanghai Chemical Co", "China", "CHN", "CNY");
```

### Generate Delivery Partners (International)
```java
// International couriers
DeliveryPartner dhl = generateCourier("DHL Express", "Germany", "INTERNATIONAL", 
    Arrays.asList("LKA", "IND", "CHN", "USA"));
DeliveryPartner fedex = generateCourier("FedEx", "USA", "INTERNATIONAL", 
    Arrays.asList("LKA", "IND", "CHN"));

// Local couriers
DeliveryPartner local = generateCourier("Colombo Express", "Sri Lanka", "LOCAL");
```

### Generate Customers (Mostly Sri Lankan, Rarely Foreign)
```java
// 90% Sri Lankan customers
for (int i = 0; i < 27; i++) {
    generateCustomer("Customer " + i, "Sri Lanka", "LKA", "LKR");
}

// 10% Foreign customers (rarely)
generateCustomer("Mumbai Retail", "India", "IND", "INR");
generateCustomer("Singapore Store", "Singapore", "SGP", "SGD");
```

### Generate Locations (Based on Actual Pattern)
```java
// Use actual location code pattern: A-01-01-4-A
for (String area : Arrays.asList("A", "B", "C", "D", "R")) {
    for (int row = 1; row <= 50; row++) {
        for (int bay = 1; bay <= 20; bay++) {
            for (int level = 1; level <= 4; level++) {
                for (String bin : Arrays.asList("A", "B", "C")) {
                    String locationCode = String.format("%s-%02d-%02d-%d-%s", 
                        area, row, bay, level, bin);
                    generateLocation(warehouse, locationCode, area, row, bay, level, bin);
                }
            }
        }
    }
}
```

---

## 🎓 AI Model Training Data

### Training Data Sources

1. **Actual Material Data** (300+ materials)
   - Material codes, descriptions, unit types
   - Supply plans (monthly)
   - Inventory levels
   - Movement patterns

2. **Actual Inventory Data**
   - Quantities, buffer stock, max stock
   - MOQ, lead times
   - Non-moving items
   - Storage types

3. **Synthetic Operational Data** (Inspired by Actual)
   - Orders (using actual materials)
   - Picking/putaway tasks
   - Stock movements
   - Cycle counts

### AI Training Tables

**For Demand Forecasting:**
- Use `supply_plans` table (actual monthly data)
- Use `stock_movements` table (historical movements)
- Use `orders` table (historical orders)

**For Slotting Optimization (GA):**
- Use `inventory` table (current locations)
- Use `stock_movements` table (movement frequency)
- Use `locations` table (available locations)

**For Anomaly Detection:**
- Use `inventory` table (quantity variances)
- Use `cycle_counts` table (count variances)
- Use `stock_movements` table (unusual patterns)

**For Path Optimization:**
- Use `tasks` table (picking/putaway tasks)
- Use `locations` table (coordinates)
- Use `stock_movements` table (movement patterns)

---

## ✅ Migration Checklist

- [x] Enhanced materials table with planning fields
- [x] Enhanced materials table with material_type (raw/finished)
- [x] Enhanced suppliers with international support
- [x] Enhanced delivery_partners with international support
- [x] Enhanced customers with international support
- [x] Created supply_plans table
- [x] Created material_planning table
- [x] Enhanced inventory with batch/expiry
- [x] Enhanced inventory with AI fields (optional)
- [x] Enhanced locations with AI pathfinding support
- [x] Created AI service tables (all optional)
- [x] Created supplier_product_links table
- [x] Created grns table for traceability
- [x] Created quality_check_logs table
- [x] All AI fields are nullable (core WMS works without AI)

---

## 🚀 Next Steps

1. **Run Migration:**
   ```bash
   # Migration file: V4__finalized_schema_with_ai_support.sql
   # Flyway will apply automatically
   ```

2. **Import Actual Data:**
   - Import materials from CSV
   - Import supply plans from CSV
   - Import inventory data from CSV
   - Flag non-moving items
   - Mark non-pallet storage

3. **Generate Synthetic Data:**
   - Generate international suppliers
   - Generate international couriers
   - Generate customers (mostly Sri Lankan)
   - Generate locations
   - Generate orders (using actual materials)

4. **Test Core WMS:**
   - Verify core WMS works without AI
   - Test manual operations
   - Test international suppliers/couriers

5. **Test AI Integration (Optional):**
   - Populate AI fields
   - Test AI suggestions
   - Verify graceful degradation

---

**Last Updated:** 2025-01-XX  
**Status:** Finalized - Ready for Implementation  
**Migration File:** `V4__finalized_schema_with_ai_support.sql`

