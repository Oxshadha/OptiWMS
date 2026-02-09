# Comprehensive Backend-Frontend Integration Plan

## 📋 Executive Summary

This document provides a structured plan to align the backend implementation with the frontend features and SOP (Standard Operating Procedures) requirements. The frontend has evolved significantly while the backend was being built, creating gaps that need systematic resolution.

**Key Challenges:**
- Frontend uses mock data and expects specific API structures
- SOP documents define business processes not yet implemented in backend
- Existing backend controllers need alignment with frontend expectations
- Missing domain models for SOP-specific processes

---

## 1. Frontend Feature Analysis

### 1.1 Admin Dashboard Features

#### **Core Pages Identified:**
1. **Dashboard** (`/admin/dashboard`)
   - KPIs, metrics, charts
   - Recent activities
   - Status overviews

2. **Warehouses** (`/admin/warehouses`)
   - Warehouse CRUD operations
   - Warehouse layout visualization
   - Rack management (status, description, notes)
   - Location management

3. **Orders** (`/admin/orders`)
   - Inbound orders management
   - Outbound orders management
   - Order status tracking
   - Order items management

4. **Inventory** (`/admin/inventory`)
   - Stock levels by location
   - Material inventory tracking
   - Low stock alerts
   - Non-moving items
   - Quarantine management

5. **Products/Materials** (`/admin/products`)
   - Material CRUD operations
   - Material search and filtering
   - Material details and specifications

6. **Tasks** (`/admin/tasks`)
   - Task assignment and tracking
   - Task status management
   - Task filtering by type/status

7. **Packing** (`/admin/packing`)
   - Packing records management
   - Packaging type management
   - Packing verification

8. **Shipments** (`/admin/shipments`)
   - Shipment tracking
   - Carrier management
   - Delivery partner integration

9. **Returns** (`/admin/returns`)
   - Return processing
   - Return inspection
   - Return resolution

10. **Cycle Counts** (`/admin/cycle-counts`)
    - Cycle count scheduling
    - Variance tracking
    - Count verification

11. **Stock Transfers** (`/admin/stock-transfers`)
    - Transfer creation
    - Transfer dispatch/receive
    - Transfer tracking

12. **Workers** (`/admin/workers`)
    - Worker management
    - Role assignment
    - Worker profiles

13. **Suppliers** (`/admin/suppliers`)
    - Supplier CRUD
    - Supplier rating
    - Lead time management

14. **Customers** (`/admin/customers`)
    - Customer CRUD
    - Customer activity tracking

15. **Delivery Partners** (`/admin/delivery-partners`)
    - Delivery partner management
    - Integration tracking

16. **Reports** (`/admin/reports`)
    - Various report types
    - Report generation and download

17. **Quality Checks** (`/admin/quality-checks`)
    - Quality check records
    - Inspection management

18. **Anomalies** (`/admin/anomalies`)
    - Anomaly tracking
    - Issue resolution

19. **SOPs** (`/admin/sops`)
    - SOP document management
    - SOP compliance tracking

### 1.2 Worker PWA Features

#### **Core Operations:**
1. **Receiving** (`/worker/receiving`)
   - Order scanning
   - Item receiving
   - Location assignment

2. **Putaway** (`/worker/putaway`)
   - Putaway task management
   - Location scanning
   - Putaway completion

3. **Picking** (`/worker/picking`)
   - Pick list management
   - Item scanning
   - Pick confirmation

4. **Packing** (`/worker/packing`)
   - Order verification
   - Packaging selection
   - Weight recording
   - Label printing

5. **Stock Transfer** (`/worker/stock-transfer`)
   - Transfer initiation
   - Location scanning
   - Transfer completion

6. **Cycle Count** (`/worker/cycle-count`)
   - Count task management
   - Item scanning
   - Variance recording

7. **Shipments** (`/worker/shipments`)
   - Shipment processing
   - Manifest generation

8. **Returns** (`/worker/returns`)
   - Return receiving
   - Return inspection

#### **Supporting Features:**
- Profile management
- Settings
- Offline mode with IndexedDB
- QR Scanner integration
- Network status monitoring
- Auto-sync functionality

### 1.3 Frontend API Client Structure

The frontend expects these API modules:
- `/lib/api/client.ts` - Base API client
- `/lib/api/warehouses.ts` - Warehouse APIs
- `/lib/api/inventory.ts` - Inventory APIs
- `/lib/api/orders.ts` - Order APIs
- `/lib/api/packing.ts` - Packing APIs
- `/lib/api/operations.ts` - Operations APIs (dock management, yard trailers)
- `/lib/api/warehouse-layout.ts` - Layout management APIs

