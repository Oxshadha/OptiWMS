# Supply Planning Data - Storage & Display Analysis

## 📊 Current Database Storage Status

### ✅ **Already Stored in Database**

#### **`materials` Table** (Material-Level Planning)
```sql
-- From V4 migration
lead_time_months DECIMAL(5,2)          -- ✅ Stored
future_average DECIMAL(15,2)          -- ✅ Stored
expected_value DECIMAL(15,2)          -- ✅ Stored (EX column)
variance_demand DECIMAL(15,2)         -- ✅ Stored
variance_lead_time_demand DECIMAL(15,2) -- ✅ Stored
rop_days DECIMAL(10,2)                -- ✅ Stored (ROP in days)
buffer_days INTEGER                    -- ✅ Stored
order_delivery_days INTEGER            -- ✅ Stored
order_quantity DECIMAL(15,2)          -- ✅ Stored
pallet_requirement DECIMAL(15,2)      -- ✅ Stored
min_order_quantity DECIMAL(15,2)     -- ✅ Stored (MOQ at material level)
```

#### **`inventory` Table** (Warehouse-Specific Planning)
```sql
-- From V1 migration
buffer_stock DECIMAL(15,2)            -- ✅ Stored
max_stock DECIMAL(15,2)               -- ✅ Stored (Maximum stock)
min_stock DECIMAL(15,2)               -- ✅ Stored
reorder_point DECIMAL(15,2)           -- ✅ Stored (ROP)
stacking_quantity INTEGER             -- ✅ Stored
moq DECIMAL(15,2)                     -- ✅ Stored (Minimum Order Quantity)
lead_time_days INTEGER                -- ✅ Stored
```

---

## ⚠️ **Partially Implemented**

### 1. **Supply Plan (Monthly Forecasts)**
**Columns from CSV**: `Sep 19`, `Oct 19`, `Nov 19`, `Jan`, etc.

**Current Status**: 
- ✅ **Table EXISTS**: `supply_plans` table created in V4 migration
- ❌ **Data NOT Stored**: CSV importer parses it but doesn't save (TODO comment)
- ❌ **Entity Missing**: No `SupplyPlanEntity` or repository

**Table Structure** (already exists):
```sql
CREATE TABLE supply_plans (
    id UUID PRIMARY KEY,
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    plan_year INTEGER NOT NULL,
    plan_month INTEGER NOT NULL CHECK (plan_month BETWEEN 1 AND 12),
    planned_quantity DECIMAL(15,2) NOT NULL,
    actual_quantity DECIMAL(15,2),
    variance DECIMAL(15,2),
    UNIQUE(material_id, warehouse_id, plan_year, plan_month)
);
```

**Action Required**: 
1. Create `SupplyPlanEntity` and repository
2. Update CSV importer to save supply plan data
3. Create API endpoints to query supply plans

---

## 🏗️ **Industry Best Practices (Existing WMS Systems)**

### **How SAP, Oracle WMS, Manhattan WMS Handle This:**

#### **1. Material Planning Fields**
- **Location**: `materials` table (master data)
- **Who Sees**: Admin, Procurement, Planning teams
- **Purpose**: Material-level defaults, used across all warehouses

#### **2. Inventory Planning Fields**
- **Location**: `inventory` table (warehouse-specific)
- **Who Sees**: Warehouse Manager, Inventory Manager
- **Purpose**: Warehouse-specific overrides (different ROP per warehouse)

#### **3. Supply Plan (Forecasts)**
- **Location**: Separate `supply_plans` or `demand_forecasts` table
- **Structure**: Time-series (material_id, warehouse_id, period, quantity)
- **Who Sees**: Admin, Planning, Procurement
- **Purpose**: Monthly/quarterly demand forecasts

#### **4. Display Strategy**
- **Admin Dashboard**: Full planning view (all fields + forecasts)
- **Warehouse Manager**: Inventory view (current stock + reorder points)
- **Procurement**: Reorder alerts (items below ROP)

