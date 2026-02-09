# Quick API Test Guide

## ⚠️ Important: Use Actual UUIDs, Not Placeholders

**❌ WRONG:**
```bash
curl -u admin:admin123 http://localhost:8080/api/inventory/{id}/quantity
```

**✅ CORRECT:**
```bash
# First get the actual ID
INVENTORY_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/inventory | jq -r '.[0].id')

# Then use it
curl -u admin:admin123 "http://localhost:8080/api/inventory/$INVENTORY_ID/quantity?quantityChange=10"
```

---

## 🚀 Quick Test Script

Run the automated test script:

```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend
./test-apis.sh
```

This script will:
1. Get or create a warehouse
2. Test location API
3. Test inventory API (check String quantities)
4. Test quarantine API
5. Test task assignment API

---

## 📋 Manual Test Examples

### 1. Test Inventory (Check Quantity Type)

```bash
# Should return quantities as STRINGS
curl -u admin:admin123 http://localhost:8080/api/inventory | jq '.[0] | {quantity, availableQuantity}'
```

**Expected:**
```json
{
  "quantity": "100.00",      // ✅ String
  "availableQuantity": "95.00"  // ✅ String
}
```

### 2. Test Location API

```bash
# Get warehouse ID first
WAREHOUSE_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses | jq -r '.[0].id')

# Test locations by warehouse
curl -u admin:admin123 "http://localhost:8080/api/locations/warehouse/$WAREHOUSE_ID"
```

### 3. Test Inventory Quantity Update

```bash
# Get inventory ID
INVENTORY_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/inventory | jq -r '.[0].id')

# Update quantity (add 10)
curl -X PATCH -u admin:admin123 \
  "http://localhost:8080/api/inventory/$INVENTORY_ID/quantity?quantityChange=10"
```

### 4. Test Task Assignment

```bash
# Get task and worker IDs
TASK_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/tasks | jq -r '.[0].id')
WORKER_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/users | jq -r '.[0].id')

# Assign task
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{\"workerId\":\"$WORKER_ID\",\"assignedBy\":\"admin\"}" \
  "http://localhost:8080/api/tasks/$TASK_ID/assign"
```

---

## 🔍 Verify APIs Are Working

### Check if Backend is Running:
```bash
curl http://localhost:8080/actuator/health
```

### Check Available Endpoints:
```bash
# List all endpoints (if actuator is enabled)
curl http://localhost:8080/actuator/mappings 2>/dev/null | jq '.contexts.application.mappings.dispatcherServlets.dispatcherServlet[].predicate' | grep -E "(inventory|location|task)"
```

---

## ✅ Success Indicators

1. **Inventory API:**
   - Quantities returned as **strings** (not numbers)
   - All endpoints return 200 OK

2. **Location API:**
   - Can list locations
   - Can get by warehouse
   - Can create locations

3. **Task API:**
   - Can assign tasks
   - Returns updated task with assigned worker

---

**Run the test script to verify everything works!**

