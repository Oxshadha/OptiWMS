#!/bin/bash

echo "=== Testing OptiWMS Backend APIs ==="
echo ""

BASE_URL="http://localhost:8080"
AUTH="admin:admin123"

echo "1. Testing Health Endpoint..."
curl -s http://localhost:8080/actuator/health
echo -e "\n"

echo "2. Testing Authentication..."
curl -s -u $AUTH http://localhost:8080/api/auth/me
echo -e "\n\n"

echo "3. Testing Master Data APIs..."
echo "   - Warehouses:"
curl -s -u $AUTH $BASE_URL/api/master/warehouses | head -5
echo -e "\n"
echo "   - Materials:"
curl -s -u $AUTH $BASE_URL/api/master/materials | head -5
echo -e "\n"
echo "   - Inventory:"
curl -s -u $AUTH $BASE_URL/api/inventory | head -5
echo -e "\n\n"

echo "4. Testing Operations APIs..."
echo "   - Stock Transfers:"
curl -s -u $AUTH -w "\nHTTP Status: %{http_code}\n" $BASE_URL/api/operations/stock-transfers
echo -e "\n"
echo "   - Cycle Counts:"
curl -s -u $AUTH -w "\nHTTP Status: %{http_code}\n" $BASE_URL/api/operations/cycle-counts
echo -e "\n"
echo "   - Receiving (test order lookup):"
curl -s -u $AUTH -w "\nHTTP Status: %{http_code}\n" $BASE_URL/api/operations/receiving/order/PO-001
echo -e "\n\n"

echo "=== API Test Complete ==="