---

## 2. SOP Requirements Analysis

### 2.1 Vehicle Inspection SOP
**Requirements:**
- Vehicle inspection record creation
- 10-point inspection checklist
- Transporter information
- Supplier information
- Dispatch/GRN number tracking
- Evaluation results (Yes/No for each condition)
- Remarks and approval workflow

**Backend Needs:**
- `VehicleInspection` domain entity
- `VehicleInspectionController`
- Inspection checklist configuration
- Approval workflow

### 2.2 Pallet Purchasing SOP
**Requirements:**
- Supplier quotation management
- Annual supplier evaluation
- Pallet requirement tracking from plants
- Pallet in/out reconciliation
- Approval workflow (Assistant Manager/Head of Logistics)
- Plant release checking

**Backend Needs:**
- `PalletPurchase` domain entity
- `PalletTransaction` for in/out tracking
- Supplier evaluation system
- Approval workflow

### 2.3 Unloading SOP
**Requirements:**
- PPE requirement tracking
- Equipment assignment (drum handler, forklift, powered pallet truck)
- Material condition verification
- Weight limits enforcement:
  - Raw materials: max 1500kg per pallet
  - Packing materials: max 1000kg per pallet
- Stacking standards compliance
- Material separation rules
- Wrapping/strapping verification

**Backend Needs:**
- Weight validation in receiving process
- Equipment assignment tracking
- Material condition recording
- Stacking standard configuration

### 2.4 Warehouse Safekeeping SOP
**Requirements:**
- Quarterly inspection scheduling (every 3 months)
- Inspection checklist (F 15.4.1)
- Observation recording
- Weakness identification
- Improvement tracking

**Backend Needs:**
- `WarehouseInspection` domain entity
- Inspection scheduling system
- Checklist management
- Observation tracking

### 2.5 Cycle Count SOP
**Requirements:**
- Quarterly cycle counts
- Material data sheet generation by category
- Team assignment by material category
- Physical count recording
- Variance calculation
- Re-counting for variances
- Cycle count shortage location (2047) assignment

**Backend Needs:**
- Enhanced cycle count with material categories
- Team assignment system
- Variance resolution workflow
- Shortage location management

### 2.6 Equipment Operation SOPs
**Requirements for Forklift/Stacker/Powered Pallet Truck:**
- Operator qualification/license tracking
- Pre-use equipment inspection
- Equipment status management
- Safety compliance tracking
- Equipment maintenance records

**Backend Needs:**
- `Equipment` domain entity
- `EquipmentInspection` records
- Operator license management
- Equipment status tracking

---

## 3. Gap Analysis: Frontend vs Backend

### 3.1 Existing Backend Controllers

✅ **Already Implemented:**
- `WarehouseController` - Basic CRUD
- `MaterialController` - Basic CRUD
- `CustomerController` - Basic CRUD
- `SupplierController` - Basic CRUD
- `DeliveryPartnerController` - Basic CRUD
- `ReceivingController` - Basic receiving
- `PutawayController` - Basic putaway
- `PickingController` - Basic picking
- `PackingController` - Basic packing
- `StockTransferController` - Basic transfers
- `CycleCountController` - Basic cycle counts
- `ShipmentController` - Basic shipments
- `ReturnController` - Basic returns
- `OrderController` - Basic orders
- `TaskController` - Basic tasks
- `UserController` - Basic users
- `InventoryController` - Basic inventory

### 3.2 Missing/Incomplete Features

#### **A. Master Data APIs**
- ❌ Location management APIs (CRUD, QR generation)
- ❌ Packaging types management
- ❌ Equipment management
- ❌ Material categories
- ❌ Warehouse layout APIs

#### **B. Operations APIs**
- ❌ Dock door management
- ❌ Dock appointment scheduling
- ❌ Yard trailer management
- ❌ Vehicle inspection APIs
- ❌ Pallet purchase/transaction APIs
- ❌ Warehouse inspection APIs
- ❌ Equipment inspection APIs

#### **C. Enhanced Features**
- ❌ Quarantine management (partially in frontend)
- ❌ Non-moving items tracking
- ❌ Low stock alerts
- ❌ Material search with filters
- ❌ Order items management
- ❌ Task assignment workflows
- ❌ Approval workflows

