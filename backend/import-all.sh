#!/bin/bash

# OptiWMS CSV Data Import Script
# This script imports all CSV data into the database

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "OptiWMS CSV Data Import"
echo "=========================================="
echo ""

# Check if application is running
echo "Checking if application is running..."
if ! curl -s http://localhost:8080/actuator/health > /dev/null; then
    echo -e "${RED}❌ Application is not running!${NC}"
    echo "Please start the application first:"
    echo "  cd backend && ./gradlew :core-api:bootRun"
    exit 1
fi
echo -e "${GREEN}✅ Application is running${NC}"
echo ""

# Step 1: Import Materials
echo "Step 1: Importing materials..."
MATERIALS_RESPONSE=$(curl -s -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"csvPath":"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Item code and descriptions.csv"}' \
  http://localhost:8080/api/integration/import/materials)

if echo "$MATERIALS_RESPONSE" | grep -q '"success":true'; then
    IMPORTED=$(echo "$MATERIALS_RESPONSE" | jq -r '.imported // 0')
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
WAREHOUSE_COUNT=$(echo "$WAREHOUSE_RESPONSE" | jq 'length // 0')

if [ "$WAREHOUSE_COUNT" -eq "0" ]; then
    echo "Creating warehouse..."
    WAREHOUSE_RESPONSE=$(curl -s -X POST -u admin:admin123 \
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
      http://localhost:8080/api/master/warehouses)
    
    if echo "$WAREHOUSE_RESPONSE" | grep -q '"id"'; then
        echo -e "${GREEN}✅ Warehouse created${NC}"
        WAREHOUSE_ID=$(echo "$WAREHOUSE_RESPONSE" | jq -r '.id')
    else
        echo -e "${RED}❌ Failed to create warehouse${NC}"
        echo "$WAREHOUSE_RESPONSE"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Using existing warehouse${NC}"
    WAREHOUSE_ID=$(echo "$WAREHOUSE_RESPONSE" | jq -r '.[0].id')
fi

echo "Warehouse ID: $WAREHOUSE_ID"
echo ""

# Step 3: Import Inventory
echo "Step 3: Importing inventory..."
INVENTORY_RESPONSE=$(curl -s -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{\"csvPath\":\"/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Active stock.csv\",\"warehouseId\":\"$WAREHOUSE_ID\"}" \
  http://localhost:8080/api/integration/import/inventory)

if echo "$INVENTORY_RESPONSE" | grep -q '"success":true'; then
    PROCESSED=$(echo "$INVENTORY_RESPONSE" | jq -r '.materialsProcessed // 0')
    CREATED=$(echo "$INVENTORY_RESPONSE" | jq -r '.inventoryCreated // 0')
    ERRORS=$(echo "$INVENTORY_RESPONSE" | jq -r '.errors // 0')
    echo -e "${GREEN}✅ Processed $PROCESSED materials, created $CREATED inventory records${NC}"
    if [ "$ERRORS" -gt "0" ]; then
        echo -e "${YELLOW}⚠️  $ERRORS errors occurred during import${NC}"
    fi
else
    echo -e "${RED}❌ Failed to import inventory${NC}"
    echo "$INVENTORY_RESPONSE"
    exit 1
fi
echo ""

# Step 4: Update Non-Pallet Materials
NON_PALLET_CSV="/Users/k.e.oshada/Documents/OptiWMS/frontend/Database Documents/Raw matrilas not store in pallets.csv"
if [ -f "$NON_PALLET_CSV" ]; then
    echo "Step 4: Updating non-pallet materials..."
    NON_PALLET_RESPONSE=$(curl -s -X POST -u admin:admin123 \
      -H "Content-Type: application/json" \
      -d "{\"csvPath\":\"$NON_PALLET_CSV\"}" \
      http://localhost:8080/api/integration/import/non-pallet-materials)
    
    if echo "$NON_PALLET_RESPONSE" | grep -q '"success":true'; then
        UPDATED=$(echo "$NON_PALLET_RESPONSE" | jq -r '.updated // 0')
        echo -e "${GREEN}✅ Updated $UPDATED non-pallet materials${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed to update non-pallet materials (may not be critical)${NC}"
        echo "$NON_PALLET_RESPONSE"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  Non-pallet CSV file not found, skipping...${NC}"
    echo ""
fi

# Summary
echo "=========================================="
echo -e "${GREEN}Import Complete!${NC}"
echo "=========================================="
echo ""
echo "You can now verify the data:"
echo ""
echo "1. View materials:"
echo "   curl -u admin:admin123 http://localhost:8080/api/master/materials | jq 'length'"
echo ""
echo "2. View inventory:"
echo "   curl -u admin:admin123 http://localhost:8080/api/inventory | jq 'length'"
echo ""
echo "3. View warehouse:"
echo "   curl -u admin:admin123 http://localhost:8080/api/master/warehouses | jq '.[0]'"
echo ""

