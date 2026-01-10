# CSV Data Import - Step by Step Guide

## 📋 Prerequisites

1. ✅ Migration V4 has run successfully
2. ✅ Application is running on `http://localhost:8080`
3. ✅ Database is running (PostgreSQL on port 5434)
4. ✅ CSV files are in: `/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/`

---

## 🚀 Step 1: Start the Application

```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend
./gradlew :core-api:bootRun
```

**Wait for:** You should see `Started OptiWmsApplication` in the logs.

**Verify it's running:**
```bash
curl http://localhost:8080/actuator/health
```

Expected response: `{"status":"UP"}`

---

## 📦 Step 2: Import Materials

Import materials from `Item code and descriptions.csv`:

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Item code and descriptions.csv"}' \
  http://localhost:8080/api/integration/import/materials
```

**Expected Response:**
```json
{
  "success": true,
  "imported": 300,
  "message": "Materials imported successfully"
}
```

**Verify:**
```bash
curl -u admin:admin123 http://localhost:8080/api/master/materials | jq 'length'
```

Should show the number of materials imported (around 300+).

---

## 🏢 Step 3: Create or Get Warehouse

### Option A: Check if warehouse exists

```bash
curl -u admin:admin123 http://localhost:8080/api/master/warehouses
```

### Option B: Create a warehouse (if none exists)

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WH-001",
    "name": "Colombo Main Warehouse",
    "address": "123 Galle Road, Colombo 03",
    "city": "Colombo",
    "country": "Sri Lanka",
    "contactPerson": "John Silva",
    "phone": "+94-11-2345678",
    "email": "warehouse@optiwms.com",
    "status": "active"
  }' \
  http://localhost:8080/api/master/warehouses
```

**Save the `id` from the response** - you'll need it for inventory import.

**Example Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "WH-001",
  "name": "Colombo Main Warehouse",
  ...
}
```

---

## 📊 Step 4: Import Inventory Data

**Replace `{WAREHOUSE_ID}` with the actual warehouse ID from Step 3:**

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "csvPath": "/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Active stock.csv",
    "warehouseId": "{WAREHOUSE_ID}"
  }' \
  http://localhost:8080/api/integration/import/inventory
```

**Example (with actual UUID):**
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "csvPath": "/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Active stock.csv",
    "warehouseId": "550e8400-e29b-41d4-a716-446655440000"
  }' \
  http://localhost:8080/api/integration/import/inventory
```

**Expected Response:**
```json
{
  "success": true,
  "materialsProcessed": 314,
  "inventoryCreated": 314,
  "supplyPlansCreated": 0,
  "errors": 0
}
```

**Note:** Supply plans import is complex and may need manual SQL import later.

**Verify:**
```bash
curl -u admin:admin123 http://localhost:8080/api/inventory | jq 'length'
```

---

## 🚫 Step 5: Update Non-Pallet Materials (Optional)

Update materials that don't require pallets:

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Raw matrilas not store in pallets.csv"}' \
  http://localhost:8080/api/integration/import/non-pallet-materials
```

**Expected Response:**
```json
{
  "success": true,
  "updated": 20,
  "message": "Non-pallet materials updated successfully"
}
```

---

## ✅ Step 6: Verify All Data

### Check Materials
```bash
curl -u admin:admin123 http://localhost:8080/api/master/materials | jq '.[0:3]'
```

### Check Inventory
```bash
curl -u admin:admin123 http://localhost:8080/api/inventory | jq '.[0:3]'
```

### Check Warehouse
```bash
curl -u admin:admin123 http://localhost:8080/api/master/warehouses | jq '.[0]'
```

---

## 🔧 Troubleshooting

### Issue: "Connection refused"
**Solution:** Make sure the application is running:
```bash
# Check if app is running
curl http://localhost:8080/actuator/health

# If not, start it
cd backend && ./gradlew :core-api:bootRun
```

### Issue: "Authentication failed"
**Solution:** Use correct credentials:
- Username: `admin`
- Password: `admin123`
- Format: `-u admin:admin123`

### Issue: "File not found"
**Solution:** Check the CSV file path is correct:
```bash
ls -la "/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Item code and descriptions.csv"
```

### Issue: "Warehouse not found"
**Solution:** Create a warehouse first (Step 3), then use its ID.

### Issue: "CSV parsing errors"
**Solution:** Check the CSV file format. The import service handles:
- Quoted values with commas
- Empty lines
- Header rows
- Number formatting (commas, parentheses for negatives)

---

## 📝 Complete Import Script

Here's a complete script you can run (save as `import-all.sh`):

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=========================================="
echo "OptiWMS CSV Data Import"
echo "=========================================="
echo ""

