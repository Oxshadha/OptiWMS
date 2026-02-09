# Database Schema Alignment Analysis

## 📊 Executive Summary

This document analyzes the alignment between:
1. **Proposed Schema** (from WMS Database schema documentation.pdf)
2. **Actual Data** (from CSV files)
3. **Current Backend Implementation** (Java domain models)
4. **Frontend Requirements** (from implementation plan)

**Key Finding:** There are significant conflicts and gaps that need resolution before implementation.

---

## 1. Critical Conflicts

### 1.1 ID Type Mismatch

| Aspect | Proposed Schema | Actual Data | Current Backend | Conflict? |
|--------|----------------|-------------|----------------|-----------|
| **Primary Keys** | SERIAL (INTEGER) | Material Code (6-digit) | UUID | ⚠️ **YES** |
| **Material ID** | `sku_id VARCHAR(50)` | Material Code (100036, 101054) | UUID + materialCode String | ⚠️ **YES** |
| **Inventory ID** | `item_id SERIAL` | N/A | UUID | ⚠️ **YES** |

**Resolution:**
- ✅ **Keep UUID** for all primary keys (current backend approach is correct)
- ✅ **Use materialCode as unique business identifier** (not primary key)
- ✅ **Add materialCode as indexed unique field** in Material table

---

### 1.2 Material/Product Naming Conflict

| Proposed Schema | Actual Data | Current Backend | Issue |
|----------------|-------------|----------------|-------|
| `product` table with `sku_id` | `Material Code` | `Material` entity with `materialCode` | Terminology mismatch |

**Resolution:**
- ✅ **Use "Material" terminology** (matches actual data and Sri Lankan context)
- ✅ **Keep materialCode field** (6-digit codes like 100036)
- ✅ **Add sku_id as optional alias** if needed for future integration

---

### 1.3 Location Structure Mismatch

| Proposed Schema | Actual Data | Current Backend | Issue |
|----------------|-------------|----------------|-------|
| `wms_zone` → `wms_location` (zone_id FK) | Location codes: A-01-01-4-A | No zone concept, direct location | Missing zone hierarchy |

**Resolution:**
- ⚠️ **Actual data uses direct location codes** (A-01-01-4-A format)
- ⚠️ **Proposed schema has zone hierarchy** (warehouse → zone → location)
- ✅ **Current implementation plan uses direct locations** (correct for actual data)
- **Decision:** Use direct location structure, zones are optional enhancement

---

## 2. Missing Data Points in Proposed Schema

### 2.1 Material/Product Fields Missing

**From Actual Data (Active stock.csv):**
- ✅ `Material Code` - **EXISTS** (as materialCode)
- ✅ `Description` - **EXISTS**
- ✅ `Unit Type` (Bags, Drum, Reel, Can, Box) - **EXISTS** (as unitType)
- ❌ `Storage Type` (pallet vs non-pallet) - **PARTIALLY EXISTS** (storageType field exists but needs values)
- ❌ `Supply Plan` (monthly data: Jul SP, Aug SP, Sep SP, Oct SP, Nov SP) - **MISSING**
- ❌ `Buffer days` - **MISSING** (in Material, exists in InventoryItem)
- ❌ `Future average` - **MISSING**
- ❌ `Lead time` (days) - **EXISTS** (in InventoryItem, should be in Material too)
- ❌ `Lead time months` - **MISSING**
- ❌ `EX` (expected value) - **MISSING**
- ❌ `Variance (demand)` - **MISSING**
- ❌ `Variance lead time demand` - **MISSING**
- ❌ `ROP` (Reorder Point) - **EXISTS** (in InventoryItem)
- ❌ `ROP in days` - **MISSING**
- ❌ `Buffer stock` - **EXISTS** (in InventoryItem)
- ❌ `Maximum stock` - **EXISTS** (in InventoryItem)
- ❌ `Stacking quantity` - **EXISTS** (in InventoryItem)
- ❌ `MOQ` (Minimum Order Quantity) - **EXISTS** (in InventoryItem)
- ❌ `Order Delivery` (days) - **MISSING**
- ❌ `Order Quantity` - **MISSING**
- ❌ `Pallet requirement` - **MISSING**

**Action Required:**
- Add `supply_plan` table for monthly supply planning data
- Add missing fields to Material or create MaterialPlanning table
- Consider if some fields belong in Material vs InventoryItem

---

### 2.2 Inventory Fields Missing

