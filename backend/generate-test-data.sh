#!/bin/bash

# Script to generate comprehensive test data for OptiWMS
# Usage: ./generate-test-data.sh

BASE_URL="http://localhost:8080"
AUTH="admin:admin123"

echo "🚀 Generating comprehensive test data for OptiWMS..."
echo ""

# Step 1: Generate master data (suppliers, delivery partners, customers)
echo "📦 Step 1: Generating master data..."
RESPONSE=$(curl -s -X POST -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "suppliersCount": 15,
    "couriersCount": 10,
    "customersCount": 30
  }' \
  "$BASE_URL/api/integration/synthetic/all")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Master data generated successfully!"
    echo "$RESPONSE" | jq -r '
        "   Suppliers: \(.suppliersCreated)",
        "   Delivery Partners: \(.couriersCreated)",
        "   Customers: \(.customersCreated)"
    '
else
    echo "❌ Failed to generate master data"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
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
echo "🎉 All test data generated successfully!"
echo ""
echo "Summary:"
echo "  - Suppliers, Delivery Partners, Customers"
echo "  - Inbound and Outbound Orders with Order Items"
echo "  - Picking, Putaway, and Packing Tasks"
echo ""
echo "You can now test the Analytics and Reports APIs with real data!"