---

## 🎯 **Recommended Implementation**

### **Option 1: Full Implementation (Recommended)**

#### **Step 1: Create Supply Plans Table**
```sql
CREATE TABLE supply_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id),
    warehouse_id UUID REFERENCES warehouses(id),
    period_date DATE NOT NULL,  -- First day of month (2024-09-01)
    planned_quantity DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(material_id, warehouse_id, period_date)
);

CREATE INDEX idx_supply_plans_material ON supply_plans(material_id);
CREATE INDEX idx_supply_plans_warehouse ON supply_plans(warehouse_id);
CREATE INDEX idx_supply_plans_period ON supply_plans(period_date);
```

#### **Step 2: Update CSV Importer**
- Store monthly supply plan data in `supply_plans` table
- Link to material and warehouse

#### **Step 3: Frontend Views**

**Admin View** (`/admin/materials/{id}/planning`):
- Material-level planning fields
- Supply plan chart (monthly forecasts)
- All warehouses' inventory planning

**Warehouse Manager View** (`/admin/inventory`):
- Current stock levels
- Reorder points
- Buffer stock
- Alerts (below ROP, low stock)

---

### **Option 2: Simplified (Quick Fix)**

**Store supply plan as JSON in `materials` table:**
```sql
ALTER TABLE materials ADD COLUMN supply_plan JSONB;
-- Store: {"2024-09": 1000, "2024-10": 1200, ...}
```

**Pros**: Quick to implement
**Cons**: Harder to query, not normalized

---

## 📋 **What Should Be Shown to Users**

### **Admin Users**
✅ **Full Access**:
- Material catalog with all planning fields
- Supply plan forecasts (monthly charts)
- All warehouses' inventory planning
- Reorder alerts across all warehouses
- Procurement recommendations

**Pages**:
- `/admin/materials` - Product catalog
- `/admin/materials/{id}/planning` - Detailed planning view
- `/admin/inventory` - All warehouses inventory
- `/admin/procurement` - Reorder alerts

### **Warehouse Manager**
✅ **Warehouse-Specific**:
- Their warehouse's inventory levels
- Reorder points for their warehouse
- Buffer stock alerts
- Stock movements in their warehouse

**Pages**:
- `/admin/inventory` - Filtered to their warehouse
- `/admin/inventory/{id}` - Item details with planning

---

## 🔧 **Implementation Plan**

### **Phase 1: Fix Missing Supply Plans (High Priority)**
1. Create `supply_plans` table migration
2. Update CSV importer to store supply plans
3. Add API endpoints for supply plan queries
4. Display in admin planning view

### **Phase 2: Expose Planning Fields (Medium Priority)**
1. Add planning fields to Material DTO
2. Create planning detail page for materials
3. Show supply plan charts
4. Add reorder alerts

### **Phase 3: Role-Based Views (Medium Priority)**
1. Filter inventory by warehouse for warehouse managers
2. Show only relevant planning fields per role
3. Add procurement dashboard for admins

---

## 📊 **Data Flow (Industry Standard)**

```
CSV Import
    ↓
Materials Table (master data)
    ├─→ Material-level planning fields
    └─→ Supply Plans Table (monthly forecasts)
         ↓
Inventory Table (warehouse-specific)
    ├─→ Warehouse-specific ROP, buffer stock
    └─→ Current stock levels
         ↓
Frontend Display
    ├─→ Admin: Full planning view
    └─→ Warehouse Manager: Inventory view
```

---

## ✅ **Summary**

**What's Stored**: ✅ Most planning fields (ROP, buffer stock, MOQ, lead time, etc.)
**What's Missing**: ❌ Supply plan monthly forecasts (time-series data)
**Where to Store**: `supply_plans` table (separate time-series table)
**Who Should See**:
- **Admin**: Everything (full planning + forecasts)
- **Warehouse Manager**: Their warehouse inventory + reorder points

**Next Steps**: Create `supply_plans` table and update CSV importer to store monthly forecasts.
