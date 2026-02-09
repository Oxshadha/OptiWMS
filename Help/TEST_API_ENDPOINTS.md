# Testing API Endpoints - Correct Examples

## ⚠️ Common Mistake

**Don't use:** `{id}` or `{warehouseId}` as literal strings  
**Use:** Actual UUID values from your database

---

## 🔍 Step 1: Get Actual IDs

### Get Warehouse ID:
```bash
curl -u admin:admin123 http://localhost:8080/api/master/warehouses | jq '.[0].id'
```

**Example output:**
```
"550e8400-e29b-41d4-a716-446655440000"
```

### Get Inventory Item ID:
```bash
curl -u admin:admin123 http://localhost:8080/api/inventory | jq '.[0].id'
```

### Get Task ID:
```bash
curl -u admin:admin123 http://localhost:8080/api/tasks | jq '.[0].id'
```

---

## ✅ Correct Test Examples

### Test Inventory API:

#### 1. List All Inventory (Should return String quantities):
```bash
curl -u admin:admin123 http://localhost:8080/api/inventory
```

**Expected:** JSON with `quantity`, `availableQuantity`, etc. as **strings**

#### 2. Get Inventory by Material:
```bash
# First get a material ID
MATERIAL_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/master/materials | jq -r '.[0].id')

# Then use it
curl -u admin:admin123 "http://localhost:8080/api/inventory/material/$MATERIAL_ID"
```

#### 3. Update Quantity (Use actual UUID):
```bash
# Get inventory item ID
INVENTORY_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/inventory | jq -r '.[0].id')

# Update quantity (add 10)
curl -X PATCH -u admin:admin123 \
  "http://localhost:8080/api/inventory/$INVENTORY_ID/quantity?quantityChange=10"
```

#### 4. Get Quarantined Items:
```bash
curl -u admin:admin123 http://localhost:8080/api/inventory/quarantined
```

---

### Test Location API:

#### 1. List All Locations:
```bash
curl -u admin:admin123 http://localhost:8080/api/locations
```

#### 2. Get Locations by Warehouse (Use actual UUID):
```bash
# Get warehouse ID first
WAREHOUSE_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses | jq -r '.[0].id')

# Then use it
curl -u admin:admin123 "http://localhost:8080/api/locations/warehouse/$WAREHOUSE_ID"
```

#### 3. Get Available Locations:
```bash
WAREHOUSE_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses | jq -r '.[0].id')
curl -u admin:admin123 "http://localhost:8080/api/locations/available?warehouseId=$WAREHOUSE_ID"
```

#### 4. Create Location:
```bash
WAREHOUSE_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/master/warehouses | jq -r '.[0].id')

curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{
    \"warehouseId\": \"$WAREHOUSE_ID\",
    \"locationCode\": \"A-01-01-1-A\",
    \"area\": \"A\",
    \"rowNumber\": \"01\",
    \"bayNumber\": \"01\",
    \"levelNumber\": 1,
    \"binPosition\": \"A\",
    \"locationType\": \"storage\",
    \"isActive\": true
  }" \
  http://localhost:8080/api/locations
```

---

### Test Task Assignment:

#### 1. List All Tasks:
```bash
curl -u admin:admin123 http://localhost:8080/api/tasks
```

#### 2. Assign Task (Use actual UUIDs):
```bash
# Get task ID
TASK_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/tasks | jq -r '.[0].id')

# Get worker/user ID
WORKER_ID=$(curl -s -u admin:admin123 http://localhost:8080/api/users | jq -r '.[0].id')

# Assign task
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d "{
    \"workerId\": \"$WORKER_ID\",
    \"assignedBy\": \"admin\"
  }" \
  "http://localhost:8080/api/tasks/$TASK_ID/assign"
```

---

## 🧪 Quick Test Script

Save this as `test-apis.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:8080"
AUTH="admin:admin123"

echo "🔍 Getting IDs..."
WAREHOUSE_ID=$(curl -s -u $AUTH "$BASE_URL/api/master/warehouses" | jq -r '.[0].id // empty')
INVENTORY_ID=$(curl -s -u $AUTH "$BASE_URL/api/inventory" | jq -r '.[0].id // empty')
TASK_ID=$(curl -s -u $AUTH "$BASE_URL/api/tasks" | jq -r '.[0].id // empty')

echo "Warehouse ID: $WAREHOUSE_ID"
echo "Inventory ID: $INVENTORY_ID"
echo "Task ID: $TASK_ID"
echo ""

if [ -z "$WAREHOUSE_ID" ]; then
  echo "⚠️  No warehouses found. Create one first."
  exit 1
fi

echo "✅ Testing Location API..."
curl -s -u $AUTH "$BASE_URL/api/locations/warehouse/$WAREHOUSE_ID" | jq 'length' || echo "Failed"

echo "✅ Testing Inventory API..."
curl -s -u $AUTH "$BASE_URL/api/inventory" | jq '.[0] | {id, quantity, availableQuantity}' || echo "Failed"

if [ ! -z "$INVENTORY_ID" ]; then
  echo "✅ Testing Inventory Quantity Update..."
  curl -s -X PATCH -u $AUTH "$BASE_URL/api/inventory/$INVENTORY_ID/quantity?quantityChange=5" | jq '.' || echo "Failed"
fi

if [ ! -z "$TASK_ID" ]; then
  WORKER_ID=$(curl -s -u $AUTH "$BASE_URL/api/users" | jq -r '.[0].id // empty')
  if [ ! -z "$WORKER_ID" ]; then
    echo "✅ Testing Task Assignment..."
    curl -s -X POST -u $AUTH \
      -H "Content-Type: application/json" \
      -d "{\"workerId\":\"$WORKER_ID\",\"assignedBy\":\"admin\"}" \
      "$BASE_URL/api/tasks/$TASK_ID/assign" | jq '.' || echo "Failed"
  fi
fi

echo ""
echo "✅ Tests complete!"
```

---

## 📝 Notes

1. **Always get actual IDs first** - Don't use `{id}` as literal
2. **Use `jq` to parse JSON** - Makes it easier to extract IDs
3. **Check if data exists** - Some endpoints need data to test
4. **UUID format** - Must be valid UUID format: `550e8400-e29b-41d4-a716-446655440000`

---

## 🔧 If You Get 400 Bad Request

1. **Check the ID format** - Must be valid UUID
2. **Check if resource exists** - ID might not exist in database
3. **Check request body** - Must be valid JSON
4. **Check query parameters** - Must match endpoint expectations

---

**Example of correct usage:**
```bash
# ❌ WRONG:
curl -u admin:admin123 http://localhost:8080/api/inventory/{id}/quantity

# ✅ CORRECT:
INVENTORY_ID="550e8400-e29b-41d4-a716-446655440000"
curl -u admin:admin123 "http://localhost:8080/api/inventory/$INVENTORY_ID/quantity?quantityChange=10"
```

