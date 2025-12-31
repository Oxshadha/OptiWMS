#!/bin/bash

# Phase 1 API Test Commands
# Test all APIs that were connected in Phase 1

BASE_URL="http://localhost:8080/api"
AUTH="admin:admin123"

echo "========================================="
echo "Phase 1 API Integration Tests"
echo "========================================="
echo ""

echo "1. Testing Stock Transfers API..."
echo "GET /api/operations/stock-transfers"
curl -s -u $AUTH "$BASE_URL/operations/stock-transfers" | jq '.[0:3]' || echo "No data or error"
echo ""

echo "2. Testing Shipments API..."
echo "GET /api/shipments"
curl -s -u $AUTH "$BASE_URL/shipments" | jq '.[0:3]' || echo "No data or error"
echo ""

echo "3. Testing Returns API..."
echo "GET /api/returns"
curl -s -u $AUTH "$BASE_URL/returns" | jq '.[0:3]' || echo "No data or error"
echo ""

echo "4. Testing Packing API..."
echo "GET /api/packing"
curl -s -u $AUTH "$BASE_URL/packing" | jq '.[0:3]' || echo "No data or error"
echo ""

echo "5. Testing Cycle Counts API..."
echo "GET /api/operations/cycle-counts"
curl -s -u $AUTH "$BASE_URL/operations/cycle-counts" | jq '.[0:3]' || echo "No data or error"
echo ""

echo "6. Testing Delivery Partners API..."
echo "GET /api/delivery-partners"
curl -s -u $AUTH "$BASE_URL/delivery-partners" | jq '.[0:3]' || echo "No data or error"
echo ""

echo "========================================="
echo "Phase 1 Tests Complete"
echo "========================================="
echo ""
echo "Note: Empty arrays are expected if no data exists yet."
echo "Frontend pages should display loading states and handle empty data gracefully."
