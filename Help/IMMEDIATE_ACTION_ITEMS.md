# Immediate Action Items - Backend-Frontend Alignment

## 🎯 Quick Start Guide

This document provides immediate action items to start aligning the backend with the frontend and SOP requirements.

---

## Phase 1: Critical Missing APIs (Start Here)

### 1. Location Management APIs
**Priority: HIGH** - Frontend warehouse layout depends on this

**Files to Create:**
- `backend/core-domain/src/main/java/com/optiwms/domain/master/Location.java`
- `backend/core-app/src/main/java/com/optiwms/coreapp/master/LocationService.java`
- `backend/core-api/src/main/java/com/optiwms/coreapi/master/LocationController.java`

**Database Migration:**
```sql
-- Add to Flyway migration
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id),
    location_code VARCHAR(50) UNIQUE NOT NULL,
    area VARCHAR(10) NOT NULL,
    row_number VARCHAR(10) NOT NULL,
    bay_number VARCHAR(10) NOT NULL,
    level_number INTEGER NOT NULL,
    bin_position VARCHAR(10) NOT NULL,
    location_type VARCHAR(50),
    capacity DECIMAL(15,2),
    is_active BOOLEAN DEFAULT TRUE,
    qr_code TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints Needed:**
- `GET /api/master/locations?warehouseId={id}`
- `GET /api/master/locations/{code}`
- `POST /api/master/locations`
- `PUT /api/master/locations/{code}`
- `GET /api/master/locations/{code}/qr-code`

---

### 2. Warehouse Layout APIs
**Priority: HIGH** - Admin warehouse page needs this

**Enhance Existing:**
- `backend/core-api/src/main/java/com/optiwms/coreapi/master/WarehouseController.java`

**Add Endpoints:**
- `GET /api/master/warehouses/{id}/layout`
- `PUT /api/master/warehouses/{id}/racks/{rackId}/status`
- `PUT /api/master/warehouses/{id}/racks/{rackId}/description`

---

### 3. Enhanced Inventory APIs
**Priority: HIGH** - Multiple frontend pages depend on this

**Enhance Existing:**
- `backend/core-api/src/main/java/com/optiwms/coreapi/inventory/InventoryController.java`

**Add Endpoints:**
- `GET /api/inventory/material/{materialId}`
- `GET /api/inventory/warehouse/{warehouseId}`
- `POST /api/inventory/quarantined`
- `GET /api/inventory/quarantined?warehouseId={id}`
- `POST /api/inventory/quarantined/{id}/release`
- `GET /api/inventory/non-moving`
- `GET /api/inventory/low-stock`

---

### 4. Enhanced Order APIs
**Priority: HIGH** - Order management pages need this

**Enhance Existing:**
- `backend/core-api/src/main/java/com/optiwms/coreapi/orders/OrderController.java`

**Add Endpoints:**
- `GET /api/orders/number/{orderNumber}`
- `GET /api/orders?orderType={type}&status={status}`
- `GET /api/orders/{id}/items`
- `POST /api/orders/{id}/items`
- `PUT /api/orders/{id}/status`

---

### 5. Dock Management APIs
**Priority: MEDIUM** - Operations page uses this

**Files to Create:**
- `backend/core-domain/src/main/java/com/optiwms/domain/operations/DockDoor.java`
- `backend/core-domain/src/main/java/com/optiwms/domain/operations/DockAppointment.java`
- `backend/core-domain/src/main/java/com/optiwms/domain/operations/YardTrailer.java`
- `backend/core-app/src/main/java/com/optiwms/coreapp/operations/DockManagementService.java`
- `backend/core-api/src/main/java/com/optiwms/coreapi/operations/DockManagementController.java`

**API Endpoints Needed:**
- `GET /api/operations/dock-doors?warehouseId={id}`
- `GET /api/operations/dock-appointments?warehouseId={id}`
- `POST /api/operations/dock-appointments`
- `PUT /api/operations/dock-appointments/{id}`
- `POST /api/operations/dock-appointments/{id}/cancel`
- `GET /api/operations/yard-trailers?warehouseId={id}`

---

## Phase 2: SOP-Specific Features

### 6. Vehicle Inspection System
**Priority: MEDIUM** - SOP requirement

**Files to Create:**
- `backend/core-domain/src/main/java/com/optiwms/domain/operations/VehicleInspection.java`
- `backend/core-app/src/main/java/com/optiwms/coreapp/operations/VehicleInspectionService.java`
- `backend/core-api/src/main/java/com/optiwms/coreapi/operations/VehicleInspectionController.java`

**Database Migration:**
```sql
CREATE TABLE vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_date DATE NOT NULL,
    transporter_name VARCHAR(200),
    supplier_id UUID REFERENCES suppliers(id),
    dispatch_number VARCHAR(100),
    grn_number VARCHAR(100),
    vehicle_number VARCHAR(50),
    evaluation_results JSONB,
    remarks TEXT,
    evaluated_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 7. Pallet Purchasing System
**Priority: MEDIUM** - SOP requirement