**From Actual Data:**
- ✅ `Material Code` - **EXISTS** (via materialId FK)
- ✅ `Location Code` - **EXISTS** (as locationCode)
- ✅ `Quantity` - **EXISTS**
- ✅ `Buffer stock` - **EXISTS**
- ✅ `Max stock` - **EXISTS**
- ✅ `Stacking quantity` - **EXISTS**
- ✅ `MOQ` - **EXISTS**
- ✅ `Lead time days` - **EXISTS**
- ✅ `ROP` - **EXISTS**
- ❌ `Batch number` - **MISSING** (exists in proposed schema)
- ❌ `Expiry date` - **MISSING** (exists in proposed schema)
- ❌ `GRN ID` - **MISSING** (exists in proposed schema for traceability)
- ❌ `Last counted at` - **MISSING** (mentioned in implementation plan)

**Action Required:**
- Add batch tracking fields for traceability
- Add expiry date for FEFO (First-Expired-First-Out) logic
- Add GRN reference for traceability

---

### 2.3 Location Structure Missing

**From Actual Data:**
- Location codes follow pattern: `A-01-01-4-A` (Area-Row-Bay-Level-Bin)
- No zone concept in actual data
- Direct warehouse → location relationship

**Proposed Schema Has:**
- `warehouse` → `wms_zone` → `wms_location` hierarchy
- Zone types: PICKING, RESERVE, QUARANTINE, STAGING
- Storage conditions: AMBIENT, REFRIGERATED, HAZARDOUS

**Current Backend:**
- No location entity yet (needs to be created)

**Action Required:**
- Create `Location` entity matching actual data structure
- Zones are optional (can be derived from location codes)
- Add zone_type and storage_condition as optional fields

---

### 2.4 Non-Moving Items Tracking

**From Actual Data (Non Moving items.csv):**
- Material codes that haven't moved
- Supply plan shows 0 or "-" for these items

**Proposed Schema:**
- Has `inventory_anomaly` table but not specifically for non-moving items

**Action Required:**
- Add `non_moving_items` table or flag in inventory
- Track last movement date
- Days since last movement

---

### 2.5 Raw Materials Not in Pallets

**From Actual Data (Raw matrilas not store in pallets.csv):**
- Materials stored in tanks
- Third-party locations
- Special storage requirements

**Proposed Schema:**
- No specific handling for non-pallet storage

**Action Required:**
- Add `storage_type` field (already exists in Material)
- Add `storage_location_type` (WAREHOUSE, TANK, THIRD_PARTY)
- Add `third_party_location` field

---

## 3. Alignment with Frontend/Backend

### 3.1 Frontend Expectations

**From Frontend API Calls:**
- `warehousesApi.getAll()` - ✅ Backend has this
- `inventoryApi.getByMaterial()` - ⚠️ Needs enhancement
- `inventoryApi.quarantineBin()` - ❌ Missing
- `warehouseLayoutApi.getLayout()` - ❌ Missing
- `ordersApi.getByOrderNumber()` - ⚠️ Needs enhancement

**From Frontend Data Structures:**
- Material with materialCode, description, unitType - ✅ Matches
- Inventory with locationCode, quantity, status - ✅ Matches
- Warehouse with code, name, address - ✅ Matches

### 3.2 Backend Current State

**Domain Models:**
- ✅ `Material` - Has materialCode, description, unitType, storageType
- ✅ `InventoryItem` - Has most fields but missing some
- ✅ `Warehouse` - Complete
- ❌ `Location` - **MISSING** (needs to be created)
- ❌ `SupplyPlan` - **MISSING**
- ❌ `NonMovingItem` - **MISSING**

**Controllers:**
- ✅ Basic CRUD exists
- ⚠️ Missing enhanced queries (by material, by warehouse, etc.)
- ❌ Missing SOP-specific endpoints

---

## 4. Required Schema Changes

### 4.1 Material Table Enhancement

