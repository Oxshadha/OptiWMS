#!/bin/bash

# Test script for Tasks Page - Verify 100% Backend Connection
# This script tests all API endpoints used by the tasks page

API_BASE="http://localhost:8080/api"
AUTH_USER="admin"
AUTH_PASS="admin"

echo "=========================================="
echo "Testing Tasks Page Backend Connection"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test API endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo "Testing: $name"
    echo "  $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -u "$AUTH_USER:$AUTH_PASS" "$API_BASE$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -u "$AUTH_USER:$AUTH_PASS" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -u "$AUTH_USER:$AUTH_PASS" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "  ${GREEN}✅ Status: $http_code${NC}"
        item_count=$(echo "$body" | jq 'if type=="array" then length else 1 end' 2>/dev/null || echo "N/A")
        echo "  Response: $item_count items"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "  ${RED}❌ Status: $http_code${NC}"
        echo "  Error: $(echo "$body" | jq -r '.message // .error // "Unknown error"' 2>/dev/null || echo "$body")"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "=========================================="
echo "1. TESTING TASKS API"
echo "=========================================="
echo ""

# Test 1: Get all tasks
test_endpoint "GET /tasks" "GET" "/tasks"

# Test 2: Get tasks by status
test_endpoint "GET /tasks?status=pending" "GET" "/tasks?status=pending"
test_endpoint "GET /tasks?status=in_progress" "GET" "/tasks?status=in_progress"
test_endpoint "GET /tasks?status=completed" "GET" "/tasks?status=completed"

# Test 3: Get tasks by type
test_endpoint "GET /tasks?taskType=picking" "GET" "/tasks?taskType=picking"
test_endpoint "GET /tasks?taskType=putaway" "GET" "/tasks?taskType=putaway"

echo ""
echo "=========================================="
echo "2. TESTING USERS/WORKERS API"
echo "=========================================="
echo ""

# Test 4: Get all users
test_endpoint "GET /users" "GET" "/users"

# Test 5: Get workers by role (for task assignment)
test_endpoint "GET /users?role=picker" "GET" "/users?role=picker"
test_endpoint "GET /users?role=packer" "GET" "/users?role=packer"
test_endpoint "GET /users?role=forklift_operator" "GET" "/users?role=forklift_operator"
test_endpoint "GET /users?role=unloading_worker" "GET" "/users?role=unloading_worker"
test_endpoint "GET /users?role=cycle_count_worker" "GET" "/users?role=cycle_count_worker"

echo ""
echo "=========================================="
echo "3. TESTING WAREHOUSES API"
echo "=========================================="
echo ""

# Test 6: Get all warehouses
test_endpoint "GET /master/warehouses" "GET" "/master/warehouses"

echo ""
echo "=========================================="
echo "4. TESTING TASK CREATION"
echo "=========================================="
echo ""

# Get a warehouse ID for task creation
WAREHOUSE_ID=$(curl -s -u "$AUTH_USER:$AUTH_PASS" "$API_BASE/master/warehouses" | jq -r '.[0].id // empty' 2>/dev/null)

if [ -z "$WAREHOUSE_ID" ]; then
    echo -e "${YELLOW}⚠️  No warehouses found. Skipping task creation test.${NC}"
    echo "  Please create a warehouse first."
else
    echo "Using warehouse ID: $WAREHOUSE_ID"
    
    # Test 7: Create a task
    TASK_DATA=$(cat <<EOF
{
  "taskNumber": "TEST-TASK-$(date +%s)",
  "taskType": "picking",
  "warehouseId": "$WAREHOUSE_ID",
  "priority": "normal",
  "status": "pending",
  "notes": "Test task created by test script"
}
EOF
)
    
    test_endpoint "POST /tasks (Create task)" "POST" "/tasks" "$TASK_DATA"
fi

echo ""
echo "=========================================="
echo "5. TESTING TASK STATUS UPDATE"
echo "=========================================="
echo ""

# Get a task ID for status update
TASK_ID=$(curl -s -u "$AUTH_USER:$AUTH_PASS" "$API_BASE/tasks" | jq -r '.[0].id // empty' 2>/dev/null)

if [ -z "$TASK_ID" ]; then
    echo -e "${YELLOW}⚠️  No tasks found. Skipping status update test.${NC}"
else
    echo "Using task ID: $TASK_ID"
    
    # Test 8: Update task status
    STATUS_DATA='{"status": "in_progress"}'
    test_endpoint "PUT /tasks/{id}/status" "PUT" "/tasks/$TASK_ID/status" "$STATUS_DATA"
fi

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Tasks page is 100% connected to backend!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Please check the errors above.${NC}"
    exit 1
fi