#### **D. SOP-Specific Features**
- ❌ Vehicle inspection system
- ❌ Pallet purchasing workflow
- ❌ Unloading validation (weight limits, PPE)
- ❌ Warehouse safekeeping inspections
- ❌ Equipment operation tracking
- ❌ Operator license management

#### **E. Reporting & Analytics**
- ❌ Dashboard KPIs API
- ❌ Recent activities API
- ❌ Custom reports API
- ❌ Report generation service

---

## 4. Implementation Phases

### **Phase 1: Foundation & Master Data** (Week 1-2)

#### **1.1 Database Schema Enhancements**
- [ ] Add `locations` table with hierarchical structure
- [ ] Add `packaging_types` table
- [ ] Add `equipment` table
- [ ] Add `material_categories` table
- [ ] Add `vehicle_inspections` table
- [ ] Add `pallet_purchases` table
- [ ] Add `pallet_transactions` table
- [ ] Add `warehouse_inspections` table
- [ ] Add `equipment_inspections` table
- [ ] Add `operator_licenses` table
- [ ] Add `dock_doors` table
- [ ] Add `dock_appointments` table
- [ ] Add `yard_trailers` table
- [ ] Enhance existing tables with SOP fields

#### **1.2 Domain Models**
- [ ] Create `Location` domain entity
- [ ] Create `PackagingType` domain entity
- [ ] Create `Equipment` domain entity
- [ ] Create `MaterialCategory` domain entity
- [ ] Create `VehicleInspection` domain entity
- [ ] Create `PalletPurchase` domain entity
- [ ] Create `PalletTransaction` domain entity
- [ ] Create `WarehouseInspection` domain entity
- [ ] Create `EquipmentInspection` domain entity
- [ ] Create `OperatorLicense` domain entity
- [ ] Create `DockDoor` domain entity
- [ ] Create `DockAppointment` domain entity
- [ ] Create `YardTrailer` domain entity

#### **1.3 Master Data APIs**
- [ ] Complete `LocationController` with CRUD and QR generation
- [ ] Create `PackagingTypeController`
- [ ] Create `EquipmentController`
- [ ] Create `MaterialCategoryController`
- [ ] Enhance `MaterialController` with search and filters
- [ ] Enhance `WarehouseController` with layout APIs

### **Phase 2: SOP-Specific Features** (Week 2-3)

#### **2.1 Vehicle Inspection System**
- [ ] Create `VehicleInspectionService`
- [ ] Create `VehicleInspectionController`
- [ ] Implement inspection checklist configuration
- [ ] Implement approval workflow
- [ ] Add integration with receiving process

#### **2.2 Pallet Purchasing System**
- [ ] Create `PalletPurchaseService`
- [ ] Create `PalletPurchaseController`
- [ ] Implement supplier evaluation
- [ ] Implement approval workflow
- [ ] Create `PalletTransactionService` for in/out tracking

#### **2.3 Unloading Validation**
- [ ] Enhance `ReceivingService` with weight validation
- [ ] Add PPE requirement checking
- [ ] Add equipment assignment logic
- [ ] Add material condition verification
- [ ] Add stacking standard validation

#### **2.4 Warehouse Safekeeping**
- [ ] Create `WarehouseInspectionService`
- [ ] Create `WarehouseInspectionController`
- [ ] Implement quarterly scheduling
- [ ] Implement checklist management
- [ ] Implement observation tracking

#### **2.5 Equipment Management**
- [ ] Create `EquipmentInspectionService`
- [ ] Create `EquipmentInspectionController`
- [ ] Implement operator license management
- [ ] Implement pre-use inspection workflow
- [ ] Add equipment status tracking

### **Phase 3: Enhanced Operations** (Week 3-4)

#### **3.1 Dock Management**
- [ ] Create `DockDoorService`
- [ ] Create `DockDoorController`
- [ ] Create `DockAppointmentService`
- [ ] Create `DockAppointmentController`
- [ ] Create `YardTrailerService`
- [ ] Create `YardTrailerController`

#### **3.2 Enhanced Cycle Count**
- [ ] Enhance `CycleCountService` with material categories
- [ ] Add team assignment functionality
- [ ] Add shortage location (2047) management
- [ ] Enhance variance resolution workflow

#### **3.3 Enhanced Inventory**
- [ ] Add quarantine management APIs
- [ ] Add non-moving items tracking
- [ ] Add low stock alerts
- [ ] Enhance inventory search and filtering

#### **3.4 Enhanced Orders**
- [ ] Complete `OrderItemController`
- [ ] Add order status workflow
- [ ] Add order priority management
- [ ] Add order search and filtering