```sql
-- Current Material table needs these additions:
ALTER TABLE materials ADD COLUMN IF NOT EXISTS
    supply_plan_id UUID REFERENCES supply_plans(id),
    buffer_days INTEGER,
    future_average DECIMAL(15,2),
    lead_time_months DECIMAL(5,2),
    expected_value DECIMAL(15,2),
    variance_demand DECIMAL(15,2),
    variance_lead_time_demand DECIMAL(15,2),
    rop_days DECIMAL(10,2),
    order_delivery_days INTEGER,
    order_quantity DECIMAL(15,2),
    pallet_requirement DECIMAL(15,2);

-- Or create separate MaterialPlanning table for better normalization
CREATE TABLE material_planning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id),
    buffer_days INTEGER,
    future_average DECIMAL(15,2),
    lead_time_days INTEGER,
    lead_time_months DECIMAL(5,2),
    expected_value DECIMAL(15,2),
    variance_demand DECIMAL(15,2),
    variance_lead_time_demand DECIMAL(15,2),
    rop_days DECIMAL(10,2),
    order_delivery_days INTEGER,
    order_quantity DECIMAL(15,2),
    pallet_requirement DECIMAL(15,2),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 Supply Plan Table (NEW)

```sql
CREATE TABLE supply_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    plan_year INTEGER NOT NULL,
    plan_month INTEGER NOT NULL, -- 1-12
    planned_quantity DECIMAL(15,2) NOT NULL,
    actual_quantity DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(material_id, warehouse_id, plan_year, plan_month)
);
```

### 4.3 Location Table (NEW - Critical)

```sql
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id),
    location_code VARCHAR(50) UNIQUE NOT NULL, -- A-01-01-4-A
    area VARCHAR(10) NOT NULL, -- A, B, C, D, R
    row_number VARCHAR(10) NOT NULL, -- 01, 02, etc.
    bay_number VARCHAR(10) NOT NULL, -- 01, 02, etc.
    level_number INTEGER NOT NULL, -- 1-4
    bin_position VARCHAR(10) NOT NULL, -- A, B, C
    location_type VARCHAR(50), -- storage, picking, transit, quarantine
    zone_type VARCHAR(20), -- PICKING, RESERVE, QUARANTINE, STAGING (optional)
    storage_condition VARCHAR(20), -- AMBIENT, REFRIGERATED, HAZARDOUS (optional)
    capacity_vol_cm3 DECIMAL(15,2),
    max_weight_kg DECIMAL(15,2),
    is_active BOOLEAN DEFAULT TRUE,
    qr_code TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.4 Inventory Item Enhancement

```sql
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS
    batch_number VARCHAR(100),
    expiry_date DATE,
    grn_id UUID REFERENCES grns(id),
    last_counted_at TIMESTAMP,
    last_movement_date DATE,
    days_since_last_movement INTEGER;
```

### 4.5 Non-Moving Items Table (NEW)

```sql
CREATE TABLE non_moving_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    last_movement_date DATE,
    days_since_last_movement INTEGER,
    flagged_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'flagged' -- flagged, reviewed, action_taken
);
```

### 4.6 Material Storage Type Enhancement

```sql
ALTER TABLE materials ADD COLUMN IF NOT EXISTS
    storage_location_type VARCHAR(20) DEFAULT 'warehouse', -- warehouse, tank, third_party
    third_party_location VARCHAR(200),
    requires_pallet BOOLEAN DEFAULT TRUE;
```

---

## 5. Synthetic Data Generation Requirements

### 5.1 Must Use Actual Data

**From CSV Files:**
- ✅ **Material Codes** - Use actual codes (100036, 101054, etc.)
- ✅ **Descriptions** - Use actual descriptions
- ✅ **Unit Types** - Use actual types (Bags, Drum, Reel, Can, Box)
- ✅ **Supply Plan Data** - Use actual monthly supply plans
- ✅ **Inventory Levels** - Use actual stock quantities
- ✅ **Location Codes** - Generate based on A-01-01-4-A pattern
- ✅ **Non-Moving Items** - Use actual flagged materials

### 5.2 Can Be Synthetically Generated (Sri Lankan Context)

#### **Warehouses:**
- Names: "Colombo Main Warehouse", "Kandy Distribution Center", "Galle Storage Facility"
- Cities: Colombo, Kandy, Galle, Negombo, Kurunegala
- Addresses: Sri Lankan format (Street, City, Postal Code)
- Phone: +94-XX-XXXXXXX format
- Contact Persons: Sinhala/Tamil/English names

#### **Suppliers:**
- Names: Sri Lankan company names
- Locations: Major cities in Sri Lanka
- Contact: Sri Lankan phone/email formats
- Ratings: Based on lead time and quality (1.00-5.00)

#### **Customers:**
- Names: Sri Lankan business names
- Locations: Major cities
- Priority Tiers: GOLD, SILVER, BRONZE (based on lifetime value)
- Addresses: Sri Lankan format

#### **Users/Workers:**
- Names: Sinhala/Tamil/English names
- Employee IDs: EMP-XXXX format
- Roles: Based on SOP requirements (forklift_operator, picker, etc.)
- Phone: +94-XX-XXXXXXX format

#### **Orders:**
- Order Numbers: ORD-YYYY-XXXX format
- Dates: Recent dates (2024-2025)
- Quantities: Based on actual material MOQ and supply plans
- Status: Based on workflow (pending, received, picking, etc.)

#### **Locations:**
- Generate based on warehouse layout
- Follow A-01-01-4-A pattern
- Areas: A, B, C, D, R (Reserve)
- Rows: 01-50
- Bays: 01-20
- Levels: 1-4
- Bins: A, B, C

### 5.3 Data Generation Rules

1. **Material Data:**
   - Import from `Item code and descriptions.csv`
   - Import from `Active stock.csv` for inventory levels
   - Import from `Non Moving items.csv` for non-moving flags
   - Import from `Raw matrilas not store in pallets.csv` for storage types

