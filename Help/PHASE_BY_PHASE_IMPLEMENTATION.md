# Phase-by-Phase Implementation Plan - OptiWMS

## 🎯 Overview

This document provides a step-by-step implementation plan to complete backend and frontend integration across 6 phases.

---

## 📊 Current Status

### ✅ Already Completed:
- Database schema finalized (V1-V4 migrations)
- Basic entities and repositories
- Basic controllers structure (20 controllers exist)
- CSV data import functionality
- Synthetic data generation
- Docker setup with pgAdmin
- Component scanning fixed

### 🔄 Needs Implementation:
- Location Management APIs (Phase 1)
- Complete Inventory APIs (Phase 1)
- Complete Order APIs (Phase 1)
- SOP-specific features (Phase 2)
- Frontend API integration (Phase 4)
- Dashboard & Reporting (Phase 5)

---

## 📅 Phase 1: Foundation (Week 1-2)
**Priority: HIGHEST**  
**Goal:** Core APIs for Location, Inventory, and Orders

### 1.1 Location Management APIs ⚠️ **MISSING**

#### Tasks:
- [ ] Create `LocationController` with CRUD operations
- [ ] Implement location hierarchy (Area-Row-Bay-Level-Bin)
- [ ] Add location search/filter endpoints
- [ ] Add location status management (available, occupied, reserved, blocked)
- [ ] Add location capacity tracking
- [ ] Create location DTOs matching frontend expectations
- [ ] Add location validation logic

#### Endpoints Needed:
```
GET    /api/locations                    - List all locations
GET    /api/locations/{id}               - Get location details
POST   /api/locations                    - Create location
PUT    /api/locations/{id}               - Update location
DELETE /api/locations/{id}                - Delete location
GET    /api/locations/warehouse/{warehouseId} - Get locations by warehouse
GET    /api/locations/search?q={query}    - Search locations
GET    /api/locations/available          - Get available locations
GET    /api/locations/hierarchy           - Get location hierarchy
```

#### Frontend Integration:
- Connect `/admin/warehouses` page location management
- Replace mock location data
- Test location CRUD operations

---

### 1.2 Inventory APIs 🔄 **PARTIALLY DONE**

#### Tasks:
- [ ] Review existing `InventoryController`
- [ ] Add missing endpoints (low stock alerts, non-moving items)
- [ ] Add inventory search/filter endpoints
- [ ] Add inventory by location endpoints
- [ ] Add inventory movement history
- [ ] Add batch/expiry tracking endpoints
- [ ] Create inventory DTOs matching frontend
- [ ] Add inventory aggregation endpoints (totals, by warehouse, by material)

#### Endpoints Needed:
```
GET    /api/inventory                           - List all inventory
GET    /api/inventory/{id}                      - Get inventory item
GET    /api/inventory/material/{materialId}     - Get by material
GET    /api/inventory/warehouse/{warehouseId}   - Get by warehouse
GET    /api/inventory/location/{locationCode}    - Get by location
GET    /api/inventory/low-stock                  - Get low stock items
GET    /api/inventory/non-moving                 - Get non-moving items
GET    /api/inventory/quarantine                 - Get quarantined items
GET    /api/inventory/expiring                   - Get expiring items
POST   /api/inventory                            - Create inventory item
PUT    /api/inventory/{id}                       - Update inventory
DELETE /api/inventory/{id}                       - Delete inventory
GET    /api/inventory/movements/{id}             - Get movement history
GET    /api/inventory/summary                     - Get inventory summary
```

#### Frontend Integration:
- Connect `/admin/inventory` page
- Replace mock inventory data
- Test inventory filtering and search

---

### 1.3 Order APIs 🔄 **PARTIALLY DONE**

#### Tasks:
- [ ] Review existing `OrderController`
- [ ] Add missing order endpoints
- [ ] Add order status management
- [ ] Add order item management
- [ ] Add order search/filter endpoints
- [ ] Add order history tracking
- [ ] Create order DTOs matching frontend
- [ ] Add order validation logic

#### Endpoints Needed:
```
GET    /api/orders                      - List all orders
GET    /api/orders/{id}                 - Get order details
GET    /api/orders/inbound               - Get inbound orders
GET    /api/orders/outbound              - Get outbound orders
GET    /api/orders/status/{status}        - Get orders by status
POST   /api/orders                       - Create order
PUT    /api/orders/{id}                  - Update order
PUT    /api/orders/{id}/status           - Update order status
DELETE /api/orders/{id}                  - Delete order
GET    /api/orders/{id}/items             - Get order items
POST   /api/orders/{id}/items             - Add order item
PUT    /api/orders/{id}/items/{itemId}    - Update order item
DELETE /api/orders/{id}/items/{itemId}    - Remove order item
GET    /api/orders/search?q={query}       - Search orders
```

#### Frontend Integration:
- Connect `/admin/orders` page
- Replace mock order data
- Test order creation and status updates

