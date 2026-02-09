# 📋 Comprehensive Workflow Implementation Plan

**Date**: January 2026  
**Status**: 🚧 **IN PROGRESS**

---

## 🎯 Overview

This document outlines the comprehensive plan to implement:
1. **Material-to-Bin Location Assignment** (CRITICAL)
2. **Bin Location Display in Picking Tasks**
3. **Location Scanning/Verification**
4. **Multi-Location Picking Tracking**
5. **Worker Record Tracking** (for performance metrics)
6. **First-Come-First-Serve for Receiving**
7. **Centralized Task Operation Service**
8. **Optimal Path Support** (AI-ready, works without AI)

---

## 🔴 CRITICAL ISSUE #1: Material-to-Bin Location Assignment

### **Problem:**
- Materials are not assigned to bin locations yet
- Inventory has `locationCode` but it's not properly populated
- When receiving items, they need to be assigned to specific bin locations
- When picking, workers need to know which bins contain the ordered items

### **Solution:**

#### **1. Material Location Assignment Service**

**File**: `backend/core-app/src/main/java/com/optiwms/coreapp/operations/MaterialLocationAssignmentService.java` (NEW)

**Responsibilities:**
- Assign materials to bin locations during putaway
- Find available locations for materials
- Support AI-optimized location suggestion (if available)
- Fallback to rule-based assignment

**Key Methods:**
```java
// Assign material to location during putaway
assignMaterialToLocation(UUID materialId, UUID warehouseId, Integer quantity, String suggestedLocation)

// Find all locations where a material is stored
List<LocationInventory> findMaterialLocations(UUID materialId, UUID warehouseId)

// Get available quantity at specific location
Integer getAvailableQuantityAtLocation(UUID materialId, UUID warehouseId, String locationCode)
```

#### **2. Update Putaway Service**

**File**: `backend/core-app/src/main/java/com/optiwms/coreapp/operations/PutawayService.java`

**Changes:**
- When putaway is completed, assign material to the selected location
- Update inventory with `locationCode`
- Create inventory record if doesn't exist, or update existing

#### **3. Database Enhancement**

**Migration**: `V23__add_location_tracking_to_inventory.sql`

```sql
-- Ensure inventory has proper location tracking
ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS location_code VARCHAR(50) REFERENCES locations(location_code);

-- Create index for faster location-based queries
CREATE INDEX IF NOT EXISTS idx_inventory_material_location 
  ON inventory(material_id, warehouse_id, location_code);

-- Create view for material locations
CREATE OR REPLACE VIEW material_locations AS
SELECT 
  i.material_id,
  i.warehouse_id,
  i.location_code,
  l.area,
  l.row_number,
  l.bay_number,
  l.level_number,
  l.bin_position,
  SUM(i.available_quantity) as total_available,
  COUNT(*) as location_count
FROM inventory i
LEFT JOIN locations l ON i.location_code = l.location_code
WHERE i.available_quantity > 0
GROUP BY i.material_id, i.warehouse_id, i.location_code, 
         l.area, l.row_number, l.bay_number, l.level_number, l.bin_position;
```

---

## 🔴 CRITICAL ISSUE #2: Picking Tasks Don't Show Bin Locations

### **Problem:**
- Picking tasks are created but don't show which bins contain the items
- Worker doesn't know where to go to pick items
- No location information in task details

### **Solution:**

#### **1. Update OutboundOrderWorkflowService**

**File**: `backend/core-app/src/main/java/com/optiwms/coreapp/orders/OutboundOrderWorkflowService.java`

**Changes:**
- When creating picking tasks, query material locations
- Include location information in task notes or create location-specific tasks
- Support multiple locations per material (if material is stored in multiple bins)

#### **2. Enhanced Picking Task Structure**

**Option A: One task per location** (Recommended)
- Create separate picking task for each location
- Task includes: material, quantity needed, location code
- Worker picks from one location at a time

**Option B: One task with multiple locations**
- Single task with list of locations
- Worker visits all locations
- Track which locations have been picked

**We'll use Option A** - simpler and clearer for workers