**Files to Create:**
- `backend/core-domain/src/main/java/com/optiwms/domain/operations/PalletPurchase.java`
- `backend/core-domain/src/main/java/com/optiwms/domain/operations/PalletTransaction.java`
- `backend/core-app/src/main/java/com/optiwms/coreapp/operations/PalletPurchaseService.java`
- `backend/core-api/src/main/java/com/optiwms/coreapi/operations/PalletPurchaseController.java`

---

### 8. Warehouse Inspection System
**Priority: MEDIUM** - SOP requirement

**Files to Create:**
- `backend/core-domain/src/main/java/com/optiwms/domain/operations/WarehouseInspection.java`
- `backend/core-app/src/main/java/com/optiwms/coreapp/operations/WarehouseInspectionService.java`
- `backend/core-api/src/main/java/com/optiwms/coreapi/operations/WarehouseInspectionController.java`

---

## Phase 3: Frontend Integration

### 9. Update API Client
**Priority: HIGH** - Required for all frontend pages

**File to Update:**
- `frontend/lib/api/client.ts`

**Changes Needed:**
- Add proper error handling
- Add authentication token management
- Add request/response interceptors
- Add retry logic

---

### 10. Replace Mock Data
**Priority: HIGH** - Remove all mock data

**Pages to Update:**
- `frontend/app/admin/warehouses/page.tsx`
- `frontend/app/admin/inventory/page.tsx`
- `frontend/app/admin/orders/page.tsx`
- `frontend/app/admin/tasks/page.tsx`
- `frontend/app/admin/packing/page.tsx`
- `frontend/app/worker/receiving/page.tsx`
- `frontend/app/worker/putaway/page.tsx`
- `frontend/app/worker/picking/page.tsx`
- `frontend/app/worker/packing/page.tsx`
- `frontend/app/worker/cycle-count/page.tsx`
- `frontend/app/worker/stock-transfer/page.tsx`

---

## Quick Reference: File Structure

### Backend Structure
```
backend/
├── core-domain/          # Domain entities
│   └── src/main/java/com/optiwms/domain/
│       ├── master/       # Location, Equipment, etc.
│       └── operations/   # VehicleInspection, DockDoor, etc.
├── core-app/             # Business logic
│   └── src/main/java/com/optiwms/coreapp/
│       ├── master/       # LocationService, etc.
│       └── operations/   # VehicleInspectionService, etc.
└── core-api/             # REST controllers
    └── src/main/java/com/optiwms/coreapi/
        ├── master/       # LocationController, etc.
        └── operations/   # VehicleInspectionController, etc.
```

### Frontend Structure
```
frontend/
├── lib/api/              # API client modules
│   ├── client.ts         # Base client (UPDATE)
│   ├── warehouses.ts    # Warehouse APIs
│   ├── inventory.ts      # Inventory APIs
│   ├── orders.ts         # Order APIs
│   └── operations.ts     # Operations APIs
└── app/
    ├── admin/            # Admin pages (REPLACE MOCK DATA)
    └── worker/           # Worker PWA pages (REPLACE MOCK DATA)
```

---

## Implementation Order

### Week 1: Foundation
1. ✅ Create Location domain and APIs
2. ✅ Enhance Warehouse APIs with layout
3. ✅ Enhance Inventory APIs
4. ✅ Enhance Order APIs

### Week 2: Operations
5. ✅ Create Dock Management APIs
6. ✅ Create Vehicle Inspection APIs
7. ✅ Create Pallet Purchase APIs

### Week 3: Integration
8. ✅ Update API client
9. ✅ Replace mock data in admin pages
10. ✅ Replace mock data in worker pages

### Week 4: Testing & Polish
11. ✅ Integration testing
12. ✅ Error handling
13. ✅ Documentation

---

## Common Patterns to Follow

### 1. Controller Pattern
```java
@RestController
@RequestMapping("/api/master/locations")
public class LocationController {
    private final LocationService service;
    
    @GetMapping
    public ResponseEntity<List<LocationDto>> list(@RequestParam(required = false) UUID warehouseId) {
        // Implementation
    }
    
    // Other CRUD operations
}
```

### 2. Service Pattern
```java
@Service
public class LocationService {
    private final LocationRepository repository;
    
    public List<Location> findByWarehouse(UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId);
    }
    
    // Other business logic
}
```

### 3. Domain Entity Pattern
```java
@Entity
@Table(name = "locations")
public class Location extends BaseEntity {
    @Column(nullable = false, unique = true)
    private String locationCode;
    
    // Other fields
}
```

---

## Testing Checklist

For each new API endpoint:
- [ ] Unit test for service
- [ ] Integration test for controller
- [ ] Test with frontend API client
- [ ] Test error cases
- [ ] Test validation

---

## Notes

- **Always check existing code** before creating new files
- **Follow existing patterns** in the codebase
- **Update API documentation** as you add endpoints
- **Test with frontend** as you implement
- **Use UUID** for all IDs (not integers)

---

**Last Updated:** 2025-01-XX  
**Next Review:** After Phase 1 completion