---

### Phase 1 Deliverables:
- ✅ Location Management fully functional
- ✅ Inventory Management fully functional
- ✅ Order Management fully functional
- ✅ All APIs tested and documented
- ✅ Frontend pages connected (warehouses, inventory, orders)

---

## 📅 Phase 2: SOP Features (Week 2-3)
**Priority: HIGH**  
**Goal:** Implement SOP-specific business processes

### 2.1 Vehicle Inspection ⚠️ **MISSING**

#### Tasks:
- [ ] Create `VehicleInspection` entity
- [ ] Create `VehicleInspectionController`
- [ ] Implement inspection checklist
- [ ] Add inspection status tracking
- [ ] Add inspection history
- [ ] Create inspection DTOs

#### Endpoints Needed:
```
POST   /api/vehicle-inspections           - Create inspection
GET    /api/vehicle-inspections/{id}     - Get inspection
GET    /api/vehicle-inspections/vehicle/{vehicleId} - Get by vehicle
PUT    /api/vehicle-inspections/{id}      - Update inspection
GET    /api/vehicle-inspections/pending   - Get pending inspections
```

#### Frontend Integration:
- Connect vehicle inspection form
- Add inspection checklist UI
- Test inspection workflow

---

### 2.2 Pallet Purchasing ⚠️ **MISSING**

#### Tasks:
- [ ] Create `PalletPurchase` entity
- [ ] Create `PalletPurchaseController`
- [ ] Implement purchase request workflow
- [ ] Add approval process
- [ ] Add purchase tracking
- [ ] Create purchase DTOs

#### Endpoints Needed:
```
POST   /api/pallet-purchases              - Create purchase request
GET    /api/pallet-purchases              - List purchases
GET    /api/pallet-purchases/{id}         - Get purchase details
PUT    /api/pallet-purchases/{id}/approve - Approve purchase
PUT    /api/pallet-purchases/{id}/reject  - Reject purchase
GET    /api/pallet-purchases/pending      - Get pending purchases
```

#### Frontend Integration:
- Connect pallet purchase form
- Add approval workflow UI
- Test purchase process

---

### 2.3 Other SOP Features

#### Tasks:
- [ ] Implement unloading procedures
- [ ] Implement warehouse safekeeping
- [ ] Implement cycle count procedures (enhance existing)
- [ ] Implement stacker operations
- [ ] Implement forklift operations
- [ ] Implement pallet truck operations

---

### Phase 2 Deliverables:
- ✅ All SOP features implemented
- ✅ SOP workflows tested
- ✅ Frontend SOP pages connected

---

## 📅 Phase 3: Enhanced Operations (Week 3-4)
**Priority: MEDIUM**  
**Goal:** Enhance existing operations with advanced features

### 3.1 Dock Management ⚠️ **MISSING**

#### Tasks:
- [ ] Create `Dock` entity
- [ ] Create `DockController`
- [ ] Implement dock scheduling
- [ ] Add dock status management
- [ ] Add dock assignment logic

#### Endpoints Needed:
```
GET    /api/docks                        - List all docks
GET    /api/docks/{id}                   - Get dock details
POST   /api/docks                        - Create dock
PUT    /api/docks/{id}                    - Update dock
GET    /api/docks/available               - Get available docks
POST   /api/docks/{id}/assign            - Assign dock
POST   /api/docks/{id}/release           - Release dock
```

---

### 3.2 Enhanced Cycle Count

#### Tasks:
- [ ] Enhance existing `CycleCountController`
- [ ] Add cycle count scheduling
- [ ] Add variance analysis
- [ ] Add count verification workflow
- [ ] Add count history tracking

---

### Phase 3 Deliverables:
- ✅ Dock management functional
- ✅ Enhanced cycle count features
- ✅ All operations tested

---

## 📅 Phase 4: Frontend Integration (Week 4-5)
**Priority: HIGH**  
**Goal:** Connect all frontend pages to backend APIs

### 4.1 Replace Mock Data

#### Tasks:
- [ ] Update `lib/api.ts` with all API endpoints
- [ ] Replace mock data in all admin pages
- [ ] Replace mock data in worker pages
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add data refresh logic

#### Pages to Connect:
- [ ] `/admin/dashboard` - Connect KPI APIs
- [ ] `/admin/warehouses` - Connect warehouse & location APIs
- [ ] `/admin/orders` - Connect order APIs
- [ ] `/admin/inventory` - Connect inventory APIs
- [ ] `/admin/products` - Connect material APIs
- [ ] `/admin/tasks` - Connect task APIs
- [ ] `/admin/packing` - Connect packing APIs
- [ ] `/admin/shipments` - Connect shipment APIs
- [ ] `/admin/returns` - Connect return APIs
- [ ] `/admin/cycle-counts` - Connect cycle count APIs
- [ ] `/admin/stock-transfers` - Connect transfer APIs
- [ ] `/admin/workers` - Connect worker APIs
- [ ] `/admin/suppliers` - Connect supplier APIs
- [ ] `/admin/customers` - Connect customer APIs
- [ ] `/admin/delivery-partners` - Connect delivery partner APIs

