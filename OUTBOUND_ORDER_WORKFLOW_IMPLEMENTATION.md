# ✅ Outbound Order Workflow Implementation

**Date**: January 2026  
**Status**: ✅ **IMPLEMENTED**

---

## 🎯 Overview

Implemented a **centralized, best-practice outbound order workflow** with:
1. **Automatic Task Creation**: Picking tasks created automatically when outbound order is created
2. **Task Locking (First Come First Serve)**: Workers claim tasks, locking them from other workers
3. **Status Progression**: Order status updates automatically at each step
4. **Warehouse Filtering**: Workers only see tasks for their assigned warehouse
5. **Manual Assignment**: Admin/Warehouse Manager can assign tasks to specific workers

---

## ✅ Workflow Steps

```
Outbound Order Created (pending)
    ↓
Picking Tasks Auto-Created (pending)
    ↓
Worker Claims Task → Task Status: "assigned" → Order Status: "picking"
    ↓
Worker Completes Picking → Task Status: "completed" → Order Status: "picked"
    ↓
Packer Packs Order → Packing Status: "completed" → Order Status: "ready_to_ship"
    ↓
Shipment Handler Ships → Shipment Status: "shipped" → Order Status: "shipped"
```

---

## ✅ Implementations

### **1. OutboundOrderWorkflowService (Centralized Service)**

**File**: `backend/core-app/src/main/java/com/optiwms/coreapp/orders/OutboundOrderWorkflowService.java`

**Responsibilities:**
- Auto-create picking tasks when outbound order is created
- Task claiming (first come first serve)
- Order status management based on workflow state
- Warehouse filtering for available tasks

**Key Methods:**
- `createPickingTasksForOrder(UUID orderId)` - Creates picking tasks automatically
- `claimTask(UUID taskId, UUID workerId)` - Locks task for worker (first come first serve)
- `updateOrderStatusIfNeeded(UUID orderId)` - Updates order status based on workflow state
- `areAllPickingTasksCompleted(UUID orderId)` - Checks if all picking is done
- `areAllOrderItemsPicked(UUID orderId)` - Checks if all items are picked
- `getAvailableTasksForWorker(UUID warehouseId, String taskType)` - Gets unassigned tasks

---

### **2. Automatic Task Creation**

**When**: Outbound order is created  
**What**: Picking tasks are automatically created for each order item

**Implementation:**
- `OrderController.create()` calls `workflowService.createPickingTasksForOrder()` after order creation
- Creates one picking task per order item
- Tasks are created with `status = "pending"` and `assignedTo = null` (unassigned)

**Code:**
```java
// In OrderController.create()
Order created = orderService.create(order);

// Automatically create picking tasks for outbound orders
if ("outbound".equals(created.getOrderType())) {
    workflowService.createPickingTasksForOrder(created.getId());
}
```

---

### **3. Task Locking (First Come First Serve)**

**How it works:**
1. Worker views available tasks (filtered by their warehouse)
2. Worker selects/claims a task
3. Task status changes to "assigned" and `assignedTo` is set to worker's ID
4. Other workers can no longer see this task (filtered out)
5. Order status updates to "picking" if not already

**API Endpoint:**
```
POST /api/tasks/{id}/claim
Body: { "workerId": "..." }
```

**Frontend:**
- Worker picking page shows "Claim This Task" button
- Clicking claims the task and locks it
- Only available (unassigned) tasks are shown

---

### **4. Status Updates at Each Step**

#### **Step 1: Picking**
- **When**: Worker completes picking task
- **Action**: `PickingService.completePicking()` → `workflowService.updateOrderStatusIfNeeded()`
- **Result**: Order status → `"picked"` (when all items picked)

#### **Step 2: Packing**
- **When**: Packer completes packing
- **Action**: `PackingService.updateStatus(id, "completed")`
- **Result**: Order status → `"ready_to_ship"`

#### **Step 3: Shipping**
- **When**: Shipment handler marks shipment as "shipped"
- **Action**: `ShipmentService.updateStatus(id, "shipped")`
- **Result**: Order status → `"shipped"`

---

### **5. Warehouse Filtering**

**Backend:**
- Task API supports `warehouseId` and `availableOnly` query parameters
- `TaskService.findByWarehouseAndTypeAndStatus()` filters by warehouse

**Frontend:**
- Worker pages filter tasks/orders by `worker.warehouseId`
- Only shows tasks/orders for worker's assigned warehouse

**Updated Pages:**
- `frontend/app/worker/picking/page.tsx` - Filters picking tasks by warehouse
- `frontend/app/worker/packing/page.tsx` - Filters orders by warehouse
- `frontend/app/worker/shipments/page.tsx` - Filters shipments by warehouse

---

### **6. Manual Task Assignment**

**Admin/Warehouse Manager:**
- Can assign tasks to specific workers via existing `/api/tasks/{id}/assign` endpoint
- Tasks assigned manually bypass first-come-first-serve
- Assigned tasks are locked to that worker

**Default Behavior:**
- Tasks are unassigned (`assignedTo = null`)
- Workers claim tasks (first come first serve)
- Once claimed, task is locked

---

## 📋 Files Modified

### **Backend:**

1. **`backend/core-app/src/main/java/com/optiwms/coreapp/orders/OutboundOrderWorkflowService.java`** (NEW)
   - Centralized workflow service
   - Task creation, claiming, status management

2. **`backend/core-api/src/main/java/com/optiwms/coreapi/orders/OrderController.java`**
   - Auto-creates picking tasks when outbound order is created

