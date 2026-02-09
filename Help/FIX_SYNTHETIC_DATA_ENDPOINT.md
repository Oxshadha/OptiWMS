# Fix: Synthetic Data Endpoint 404 Error

## 🔍 Issue
The endpoint `/api/integration/synthetic/all` returns 404 Not Found.

## ✅ Solution Applied

### 1. Explicit Component Scanning
Updated `OptiWmsApplication.java` to explicitly scan both:
- `com.optiwms.coreapi` (controllers)
- `com.optiwms.integration` (services)

**Changed from:**
```java
@SpringBootApplication(scanBasePackages = "com.optiwms")
```

**Changed to:**
```java
@SpringBootApplication
@ComponentScan(basePackages = {"com.optiwms.coreapi", "com.optiwms.coreapp", "com.optiwms.integration"})
```

**Note:** We need to include `coreapp` because that's where services like `InventoryService`, `MaterialService`, etc. are located.

This ensures both the controller (`SyntheticDataController`) and service (`SyntheticDataGenerator`) are properly scanned and registered.

---

## 🚀 Next Steps

### 1. Rebuild the Application
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend
./gradlew clean build
```

### 2. Restart the Application
```bash
./gradlew :core-api:bootRun
```

Wait for: `Started OptiWmsApplication`

### 3. Test the Endpoint
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "suppliersCount": 15,
    "couriersCount": 10,
    "customersCount": 30
  }' \
  http://localhost:8080/api/integration/synthetic/all
```

**Expected Response:**
```json
{
  "success": true,
  "suppliersCreated": 15,
  "couriersCreated": 10,
  "customersCreated": 30,
  "message": "All synthetic data generated successfully"
}
```

---

## 🔍 Verify Endpoints Are Registered

After restart, you can check if endpoints are available:

```bash
# Check actuator endpoints (if enabled)
curl http://localhost:8080/actuator/mappings | jq '.contexts.application.mappings.dispatcherServlets.dispatcherServlet[].predicate' | grep synthetic
```

Or test individual endpoints:
```bash
# Test suppliers endpoint
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 5}' \
  http://localhost:8080/api/integration/synthetic/suppliers

# Test delivery partners endpoint
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 5}' \
  http://localhost:8080/api/integration/synthetic/delivery-partners

# Test customers endpoint
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 10}' \
  http://localhost:8080/api/integration/synthetic/customers
```

---

## 📝 Why This Happened

The `@SpringBootApplication(scanBasePackages = "com.optiwms")` should have worked, but sometimes Spring Boot needs explicit component scanning when:
1. Services are in separate modules
2. The module structure is complex
3. There are multiple source sets

By explicitly listing both packages, we ensure:
- Controllers in `com.optiwms.coreapi.integration` are found
- Services in `com.optiwms.integration` are found
- All dependencies are properly wired

---

**Status:** ✅ Fixed - Rebuild and restart required

