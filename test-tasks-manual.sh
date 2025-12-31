#!/bin/bash

# Manual Test Commands for Tasks Page
# Run these commands after starting the backend

API_BASE="http://localhost:8080/api"
AUTH_USER="admin"
AUTH_PASS="admin"

echo "=========================================="
echo "Tasks Page - Manual Test Commands"
echo "=========================================="
echo ""
echo "⚠️  Make sure the backend is running on port 8080"
echo ""

echo "1. Test GET all tasks:"
echo "curl -u $AUTH_USER:$AUTH_PASS $API_BASE/tasks | jq"
echo ""

echo "2. Test GET tasks by status:"
echo "curl -u $AUTH_USER:$AUTH_PASS '$API_BASE/tasks?status=pending' | jq"
echo "curl -u $AUTH_USER:$AUTH_PASS '$API_BASE/tasks?status=in_progress' | jq"
echo ""

echo "3. Test GET tasks by type:"
echo "curl -u $AUTH_USER:$AUTH_PASS '$API_BASE/tasks?taskType=picking' | jq"
echo "curl -u $AUTH_USER:$AUTH_PASS '$API_BASE/tasks?taskType=putaway' | jq"
echo ""

echo "4. Test GET all users (workers):"
echo "curl -u $AUTH_USER:$AUTH_PASS $API_BASE/users | jq"
echo ""

echo "5. Test GET workers by role:"
echo "curl -u $AUTH_USER:$AUTH_PASS '$API_BASE/users?role=picker' | jq"
echo "curl -u $AUTH_USER:$AUTH_PASS '$API_BASE/users?role=packer' | jq"
echo "curl -u $AUTH_USER:$AUTH_PASS '$API_BASE/users?role=forklift_operator' | jq"
echo ""

echo "6. Test GET warehouses:"
echo "curl -u $AUTH_USER:$AUTH_PASS $API_BASE/master/warehouses | jq"
echo ""

echo "7. Test CREATE task (replace WAREHOUSE_ID with actual ID):"
echo "curl -u $AUTH_USER:$AUTH_PASS -X POST $API_BASE/tasks \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"taskNumber\":\"TEST-TASK-001\",\"taskType\":\"picking\",\"warehouseId\":\"WAREHOUSE_ID\",\"priority\":\"normal\",\"status\":\"pending\"}' | jq"
echo ""

echo "8. Test UPDATE task status (replace TASK_ID with actual ID):"
echo "curl -u $AUTH_USER:$AUTH_PASS -X PUT $API_BASE/tasks/TASK_ID/status \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"status\":\"in_progress\"}' | jq"
echo ""

echo "=========================================="
echo "Quick Test (if backend is running):"
echo "=========================================="
echo ""

# Check if backend is running
if curl -s -u "$AUTH_USER:$AUTH_PASS" "$API_BASE/tasks" > /dev/null 2>&1; then
    echo "✅ Backend is running!"
    echo ""
    echo "Testing endpoints..."
    echo ""
    
    echo "📋 Tasks:"
    curl -s -u "$AUTH_USER:$AUTH_PASS" "$API_BASE/tasks" | jq 'length' 2>/dev/null && echo " tasks found" || echo "Error fetching tasks"
    
    echo ""
    echo "👥 Users:"
    curl -s -u "$AUTH_USER:$AUTH_PASS" "$API_BASE/users" | jq 'length' 2>/dev/null && echo " users found" || echo "Error fetching users"
    
    echo ""
    echo "🏭 Warehouses:"
    curl -s -u "$AUTH_USER:$AUTH_PASS" "$API_BASE/master/warehouses" | jq 'length' 2>/dev/null && echo " warehouses found" || echo "Error fetching warehouses"
    
    echo ""
    echo "✅ All endpoints are accessible!"
else
    echo "❌ Backend is not running or not accessible"
    echo ""
    echo "Please start the backend first:"
    echo "  cd backend && ./gradlew bootRun"
    echo ""
    echo "Then run this script again."
fi

