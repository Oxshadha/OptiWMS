# Materials vs Inventory - Complete Explanation

## 🎯 Key Difference (Industry Standard)

### **Materials** = Product Catalog (Master Data)
**What it is**: List of all items that CAN exist in the warehouse
**Database**: `materials` table
**Source**: `Item code and descriptions.csv`
**Purpose**: Define what items the warehouse handles

**Example**:
- Material Code: `100036`
- Description: `CAUSTIC SODA`
- Type: `Raw Material`
- Unit: `Bags`

**Think of it as**: "What products do we deal with?"

---

### **Inventory** = Actual Stock Levels (Transaction Data)
**What it is**: How much of each material is ACTUALLY in the warehouse RIGHT NOW
**Database**: `inventory` table
**Source**: `Active stock.csv`
**Purpose**: Track current stock quantities and locations

**Example**:
- Material: `CAUSTIC SODA` (from materials table)
- Quantity: `88,715` bags
- Location: `A-01-02-01`
- Warehouse: `WH-001`

**Think of it as**: "How much do we have right now?"

---

## 📊 Database Relationship

```
materials (Master Data)
├─ id: uuid
├─ material_code: "100036"
├─ description: "CAUSTIC SODA"
└─ ... other attributes

inventory (Stock Levels)
├─ id: uuid
├─ material_id: → references materials.id
├─ warehouse_id: → references warehouses.id
├─ quantity: 88715
├─ location_code: "A-01-02-01"
└─ ... other stock fields
```

**Key Point**: Inventory **references** Materials. You can't have inventory without a material!

---

## 📁 Your CSV Files Explained

### 1. `Item code and descriptions.csv` ✅
**Purpose**: Import to **Materials** table
**Contains**: Material codes and descriptions
**Example**:
```csv
Material Code,Description
100036,CAUSTIC SODA
101054,CALCIUM CARBONATE ( GROUND )
```

**Action**: Import this to create materials in the catalog

---

### 2. `Active stock.csv` ✅
**Purpose**: Import to **Inventory** table
**Contains**: Current stock levels for materials
**Example**:
```csv
Material Code,Description,Quantity,Location,...
100036,CAUSTIC SODA,88715,A-01-02-01,...
```

**Action**: Import this AFTER materials are imported (needs material_id)

---

### 3. `Raw materials not store in pallets.csv` ⚠️
**Purpose**: Special handling for materials stored in tanks/third-party locations
**Contains**: Materials that need different storage handling
**Example**:
```csv
Material Code,Description,...
100133,F.D.& C YELLOW 6,...
*****,"These materials are stored in tanks, third party locations"
```

**Action**: 
- Import to Materials table
- Flag as `requires_pallet = false`
- Set `storage_type = 'bulk'` or `storage_type = 'third_party'`

---

### 4. `Non Moving items.csv` ⚠️
**Purpose**: Flag materials with no movement
**Contains**: Materials with zero or no supply plan
**Example**:
```csv
Material,Name,Supply plan
101383,CAMPHOR, -   , -   , -   , -   , -   
```

**Action**:
- Import to Materials table (if not exists)
- Flag in inventory as `status = 'non_moving'`
- Or add `movement_status` field to materials

---

## 🔄 Import Flow (Correct Order)

### Step 1: Import Materials First ✅

**File**: `Item code and descriptions.csv`
**Target**: `materials` table
**Result**: Materials catalog created

### Step 2: Import Special Materials ✅

**File**: `Raw materials not store in pallets.csv`
**Target**: `materials` table (update existing or create new)
**Action**: Set `requires_pallet = false`, `storage_type = 'bulk'`

### Step 3: Import Inventory ✅

**File**: `Active stock.csv`
**Target**: `inventory` table
**Requires**: Materials must exist first (references material_id)
**Result**: Stock levels created

### Step 4: Flag Non-Moving Items ✅

**File**: `Non Moving items.csv`
**Target**: Update `materials` or `inventory` table
**Action**: Set `status = 'non_moving'` or `movement_status = 'non_moving'`

---

## 🎯 Why Inventory Shows Nothing

**Problem**: Inventory page shows nothing because:

1. ❌ Materials not imported yet → No materials exist
2. ❌ Inventory not imported yet → No stock levels exist
3. ❌ Materials imported but inventory not → Materials exist but no stock

**Solution**: Import both in correct order!

---

## ✅ Industry Best Practice

**Standard WMS Flow**:

1. **Materials Master** (One-time setup)
   - Import all materials from catalog
   - Define material attributes
   - Set storage requirements

2. **Inventory** (Ongoing)
   - Import initial stock levels
   - Update via receiving/putaway operations
   - Track movements

**Your System**: Follows this pattern! ✅

---

## 📋 What You Need to Do

### Quick Fix:

1. **Import Materials**:
   - Use `Item code and descriptions.csv`
   - Go to `/admin/materials` → Import CSV
   - Result: Materials appear in Materials page

2. **Import Inventory**:
   - Use `Active stock.csv`
   - Go to `/admin/inventory` → Import (if available)
   - Or use API endpoint
   - Result: Stock levels appear in Inventory page

3. **Handle Special Cases**:
   - Import `Raw materials not store in pallets.csv` → Update materials
   - Import `Non Moving items.csv` → Flag as non-moving

---

## 🔧 Next Steps

I'll create a comprehensive import solution that:
1. ✅ Imports all CSV files in correct order
2. ✅ Handles special cases (non-pallet, non-moving)
3. ✅ Shows data in both Materials and Inventory pages
4. ✅ Follows industry best practices
5. ✅ Centralized implementation

**Ready to implement!** 🚀