#### **3. Update Picking Task Creation**

```java
// In OutboundOrderWorkflowService.createPickingTasksForOrder()

for (OrderItemEntity item : orderItems) {
    // Find all locations where this material is stored
    List<LocationInventory> materialLocations = 
        materialLocationService.findMaterialLocations(
            item.getMaterialId(), 
            order.getWarehouseId()
        );
    
    // Create picking task for each location (or consolidate if same location)
    for (LocationInventory location : materialLocations) {
        Task pickingTask = new Task();
        pickingTask.setTaskNumber(generateTaskNumber("PICK", order.getOrderNumber()));
        pickingTask.setTaskType("picking");
        pickingTask.setWarehouseId(order.getWarehouseId());
        pickingTask.setLocationCode(location.getLocationCode()); // ✅ Bin location
        pickingTask.setReferenceType("order");
        pickingTask.setReferenceId(orderId);
        pickingTask.setNotes(
            String.format("Pick %s units of %s from location %s", 
                item.getQuantity(), 
                materialName, 
                location.getLocationCode())
        );
        
        taskService.create(pickingTask);
    }
}
```

---

## 🔴 CRITICAL ISSUE #3: Location Scanning/Verification

### **Problem:**
- Workers need to scan bin location QR codes
- Verify they're at the correct location
- Manually enter bin number if QR scan fails

### **Solution:**

#### **1. Update Picking Page UI**

**File**: `frontend/app/worker/picking/page.tsx`

**Changes:**
- Show bin location prominently in task details
- Add "Scan Location" button
- Add manual location input field
- Verify scanned/entered location matches task location
- Show success/error feedback

#### **2. Location Verification Logic**

```typescript
const verifyLocation = (scannedLocation: string, taskLocation: string): boolean => {
  // Exact match
  if (scannedLocation === taskLocation) return true;
  
  // Case-insensitive match
  if (scannedLocation.toUpperCase() === taskLocation.toUpperCase()) return true;
  
  // Partial match (e.g., "B3" matches "B-03-01-1-A")
  const normalizedScanned = scannedLocation.replace(/[^A-Z0-9]/g, '');
  const normalizedTask = taskLocation.replace(/[^A-Z0-9]/g, '');
  if (normalizedScanned.includes(normalizedTask) || normalizedTask.includes(normalizedScanned)) {
    return true;
  }
  
  return false;
};
```

---

## 🔴 CRITICAL ISSUE #4: Worker Record Tracking

### **Problem:**
- Need to track who received, picked, shipped each order
- Worker performance metrics need this data
- Currently not stored in database

### **Solution:**

#### **1. Database Migration**

**File**: `V24__add_worker_tracking_to_orders.sql`

```sql
-- Add worker tracking columns to orders
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS picked_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS packed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS shipped_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS picked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS packed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;

-- Add worker tracking to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Add worker tracking to packing records
ALTER TABLE packing_records
  ADD COLUMN IF NOT EXISTS packer_id UUID REFERENCES users(id); -- Already exists, verify

-- Add worker tracking to shipments
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS shipped_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP; -- Already exists, verify
```

#### **2. Update Services to Store Worker Records**

**PickingService:**
```java
// When picking completed
order.setPickedBy(workerId);
order.setPickedAt(LocalDateTime.now());
```

**PackingService:**
```java
// When packing completed
order.setPackedBy(packerId);
order.setPackedAt(LocalDateTime.now());
```

**ShipmentService:**
```java
// When shipment created/completed
order.setShippedBy(workerId);
order.setShippedAt(LocalDateTime.now());
```

**ReceivingService:**
```java
// When receiving completed
order.setReceivedBy(workerId);
order.setReceivedAt(LocalDateTime.now());
```

---

## 🔴 CRITICAL ISSUE #5: Receiving First-Come-First-Serve

### **Problem:**
- Receiving doesn't use first-come-first-serve
- Workers can't claim receiving tasks
- Same logic needed as picking

### **Solution:**

#### **1. Create Receiving Tasks**

