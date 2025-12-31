#!/bin/bash

# Safe version: Skip generation if data already exists, only generate orders and tasks
# Usage: ./generate-test-data-safe.sh

BASE_URL="http://localhost:8080"
AUTH="admin:admin123"

echo "🚀 Generating test data (orders and tasks only)..."
echo "   Note: Skipping master data generation if already exists"
echo ""

# Step 1: Check if we need master data, generate only if missing
echo "📦 Step 1: Checking master data..."
SUPPLIERS=$(curl -s -u "$AUTH" "$BASE_URL/api/master/suppliers" | jq '. | length')
CUSTOMERS=$(curl -s -u "$AUTH" "$BASE_URL/api/master/customers" | jq '. | length')
COURIERS=$(curl -s -u "$AUTH" "$BASE_URL/api/master/delivery-partners" | jq '. | length')

if [ "$SUPPLIERS" -lt 5 ] || [ "$CUSTOMERS" -lt 5 ] || [ "$COURIERS" -lt 3 ]; then
    echo "   Generating missing master data..."
    RESPONSE=$(curl -s -X POST -u "$AUTH" \
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
RESPONSE=$(curl -s -X POST -u "$AUTH" \
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
RESPONSE=$(curl -s -X POST -u "$AUTH" \
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
echo "You can now test the Analytics and Reports APIs with real data!"

