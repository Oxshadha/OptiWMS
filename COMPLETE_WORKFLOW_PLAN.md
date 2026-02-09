# Complete Workflow Implementation Plan

## Current State Analysis

### What's Working:
- ✅ Inbound orders can be created by admin/warehouse manager
- ✅ Receiving workers can receive items
- ✅ Putaway tasks are created after receiving
- ✅ Basic putaway UI exists

### What's Missing/Broken:
- ❌ Receiving doesn't properly update order status in dashboard
- ❌ Putaway workers can't see order list with PO numbers
- ❌ Putaway workers can't select PO to see its items
- ❌ Bin locations not assigned to products in database
- ❌ Putaway doesn't track which items are put away
- ❌ Order status doesn't update when all items put away
- ❌ No centralized logic for picking/shipping (opposite flow)

## Complete Workflow Requirements

### 1. INBOUND ORDER → RECEIVING → PUTAWAY Flow

#### Step 1: Order Creation (Admin/Warehouse Manager)
- Admin creates inbound order with items
- Order status: "pending"
- Order visible to receiving workers in that warehouse

#### Step 2: Receiving (Receiving Workers)
- Receiving workers see available orders for their warehouse
- Worker can:
  - Scan order code (PO-...) OR manually enter
  - See order items list
  - Scan product code OR manually enter
  - Enter received quantity
  - Confirm received
- **Backend Updates:**
  - Update order item `picked_quantity` (received quantity)
  - Update order item `status` to "received"
  - Update order `status` to "received" (when all items received)
  - Create inventory records (no location yet)
  - Create putaway tasks for received items
- **Dashboard Updates:**
  - Order status changes to "received" or "partially_received"
  - Received items count updates

#### Step 3: Putaway (Putaway Workers)
- Putaway workers see available putaway tasks for their warehouse
- Worker can:
  - See list of orders with PO numbers that need putaway
  - Select/scan PO number to see items in that order
  - See suggested bin locations for each item (from database)
  - Put away each item:
    - Scan/enter bin location
    - Confirm item stored in that location
  - After all items in PO are put away:
    - Order status updates to "put_away" or "ready_for_picking"
- **Backend Updates:**
  - Update inventory with `location_code`
  - Update material_location_assignment
  - Mark putaway task as completed
  - Update order status when all items put away
- **Database:**
  - Products must have suggested bin locations
  - Track which items are put away vs pending

### 2. OUTBOUND ORDER → PICKING → SHIPPING Flow (Opposite)

#### Step 1: Order Creation
- Admin creates outbound order
- Order status: "pending"

#### Step 2: Picking (Picking Workers)
- Picking workers see available orders
- Select/scan order number
- See items with bin locations (from inventory)
- Pick items from bins:
  - Scan bin location to verify
  - Confirm item picked
- After all items picked:
  - Order status: "picked"
  - Items moved to packing area

#### Step 3: Shipping (Shipping Workers)
- Shipping workers see picked orders
- Pack and ship items
- Order status: "shipped"

## Implementation Plan

### Phase 1: Database Schema Updates
1. ✅ Ensure `inventory` table has `location_code`
2. ✅ Ensure `material_location_assignment` table exists
3. ✅ Add suggested bin locations to materials or create mapping table
4. ✅ Track putaway progress per order item

### Phase 2: Backend API Updates
1. **Receiving API:**
   - ✅ Update order status after receiving
   - ✅ Create putaway tasks
   - ✅ Update inventory

2. **Putaway API:**
   - ✅ List orders needing putaway (with PO numbers)
   - ✅ Get order items for a specific PO
   - ✅ Get suggested bin locations for items
   - ✅ Confirm item put away to bin location
   - ✅ Update order status when all items done

3. **Order Status Updates:**
   - ✅ Centralized service to update order status
   - ✅ Check if all items received → "received"
   - ✅ Check if all items put away → "put_away"
   - ✅ Check if all items picked → "picked"
   - ✅ Check if all items shipped → "shipped"

### Phase 3: Frontend Updates
1. **Receiving Page:**
   - ✅ Show orders by warehouse
   - ✅ Allow scanning/entering PO number
   - ✅ Show order items
   - ✅ Enter quantity and confirm
   - ✅ Update UI after receiving

2. **Putaway Page:**
   - ✅ Show list of orders (PO numbers) needing putaway
   - ✅ Allow selecting/scanning PO number
   - ✅ Show items in that order with suggested locations
   - ✅ Allow entering bin location for each item
   - ✅ Confirm each item put away
   - ✅ Track progress (X/Y items done)
   - ✅ Show completion when all items done

3. **Admin Dashboard:**
   - ✅ Real-time order status updates
   - ✅ Show received items count
   - ✅ Show putaway progress

### Phase 4: Centralized Logic
1. **TaskOperationService** (already exists)
   - ✅ Centralize task claiming
   - ✅ Centralize status updates
   - ✅ Centralize worker tracking

2. **OrderStatusService** (NEW)
   - ✅ Centralize order status logic
   - ✅ Check completion criteria
   - ✅ Update status automatically

## Database Changes Needed

```sql
-- Ensure inventory has location_code
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS location_code VARCHAR(50);

-- Material location assignments (should exist)
-- Track which materials are in which locations

-- Order items - track putaway status
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS putaway_status VARCHAR(20) DEFAULT 'pending';
-- Values: 'pending', 'in_progress', 'completed'

-- Suggested locations for materials (optional)
CREATE TABLE IF NOT EXISTS material_suggested_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    location_code VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints Needed

### Receiving:
- ✅ `POST /api/operations/receive` - Receive order items
- ✅ `GET /api/orders/warehouse/{warehouseId}/pending` - Get pending orders for receiving

### Putaway:
- `GET /api/orders/warehouse/{warehouseId}/needs-putaway` - Get orders needing putaway
- `GET /api/orders/{orderId}/putaway-items` - Get items for putaway with suggested locations
- `POST /api/operations/putaway/{taskId}/confirm` - Confirm item put away to location
- `GET /api/orders/{orderId}/putaway-progress` - Get putaway progress

### Order Status:
- `GET /api/orders/{orderId}/status` - Get current status
- `PUT /api/orders/{orderId}/update-status` - Update status (internal)

## Next Steps

1. **Review and approve this plan**
2. **Implement database changes**
3. **Implement backend APIs**
4. **Update frontend to use new APIs**
5. **Test complete workflow**
6. **Apply same logic to picking/shipping**
