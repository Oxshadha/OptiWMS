# Phase 1 Quick Start Guide

## 🎯 Goal
Complete Location, Inventory, and Order APIs to connect with frontend.

---

## 📋 Step 1: Location Management APIs (START HERE)

### Current Status: ⚠️ **MISSING**

Location management is referenced in many places but no dedicated controller exists.

### Tasks:

#### 1.1 Check if Location Entity Exists
```bash
# Check for location entity
find backend/infra/src/main/java -name "*Location*.java"
```

#### 1.2 Create LocationController
**File:** `backend/core-api/src/main/java/com/optiwms/coreapi/master/LocationController.java`

**Required Endpoints:**
```java
@RestController
@RequestMapping("/api/locations")
public class LocationController {
    
    @GetMapping
    public ResponseEntity<List<LocationDto>> list(
        @RequestParam(required = false) UUID warehouseId,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String area
    ) { }
    
    @GetMapping("/{id}")
    public ResponseEntity<LocationDto> getById(@PathVariable UUID id) { }
    
    @GetMapping("/warehouse/{warehouseId}")
    public ResponseEntity<List<LocationDto>> getByWarehouse(@PathVariable UUID warehouseId) { }
    
    @GetMapping("/available")
    public ResponseEntity<List<LocationDto>> getAvailable(
        @RequestParam UUID warehouseId
    ) { }
    
    @GetMapping("/hierarchy")
    public ResponseEntity<LocationHierarchyDto> getHierarchy(
        @RequestParam UUID warehouseId
    ) { }
    
    @PostMapping
    public ResponseEntity<LocationDto> create(@RequestBody CreateLocationRequest request) { }
    
    @PutMapping("/{id}")
    public ResponseEntity<LocationDto> update(@PathVariable UUID id, @RequestBody UpdateLocationRequest request) { }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) { }
}
```

#### 1.3 Create LocationService (if not exists)
**File:** `backend/core-app/src/main/java/com/optiwms/coreapp/master/LocationService.java`

#### 1.4 Create LocationDTOs
Match frontend expectations from `/admin/warehouses` page.

---

## 📋 Step 2: Complete Inventory APIs

### Current Status: 🔄 **PARTIALLY DONE**

`InventoryController` exists but missing:
- Low stock alerts
- Non-moving items
- Quarantine management
- Expiring items
- Movement history
- Inventory summary

### Tasks:

#### 2.1 Add Missing Endpoints to InventoryController

**Add these methods:**
```java
@GetMapping("/low-stock")
public ResponseEntity<List<InventoryItemDto>> getLowStock(
    @RequestParam(required = false) UUID warehouseId
) { }

@GetMapping("/non-moving")
public ResponseEntity<List<InventoryItemDto>> getNonMoving(
    @RequestParam(required = false) UUID warehouseId,
    @RequestParam(required = false) Integer days
) { }

@GetMapping("/quarantine")
public ResponseEntity<List<InventoryItemDto>> getQuarantine(
    @RequestParam(required = false) UUID warehouseId
) { }

@GetMapping("/expiring")
public ResponseEntity<List<InventoryItemDto>> getExpiring(
    @RequestParam(required = false) UUID warehouseId,
    @RequestParam(required = false) Integer days
) { }

@GetMapping("/location/{locationCode}")
public ResponseEntity<List<InventoryItemDto>> getByLocation(
    @PathVariable String locationCode
) { }

@GetMapping("/summary")
public ResponseEntity<InventorySummaryDto> getSummary(
    @RequestParam(required = false) UUID warehouseId
) { }
```

#### 2.2 Update InventoryService
Add business logic for:
- Low stock calculation (quantity < minStock)
- Non-moving items (daysSinceLastMovement > threshold)
- Quarantine filtering (status = 'quarantine')
- Expiring items (expiryDate within X days)

---

## 📋 Step 3: Complete Order APIs

### Current Status: 🔄 **PARTIALLY DONE**

`OrderController` exists but needs review and completion.

