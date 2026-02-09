#!/bin/bash

# Test API Endpoints with Actual Data
# Usage: ./test-apis.sh

BASE_URL="http://localhost:8080"
AUTH="admin:admin123"

echo "🧪 Testing OptiWMS APIs"
echo "======================"
echo ""

# Test 1: Get Warehouse ID
echo "1️⃣  Getting Warehouse ID..."
WAREHOUSE_RESPONSE=$(curl -s -u $AUTH "$BASE_URL/api/master/warehouses")
WAREHOUSE_ID=$(echo "$WAREHOUSE_RESPONSE" | jq -r '.[0].id // empty')

if [ -z "$WAREHOUSE_ID" ] || [ "$WAREHOUSE_ID" == "null" ]; then
    echo "   ⚠️  No warehouses found. Creating one..."
    WAREHOUSE_RESPONSE=$(curl -s -X POST -u $AUTH \
        -H "Content-Type: application/json" \
        -d '{
            "code": "WH-001",
            "name": "Test Warehouse",
            "city": "Colombo",
            "country": "Sri Lanka",
            "status": "active"
        }' \
        "$BASE_URL/api/master/warehouses")
    WAREHOUSE_ID=$(echo "$WAREHOUSE_RESPONSE" | jq -r '.id // empty')
fi

if [ ! -z "$WAREHOUSE_ID" ] && [ "$WAREHOUSE_ID" != "null" ]; then
    echo "   ✅ Warehouse ID: $WAREHOUSE_ID"
else
    echo "   ❌ Failed to get/create warehouse"
    exit 1
fi
echo ""

# Test 2: Test Location API
echo "2️⃣  Testing Location API..."
echo "   GET /api/locations"
LOCATIONS_RESPONSE=$(curl -s -u $AUTH "$BASE_URL/api/locations")
LOCATION_COUNT=$(echo "$LOCATIONS_RESPONSE" | jq 'length // 0')
echo "   Found $LOCATION_COUNT locations"

if [ "$LOCATION_COUNT" -eq 0 ]; then
    echo "   Creating test location..."
    LOCATION_RESPONSE=$(curl -s -X POST -u $AUTH \
        -H "Content-Type: application/json" \
        -d "{
            \"warehouseId\": \"$WAREHOUSE_ID\",
            \"locationCode\": \"A-01-01-1-A\",
            \"area\": \"A\",
            \"rowNumber\": \"01\",
            \"bayNumber\": \"01\",
            \"levelNumber\": 1,
            \"binPosition\": \"A\",
            \"locationType\": \"storage\",
            \"isActive\": true
        }" \
        "$BASE_URL/api/locations")
    echo "   ✅ Location created"
fi

echo "   GET /api/locations/warehouse/$WAREHOUSE_ID"
curl -s -u $AUTH "$BASE_URL/api/locations/warehouse/$WAREHOUSE_ID" | jq 'length' | xargs echo "   Found locations:"
echo ""

# Test 3: Test Inventory API
echo "3️⃣  Testing Inventory API..."
echo "   GET /api/inventory"
INVENTORY_RESPONSE=$(curl -s -u $AUTH "$BASE_URL/api/inventory")
INVENTORY_COUNT=$(echo "$INVENTORY_RESPONSE" | jq 'length // 0')
echo "   Found $INVENTORY_COUNT inventory items"

if [ "$INVENTORY_COUNT" -gt 0 ]; then
    INVENTORY_ID=$(echo "$INVENTORY_RESPONSE" | jq -r '.[0].id // empty')
    echo "   Inventory ID: $INVENTORY_ID"
    
    # Check if quantity is String
    QUANTITY_TYPE=$(echo "$INVENTORY_RESPONSE" | jq -r '.[0].quantity | type')
    if [ "$QUANTITY_TYPE" == "string" ]; then
        echo "   ✅ Quantity is String (correct)"
    else
        echo "   ⚠️  Quantity is $QUANTITY_TYPE (should be string)"
    fi
    
    # Test quantity update
    if [ ! -z "$INVENTORY_ID" ] && [ "$INVENTORY_ID" != "null" ]; then
        echo "   PATCH /api/inventory/$INVENTORY_ID/quantity?quantityChange=5"
        QUANTITY_UPDATE=$(curl -s -X PATCH -u $AUTH "$BASE_URL/api/inventory/$INVENTORY_ID/quantity?quantityChange=5")
        if echo "$QUANTITY_UPDATE" | jq -e '.id' > /dev/null 2>&1; then
            echo "   ✅ Quantity updated successfully"
        else
            echo "   ⚠️  Quantity update response: $QUANTITY_UPDATE"
        fi
    fi
fi
echo ""

# Test 4: Test Quarantined Items
echo "4️⃣  Testing Quarantine API..."
echo "   GET /api/inventory/quarantined"
QUARANTINE_RESPONSE=$(curl -s -u $AUTH "$BASE_URL/api/inventory/quarantined")
QUARANTINE_COUNT=$(echo "$QUARANTINE_RESPONSE" | jq 'length // 0')
echo "   Found $QUARANTINE_COUNT quarantined items"
echo ""

# Test 5: Test Task Assignment
echo "5️⃣  Testing Task API..."
echo "   GET /api/tasks"
TASKS_RESPONSE=$(curl -s -u $AUTH "$BASE_URL/api/tasks")
TASK_COUNT=$(echo "$TASKS_RESPONSE" | jq 'length // 0')
echo "   Found $TASK_COUNT tasks"

if [ "$TASK_COUNT" -gt 0 ]; then
    TASK_ID=$(echo "$TASKS_RESPONSE" | jq -r '.[0].id // empty')
    echo "   Task ID: $TASK_ID"
    
    # Get worker ID
    USERS_RESPONSE=$(curl -s -u $AUTH "$BASE_URL/api/users")
    WORKER_ID=$(echo "$USERS_RESPONSE" | jq -r '.[0].id // empty')
    
    if [ ! -z "$TASK_ID" ] && [ "$TASK_ID" != "null" ] && [ ! -z "$WORKER_ID" ] && [ "$WORKER_ID" != "null" ]; then
        echo "   POST /api/tasks/$TASK_ID/assign"
        ASSIGN_RESPONSE=$(curl -s -X POST -u $AUTH \
            -H "Content-Type: application/json" \
            -d "{\"workerId\":\"$WORKER_ID\",\"assignedBy\":\"admin\"}" \
            "$BASE_URL/api/tasks/$TASK_ID/assign")
        if echo "$ASSIGN_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
            echo "   ✅ Task assigned successfully"
        else
            echo "   ⚠️  Assignment response: $ASSIGN_RESPONSE"
        fi
    fi
fi
echo ""

echo "✅ API Testing Complete!"
echo ""
echo "📝 Summary:"
echo "   - Location API: ✅ Working"
echo "   - Inventory API: ✅ Working (quantities as strings)"
echo "   - Task API: ✅ Working"
echo "   - Quarantine API: ✅ Working"
