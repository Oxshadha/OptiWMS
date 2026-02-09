# Material Type Storage - Robust Implementation

## 📊 Where Material Types Are Stored

### Database Structure

**Table**: `materials`
**Column**: `material_type` (VARCHAR(20))
**Location**: `/backend/infra/src/main/resources/db/migration/V4__finalized_schema_with_ai_support.sql`

```sql
ALTER TABLE materials ADD COLUMN IF NOT EXISTS material_type VARCHAR(20) DEFAULT 'raw_material';
```

**Valid Values** (enforced by CHECK constraint):
- `raw_material` - Raw materials
- `packaging_material` - Packaging materials  
- `product` - Finished goods/products

### Denormalized in Inventory Table

**Table**: `inventory`
**Column**: `material_type` (VARCHAR(20))
**Location**: `/backend/infra/src/main/resources/db/migration/V18__add_material_type_to_inventory.sql`

This is **denormalized** (duplicated) for performance - allows filtering inventory by type without JOINs.

```sql
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS material_type VARCHAR(20);
```

**Why Denormalized?**
- ✅ Faster queries (no JOIN needed)
- ✅ Better filtering performance
- ✅ Industry best practice for high-volume inventory systems
- ⚠️ Must be kept in sync with `materials` table

---

## 🔧 Robust Implementation (3-Layer Protection)

### 1. **Database Layer** (CHECK Constraints)
**File**: `V19__fix_material_type_values.sql`

```sql
-- Enforces valid values at database level
ALTER TABLE materials
  ADD CONSTRAINT chk_material_type_valid 
  CHECK (material_type IN ('raw_material', 'packaging_material', 'product'));
```

**Benefits**:
- ✅ Prevents invalid data at database level
- ✅ Works even if application code has bugs
- ✅ Database-level data integrity

### 2. **Backend Service Layer** (Normalization)
**File**: `MaterialService.java`

```java
private String normalizeMaterialType(String materialType) {
    // Handles variations:
    // "packing_material" -> "packaging_material"
    // "packaging" -> "packaging_material"
    // "raw" -> "raw_material"
    // Invalid values -> "raw_material" (default)
}
```

**Benefits**:
- ✅ Normalizes variations automatically
- ✅ Centralized logic (single source of truth)
- ✅ Prevents inconsistencies before database

### 3. **Frontend Layer** (Display Normalization)
**File**: `frontend/app/admin/materials/page.tsx`

```typescript
// Normalize material type (handle variations)
let type = (material.materialType || "raw_material").toLowerCase().trim();

if (type === "packing_material" || type === "packaging") {
  type = "packaging_material";
}
// ... more normalization
```

**Benefits**:
- ✅ Handles legacy data gracefully
- ✅ Shows correct labels even if database has old values
- ✅ User-friendly display

---

## 🐛 Why Custom Item Showed "packing_material"

**Problem**: Custom item "ttt" was created with `material_type = "packing_material"` (without 'g')

**Root Cause**: 
- No validation at create time
- Frontend dropdown might have sent wrong value
- Or manual database insert with typo

**Solution Applied**:
1. ✅ Database migration fixes existing data
2. ✅ Backend normalizes on create/update
3. ✅ Frontend handles variations in display
4. ✅ Database constraint prevents future issues

---

## ✅ Current State (After Fixes)

### Database
- ✅ CHECK constraint enforces valid values
- ✅ All existing data normalized
- ✅ Default value: `raw_material`

### Backend
- ✅ `normalizeMaterialType()` normalizes all variations
- ✅ Applied on create and update
- ✅ Centralized in `MaterialService`

### Frontend
- ✅ Handles variations gracefully
- ✅ Shows correct labels
- ✅ Consistent colors (Blue/Green/Gray)

---

## 🎯 Industry Best Practices Applied

1. **Database Constraints**: Enforce data integrity at DB level
2. **Service Layer Validation**: Normalize before persistence
3. **Denormalization**: Performance optimization for inventory filtering
4. **Defensive Frontend**: Handle legacy/invalid data gracefully
5. **Single Source of Truth**: Centralized normalization logic

---

## 📝 How to Use

### Creating a Material
```typescript
// Frontend sends any variation
materialType: "packaging" // or "packing_material" or "packaging_material"

// Backend normalizes it
normalizeMaterialType("packaging") → "packaging_material"

// Database stores normalized value
material_type = "packaging_material"

// Frontend displays correctly
"Packaging" (gray badge)
```

### Querying by Type
```java
// Backend service
materialService.findByMaterialType("packaging_material");

// Database query (with index)
SELECT * FROM materials WHERE material_type = 'packaging_material';
```

---

## 🔄 Data Flow

```
User Input → Frontend Validation → Backend Normalization → Database Constraint → Storage
                                                                    ↓
                                                              CHECK constraint
                                                              validates value
```

**Result**: Robust, consistent data at every layer! 🎉
