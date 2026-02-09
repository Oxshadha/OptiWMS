# New APIs Test Commands - Reports & Analytics

## Prerequisites

1. **Backend must be running:**
   ```bash
   cd backend
   ./gradlew :core-api:bootRun
   ```

2. **Get IDs for testing:**
   ```bash
   # Get warehouse ID
   WAREHOUSE_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses | jq -r '.[0].id')
   echo "Warehouse ID: $WAREHOUSE_ID"

   # Get a worker/user ID
   WORKER_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/users | jq -r '.[0].id')
   echo "Worker ID: $WORKER_ID"
   ```

---

## 📊 Reports API

### 1. Get All Reports
```bash
# Get all reports
curl -u admin:admin123 http://localhost:8080/api/reports | jq

# Get reports by type
curl -u admin:admin123 "http://localhost:8080/api/reports?type=inventory" | jq

# Get reports by type and status
curl -u admin:admin123 "http://localhost:8080/api/reports?type=inbound&status=completed" | jq
```

### 2. Get Report by ID
```bash
curl -u admin:admin123 http://localhost:8080/api/reports/REPORT_ID | jq
```

### 3. Generate Report
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "reportName": "Monthly Inventory Report",
    "reportType": "inventory",
    "description": "Monthly inventory summary report",
    "reportConfig": "{\"startDate\":\"2024-12-01\",\"endDate\":\"2024-12-31\"}",
    "createdBy": null
  }' \
  http://localhost:8080/api/reports/generate | jq
```

### 4. Download Report
```bash
curl -u admin:admin123 http://localhost:8080/api/reports/REPORT_ID/download | jq
```

### 5. Create Custom Report
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "reportName": "Custom Sales Report",
    "reportType": "sales",
    "description": "Custom sales analysis",
    "reportConfig": "{\"filters\":{\"dateRange\":\"last30days\",\"productCategory\":\"electronics\"}}",
    "createdBy": null
  }' \
  http://localhost:8080/api/reports/custom | jq
```

### 6. Get All Scheduled Reports
```bash
# Get all scheduled reports
curl -u admin:admin123 http://localhost:8080/api/reports/scheduled | jq

# Get scheduled reports by type
curl -u admin:admin123 "http://localhost:8080/api/reports/scheduled?type=inventory" | jq
```

### 7. Get Scheduled Report by ID
```bash
curl -u admin:admin123 http://localhost:8080/api/reports/scheduled/SCHEDULED_REPORT_ID | jq
```

### 8. Schedule Report
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "inventory",
    "frequency": "weekly",
    "scheduledTime": "09:00:00",
    "emailRecipients": ["admin@optiwms.com", "manager@optiwms.com"],
    "isActive": true,
    "createdBy": null
  }' \
  http://localhost:8080/api/reports/schedule | jq
```

### 9. Update Scheduled Report
```bash
curl -X PUT -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "inventory",
    "frequency": "daily",
    "scheduledTime": "08:00:00",
    "emailRecipients": ["admin@optiwms.com"],
    "isActive": true
  }' \
  http://localhost:8080/api/reports/scheduled/SCHEDULED_REPORT_ID | jq
```

### 10. Delete Scheduled Report
```bash
curl -X DELETE -u admin:admin123 \
  http://localhost:8080/api/reports/scheduled/SCHEDULED_REPORT_ID
```

---

## 📈 Analytics API

### 1. Worker Productivity
```bash
# Get worker productivity (monthly)
curl -u admin:admin123 "http://localhost:8080/api/analytics/worker-productivity?period=monthly" | jq

# Get worker productivity for specific warehouse
curl -u admin:admin123 "http://localhost:8080/api/analytics/worker-productivity?period=weekly&warehouseId=$WAREHOUSE_ID" | jq

# Get daily productivity
curl -u admin:admin123 "http://localhost:8080/api/analytics/worker-productivity?period=daily" | jq
```

### 2. Leaderboard
```bash
# Weekly leaderboard
curl -u admin:admin123 "http://localhost:8080/api/analytics/leaderboard?period=weekly" | jq

# Monthly leaderboard
curl -u admin:admin123 "http://localhost:8080/api/analytics/leaderboard?period=monthly" | jq

# Leaderboard for specific warehouse
curl -u admin:admin123 "http://localhost:8080/api/analytics/leaderboard?period=monthly&warehouseId=$WAREHOUSE_ID" | jq
```

### 3. Dashboard KPIs
```bash
# Get dashboard KPIs
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/kpis" | jq