# Step 1: Import Materials
echo "Step 1: Importing materials..."
MATERIALS_RESPONSE=$(curl -s -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Item code and descriptions.csv"}' \
  http://localhost:8080/api/integration/import/materials)

if echo "$MATERIALS_RESPONSE" | grep -q '"success":true'; then
    IMPORTED=$(echo "$MATERIALS_RESPONSE" | jq -r '.imported')
    echo -e "${GREEN}✅ Imported $IMPORTED materials${NC}"
else
    echo -e "${RED}❌ Failed to import materials${NC}"
    echo "$MATERIALS_RESPONSE"
    exit 1
fi
echo ""

# Step 2: Get or Create Warehouse
echo "Step 2: Setting up warehouse..."
WAREHOUSE_RESPONSE=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses)
WAREHOUSE_COUNT=$(echo "$WAREHOUSE_RESPONSE" | jq 'length')

if [ "$WAREHOUSE_COUNT" -eq "0" ]; then
    echo "Creating warehouse..."
    WAREHOUSE_RESPONSE=$(curl -s -X POST -u admin:admin123 \
      -H "Content-Type: application/json" \
      -d '{
        "code": "WH-001",
        "name": "Colombo Main Warehouse",
        "city": "Colombo",
        "country": "Sri Lanka",
        "status": "active"
      }' \
      http://localhost:8080/api/master/warehouses)
    echo -e "${GREEN}✅ Warehouse created${NC}"
else
    echo -e "${GREEN}✅ Using existing warehouse${NC}"
fi

WAREHOUSE_ID=$(echo "$WAREHOUSE_RESPONSE" | jq -r '.[0].id // .id')
echo "Warehouse ID: $WAREHOUSE_ID"
echo ""

# Step 3: Import Inventory
echo "Step 3: Importing inventory..."
INVENTORY_RESPONSE=$(curl -s -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{\"csvPath\":\"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Active stock.csv\",\"warehouseId\":\"$WAREHOUSE_ID\"}" \
  http://localhost:8080/api/integration/import/inventory)

if echo "$INVENTORY_RESPONSE" | grep -q '"success":true'; then
    PROCESSED=$(echo "$INVENTORY_RESPONSE" | jq -r '.materialsProcessed')
    CREATED=$(echo "$INVENTORY_RESPONSE" | jq -r '.inventoryCreated')
    echo -e "${GREEN}✅ Processed $PROCESSED materials, created $CREATED inventory records${NC}"
else
    echo -e "${RED}❌ Failed to import inventory${NC}"
    echo "$INVENTORY_RESPONSE"
    exit 1
fi
echo ""

# Step 4: Update Non-Pallet Materials
if [ -f "/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Raw matrilas not store in pallets.csv" ]; then
    echo "Step 4: Updating non-pallet materials..."
    NON_PALLET_RESPONSE=$(curl -s -X POST -u admin:admin123 \
      -H "Content-Type: application/json" \
      -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Raw matrilas not store in pallets.csv"}' \
      http://localhost:8080/api/integration/import/non-pallet-materials)
    
    if echo "$NON_PALLET_RESPONSE" | grep -q '"success":true'; then
        UPDATED=$(echo "$NON_PALLET_RESPONSE" | jq -r '.updated')
        echo -e "${GREEN}✅ Updated $UPDATED non-pallet materials${NC}"
    else
        echo -e "${RED}⚠️  Failed to update non-pallet materials${NC}"
    fi
    echo ""
fi

# Summary
echo "=========================================="
echo "Import Complete!"
echo "=========================================="
echo ""
echo "You can now:"
echo "1. View materials: curl -u admin:admin123 http://localhost:8080/api/master/materials"
echo "2. View inventory: curl -u admin:admin123 http://localhost:8080/api/inventory"
echo "3. View warehouse: curl -u admin:admin123 http://localhost:8080/api/master/warehouses"
echo ""
```

**To use the script:**
```bash
chmod +x import-all.sh
./import-all.sh
```

---

## 🎯 Quick Reference Commands

### Import Materials
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Item code and descriptions.csv"}' \
  http://localhost:8080/api/integration/import/materials
```

### Get Warehouse ID
```bash
curl -u admin:admin123 http://localhost:8080/api/master/warehouses | jq '.[0].id'
```

### Import Inventory (replace {WAREHOUSE_ID})
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Active stock.csv","warehouseId":"{WAREHOUSE_ID}"}' \
  http://localhost:8080/api/integration/import/inventory
```

### Update Non-Pallet Materials
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Raw matrilas not store in pallets.csv"}' \
  http://localhost:8080/api/integration/import/non-pallet-materials
```

---

## 📊 Expected Results

After successful import:
- ✅ **Materials**: ~300+ records
- ✅ **Inventory**: ~314 records (matching materials)
- ✅ **Warehouse**: 1 record (Colombo Main Warehouse)
- ✅ **Non-Pallet Materials**: ~20 updated

---

**Last Updated:** 2025-01-XX  
**Status:** Ready to Use

