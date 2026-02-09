#!/bin/bash

# Phase 2 API Test Commands
# Test Labor Productivity Analytics APIs

BASE_URL="http://localhost:8080/api"
AUTH="admin:admin123"

echo "========================================="
echo "Phase 2 API Integration Tests"
echo "========================================="
echo ""

echo "1. Testing Worker Productivity API..."
echo "GET /api/analytics/worker-productivity"
curl -s -u $AUTH "$BASE_URL/analytics/worker-productivity" | jq '.[0:3]' || echo "No data or error"
echo ""

echo "2. Testing Worker Leaderboard API (Weekly)..."
echo "GET /api/analytics/leaderboard?period=weekly"
curl -s -u $AUTH "$BASE_URL/analytics/leaderboard?period=weekly" | jq '.[0:5]' || echo "No data or error"
echo ""

echo "3. Testing Worker Leaderboard API (Monthly)..."
echo "GET /api/analytics/leaderboard?period=monthly"
curl -s -u $AUTH "$BASE_URL/analytics/leaderboard?period=monthly" | jq '.[0:5]' || echo "No data or error"
echo ""

echo "========================================="
echo "Phase 2 Tests Complete"
echo "========================================="
echo ""
echo "Note: Empty arrays are expected if no worker task data exists yet."
echo "The Labor Productivity page should display loading states and handle empty data gracefully."

