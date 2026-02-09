# Quick Guide: Add Materials (3 Ways)

## 🎯 Why Page is Empty?

**No materials in database yet!** The table exists but is empty.

---

## ✅ Method 1: Add via UI (Easiest - 30 seconds)

1. Go to `/admin/materials` page
2. Click **"Add Material"** button (red button, top right)
3. Fill form:
   - Material Code: `MAT-001`
   - Description: `Rice 5kg Bag`
   - Material Type: `Raw Material`
   - Unit Type: `kg`
   - Storage Type: `pallet`
4. Click **"Create Material"**

**Done!** Material appears in table.

---

## ✅ Method 2: Import CSV (Bulk - 1 minute)

1. Use provided `sample_materials.csv` file
2. Go to `/admin/materials` page
3. Click **"Import CSV"** button
4. Select `sample_materials.csv`
5. Click **"Import"`

**Done!** 8 materials added at once!

---

## ✅ Method 3: Use API (Programmatic)

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.accessToken')

# Create material
curl -X POST http://localhost:8080/api/master/materials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "materialCode": "MAT-001",
    "description": "Rice 5kg Bag",
    "materialType": "raw_material",
    "unitType": "kg",
    "storageType": "pallet"
  }'
```

---

## 📋 CSV Format

```csv
material_code,description,material_type,unit_type,storage_type
MAT-001,Rice 5kg Bag,raw_material,kg,pallet
MAT-002,Sugar 1kg,raw_material,kg,pallet
```

**Required**: `material_code`, `description`  
**Optional**: `material_type`, `unit_type`, `storage_type`

---

## 🚀 Quick Start

**Fastest way:**
1. Use `sample_materials.csv` (provided)
2. Import via UI
3. Done! 8 materials added

**See full guide**: `HOW_TO_ADD_MATERIALS.md`