### Tasks:

#### 3.1 Review OrderController
Check what endpoints exist and what's missing.

#### 3.2 Add Missing Endpoints

**Required:**
```java
@GetMapping("/inbound")
public ResponseEntity<List<OrderDto>> getInboundOrders() { }

@GetMapping("/outbound")
public ResponseEntity<List<OrderDto>> getOutboundOrders() { }

@GetMapping("/status/{status}")
public ResponseEntity<List<OrderDto>> getByStatus(@PathVariable String status) { }

@PutMapping("/{id}/status")
public ResponseEntity<OrderDto> updateStatus(
    @PathVariable UUID id,
    @RequestBody UpdateStatusRequest request
) { }

@GetMapping("/{id}/items")
public ResponseEntity<List<OrderItemDto>> getOrderItems(@PathVariable UUID id) { }

@PostMapping("/{id}/items")
public ResponseEntity<OrderItemDto> addOrderItem(
    @PathVariable UUID id,
    @RequestBody CreateOrderItemRequest request
) { }

@PutMapping("/{id}/items/{itemId}")
public ResponseEntity<OrderItemDto> updateOrderItem(
    @PathVariable UUID id,
    @PathVariable UUID itemId,
    @RequestBody UpdateOrderItemRequest request
) { }

@DeleteMapping("/{id}/items/{itemId}")
public ResponseEntity<Void> removeOrderItem(
    @PathVariable UUID id,
    @PathVariable UUID itemId
) { }

@GetMapping("/search")
public ResponseEntity<List<OrderDto>> search(
    @RequestParam String q
) { }
```

---

## 🧪 Testing Each Step

### Test Location APIs:
```bash
# List locations
curl -u admin:admin123 http://localhost:8080/api/locations

# Get by warehouse
curl -u admin:admin123 http://localhost:8080/api/locations/warehouse/{warehouseId}

# Create location
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"warehouseId":"...","area":"A","row":"01","bay":"01","level":"01","bin":"01","status":"available"}' \
  http://localhost:8080/api/locations
```

### Test Inventory APIs:
```bash
# Low stock
curl -u admin:admin123 http://localhost:8080/api/inventory/low-stock

# Non-moving
curl -u admin:admin123 http://localhost:8080/api/inventory/non-moving?days=90

# Quarantine
curl -u admin:admin123 http://localhost:8080/api/inventory/quarantine
```

### Test Order APIs:
```bash
# Inbound orders
curl -u admin:admin123 http://localhost:8080/api/orders/inbound

# Update status
curl -X PUT -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}' \
  http://localhost:8080/api/orders/{id}/status
```

---

## 🔗 Frontend Integration

### After Each API is Complete:

1. **Update `lib/api.ts`** with new endpoints
2. **Replace mock data** in frontend pages
3. **Test the connection**
4. **Add error handling**
5. **Add loading states**

### Pages to Connect:
- `/admin/warehouses` → Location APIs
- `/admin/inventory` → Inventory APIs  
- `/admin/orders` → Order APIs

---

## ✅ Phase 1 Completion Checklist

- [ ] Location Management APIs complete
- [ ] Inventory APIs complete (all endpoints)
- [ ] Order APIs complete (all endpoints)
- [ ] All APIs tested with curl/Postman
- [ ] Frontend `/admin/warehouses` connected
- [ ] Frontend `/admin/inventory` connected
- [ ] Frontend `/admin/orders` connected
- [ ] No mock data remaining in these pages
- [ ] Error handling added
- [ ] Loading states added

---

## 🚀 Next Steps After Phase 1

Once Phase 1 is complete, move to:
- **Phase 2:** SOP Features (Vehicle Inspection, Pallet Purchasing)
- **Phase 3:** Enhanced Operations (Dock Management)
- **Phase 4:** Connect remaining frontend pages
- **Phase 5:** Dashboard & Reporting
- **Phase 6:** Testing & Optimization

---

**Start with:** Location Management APIs (Step 1)

