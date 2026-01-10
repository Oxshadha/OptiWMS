# Complete CSV Import Guide - Industry Best Practices

## 🎯 Materials vs Inventory - Quick Explanation

### **Materials** (Master Data)
- **What**: Product catalog - all items that CAN exist
- **Database**: `materials` table
- **CSV File**: `Item code and descriptions.csv`
- **Page**: `/admin/materials`
- **Purpose**: Define what products the warehouse handles

### **Inventory** (Transaction Data)
- **What**: Actual stock levels - how much is in warehouse NOW
- **Database**: `inventory` table
- **CSV File**: `Active stock.csv`
- **Page**: `/admin/inventory`
- **Purpose**: Track current quantities and locations

**Key Point**: Materials must exist FIRST, then inventory can reference them!

---

## 📁 Your CSV Files - What They Are

### 1. `Item code and descriptions.csv` ✅
**Purpose**: Import to **Materials** table
**Format**:
```csv
Material Code,Description
100036,CAUSTIC SODA
101054,CALCIUM CARBONATE ( GROUND )
```

**Action**: Import this FIRST to create materials catalog

---

### 2. `Active stock.csv` ✅
**Purpose**: Import to **Inventory** table
**Format**: Complex CSV with material codes, quantities, locations, supply plans
**Contains**: 
- Material codes (must match materials table)
- Quantities (current stock)
- Locations
- Supply plan data

**Action**: Import this AFTER materials are imported

---

### 3. `Raw materials not store in pallets.csv` ⚠️
**Purpose**: Special materials (tanks, third-party storage)
**Contains**: Materials that need special handling
**Action**: 
- Import to Materials table
- Set `requires_pallet = false`
- Set `storage_type = 'bulk'` or `'third_party'`

---

### 4. `Non Moving items.csv` ⚠️
**Purpose**: Flag materials with no movement
**Contains**: Materials with zero supply plan
**Action**: 
- Import to Materials (if not exists)
- Flag in inventory as `status = 'non_moving'`

---

## 🔄 Correct Import Order

### Step 1: Import Materials ✅
**File**: `Item code and descriptions.csv`
**Method**: 
1. Go to `/admin/materials`
2. Click "Import CSV"
3. Select file
4. Click "Import"

**Result**: Materials appear in Materials page

---

### Step 2: Import Special Materials ✅
**File**: `Raw materials not store in pallets.csv`
**Method**: Same as Step 1, but file will update existing materials

**Result**: Materials updated with special storage requirements

---

### Step 3: Import Inventory ✅
**File**: `Active stock.csv`
**Method**: 
1. Go to `/admin/inventory`
2. Click "Import CSV" (if available)
3. Or use API endpoint

**Result**: Stock levels appear in Inventory page

---

### Step 4: Flag Non-Moving Items ✅
**File**: `Non Moving items.csv`
**Method**: Import and flag materials

**Result**: Non-moving items flagged in system

---

## 🚀 Quick Start - Import Your Data

### Option 1: Use UI (Easiest)

1. **Import Materials**:
   ```
   /admin/materials → Import CSV → Select "Item code and descriptions.csv"
   ```

2. **Import Inventory**:
   ```
   /admin/inventory → Import CSV → Select "Active stock.csv"
   ```

### Option 2: Use API

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.accessToken')

# 2. Import Materials
curl -X POST http://localhost:8080/api/master/materials/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Resources/DataBase Resources/Item code and descriptions.csv"

# 3. Import Inventory
curl -X POST http://localhost:8080/api/master/materials/inventory/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Resources/DataBase Resources/Active stock.csv"
```

---

## ✅ After Import - What You'll See

### Materials Page (`/admin/materials`):
- ✅ All materials from CSV
- ✅ Can filter by type
- ✅ Can search by code/description

### Inventory Page (`/admin/inventory`):
- ✅ Stock levels for each material
- ✅ Quantities and locations
- ✅ Status (Available, Low, Out of Stock)

---

## 📋 Next Steps

I'll enhance the import system to:
1. ✅ Handle all CSV file formats
2. ✅ Import in correct order automatically
3. ✅ Handle special cases (non-pallet, non-moving)
4. ✅ Show progress and results
5. ✅ Follow industry best practices

**Ready to implement enhanced import!** 🚀
