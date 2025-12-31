#!/bin/bash

# Comprehensive Test Script for All Phases (1-6)
# Tests all implemented APIs and integrations

BASE_URL="http://localhost:8080/api"
AUTH="admin:admin123"

echo "========================================="
echo "Comprehensive API Integration Tests"
echo "Testing Phases 1, 2, 4, and 6"
echo "========================================="
echo ""

# Phase 1 Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 1: Quick Wins"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1. Stock Transfers API..."
echo "   GET /api/operations/stock-transfers"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/operations/stock-transfers")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "   ✅ Status: OK (${COUNT} transfers)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "   (Empty array - expected if no data)"
else
    echo "   ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

echo "2. Shipments API..."
echo "   GET /api/shipments"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/shipments")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "   ✅ Status: OK (${COUNT} shipments)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "   (Empty array - expected if no data)"
else
    echo "   ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

echo "3. Returns API..."
echo "   GET /api/returns"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/returns")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "   ✅ Status: OK (${COUNT} returns)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "   (Empty array - expected if no data)"
else
    echo "   ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

echo "4. Packing API..."
echo "   GET /api/packing"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/packing")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "   ✅ Status: OK (${COUNT} packing records)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "   (Empty array - expected if no data)"
else
    echo "   ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

echo "5. Cycle Counts API..."
echo "   GET /api/operations/cycle-counts"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/operations/cycle-counts")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "   ✅ Status: OK (${COUNT} cycle counts)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "   (Empty array - expected if no data)"
else
    echo "   ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

echo "6. Delivery Partners API..."
echo "   GET /api/delivery-partners"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/delivery-partners")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "   ✅ Status: OK (${COUNT} delivery partners)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "   (Empty array - expected if no data)"
else
    echo "   ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

# Phase 2 Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 2: Analytics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "7. Worker Productivity API..."
echo "   GET /api/analytics/worker-productivity"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/analytics/worker-productivity")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "   ✅ Status: OK (${COUNT} worker productivity records)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "   (Empty array - expected if no worker tasks)"
else
    echo "   ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

echo "8. Worker Leaderboard API (Weekly)..."
echo "   GET /api/analytics/leaderboard?period=weekly"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/analytics/leaderboard?period=weekly")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "   ✅ Status: OK (${COUNT} leaderboard entries)"
    echo "$RESPONSE" | jq '.[0:3]' 2>/dev/null || echo "   (Empty array - expected if no worker tasks)"
else
    echo "   ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

echo "9. Worker Leaderboard API (Monthly)..."
echo "   GET /api/analytics/leaderboard?period=monthly"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/analytics/leaderboard?period=monthly")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "   ✅ Status: OK (${COUNT} leaderboard entries)"
    echo "$RESPONSE" | jq '.[0:3]' 2>/dev/null || echo "   (Empty array - expected if no worker tasks)"
else
    echo "   ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

# Phase 4 Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 4: New APIs (Quality Checks & Anomalies)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "10. Quality Checks API..."
echo "    GET /api/quality-checks"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/quality-checks")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "    ✅ Status: OK (${COUNT} quality checks)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "    (Empty array - expected if no quality checks)"
else
    echo "    ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

echo "11. Anomalies API..."
echo "    GET /api/anomalies"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/anomalies")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "    ✅ Status: OK (${COUNT} anomalies)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "    (Empty array - expected if no anomalies)"
else
    echo "    ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

# Phase 6 Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 6: Worker Pages"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "12. Tasks API (for Worker Tasks page)..."
echo "    GET /api/tasks"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/tasks")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "    ✅ Status: OK (${COUNT} tasks)"
    echo "$RESPONSE" | jq '.[0:2]' 2>/dev/null || echo "    (Empty array - expected if no tasks)"
else
    echo "    ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

echo "13. Worker Productivity (for Worker Profile stats)..."
echo "    GET /api/analytics/worker-productivity"
RESPONSE=$(curl -s -u $AUTH "$BASE_URL/analytics/worker-productivity")
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    echo "    ✅ Status: OK (${COUNT} worker productivity records)"
    if [ "$COUNT" -gt 0 ]; then
        echo "    Sample data:"
        echo "$RESPONSE" | jq '.[0] | {workerId, workerName, tasksCompleted, picksPerHour, errorRate}' 2>/dev/null
    fi
else
    echo "    ❌ Status: ERROR"
    echo "$RESPONSE"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All API endpoints tested"
echo ""
echo "Note:"
echo "- Empty arrays are expected if no data exists yet"
echo "- Frontend pages should display loading states and handle empty data gracefully"
echo "- To test with data, run: ./backend/generate-test-data-safe.sh"
echo ""
echo "========================================="