# Get KPIs for specific warehouse
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/kpis?warehouseId=$WAREHOUSE_ID" | jq

# Get KPIs for specific period
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/kpis?period=weekly" | jq
```

### 4. Orders Chart
```bash
# Daily orders chart
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/orders-chart?period=daily" | jq

# Weekly orders chart
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/orders-chart?period=weekly" | jq

# Monthly orders chart
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/orders-chart?period=monthly" | jq

# Orders chart for specific warehouse
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/orders-chart?period=monthly&warehouseId=$WAREHOUSE_ID" | jq
```

### 5. Top Products
```bash
# Get top 10 products (default)
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/top-products" | jq

# Get top 5 products
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/top-products?limit=5" | jq

# Get top products for specific warehouse
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/top-products?limit=10&warehouseId=$WAREHOUSE_ID" | jq
```

### 6. Inventory Overview
```bash
# Get inventory overview
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/inventory-overview" | jq

# Get inventory overview for specific warehouse
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/inventory-overview?warehouseId=$WAREHOUSE_ID" | jq
```

### 7. Worker Stats
```bash
# Get worker statistics
curl -u admin:admin123 "http://localhost:8080/api/analytics/workers/$WORKER_ID/stats" | jq
```

### 8. Worker Achievements
```bash
# Get worker achievements
curl -u admin:admin123 "http://localhost:8080/api/analytics/workers/$WORKER_ID/achievements" | jq
```

---

## 🧪 Complete Test Workflow

### Step 1: Set Variables
```bash
WAREHOUSE_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses | jq -r '.[0].id')
WORKER_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/users | jq -r '.[0].id')
echo "Warehouse ID: $WAREHOUSE_ID"
echo "Worker ID: $WORKER_ID"
```

### Step 2: Test Reports API
```bash
# Generate a report
REPORT_RESPONSE=$(curl -s -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{
    \"reportName\": \"Test Report $(date +%s)\",
    \"reportType\": \"inventory\",
    \"description\": \"Test report\",
    \"reportConfig\": \"{}\",
    \"createdBy\": null
  }" \
  http://localhost:8080/api/reports/generate)

REPORT_ID=$(echo $REPORT_RESPONSE | jq -r '.id')
echo "Created Report ID: $REPORT_ID"

# Get the report
curl -u admin:admin123 "http://localhost:8080/api/reports/$REPORT_ID" | jq

# Schedule a report
SCHEDULED_RESPONSE=$(curl -s -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{
    \"reportType\": \"inventory\",
    \"frequency\": \"daily\",
    \"scheduledTime\": \"09:00:00\",
    \"emailRecipients\": [\"test@optiwms.com\"],
    \"isActive\": true,
    \"createdBy\": null
  }" \
  http://localhost:8080/api/reports/schedule)

SCHEDULED_ID=$(echo $SCHEDULED_RESPONSE | jq -r '.id')
echo "Created Scheduled Report ID: $SCHEDULED_ID"
```

### Step 3: Test Analytics API
```bash
# Test Dashboard KPIs
echo "=== Dashboard KPIs ==="
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/kpis?warehouseId=$WAREHOUSE_ID" | jq

# Test Worker Productivity
echo "=== Worker Productivity ==="
curl -u admin:admin123 "http://localhost:8080/api/analytics/worker-productivity?period=monthly" | jq

# Test Leaderboard
echo "=== Leaderboard ==="
curl -u admin:admin123 "http://localhost:8080/api/analytics/leaderboard?period=monthly" | jq

# Test Orders Chart
echo "=== Orders Chart ==="
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/orders-chart?period=monthly" | jq

# Test Top Products
echo "=== Top Products ==="
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/top-products?limit=5" | jq

# Test Inventory Overview
echo "=== Inventory Overview ==="
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/inventory-overview" | jq

# Test Worker Stats
echo "=== Worker Stats ==="
curl -u admin:admin123 "http://localhost:8080/api/analytics/workers/$WORKER_ID/stats" | jq

# Test Worker Achievements
echo "=== Worker Achievements ==="
curl -u admin:admin123 "http://localhost:8080/api/analytics/workers/$WORKER_ID/achievements" | jq
```

---

## 🎯 Quick Test Script

Save this as `test-new-apis.sh`:

```bash
#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Testing New APIs ===${NC}\n"

# Get IDs
WAREHOUSE_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses | jq -r '.[0].id')
WORKER_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/users | jq -r '.[0].id')