2. **Supply Plan Data:**
   - Import monthly supply plans from `Active stock.csv`
   - Create records for Jul, Aug, Sep, Oct, Nov 2024

3. **Inventory Data:**
   - Use quantities from `Active stock.csv`
   - Assign to locations based on material type
   - Set buffer stock, max stock, MOQ from CSV

4. **Location Generation:**
   - Generate 100-200 locations per warehouse
   - Follow A-XX-XX-X-X pattern
   - Assign location types based on area (A-D = storage, R = reserve)

5. **Sri Lankan Context:**
   - All addresses in Sri Lankan format
   - Phone numbers: +94 format
   - Names: Mix of Sinhala, Tamil, English
   - Cities: Major Sri Lankan cities
   - Currency: LKR (Sri Lankan Rupees)

---

## 6. Implementation Priority

### Phase 1: Critical (Week 1)
1. ✅ Create `Location` table and entity
2. ✅ Enhance `Material` with missing fields
3. ✅ Create `SupplyPlan` table
4. ✅ Import actual material data from CSV

### Phase 2: Important (Week 2)
5. ✅ Enhance `InventoryItem` with batch/expiry/GRN
6. ✅ Create `NonMovingItems` table
7. ✅ Add material storage type enhancements
8. ✅ Import supply plan data

### Phase 3: Enhancement (Week 3)
9. ✅ Generate synthetic warehouses (Sri Lankan context)
10. ✅ Generate synthetic suppliers/customers
11. ✅ Generate synthetic users/workers
12. ✅ Generate synthetic orders based on actual materials

### Phase 4: Integration (Week 4)
13. ✅ Connect frontend to actual data
14. ✅ Test with real material codes
15. ✅ Validate location structure
16. ✅ Test supply plan queries

---

## 7. Schema Alignment Summary

| Component | Proposed Schema | Actual Data | Current Backend | Status | Action |
|-----------|----------------|-------------|----------------|--------|--------|
| **ID Type** | SERIAL | N/A | UUID | ✅ Correct | Keep UUID |
| **Material Code** | sku_id VARCHAR | 6-digit codes | materialCode String | ✅ Aligned | No change |
| **Material Fields** | Basic | Extended (30+ fields) | Basic (4 fields) | ⚠️ Incomplete | Add fields |
| **Location** | Zone hierarchy | Direct codes | Missing | ❌ Missing | Create Location |
| **Inventory** | Basic | Extended | Extended | ✅ Mostly aligned | Add batch/expiry |
| **Supply Plan** | Not in schema | Monthly data | Missing | ❌ Missing | Create table |
| **Non-Moving** | Not specific | Flagged items | Missing | ❌ Missing | Create table |
| **Storage Type** | Not specific | Tank/3rd party | Exists | ✅ Aligned | Enhance |

---

## 8. Recommendations

### 8.1 Immediate Actions
1. **Keep UUID approach** - Don't change to SERIAL
2. **Create Location entity** - Critical for warehouse operations
3. **Enhance Material entity** - Add planning fields or create separate table
4. **Create SupplyPlan table** - For monthly supply planning
5. **Import actual CSV data** - Use real material codes and descriptions

### 8.2 Data Import Strategy
1. Import materials from `Item code and descriptions.csv`
2. Import inventory from `Active stock.csv`
3. Import supply plans from `Active stock.csv` (monthly columns)
4. Flag non-moving items from `Non Moving items.csv`
5. Mark storage types from `Raw matrilas not store in pallets.csv`

### 8.3 Synthetic Data Strategy
1. Generate warehouses with Sri Lankan addresses
2. Generate suppliers with Sri Lankan company names
3. Generate customers with Sri Lankan business names
4. Generate users with Sri Lankan names and employee IDs
5. Generate orders linked to actual materials
6. Generate locations following A-XX-XX-X-X pattern

### 8.4 Schema Evolution
1. Start with direct location structure (no zones)
2. Add zones later if needed (can be derived from location codes)
3. Keep material planning separate for flexibility
4. Add batch/expiry tracking for traceability
5. Add GRN references for audit trail

---

## 9. Conclusion

**Key Findings:**
- ✅ UUID approach is correct (don't use SERIAL)
- ✅ Material terminology matches actual data
- ⚠️ Missing Location entity (critical)
- ⚠️ Missing SupplyPlan data structure
- ⚠️ Material entity needs enhancement
- ✅ Inventory mostly aligned
- ❌ Missing non-moving items tracking
- ❌ Missing batch/expiry tracking

**Next Steps:**
1. Create Location entity and table
2. Enhance Material with planning fields
3. Create SupplyPlan table
4. Import actual CSV data
5. Generate synthetic data with Sri Lankan context
6. Test with frontend integration

---

**Last Updated:** 2025-01-XX  
**Status:** Analysis Complete - Ready for Schema Updates