### **Phase 4: Frontend Integration** (Week 4-5)

#### **4.1 API Client Updates**
- [ ] Update `api/client.ts` with proper error handling
- [ ] Update all API modules to match backend endpoints
- [ ] Add authentication token management
- [ ] Add request/response interceptors

#### **4.2 Replace Mock Data**
- [ ] Replace warehouse mock data
- [ ] Replace inventory mock data
- [ ] Replace order mock data
- [ ] Replace task mock data
- [ ] Replace packing mock data
- [ ] Replace shipment mock data
- [ ] Replace return mock data
- [ ] Replace cycle count mock data
- [ ] Replace stock transfer mock data

#### **4.3 Error Handling & Loading States**
- [ ] Add consistent error handling across all pages
- [ ] Add loading states for all API calls
- [ ] Add retry logic for failed requests
- [ ] Add offline mode handling

### **Phase 5: Dashboard & Reporting** (Week 5-6)

#### **5.1 Dashboard APIs**
- [ ] Create `DashboardService`
- [ ] Create `DashboardController`
- [ ] Implement KPI calculations
- [ ] Implement recent activities feed
- [ ] Add real-time updates

#### **5.2 Reporting System**
- [ ] Create `ReportService`
- [ ] Create `ReportController`
- [ ] Implement report generation
- [ ] Add report scheduling
- [ ] Add custom report builder

### **Phase 6: Testing & Optimization** (Week 6-7)

#### **6.1 Integration Testing**
- [ ] Test all API endpoints
- [ ] Test frontend-backend integration
- [ ] Test offline mode functionality
- [ ] Test SOP workflows

#### **6.2 Performance Optimization**
- [ ] Optimize database queries
- [ ] Add caching where appropriate
- [ ] Optimize API response times
- [ ] Add pagination where needed

#### **6.3 Security & Validation**
- [ ] Add input validation
- [ ] Add authorization checks
- [ ] Add rate limiting
- [ ] Security audit

---

## 5. Detailed Implementation Guide

### 5.1 Location Management

#### **Database Schema:**
```sql
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

#### **API Endpoints:**
```
GET    /api/master/locations?warehouseId={id}
GET    /api/master/locations/{code}
POST   /api/master/locations
PUT    /api/master/locations/{code}
DELETE /api/master/locations/{code}
GET    /api/master/locations/{code}/qr-code
```

### 5.2 Vehicle Inspection

#### **Database Schema:**
```sql
CREATE TABLE vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_date DATE NOT NULL,
    transporter_name VARCHAR(200),
    supplier_id UUID REFERENCES suppliers(id),
    dispatch_number VARCHAR(100),
    grn_number VARCHAR(100),
    vehicle_number VARCHAR(50),
    evaluation_results JSONB, -- {condition1: true/false, ...}
    remarks TEXT,
    evaluated_by UUID REFERENCES users(id),
    prepared_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **API Endpoints:**
```
GET    /api/operations/vehicle-inspections
GET    /api/operations/vehicle-inspections/{id}
POST   /api/operations/vehicle-inspections
PUT    /api/operations/vehicle-inspections/{id}
POST   /api/operations/vehicle-inspections/{id}/approve
```

### 5.3 Pallet Purchasing

#### **Database Schema:**
```sql
CREATE TABLE pallet_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    quotation_id UUID,
    required_quantity INTEGER NOT NULL,
    available_from_plants INTEGER DEFAULT 0,
    purchase_quantity INTEGER,
    status VARCHAR(20) DEFAULT 'draft',
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approval_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type VARCHAR(20) NOT NULL, -- in, out
    quantity INTEGER NOT NULL,
    source_plant VARCHAR(100),
    destination_plant VARCHAR(100),
    transaction_date DATE NOT NULL,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.4 Warehouse Inspection

#### **Database Schema:**
```sql
CREATE TABLE warehouse_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_number VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id),
    scheduled_date DATE NOT NULL,
    inspection_date DATE,
    checklist_id VARCHAR(50), -- F 15.4.1
    observations JSONB,
    weaknesses JSONB,
    improvements JSONB,
    inspected_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6. API Endpoint Mapping

### 6.1 Frontend API Calls → Backend Endpoints