**File**: `backend/core-app/src/main/java/com/optiwms/coreapp/operations/ReceivingService.java`

**Changes:**
- When inbound order is created, create receiving tasks
- Tasks start as `pending` and unassigned
- Workers can claim receiving tasks (same as picking)

#### **2. Update Receiving Workflow**

- Use same `OutboundOrderWorkflowService` logic (rename to `OrderWorkflowService`)
- Support both inbound and outbound orders
- First-come-first-serve for receiving tasks

---

## 🔴 CRITICAL ISSUE #6: Centralized Task Operation Service

### **Problem:**
- Picking and putaway have similar logic
- Code duplication
- Hard to maintain

### **Solution:**

#### **1. Create TaskOperationService**

**File**: `backend/core-app/src/main/java/com/optiwms/coreapp/operations/TaskOperationService.java` (NEW)

**Responsibilities:**
- Common logic for picking and putaway
- Location verification
- Task claiming
- Status updates
- Worker record tracking

**Key Methods:**
```java
// Claim task (first come first serve)
claimTask(UUID taskId, UUID workerId)

// Verify location
verifyLocation(String scannedLocation, String expectedLocation): boolean

// Complete task operation
completeTaskOperation(UUID taskId, UUID workerId, TaskCompletionData data)

// Get optimal path for tasks (AI-ready)
List<String> getOptimalPath(List<Task> tasks, UUID warehouseId)
```

---

## 🔴 CRITICAL ISSUE #7: Optimal Path Support (AI-Ready)

### **Problem:**
- Need to support optimal path calculation
- Should work without AI
- Use AI if available

### **Solution:**

#### **1. Path Calculation Service**

**File**: `backend/core-app/src/main/java/com/optiwms/coreapp/operations/PathCalculationService.java` (NEW)

**Logic:**
1. Try AI service (if available)
2. Fallback to location code sorting
3. Return ordered list of locations

**Implementation:**
```java
public List<String> calculateOptimalPath(List<Task> tasks, UUID warehouseId) {
    // Extract locations from tasks
    List<String> locations = tasks.stream()
        .map(Task::getLocationCode)
        .filter(Objects::nonNull)
        .distinct()
        .collect(Collectors.toList());
    
    // Try AI service
    Optional<List<String>> aiPath = aiServiceAdapter.calculateOptimalPickingPath(
        warehouseId, locations);
    
    if (aiPath.isPresent()) {
        return aiPath.get();
    }
    
    // Fallback: Sort by location code (A-01-01-1-A, A-01-02-1-A, etc.)
    return locations.stream()
        .sorted()
        .collect(Collectors.toList());
}
```

---

## 📋 Implementation Order

### **Phase 1: Foundation (CRITICAL)**
1. ✅ Material Location Assignment Service
2. ✅ Database migration for location tracking
3. ✅ Update putaway to assign locations
4. ✅ Update picking task creation to include locations

### **Phase 2: Worker Experience**
5. ✅ Update picking page to show bin locations
6. ✅ Add location scanning/verification
7. ✅ Track multi-location picking

### **Phase 3: Worker Tracking**
8. ✅ Database migration for worker records
9. ✅ Update all services to store worker records
10. ✅ Sync with performance metrics

### **Phase 4: Centralization**
11. ✅ Create TaskOperationService
12. ✅ Refactor picking/putaway to use centralized service
13. ✅ Implement receiving first-come-first-serve

### **Phase 5: Optimization**
14. ✅ Path calculation service (AI-ready)
15. ✅ Update UI to show optimal path
16. ✅ Test with and without AI

---

## 🎯 Success Criteria

1. ✅ Materials are assigned to bin locations during putaway
2. ✅ Picking tasks show bin locations
3. ✅ Workers can scan/verify locations
4. ✅ Worker records are stored for all operations
5. ✅ Receiving uses first-come-first-serve
6. ✅ Picking and putaway use centralized logic
7. ✅ Optimal path works with and without AI
8. ✅ Newly created orders appear in picker list

---

**Last Updated**: January 2026  
**Status**: 🚧 Implementation in progress
