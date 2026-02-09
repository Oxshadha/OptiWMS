# How to Add Materials - Complete Guide

## 🔍 Why Materials Page is Empty

**The page is empty because there are no materials in the database yet.**

The database migration only creates the `materials` table structure - it doesn't seed any materials by default. This is intentional - materials are typically imported from your existing data or created manually.

---

## ✅ Method 1: Add Materials via UI (Easiest)

### Step 1: Click "Add Material" Button

1. Go to `/admin/materials` page
2. Click the red **"Add Material"** button (top right)
3. Fill in the form:
   - **Material Code**: e.g., `MAT-001`
   - **Description**: e.g., `Rice 5kg Bag`
   - **Material Type**: Select from dropdown
     - Raw Material
     - Product
     - Packaging Material
   - **Unit Type**: e.g., `kg`, `pcs`, `pallet`
   - **Storage Type**: e.g., `pallet`, `bulk`, `loose`, `cold`
4. Click **"Create Material"**

### Step 2: Repeat for More Materials

Add as many materials as needed using the same process.

---

## ✅ Method 2: Import from CSV (Bulk Import)

### Step 1: Prepare CSV File

Create a CSV file with this format:

```csv
material_code,description,material_type,unit_type,storage_type
MAT-001,Rice 5kg Bag,raw_material,kg,pallet
MAT-002,Sugar 1kg,raw_material,kg,pallet
MAT-003,Flour 10kg,raw_material,kg,pallet
PROD-001,Finished Product A,product,pcs,pallet
PACK-001,Small Box,packing_material,pcs,loose
```

**Required columns:**
- `material_code` - Unique code (required)
- `description` - Material description (required)
- `material_type` - Optional: `raw_material`, `product`, `packing_material`
- `unit_type` - Optional: `kg`, `pcs`, `pallet`, etc.
- `storage_type` - Optional: `pallet`, `bulk`, `loose`, `cold`

### Step 2: Import via UI

1. Go to `/admin/materials` page
2. Click **"Import CSV"** button (top right)
3. Select your CSV file
4. Click **"Import"**

### Step 3: Verify Import

Check the materials table - imported materials should appear!

---

## ✅ Method 3: Import from Existing CSV Files

If you have CSV files in `frontend/Database Documents/`:

### Option A: Use Import Script

```bash
# Navigate to backend directory
cd backend

# Run import script (if available)
./import-data.sh
```

### Option B: Use API Directly

```bash
# First, login to get JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.accessToken')

# Import materials CSV
curl -X POST http://localhost:8080/api/master/materials/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/your/materials.csv"
```

---

## ✅ Method 4: Add via API (Programmatic)

### Using cURL

```bash
# Login first
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

### Using Postman/Thunder Client

1. **Login**:
   - POST `http://localhost:8080/api/auth/login`
   - Body: `{"username":"admin","password":"admin123"}`
   - Copy `accessToken` from response

2. **Create Material**:
   - POST `http://localhost:8080/api/master/materials`
   - Headers: `Authorization: Bearer <token>`
   - Body (JSON):
     ```json
     {
       "materialCode": "MAT-001",
       "description": "Rice 5kg Bag",
       "materialType": "raw_material",
       "unitType": "kg",
       "storageType": "pallet"
     }
     ```

---

## ✅ Method 5: Add via Database (Direct SQL)

**⚠️ Not recommended** - Use API or UI instead for proper validation.

If you must use SQL directly:

```sql
-- Connect to database
psql -h localhost -p 5434 -U optiwms -d optiwms

-- Insert material
INSERT INTO materials (id, material_code, description, material_type, unit_type, storage_type, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'MAT-001',
  'Rice 5kg Bag',
  'raw_material',
  'kg',
  'pallet',
  NOW(),
  NOW()
);
```

---

## 📋 Quick Start: Add Sample Materials

### Sample CSV File

Create `sample_materials.csv`:

```csv
material_code,description,material_type,unit_type,storage_type
RICE-5KG,Rice 5kg Bag,raw_material,kg,pallet
SUGAR-1KG,Sugar 1kg,raw_material,kg,pallet
FLOUR-10KG,Flour 10kg,raw_material,kg,pallet
TEA-500G,Tea 500g,product,pcs,pallet
BOX-SMALL,Small Box,packing_material,pcs,loose
BOX-LARGE,Large Box,packing_material,pcs,loose
```

### Import Steps:

1. Save as `sample_materials.csv`
2. Go to `/admin/materials`
3. Click **"Import CSV"**
4. Select `sample_materials.csv`
5. Click **"Import"**

**Result**: 6 materials added! ✅

---

## 🔍 Verify Materials Were Added

### Check in UI:

1. Go to `/admin/materials`
2. Materials should appear in the table
3. Summary cards should show counts > 0

### Check via API:

```bash
# Get all materials
curl -X GET http://localhost:8080/api/master/materials \
  -H "Authorization: Bearer $TOKEN"
```

### Check in Database:

```sql
SELECT material_code, description, material_type 
FROM materials 
ORDER BY created_at DESC;
```

---

## 🎯 Recommended Approach

**For Quick Start:**
1. Use **Method 1** (UI) to add 5-10 sample materials
2. Test the system
3. Then use **Method 2** (CSV import) for bulk import

**For Production:**
1. Prepare CSV file with all materials
2. Use **Method 2** (CSV import) for bulk import
3. Use **Method 1** (UI) for individual additions/edits

---

## ❓ Troubleshooting

### Problem: "Material code already exists"

**Solution**: Material codes must be unique. Change the code or update existing material.

### Problem: "Import failed"

**Solution**: 
- Check CSV format (required columns: `material_code`, `description`)
- Check file encoding (should be UTF-8)
- Check file size (not too large)

### Problem: "No materials showing after import"

**Solution**:
- Refresh the page
- Check browser console for errors
- Verify materials in database: `SELECT * FROM materials;`

---

## 📝 Material Types Explained

| Type | Description | Example |
|------|-------------|---------|
| `raw_material` | Raw materials for production | Rice, Sugar, Flour |
| `product` | Finished products | Packaged goods, Final products |
| `packing_material` | Packaging supplies | Boxes, Bags, Wrapping |

**Default**: If not specified, defaults to `raw_material`

---

## ✅ Summary

**Why empty?** No materials in database yet.

**How to add?**
1. ✅ **UI** - Click "Add Material" (easiest)
2. ✅ **CSV Import** - Bulk import (recommended for many)
3. ✅ **API** - Programmatic (for automation)
4. ✅ **SQL** - Direct database (not recommended)

**Quick Start**: Use UI to add a few materials, then import CSV for bulk!

---

**After adding materials, the page will show them!** 🎉