3. **`backend/core-api/src/main/java/com/optiwms/coreapi/tasks/TaskController.java`**
   - Added `warehouseId` and `availableOnly` query parameters
   - Added `POST /api/tasks/{id}/claim` endpoint

4. **`backend/core-app/src/main/java/com/optiwms/coreapp/tasks/TaskService.java`**
   - Added `findByWarehouseAndTypeAndStatus()` method

5. **`backend/core-app/src/main/java/com/optiwms/coreapp/operations/PickingService.java`**
   - Integrated with `OutboundOrderWorkflowService`
   - Updates order status through workflow service

6. **`backend/core-app/src/main/java/com/optiwms/coreapp/operations/PackingService.java`**
   - Updates order status to `"ready_to_ship"` when packing completed

7. **`backend/core-app/src/main/java/com/optiwms/coreapp/operations/ShipmentService.java`**
   - Updates order status to `"shipped"` when shipment status is "shipped"
   - Updates order status to `"delivered"` when shipment is delivered

8. **`backend/infra/src/main/java/com/optiwms/infra/tasks/TaskRepository.java`**
   - Added `findByWarehouseIdAndTaskTypeAndStatus()` method

### **Frontend:**

1. **`frontend/lib/api/tasks-api.ts`**
   - Added `warehouseId` and `availableOnly` parameters to `getAll()`
   - Added `claim(id, workerId)` method

2. **`frontend/app/worker/picking/page.tsx`**
   - Filters tasks by worker's warehouse
   - Shows only available (unassigned) tasks
   - Added task claiming functionality
   - Auto-claims task when worker selects it

3. **`frontend/app/worker/packing/page.tsx`**
   - Filters orders by worker's warehouse
   - Calls packing API to complete packing
   - Updates order status to "ready_to_ship"

4. **`frontend/app/worker/shipments/page.tsx`**
   - Filters shipments by worker's warehouse
   - Fetches real data from API
   - Creates/updates shipments
   - Updates order status to "shipped"

5. **`frontend/lib/api/shipments.ts`**
   - Added `getByOrderId()` method

---

## 🔄 Workflow Flow

### **1. Order Creation**
```
Admin creates outbound order
    ↓
OrderController.create() called
    ↓
OrderService.create() saves order
    ↓
OutboundOrderWorkflowService.createPickingTasksForOrder() called
    ↓
Picking tasks created (one per order item)
    ↓
Tasks have status="pending", assignedTo=null
```

### **2. Worker Picking**
```
Worker opens Picking page
    ↓
Tasks filtered by worker.warehouseId and status="pending"
    ↓
Worker sees only available tasks for their warehouse
    ↓
Worker clicks "Claim This Task"
    ↓
POST /api/tasks/{id}/claim called
    ↓
Task status → "assigned", assignedTo → worker.id
    ↓
Order status → "picking" (if first task claimed)
    ↓
Worker completes picking
    ↓
POST /api/operations/picking/complete/{taskId}
    ↓
Task status → "completed"
    ↓
If all tasks completed → Order status → "picked"
```

### **3. Worker Packing**
```
Packer opens Packing page
    ↓
Orders filtered by worker.warehouseId and status="picked"
    ↓
Packer selects order and packs items
    ↓
Packer completes packing
    ↓
POST /api/packing (create or update)
    ↓
PUT /api/packing/{id}/status with status="completed"
    ↓
PackingService.updateStatus() called
    ↓
Order status → "ready_to_ship"
```

### **4. Shipment Handler Shipping**
```
Shipment handler opens Shipments page
    ↓
Orders filtered by worker.warehouseId and status="ready_to_ship"
    ↓
Handler processes shipment
    ↓
POST /api/shipments (create) or PUT /api/shipments/{id} (update)
    ↓
PUT /api/shipments/{id}/status with status="shipped"
    ↓
ShipmentService.updateStatus() called
    ↓
Order status → "shipped"
```

---

## 🎯 Key Features

### **1. First Come First Serve**
- Tasks start as `pending` and `assignedTo = null`
- Worker claims task → Task becomes `assigned` and locked
- Other workers can't see claimed tasks
- Prevents duplicate work

### **2. Warehouse Isolation**
- Workers only see tasks for their warehouse
- Admin can see all warehouses
- Warehouse managers see only their warehouse

### **3. Automatic Status Updates**
- Order status updates automatically at each step
- No manual status updates needed
- Status reflects actual workflow progress

### **4. Centralized Logic**
- All workflow logic in `OutboundOrderWorkflowService`
- Easy to maintain and extend
- Consistent behavior across all operations

---

## 🧪 Testing

### **Test Workflow:**

1. **Create Outbound Order:**
   - Admin creates outbound order
   - Check: Picking tasks are created automatically

2. **Worker Claims Task:**
   - Worker A claims task
   - Check: Task status = "assigned", assignedTo = Worker A
   - Worker B views tasks
   - Check: Worker B doesn't see Worker A's claimed task

3. **Complete Picking:**
   - Worker A completes picking
   - Check: Task status = "completed"
   - Check: Order status = "picked" (when all items picked)

4. **Complete Packing:**
   - Packer completes packing
   - Check: Order status = "ready_to_ship"

5. **Ship Order:**
   - Shipment handler processes shipment
   - Check: Order status = "shipped"

---

## 📝 Next Steps

1. **Test the complete workflow** end-to-end
2. **Add packing task creation** (optional - can be manual for now)
3. **Add shipment task creation** (optional - can be manual for now)
4. **Add notifications** when tasks are assigned/claimed
5. **Add task priority handling** (urgent tasks shown first)

---

**Last Updated**: January 2026  
**Status**: ✅ All core functionality implemented - Ready for testing
