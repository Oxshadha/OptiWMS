# Backend Startup & API Testing Guide

## 🚀 Starting the Backend

### Step 1: Start the Backend Server
```bash
cd backend
./gradlew :core-api:bootRun
```

### Step 2: Wait for Startup
Look for these log messages:
- ✅ `Found X JPA repository interfaces` (should show 7+ repositories now)
- ✅ `Tomcat started on port 8080`
- ✅ `Started OptiWmsApplication`

**Expected Repository Count:** Should show **7+ repositories** (was 3 before):
- MaterialRepository
- WarehouseRepository  
- InventoryItemRepository
- OrderRepository (NEW)
- OrderItemRepository (NEW)
- TaskRepository (NEW)
- StockTransferRepository (NEW)
- CycleCountRepository (NEW)

## 🧪 Testing API Endpoints

### Quick Test Script
```bash
cd backend
./test-apis.sh
```

### Manual Testing

#### 1. Health Check
```bash
curl http://localhost:8080/actuator/health
```

#### 2. Authentication
```bash
curl -u admin:admin123 http://localhost:8080/api/auth/me
```

#### 3. Master Data APIs (Existing)
```bash
# Warehouses
curl -u admin:admin123 http://localhost:8080/api/master/warehouses

# Materials
curl -u admin:admin123 http://localhost:8080/api/master/materials

# Inventory
curl -u admin:admin123 http://localhost:8080/api/inventory
```

#### 4. Operations APIs (NEW)

**Stock Transfers:**
```bash
# List all transfers
curl -u admin:admin123 http://localhost:8080/api/operations/stock-transfers

# Get specific transfer
curl -u admin:admin123 http://localhost:8080/api/operations/stock-transfers/{id}
```

**Cycle Counts:**
```bash
# List all cycle counts
curl -u admin:admin123 http://localhost:8080/api/operations/cycle-counts

# Get specific cycle count
curl -u admin:admin123 http://localhost:8080/api/operations/cycle-counts/{id}
```

**Receiving:**
```bash
# Get order by number
curl -u admin:admin123 http://localhost:8080/api/operations/receiving/order/PO-001
```

**Picking:**
```bash
# Complete picking task
curl -u admin:admin123 -X POST \
  http://localhost:8080/api/operations/picking/complete/{taskId} \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "materialId": "uuid",
        "quantity": "10",
        "locationCode": "A-01-01"
      }
    ]
  }'
```

**Putaway:**
```bash
# Complete putaway task
curl -u admin:admin123 -X POST \
  http://localhost:8080/api/operations/putaway/complete/{taskId} \
  -H "Content-Type: application/json" \
  -d '{
    "locationCode": "A-01-01",
    "lpn": "LPN-12345"
  }'
```

## ✅ Expected Results

### Successful Startup Indicators:
1. ✅ **Repository Detection:** "Found 7+ JPA repository interfaces"
2. ✅ **Database Connection:** "HikariPool-1 - Start completed"
3. ✅ **Flyway Migration:** "Schema is up to date"
4. ✅ **Tomcat Started:** "Tomcat started on port 8080"
5. ✅ **Application Started:** "Started OptiWmsApplication"

### API Response Codes:
- **200 OK:** Successful request
- **401 Unauthorized:** Missing or invalid credentials
- **404 Not Found:** Resource doesn't exist (expected for empty lists)
- **400 Bad Request:** Invalid request data

## 🔍 Troubleshooting

### If Backend Won't Start:
1. Check database is running: `docker ps` (if using Docker)
2. Check port 8080 is free: `lsof -i :8080`
3. Check compilation errors: `./gradlew clean compileJava`
4. Check logs for specific errors

### If APIs Return 404:
- Check endpoint URL is correct
- Verify authentication: `curl -u admin:admin123 http://localhost:8080/api/auth/me`
- Check Spring Boot logs for endpoint registration

### If Repository Count is Still 3:
- Verify all new repository files exist
- Check package structure matches `@EnableJpaRepositories(basePackages = "com.optiwms.infra")`
- Rebuild: `./gradlew clean build`

## 📊 Verification Checklist

- [ ] Backend starts without errors
- [ ] Repository count shows 7+ repositories
- [ ] Health endpoint responds
- [ ] Authentication works
- [ ] Master data APIs respond
- [ ] Stock Transfer API responds
- [ ] Cycle Count API responds
- [ ] Receiving API responds
- [ ] All endpoints return proper HTTP status codes

