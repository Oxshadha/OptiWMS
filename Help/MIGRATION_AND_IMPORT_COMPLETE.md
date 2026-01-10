# Migration and Import Setup Complete ✅

## What Was Done

### 1. ✅ Migration File Created
- **File**: `backend/infra/src/main/resources/db/migration/V4__finalized_schema_with_ai_support.sql`
- **Status**: Ready to run automatically when app starts
- **What it does**:
  - Enhances existing tables with international support
  - Adds material type (raw/finished goods)
  - Adds supply planning tables
  - Adds AI service tables (all optional)
  - Ensures core WMS works without AI

### 2. ✅ Entities Updated
- **MaterialEntity**: Added `materialType`, `storageLocationType`, `requiresPallet`
- **InventoryItemEntity**: Added `batchNumber`, `expiryDate`, `lastMovementDate`, `daysSinceLastMovement`

### 3. ✅ CSV Import Service Created
- **File**: `backend/integration/src/main/java/com/optiwms/integration/CsvDataImporter.java`
- **Features**:
  - Import materials from `Item code and descriptions.csv`
  - Import inventory from `Active stock.csv`
  - Update non-pallet materials from `Raw matrilas not store in pallets.csv`
  - Handles CSV parsing with quoted values
  - Handles numeric formatting (commas, parentheses for negatives)

### 4. ✅ Import API Controller Created
- **File**: `backend/core-api/src/main/java/com/optiwms/coreapi/integration/DataImportController.java`
- **Endpoints**:
  - `POST /api/integration/import/materials`
  - `POST /api/integration/import/inventory`
  - `POST /api/integration/import/non-pallet-materials`

### 5. ✅ Import Script Created
- **File**: `backend/import-data.sh`
- **Status**: Ready to use (needs database and app running)

### 6. ✅ Import Guide Created
- **File**: `IMPORT_DATA_GUIDE.md`
- **Contains**: Step-by-step instructions for manual import

---

## 🚀 Next Steps (What You Need to Do)

### Step 1: Start the Application

The migration will run automatically when the app starts:

```bash
cd backend
./gradlew :core-api:bootRun
```

Wait for: `Started OptiWmsApplication`

### Step 2: Import Materials

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Item code and descriptions.csv"}' \
  http://localhost:8080/api/integration/import/materials
```

**Expected**: ~300+ materials imported

### Step 3: Create Warehouse (if needed)

```bash
# Check if warehouse exists
curl -u admin:admin123 http://localhost:8080/api/master/warehouses

# If empty, create one
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WH-001",
    "name": "Colombo Main Warehouse",
    "city": "Colombo",
    "country": "Sri Lanka",
    "status": "active"
  }' \
  http://localhost:8080/api/master/warehouses
```

**Note the `id` from the response** - you'll need it for inventory import.

### Step 4: Import Inventory

Replace `{WAREHOUSE_ID}` with the actual warehouse ID from Step 3:

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "csvPath": "/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Active stock.csv",
    "warehouseId": "{WAREHOUSE_ID}"
  }' \
  http://localhost:8080/api/integration/import/inventory
```

**Expected**: Inventory records created for materials

### Step 5: Update Non-Pallet Materials (Optional)

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Raw matrilas not store in pallets.csv"}' \
  http://localhost:8080/api/integration/import/non-pallet-materials
```

### Step 6: Verify

```bash
# Check materials
curl -u admin:admin123 http://localhost:8080/api/master/materials | jq 'length'

# Check inventory
curl -u admin:admin123 http://localhost:8080/api/inventory | jq 'length'
```

---

## 📊 What Gets Imported

### Materials (from `Item code and descriptions.csv`)
- Material codes (6-digit: 100036, 101054, etc.)
- Descriptions
- Default: `material_type = 'raw_material'`, `requires_pallet = true`

### Inventory (from `Active stock.csv`)
- Quantities
- Buffer stock
- Max stock
- Stacking quantity
- MOQ
- Lead time days
- Reorder point
- **Note**: Supply plan parsing is complex - may need enhancement

### Non-Pallet Materials (from `Raw matrilas not store in pallets.csv`)
- Sets `requires_pallet = false`
- Sets `storage_location_type = 'tank'`

---

## ⚠️ Important Notes

1. **CSV Paths**: Use absolute paths in the API requests
2. **Warehouse ID**: You need a warehouse ID before importing inventory
3. **Supply Plans**: The supply plan import is partially implemented - may need manual SQL import
4. **Migration**: Runs automatically on app start - no manual step needed

---

## 🔧 Troubleshooting

### Migration Not Running
- Check database is running: `docker ps | grep optiwms-db`
- Check Flyway logs in application startup
- Verify migration file exists

### Import Fails
- Check CSV file paths are correct and absolute
- Check CSV file format
- Check application logs for detailed errors
- Verify authentication (admin:admin123)

### Data Not Appearing
- Check database directly
- Verify materials were imported: `SELECT COUNT(*) FROM materials;`
- Verify inventory: `SELECT COUNT(*) FROM inventory;`

---

## ✅ Success Checklist

After completing all steps, you should have:
- [x] Migration V4 applied successfully
- [x] ~300+ materials in database
- [x] Inventory records for materials
- [x] Warehouse created
- [x] Non-pallet materials updated (if applicable)

---

**Status**: ✅ Ready for Import  
**Next**: Start the app and run the import commands above