echo -e "${GREEN}Warehouse ID:${NC} $WAREHOUSE_ID"
echo -e "${GREEN}Worker ID:${NC} $WORKER_ID\n"

# Test Reports
echo -e "${BLUE}1. Testing Reports API${NC}"
curl -s -u admin:admin123 http://localhost:8080/api/reports | jq '. | length' | xargs echo "Reports count:"

# Test Analytics - Dashboard KPIs
echo -e "\n${BLUE}2. Testing Analytics - Dashboard KPIs${NC}"
curl -s -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/kpis" | jq

# Test Analytics - Leaderboard
echo -e "\n${BLUE}3. Testing Analytics - Leaderboard${NC}"
curl -s -u admin:admin123 "http://localhost:8080/api/analytics/leaderboard?period=monthly" | jq

# Test Analytics - Worker Productivity
echo -e "\n${BLUE}4. Testing Analytics - Worker Productivity${NC}"
curl -s -u admin:admin123 "http://localhost:8080/api/analytics/worker-productivity?period=monthly" | jq

# Test Analytics - Worker Stats
echo -e "\n${BLUE}5. Testing Analytics - Worker Stats${NC}"
curl -s -u admin:admin123 "http://localhost:8080/api/analytics/workers/$WORKER_ID/stats" | jq

# Test Analytics - Worker Achievements
echo -e "\n${BLUE}6. Testing Analytics - Worker Achievements${NC}"
curl -s -u admin:admin123 "http://localhost:8080/api/analytics/workers/$WORKER_ID/achievements" | jq

echo -e "\n${GREEN}=== All Tests Complete ===${NC}"
```

Make it executable:
```bash
chmod +x test-new-apis.sh
./test-new-apis.sh
```

---

## 📋 Expected Responses

### Reports Response Example:
```json
{
  "id": "uuid-here",
  "reportName": "Monthly Inventory Report",
  "reportType": "inventory",
  "description": "Monthly inventory summary",
  "reportConfig": "{\"startDate\":\"2024-12-01\"}",
  "generatedAt": "2024-12-30T14:00:00",
  "fileSizeBytes": null,
  "filePath": null,
  "createdBy": null
}
```

### Dashboard KPIs Response Example:
```json
{
  "totalOrders": 156,
  "ordersThisPeriod": 45,
  "totalItems": 4236,
  "lowStockItems": 147,
  "totalTasks": 1234,
  "completedTasks": 1156
}
```

### Leaderboard Response Example:
```json
[
  {
    "workerId": "uuid-here",
    "workerName": "John Doe",
    "taskCount": 45,
    "rank": 1
  },
  {
    "workerId": "uuid-here",
    "workerName": "Jane Smith",
    "taskCount": 38,
    "rank": 2
  }
]
```

### Worker Productivity Response Example:
```json
[
  {
    "workerId": "uuid-here",
    "workerName": "John Doe",
    "totalTasks": 50,
    "completedTasks": 45,
    "totalTimeMinutes": 450,
    "averageTimeMinutes": 10.00,
    "efficiency": 90.0000
  }
]
```

---

## 🔍 Troubleshooting

### Empty Results
- **Analytics endpoints returning empty arrays:** This is normal if there's no data yet
- Create some tasks, orders, or inventory items first
- Use the existing data import scripts if available

### 404 Not Found
- Check that IDs are valid UUIDs
- Verify the backend is running
- Check that migrations have been applied

### 400 Bad Request
- Verify JSON format is correct
- Check that required fields are present
- Ensure date/time formats are correct (ISO 8601)

---

## ✅ Quick Verification

Test all endpoints are accessible:
```bash
# Reports
curl -u admin:admin123 http://localhost:8080/api/reports
curl -u admin:admin123 http://localhost:8080/api/reports/scheduled

# Analytics
curl -u admin:admin123 "http://localhost:8080/api/analytics/dashboard/kpis"
curl -u admin:admin123 "http://localhost:8080/api/analytics/leaderboard?period=monthly"
curl -u admin:admin123 "http://localhost:8080/api/analytics/worker-productivity?period=monthly"
```

All should return JSON responses (even if empty arrays).

