#!/bin/bash

# Script to generate synthetic data for OptiWMS using JWT authentication
# Usage: ./generate-synthetic-jwt.sh [suppliers] [couriers] [customers]

BASE_URL="http://localhost:8080"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"

# Default counts
SUPPLIERS=${1:-15}
COURIERS=${2:-10}
CUSTOMERS=${3:-30}

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

echo "🚀 Generating synthetic data..."
echo "   Suppliers: $SUPPLIERS"
echo "   Delivery Partners: $COURIERS"
echo "   Customers: $CUSTOMERS"
echo ""

# Generate all at once using JWT token
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"suppliersCount\": $SUPPLIERS,
    \"couriersCount\": $COURIERS,
    \"customersCount\": $CUSTOMERS
  }" \
  "$BASE_URL/api/integration/synthetic/all")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Synthetic data generated successfully!"
    echo ""
    echo "Results:"
    echo "$RESPONSE" | jq -r '
        "   Suppliers: \(.suppliersCreated)",
        "   Delivery Partners: \(.couriersCreated)",
        "   Customers: \(.customersCreated)"
    '
else
    echo "❌ Failed to generate synthetic data"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi
