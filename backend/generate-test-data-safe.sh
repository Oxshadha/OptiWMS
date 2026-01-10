#!/bin/bash

# Safe version: Skip generation if data already exists, only generate orders and tasks
# Uses JWT authentication (required for admin endpoints)
# Usage: ./generate-test-data-safe.sh

BASE_URL="http://localhost:8080"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"

echo "🔐 Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")

# Extract JWT token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "❌ Failed to login"
    echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Login successful"
echo ""

echo "🚀 Generating test data (orders and tasks only)..."
echo "   Note: Skipping master data generation if already exists"
echo ""

# Step 1: Check if we need master data, generate only if missing
echo "📦 Step 1: Checking master data..."
SUPPLIERS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/master/suppliers" | jq '. | length' 2>/dev/null || echo "0")
CUSTOMERS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/master/customers" | jq '. | length' 2>/dev/null || echo "0")
COURIERS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/master/delivery-partners" | jq '. | length' 2>/dev/null || echo "0")

if [ "$SUPPLIERS" -lt 5 ] || [ "$CUSTOMERS" -lt 5 ] || [ "$COURIERS" -lt 3 ]; then
    echo "   Generating missing master data..."
    RESPONSE=$(curl -s -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "suppliersCount": 15,
        "couriersCount": 10,
        "customersCount": 30
      }' \
      "$BASE_URL/api/integration/synthetic/all")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo "✅ Master data generated!"
    else
        echo "⚠️  Master data generation had issues (may already exist)"
    fi
else
    echo "✅ Master data already exists (Suppliers: $SUPPLIERS, Customers: $CUSTOMERS, Couriers: $COURIERS)"
fi

echo ""
echo "📋 Step 2: Generating orders..."
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inboundCount": 10,
    "outboundCount": 15
  }' \
  "$BASE_URL/api/integration/synthetic/orders")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Orders generated successfully!"
    echo "$RESPONSE" | jq -r '"   Orders created: \(.created)"'
else
    echo "❌ Failed to generate orders"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

echo ""
echo "✅ Step 3: Generating tasks..."
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickingCount": 20,
    "putawayCount": 15,
    "packingCount": 10
  }' \
  "$BASE_URL/api/integration/synthetic/tasks")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Tasks generated successfully!"
    echo "$RESPONSE" | jq -r '"   Tasks created: \(.created)"'
else
    echo "❌ Failed to generate tasks"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

echo ""
echo "🎉 Test data generation complete!"
echo ""
echo "Summary:"
echo "  - Orders: Inbound and Outbound with Order Items"
echo "  - Tasks: Picking, Putaway, and Packing"
echo ""
echo "✅ Data is now stored in PostgreSQL and will persist across restarts!"
echo "You can now test the Analytics and Reports APIs with real data!"

