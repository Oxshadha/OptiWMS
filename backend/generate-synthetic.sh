#!/bin/bash

# Script to generate synthetic data for OptiWMS
# Usage: ./generate-synthetic.sh [suppliers] [couriers] [customers]

BASE_URL="http://localhost:8080"
AUTH="admin:admin123"

# Default counts
SUPPLIERS=${1:-15}
COURIERS=${2:-10}
CUSTOMERS=${3:-30}

echo "🚀 Generating synthetic data..."
echo "   Suppliers: $SUPPLIERS"
echo "   Delivery Partners: $COURIERS"
echo "   Customers: $CUSTOMERS"
echo ""

# Generate all at once
RESPONSE=$(curl -s -X POST -u "$AUTH" \
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