| Frontend API Call | Current Backend Endpoint | Status | Notes |
|------------------|-------------------------|--------|-------|
| `warehousesApi.getAll()` | `GET /api/master/warehouses` | ✅ Exists | Needs enhancement |
| `warehousesApi.getById()` | `GET /api/master/warehouses/{id}` | ✅ Exists | |
| `warehousesApi.create()` | `POST /api/master/warehouses` | ✅ Exists | |
| `warehousesApi.update()` | `PUT /api/master/warehouses/{id}` | ✅ Exists | |
| `warehousesApi.delete()` | `DELETE /api/master/warehouses/{id}` | ✅ Exists | |
| `warehouseLayoutApi.getLayout()` | `GET /api/warehouses/{id}/layout` | ❌ Missing | Need to create |
| `warehouseLayoutApi.updateRackStatus()` | `PUT /api/warehouses/{id}/racks/{rackId}/status` | ❌ Missing | Need to create |
| `inventoryApi.getAll()` | `GET /api/inventory` | ⚠️ Partial | Needs enhancement |
| `inventoryApi.getByMaterial()` | `GET /api/inventory/material/{id}` | ❌ Missing | Need to create |
| `inventoryApi.getByWarehouse()` | `GET /api/inventory/warehouse/{id}` | ❌ Missing | Need to create |
| `inventoryApi.quarantineBin()` | `POST /api/inventory/quarantined` | ❌ Missing | Need to create |
| `ordersApi.getAll()` | `GET /api/orders` | ⚠️ Partial | Needs filters |
| `ordersApi.getByOrderNumber()` | `GET /api/orders/number/{number}` | ❌ Missing | Need to create |
| `dockManagementApi.getDockDoors()` | `GET /api/operations/dock-doors` | ❌ Missing | Need to create |
| `dockManagementApi.getDockAppointments()` | `GET /api/operations/dock-appointments` | ❌ Missing | Need to create |

---

## 7. Migration Strategy

### 7.1 Database Migrations
- Use Flyway for schema versioning
- Create migration scripts for each phase
- Ensure backward compatibility during migration

### 7.2 Data Migration
- Import CSV data (materials, inventory)
- Generate synthetic data for testing
- Migrate existing mock data if any

### 7.3 API Versioning
- Use `/api/v1/` prefix for future-proofing
- Maintain backward compatibility
- Document breaking changes

---

## 8. Testing Strategy

### 8.1 Unit Tests
- Service layer tests
- Repository tests
- Domain model tests

### 8.2 Integration Tests
- Controller tests with MockMvc
- Database integration tests
- API endpoint tests

### 8.3 E2E Tests
- Frontend-backend integration
- SOP workflow tests
- Offline mode tests

---

## 9. Documentation Requirements

### 9.1 API Documentation
- OpenAPI/Swagger specification
- Endpoint documentation
- Request/response examples

### 9.2 SOP Implementation Documentation
- SOP-to-code mapping
- Business rule documentation
- Workflow diagrams

### 9.3 Developer Guide
- Setup instructions
- Architecture overview
- Contribution guidelines

---

## 10. Risk Mitigation

### 10.1 Technical Risks
- **Risk:** Frontend changes during backend development
  - **Mitigation:** Lock frontend API contracts, use versioning

- **Risk:** Performance issues with large datasets
  - **Mitigation:** Implement pagination, caching, indexing

- **Risk:** Data inconsistency
  - **Mitigation:** Use transactions, implement validation

### 10.2 Business Risks
- **Risk:** SOP requirements not fully understood
  - **Mitigation:** Regular stakeholder review, documentation

- **Risk:** Timeline delays
  - **Mitigation:** Phased approach, prioritize critical features

---

## 11. Success Criteria

### 11.1 Phase 1 Success
- ✅ All master data APIs functional
- ✅ Database schema complete
- ✅ Basic CRUD operations working

### 11.2 Phase 2 Success
- ✅ All SOP-specific features implemented
- ✅ Workflows tested and validated
- ✅ Integration with existing operations

### 11.3 Phase 3 Success
- ✅ All enhanced operations functional
- ✅ Dock management working
- ✅ Enhanced inventory features complete

### 11.4 Phase 4 Success
- ✅ All frontend pages connected to backend
- ✅ No mock data remaining
- ✅ Error handling consistent

### 11.5 Final Success
- ✅ All features functional
- ✅ Performance acceptable
- ✅ Documentation complete
- ✅ Tests passing

---

## 12. Next Steps

1. **Review this plan** with the team
2. **Prioritize phases** based on business needs
3. **Set up development environment** (Docker, database)
4. **Start Phase 1** implementation
5. **Regular progress reviews** (weekly)

---

**Last Updated:** 2025-01-XX  
**Status:** Planning Complete - Ready for Implementation  
**Owner:** Development Team

