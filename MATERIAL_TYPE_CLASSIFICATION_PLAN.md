# Material Type Classification & Inventory Enhancement Plan

## 📋 Overview

This plan addresses:
1. **Adding material_type to inventory table** (for filtering)
2. **Classifying existing materials** as `raw_material` or `packaging_material`
3. **Updating synthetic data generator** to only generate raw and packaging materials
4. **Mapping CSV columns** correctly between materials and inventory tables
5. **Updating APIs and frontend** to support material_type filtering

---

## 🎯 Column Mapping from Active stock.csv

### CSV Columns Analysis

From `Active stock.csv` header (row 1):
```
Material Code, (empty), Description, Supply Plan (Jul-Aug-Sep-Oct-Nov), 
Buffer days, future average, lead time, lead time months, EX, 
variance (demand), Variance lead time demand, ROP, ROP in days, 
Buffer stock, (empty), Maximum stock, Stacking quantity, MOQ, 
Difference, Order Delivery, Order Quantity, (empty), 
Pallet requirement, Pallet requirement (duplicate), (empty columns), 
Issuing, (more empty columns)
```

### Mapping Strategy

#### **Materials Table** (Product Catalog - Master Data)
**Purpose**: Define what materials exist in the system

| CSV Column | Materials Table Column | Notes |
|------------|----------------------|-------|
| Material Code | `material_code` | Unique identifier |
| (empty) | `unit_type` | Extracted from row data (Bags, Drum, Reel, etc.) |
| Description | `description` | Full description |
| - | `material_type` | **Classified**: `raw_material` or `packaging_material` |
| Buffer days | `buffer_days` | Planning field |
| future average | `future_average` | Demand forecast |
| lead time | `lead_time_days` | Convert months to days if needed |
| lead time months | `lead_time_months` | Original value |
| EX | `expected_value` | Expected demand value |
| variance (demand) | `variance_demand` | Demand variance |
| Variance lead time demand | `variance_lead_time_demand` | Lead time variance |
| ROP | `reorder_point` | Reorder point value |
| ROP in days | `rop_days` | Reorder point in days |
| Order Delivery | `order_delivery_days` | Delivery lead time |
| Order Quantity | `order_quantity` | Standard order quantity |
| Pallet requirement | `pallet_requirement` | Pallet space needed |

#### **Inventory Table** (Stock Levels - Transaction Data)
**Purpose**: Track actual stock quantities and locations

| CSV Column | Inventory Table Column | Notes |
|------------|----------------------|-------|
| Material Code | `material_id` | **Reference** to materials table |
| future average | `quantity` | **Current stock** (from "future average" column) |
| - | `available_quantity` | Same as quantity initially |
| - | `reserved_quantity` | Default 0 |
| Buffer stock | `buffer_stock` | Safety stock level |
| Maximum stock | `max_stock` | Maximum capacity |
| - | `min_stock` | Calculated or default |
| ROP | `reorder_point` | When to reorder |
| Stacking quantity | `stacking_quantity` | How many can stack |
| MOQ | `moq` | Minimum order quantity |
| lead time | `lead_time_days` | Lead time in days |
| - | `material_type` | **NEW**: Denormalized from materials table |
| - | `warehouse_id` | Default warehouse (WH-001) |
| - | `location_code` | To be assigned during putaway |
| - | `status` | `active`, `low_stock`, `out_of_stock`, `non_moving` |

---

## 🔧 Implementation Steps

### Step 1: Database Migration - Add material_type to Inventory

**File**: `V18__add_material_type_to_inventory.sql`

```sql
-- Add material_type to inventory table (denormalized for performance)
ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS material_type VARCHAR(20);

-- Populate material_type from materials table
UPDATE inventory i
SET material_type = m.material_type
FROM materials m
WHERE i.material_id = m.id;

-- Set default for any NULL values
UPDATE inventory 
SET material_type = 'raw_material' 
WHERE material_type IS NULL;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_inventory_material_type 
  ON inventory(material_type);

-- Add comment
COMMENT ON COLUMN inventory.material_type IS 
  'Denormalized material type for filtering: raw_material, packaging_material, product';
```

### Step 2: Material Classification Logic

**Classification Rules**:

```java
public String classifyMaterialType(String description, String unitType) {
    String descLower = description.toLowerCase();
    
    // Packaging materials
    if (descLower.contains("pouch") || 
        descLower.contains("pe back") || 
        descLower.contains("sheet") || 
        descLower.contains("woven") || 
        descLower.contains("paper") || 
        descLower.contains("reel") ||
        descLower.contains("tape") ||
        unitType != null && unitType.toLowerCase().contains("reel")) {
        return "packaging_material";
    }
    
    // Default: raw material
    return "raw_material";
}
```

### Step 3: Update CSV Importer

**File**: `CsvDataImporter.java`

- Classify materials during import
- Map CSV columns correctly to materials and inventory tables
- Set material_type in both tables

### Step 4: Update Synthetic Data Generator Guide

**File**: `SYNTHETIC_DATA_GENERATION_GUIDE.md`

- Remove product categories (household, personal_care, baby_care)
- Only generate `raw_material` and `packaging_material`
- Update `srilanka_seasonality.py` classification function

### Step 5: Update API Endpoints

**Files**: 
- `InventoryController.java`
- `InventoryDto.java`

**Changes**:
- Add `materialType` filter parameter
- Include `materialType` in response DTOs
- Update query methods to filter by material_type

### Step 6: Update Frontend

**File**: `frontend/app/admin/inventory/page.tsx`

**Changes**:
- Add material_type filter dropdown
- Filter inventory items by material_type
- Display material_type in table

---

## ✅ Validation Checklist

- [ ] Database migration runs successfully
- [ ] All existing materials are classified correctly
- [ ] Inventory items have material_type populated
- [ ] CSV import correctly classifies materials
- [ ] API endpoints support material_type filtering
- [ ] Frontend filters work correctly
- [ ] No data loss or conflicts
- [ ] Synthetic data generator only creates raw/packaging materials

---

## 🚨 Important Notes

1. **Denormalization**: `material_type` in inventory is denormalized for performance. It should be kept in sync with materials table.

2. **Backward Compatibility**: Existing inventory items will be updated with material_type from materials table.

3. **Future Products**: When products are added later, they will have `material_type = 'product'` and will appear in filters.

4. **No Breaking Changes**: All changes are additive - existing functionality remains intact.