---

### 4.2 Worker PWA Integration

#### Tasks:
- [ ] Connect receiving tasks
- [ ] Connect putaway tasks
- [ ] Connect picking tasks
- [ ] Connect cycle count tasks
- [ ] Connect packing tasks
- [ ] Connect shipment tasks
- [ ] Test offline functionality
- [ ] Test data sync

---

### Phase 4 Deliverables:
- ✅ All frontend pages connected
- ✅ No mock data remaining
- ✅ Error handling implemented
- ✅ Loading states added

---

## 📅 Phase 5: Dashboard & Reporting (Week 5-6)
**Priority: MEDIUM**  
**Goal:** Implement KPIs, reports, and analytics

### 5.1 Dashboard APIs

#### Tasks:
- [ ] Create `DashboardController`
- [ ] Implement KPI calculations
- [ ] Add real-time metrics
- [ ] Add activity feeds
- [ ] Add chart data endpoints

#### Endpoints Needed:
```
GET    /api/dashboard/kpis               - Get KPIs
GET    /api/dashboard/metrics            - Get metrics
GET    /api/dashboard/activities          - Get recent activities
GET    /api/dashboard/charts              - Get chart data
GET    /api/dashboard/alerts              - Get alerts
```

---

### 5.2 Reporting APIs

#### Tasks:
- [ ] Create `ReportController`
- [ ] Implement inventory reports
- [ ] Implement order reports
- [ ] Implement movement reports
- [ ] Add report generation
- [ ] Add report export (PDF, CSV)

#### Endpoints Needed:
```
GET    /api/reports/inventory             - Inventory report
GET    /api/reports/orders                - Order report
GET    /api/reports/movements             - Movement report
GET    /api/reports/performance           - Performance report
POST   /api/reports/generate              - Generate custom report
GET    /api/reports/{id}/download         - Download report
```

---

### Phase 5 Deliverables:
- ✅ Dashboard fully functional
- ✅ All reports implemented
- ✅ Report export working

---

## 📅 Phase 6: Testing & Optimization (Week 6-7)
**Priority: HIGH**  
**Goal:** Ensure system reliability and performance

### 6.1 Testing

#### Tasks:
- [ ] Write integration tests for all APIs
- [ ] Write unit tests for services
- [ ] Write frontend component tests
- [ ] Write E2E tests
- [ ] Test error scenarios
- [ ] Test edge cases

---

### 6.2 Performance Optimization

#### Tasks:
- [ ] Optimize database queries
- [ ] Add caching where appropriate
- [ ] Optimize API response times
- [ ] Optimize frontend bundle size
- [ ] Add pagination to list endpoints
- [ ] Add database indexes

---

### 6.3 Documentation

#### Tasks:
- [ ] Complete API documentation
- [ ] Update user guides
- [ ] Create deployment guide
- [ ] Create troubleshooting guide

---

### Phase 6 Deliverables:
- ✅ All tests passing
- ✅ Performance optimized
- ✅ Documentation complete

---

## 🚀 Getting Started - Phase 1

### Step 1: Start with Location Management

1. **Create Location Entity** (if not exists)
2. **Create LocationRepository**
3. **Create LocationService**
4. **Create LocationController**
5. **Create LocationDTOs**
6. **Test endpoints**
7. **Connect frontend**

### Step 2: Complete Inventory APIs

1. **Review existing InventoryController**
2. **Add missing endpoints**
3. **Create missing DTOs**
4. **Test endpoints**
5. **Connect frontend**

### Step 3: Complete Order APIs

1. **Review existing OrderController**
2. **Add missing endpoints**
3. **Create missing DTOs**
4. **Test endpoints**
5. **Connect frontend**

---

## 📝 Tracking Progress

Use this checklist to track progress:

- [ ] Phase 1: Foundation
  - [ ] Location Management APIs
  - [ ] Inventory APIs (complete)
  - [ ] Order APIs (complete)
- [ ] Phase 2: SOP Features
  - [ ] Vehicle Inspection
  - [ ] Pallet Purchasing
  - [ ] Other SOP features
- [ ] Phase 3: Enhanced Operations
  - [ ] Dock Management
  - [ ] Enhanced Cycle Count
- [ ] Phase 4: Frontend Integration
  - [ ] All admin pages connected
  - [ ] Worker PWA connected
- [ ] Phase 5: Dashboard & Reporting
  - [ ] Dashboard APIs
  - [ ] Reporting APIs
- [ ] Phase 6: Testing & Optimization
  - [ ] Testing complete
  - [ ] Performance optimized

---

**Next Step:** Start with Phase 1.1 - Location Management APIs

