# Data Import Guide

## 🚀 Quick Start

### Step 1: Run Migration

The migration `V4__finalized_schema_with_ai_support.sql` will run automatically when you start the backend application.

```bash
cd backend
./gradlew :core-api:bootRun
```

Wait for the application to start (you'll see "Started OptiWmsApplication").

### Step 2: Import Data via API

Once the application is running, use these API calls to import data:

#### 1. Import Materials

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Item code and descriptions.csv"}' \
  http://localhost:8080/api/integration/import/materials
```

#### 2. Create/Get Warehouse (if needed)

First, check if a warehouse exists:
```bash
curl -u admin:admin123 http://localhost:8080/api/master/warehouses
```

If empty, create one:
```bash
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

Note the warehouse `id` from the response.

#### 3. Import Inventory and Supply Plans

Replace `{WAREHOUSE_ID}` with the actual warehouse ID:

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "csvPath": "/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Active stock.csv",
    "warehouseId": "{WAREHOUSE_ID}"
  }' \
  http://localhost:8080/api/integration/import/inventory
```

#### 4. Update Non-Pallet Materials (Optional)

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Raw matrilas not store in pallets.csv"}' \
  http://localhost:8080/api/integration/import/non-pallet-materials
```

### Step 3: Verify Import

Check imported data:

```bash
# Check materials count
curl -u admin:admin123 http://localhost:8080/api/master/materials | jq 'length'

# Check inventory
curl -u admin:admin123 http://localhost:8080/api/inventory | jq 'length'
```

## 📋 What Gets Imported

### Materials Import
- **File**: `Item code and descriptions.csv`
- **Imports**: Material codes, descriptions
- **Expected**: ~300+ materials

### Inventory Import
- **File**: `Active stock.csv`
- **Imports**: 
  - Inventory quantities
  - Buffer stock, max stock, min stock
  - MOQ, stacking quantity
  - Lead time days
  - Reorder point
- **Note**: Supply plan data parsing is complex - may need manual adjustment

### Non-Pallet Materials
- **File**: `Raw matrilas not store in pallets.csv`
- **Updates**: Sets `requires_pallet = false` and `storage_location_type = 'tank'`

## 🔧 Troubleshooting

### Migration Not Running
- Check Flyway is enabled in `application.yml`
- Check database connection
- Check migration file exists: `backend/infra/src/main/resources/db/migration/V4__finalized_schema_with_ai_support.sql`

### Import Fails
- Check CSV file paths are absolute
- Check CSV file format matches expected structure
- Check application logs for detailed errors
- Verify warehouse exists before importing inventory

### Data Not Appearing
- Check database directly: `psql -h localhost -p 5434 -U optiwms -d optiwms`
- Verify materials: `SELECT COUNT(*) FROM materials;`
- Verify inventory: `SELECT COUNT(*) FROM inventory;`

## 📝 Manual SQL Import (Alternative)

If API import doesn't work, you can import directly via SQL:

```sql
-- Connect to database
psql -h localhost -p 5434 -U optiwms -d optiwms

-- Import materials (example - adjust based on CSV structure)
COPY materials(material_code, description, material_type, storage_type, requires_pallet)
FROM '/path/to/Item code and descriptions.csv'
WITH (FORMAT csv, HEADER true, DELIMITER ',');
```

## ✅ Success Indicators

After successful import, you should see:
- ✅ Materials table has ~300+ records
- ✅ Inventory table has records matching materials
- ✅ Non-pallet materials have `requires_pallet = false`
- ✅ Warehouse exists and is linked to inventory

---

**Last Updated:** 2025-01-XX  
**Status:** Ready for Use

