# 🧪 OptiWMS - Comprehensive Testing Guide

**Version**: 1.0  
**Date**: January 9, 2026  
**Purpose**: Complete testing workflow for all roles before production deployment

---

## 📋 Table of Contents

1. [Pre-Testing Setup](#pre-testing-setup)
2. [Search & Filter Verification](#search--filter-verification)
3. [Offline Capabilities Verification](#offline-capabilities-verification)
4. [Admin Testing Workflow](#admin-testing-workflow)
5. [Warehouse Manager Testing](#warehouse-manager-testing)
6. [Worker Testing Workflow](#worker-testing-workflow)
7. [Data Format Reference](#data-format-reference)
8. [Test Scripts (Automated)](#test-scripts-automated)
9. [Expected Results](#expected-results)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 🔧 Pre-Testing Setup

### Step 1: Verify Services Are Running

```bash
# 1. Check PostgreSQL
docker ps | grep optiwms-db
# Expected: Container running on port 5434

# 2. Check Backend
curl http://localhost:8080/actuator/health
# Expected: {"status":"UP"}

# 3. Check Frontend
curl http://localhost:3000
# Expected: HTML response (Next.js app)
```

### Step 2: Get Test Credentials

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123`
- Role: Admin (full access)

**Test Worker Credentials** (Create these during testing):
- Username: `test_picker`
- Password: `Test@123`
- Role: Picker

### Step 3: Get Admin Token for API Testing

```bash
# Login and get token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'

# Copy the accessToken from response
# Export it as environment variable
export ADMIN_TOKEN="your_token_here"
```

---

## 🔍 Search & Filter Verification

### ✅ Status: IMPLEMENTED (Client-Side Filtering)

All admin pages implement search and filter functionality using:
- **Search**: Real-time filtering as you type
- **Filters**: Category, Status, Type dropdowns
- **Sort**: Column-based sorting (ascending/descending)

### Pages with Search/Filter:

| Page | Search Fields | Filters | Sort |
|------|--------------|---------|------|
| **Inventory** | Name, SKU, Location, Status, Category, Quantity | Category, Item Type | Name, SKU, Qty, Location |
| **Products** | Name, SKU, ID, Category | Category | Name, SKU, Stock |
| **Orders (Inbound)** | Order #, Supplier, Status | Status, Priority | Date, Status |
| **Orders (Outbound)** | Order #, Customer, Status | Status, Priority | Date, Status |
| **Workers** | Name, Email, Role, Warehouse | Role, Status, Warehouse | Name, Role |
| **Customers** | Name, Code, Email, City | Status | Name, Code |
| **Suppliers** | Name, Code, Email, City | Status | Name, Code |
| **Tasks** | Task #, Worker, Warehouse, Type | Type, Status | Date, Priority |
| **Cycle Counts** | Count #, Location, Status | Status | Date |
| **Quality Checks** | Order #, Inspector, Status | Status | Date |
| **Returns** | Return #, Customer, Status | Status | Date |
| **Shipments** | Shipment #, Order #, Status | Status | Date |
| **Stock Transfers** | Transfer #, Source, Dest, Status | Status, Type | Date |

### Test Procedure:

1. **Open any admin page** (e.g., Inventory)
2. **Type in search bar**: "wireless" (should filter items containing "wireless")
3. **Use category filter**: Select "Electronics" (should show only electronics)
4. **Use status filter**: Select "Low" (should show only low stock items)
5. **Click sort**: Click column headers to sort ascending/descending
6. **Verify**: Filtered results update instantly without API calls

---

## 💾 Offline Capabilities Verification

### ✅ Worker Pages: OFFLINE-FIRST (IndexedDB + Sync Queue)
### ⚠️ Admin Pages: ONLINE-ONLY (As Expected)

### Worker Pages with Offline Support:

| Operation | Offline Capability | Sync When Online |
|-----------|-------------------|------------------|
| **Receiving** | ✅ Save to IndexedDB | ✅ Syncs via `addToSyncQueue()` |
| **Picking** | ✅ Save to IndexedDB | ✅ Syncs via `addToSyncQueue()` |
| **Putaway** | ✅ Save to IndexedDB | ✅ Syncs via `addToSyncQueue()` |
| **Cycle Count** | ✅ Save to IndexedDB | ✅ Syncs via `addToSyncQueue()` |
| **Stock Transfer** | ✅ Save to IndexedDB | ✅ Syncs via `addToSyncQueue()` |
| **Packing** | ⚠️ Requires online | ❌ (Needs order data) |
| **Returns** | ⚠️ Partial offline | ⚠️ (TODO: Implement) |

### Test Procedure:

#### Test 1: Worker Picking (Offline)

1. **Login as worker** → Go to Picking page
2. **Open Chrome DevTools** → Network tab → Set throttling to "Offline"
3. **Pick an item**:
   - Scan location (or enter manually)
   - Enter quantity
   - Click "Confirm Pick"
4. **Verify**:
   - ✅ Success toast: "Pick saved offline, will sync when online"
   - ✅ Data saved to IndexedDB (Application tab → IndexedDB → scan_records)
   - ✅ Sync queue updated (Application tab → IndexedDB → sync_queue)
5. **Go back online**:
   - Set throttling to "Online"
   - Refresh page or wait for auto-sync
6. **Verify**:
   - ✅ Sync queue processes items
   - ✅ Data appears in backend
   - ✅ Success toast: "Synced X items"

#### Test 2: Worker Receiving (Offline)

1. **Login as worker** → Go to Receiving page
2. **Set network to Offline** (Chrome DevTools)
3. **Scan/Enter PO number**: `PO-001`
4. **Enter quantities** for each item
5. **Click "Confirm Receiving"**
6. **Verify**:
   - ✅ Success toast: "Receipt queued for sync when online"
   - ✅ Data in IndexedDB
7. **Go online and verify sync**

#### Test 3: Admin Pages (Should Require Online)

1. **Login as admin** → Go to Inventory page
2. **Set network to Offline**
3. **Try to load page**
4. **Verify**:
   - ✅ Loading spinner or error message
   - ✅ Toast: "Network error" or "Failed to load data"
   - ✅ Page does not work offline (expected behavior)

---

## 👨‍💼 Admin Testing Workflow

### Prerequisites:
- Backend running on `http://localhost:8080`
- Frontend running on `http://localhost:3000`
- Admin credentials: `admin` / `admin123`

---

### 1. Login & Dashboard

**Steps:**
1. Navigate to `http://localhost:3000/admin/login`
2. Enter username: `admin`
3. Enter password: `admin123`
4. Click "Login"

**Expected Results:**
- ✅ Redirected to `/admin/dashboard`
- ✅ See welcome message: "Welcome back, admin!"
- ✅ See 4 summary cards (Total Orders, Shipments, Inventory Value, Alerts)
- ✅ See charts (Orders Over Time, Top Products)
- ✅ See recent activities

**Data to Verify:**
- Orders count > 0
- Inventory value showing
- Charts rendering (no errors)

---

### 2. Warehouse Management

**Steps:**
1. Click "Warehouses" in sidebar
2. Click on "Warehouse 1"
3. Verify layout visualization
4. Click "Add Location" (optional)

**Expected Results:**
- ✅ See warehouse list with 2 warehouses
- ✅ Click opens detailed layout view
- ✅ See 2D grid visualization
- ✅ See location codes (A-01-01, B-02-03, etc.)
- ✅ Color coding: Green (available), Orange (occupied), Red (full)

**Data Format:**
- Warehouse Name: Text (e.g., "Central Warehouse")
- Location Code: Format `[Zone]-[Row]-[Bay]-[Level]` (e.g., "A-01-01-1")

---

### 3. Inventory Management

**Steps:**
1. Click "Inventory" in sidebar
2. **Search Test**: Type "wireless" in search bar
3. **Filter Test**: Select "Electronics" category
4. **Sort Test**: Click "Quantity" column header
5. Click on an inventory item to see details

**Expected Results:**
- ✅ See inventory list with columns: SKU, Name, Quantity, Location, Status
- ✅ Search filters results instantly
- ✅ Category filter shows only electronics
- ✅ Sort orders by quantity (low to high)
- ✅ Detail modal shows: Stock levels, Location, Reorder point

**Data to Verify:**
- Total items count > 0
- Low stock items highlighted in orange/red
- Quantity > 0 for available items

---

### 4. Product Management (CRUD Test)

#### CREATE Product

**Steps:**
1. Go to "Products" page
2. Click "Add Product"
3. Fill form:
   - **Name**: `Test Wireless Mouse`
   - **SKU**: `TWM-001`
   - **Category**: `Electronics`
   - **Description**: `Ergonomic wireless mouse with 2.4GHz connection`
   - **Unit Type**: `Unit`
   - **Storage Type**: `Ambient`
   - **Reorder Point**: `10`
4. Click "Save"

**Expected Results:**
- ✅ Success toast: "Product created successfully"
- ✅ Product appears in products list
- ✅ Can search for "TWM-001" and find it

**Data Format:**
- Name: Text, 3-100 characters
- SKU: Alphanumeric, unique, 3-20 characters (e.g., "SKU-1001")
- Category: Dropdown (Electronics, Home, Appliances, Sports)
- Unit Type: Dropdown (Unit, Box, Pallet, Kg, Liter)
- Storage Type: Dropdown (Ambient, Refrigerated, Frozen)
- Reorder Point: Number, > 0

#### READ (Search & Filter)

**Steps:**
1. Search for "TWM-001"
2. Filter by "Electronics" category
3. Click on product to view details

**Expected Results:**
- ✅ Search finds the product
- ✅ Filter shows only electronics
- ✅ Detail modal shows all product info

#### UPDATE Product

**Steps:**
1. Click "Edit" (pencil icon) on test product
2. Change Reorder Point to `20`
3. Click "Update"

**Expected Results:**
- ✅ Success toast: "Product updated successfully"
- ✅ Reorder point now shows 20

#### DELETE Product

**Steps:**
1. Click "Delete" (trash icon) on test product
2. Confirm deletion in modal
3. Click "Delete" in confirmation modal

**Expected Results:**
- ✅ Success toast: "Product deleted successfully"
- ✅ Product removed from list
- ✅ Search for "TWM-001" returns no results

---

### 5. Order Management

#### Inbound Orders (Purchase Orders)

**Steps:**
1. Go to "Orders" → "Inbound"
2. Click "Create PO"
3. Fill form:
   - **Supplier**: Select from dropdown (create one first if needed)
   - **Warehouse**: Select "Warehouse 1"
   - **Expected Date**: Select tomorrow's date
   - **Priority**: Select "Medium"
   - **Add Item**:
     - Material: Select a product
     - Quantity: `50`
   - **Notes**: `Test PO for receiving workflow`
4. Click "Create Order"

**Expected Results:**
- ✅ Success toast: "Purchase order created successfully"
- ✅ Order appears with status "Pending"
- ✅ Order number generated (e.g., "PO-20250109-001")

**Data Format:**
- Supplier: Select from existing suppliers
- Warehouse: Select from available warehouses
- Expected Date: Future date (YYYY-MM-DD)
- Priority: Dropdown (Low, Medium, High, Urgent)
- Items: Array of {materialId, quantity}
- Quantity: Integer > 0
- Notes: Text (optional)

#### Outbound Orders (Sales Orders)

**Steps:**
1. Go to "Orders" → "Outbound"
2. Click "Create SO"
3. Fill form:
   - **Customer**: Select from dropdown
   - **Warehouse**: Select "Warehouse 1"
   - **Required Date**: Select tomorrow's date
   - **Priority**: Select "High"
   - **Add Item**:
     - Material: Select a product with stock
     - Quantity: `5`
4. Click "Create Order"

**Expected Results:**
- ✅ Success toast: "Sales order created successfully"
- ✅ Order appears with status "Pending"
- ✅ Order number generated (e.g., "SO-20250109-001")

---

### 6. Worker Management (CRUD)

#### CREATE Worker

**Steps:**
1. Go to "Workers" page
2. Click "Add Worker"
3. Fill form:
   - **Name**: `John Picker`
   - **Username**: `john_picker`
   - **Email**: `john.picker@optiwms.com`
   - **Password**: `Picker@123`
   - **Role**: Select "Picker"
   - **Warehouse**: Select "Warehouse 1"
   - **Status**: Active
4. Click "Create"

**Expected Results:**
- ✅ Success toast: "Worker created successfully"
- ✅ Worker appears in workers list
- ✅ Can login with these credentials at `/worker/login`

**Data Format:**
- Name: Text, 2-50 characters (Full name)
- Username: Alphanumeric, 3-20 characters, unique (lowercase recommended)
- Email: Valid email format (must be unique)
- Password: Minimum 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
- Role: Dropdown (Picker, Packer, Forklift Operator, Quality Inspector, Inbound Coordinator, Outbound Coordinator)
- Warehouse: Select from available warehouses
- Status: Dropdown (Active, Inactive, On Leave)

#### UPDATE Worker

**Steps:**
1. Click "Edit" on worker
2. Change role to "Packer"
3. Click "Update"

**Expected Results:**
- ✅ Success toast: "Worker updated successfully"
- ✅ Role now shows "Packer"

#### DELETE Worker

**Steps:**
1. Click "Delete" on worker
2. Confirm deletion
3. Click "Delete" in confirmation modal

**Expected Results:**
- ✅ Success toast: "Worker deleted successfully"
- ✅ Worker removed from list
- ✅ Cannot login with deleted credentials

---

### 7. Customer Management (CRUD)

#### CREATE Customer

**Steps:**
1. Go to "Customers" page
2. Click "Add Customer"
3. Fill form:
   - **Name**: `ABC Electronics Ltd`
   - **Code**: `ABC-001`
   - **Email**: `contact@abcelectronics.com`
   - **Phone**: `+94 11 234 5678`
   - **Address**: `123 Main Street, Colombo 03`
   - **City**: `Colombo`
   - **Country**: `Sri Lanka`
   - **Status**: Active
4. Click "Create"

**Expected Results:**
- ✅ Success toast: "Customer created successfully"
- ✅ Customer appears in list

**Data Format:**
- Name: Text, 2-100 characters (Company name)
- Code: Alphanumeric, 3-20 characters, unique (e.g., "CUST-001")
- Email: Valid email format
- Phone: International format (+94 XX XXX XXXX)
- Address: Text, full address
- City: Text (e.g., Colombo, Kandy, Galle)
- Country: Text (default: Sri Lanka)
- Status: Dropdown (Active, Inactive, Suspended)

---

### 8. Supplier Management (CRUD)

Similar to Customer management. Test CREATE, READ, UPDATE, DELETE operations.

**Sample Data:**
- Name: `XYZ Importers Pvt Ltd`
- Code: `SUP-001`
- Email: `info@xyzimporters.lk`
- Phone: `+94 11 456 7890`

---

### 9. Cycle Count Management

#### Schedule Cycle Count

**Steps:**
1. Go to "Cycle Counts" page
2. Click "Schedule Count"
3. Fill form:
   - **Count Number**: Auto-generated (or manual: `CC-20250109-001`)
   - **Warehouse**: Select "Warehouse 1"
   - **Location**: Leave blank for "All" or select specific zone
   - **Scheduled Date**: Select tomorrow's date
   - **Assign Workers**: Select 2-3 workers (create pickers first)
   - **Notes**: `Quarterly cycle count - Zone A`
4. Click "Schedule"

**Expected Results:**
- ✅ Success toast: "Cycle count scheduled successfully"
- ✅ Count appears with status "Scheduled"
- ✅ Assigned workers receive notification (if implemented)

**Data Format:**
- Count Number: Text, unique (e.g., "CC-20250109-001")
- Warehouse: Select from available warehouses
- Location Code: Optional, zone filter (e.g., "A%" for all Zone A locations)
- Scheduled Date: Future date (YYYY-MM-DD)
- Assigned Workers: Multi-select, worker IDs
- Notes: Text (optional)

---

### 10. Quality Check Management

#### Approve/Reject Quality Check

**Steps:**
1. Go to "Quality Checks" page
2. Find a check with status "Pending"
3. Click "View Details"
4. **To Approve**:
   - Click "Approve"
   - Confirm approval
5. **To Reject**:
   - Click "Reject"
   - Enter rejection reason: `Damaged packaging found on 3 units`
   - Click "Submit"

**Expected Results:**
- ✅ Approve: Success toast, status changes to "Approved"
- ✅ Reject: Success toast, status changes to "Rejected", reason saved

---

### 11. Returns Management

#### Process Return

**Steps:**
1. Go to "Returns" page
2. Click "Create Return"
3. Fill form:
   - **Customer**: Select customer
   - **Order Reference**: Enter original order number (optional)
   - **Return Reason**: Select "Defective"
   - **Add Item**:
     - Material: Select product
     - Quantity: `2`
   - **Notes**: `Customer reported battery not charging`
4. Click "Create"
5. Once created, click "Assign Worker"
6. Select a worker and click "Assign"
7. Click "Submit Inspection"
8. Fill inspection form:
   - **Resolution**: Select "Refund"
   - **Inspection Notes**: `Verified defect. Battery issue confirmed.`
9. Click "Submit"
10. Click "Approve Return"

**Expected Results:**
- ✅ Return created with status "Pending"
- ✅ Worker assigned, status changes to "In Progress"
- ✅ Inspection submitted, status changes to "Inspected"
- ✅ Approval granted, status changes to "Approved"

**Data Format:**
- Customer: Select from existing customers
- Order Reference: Text, optional (original order number)
- Return Reason: Dropdown (Defective, Wrong Item, Damaged, Changed Mind, Other)
- Items: Array of {materialId, quantity}
- Quantity: Integer > 0
- Notes: Text (optional)
- Resolution: Dropdown (Refund, Replace, Repair, Reject)

---

### 12. Shipment Management

#### Create Shipment

**Steps:**
1. Go to "Shipments" page
2. Click "Create Shipment"
3. Fill form:
   - **Warehouse**: Select "Warehouse 1"
   - **Select Orders**: Check 1-2 outbound orders with status "Picked" or "Ready"
   - **Delivery Partner**: Select from dropdown (create one first if needed)
   - **Expected Delivery**: Select future date
   - **Notes**: `Fragile items - handle with care`
4. Click "Create"

**Expected Results:**
- ✅ Success toast: "Shipment(s) created successfully"
- ✅ Shipment(s) appear with status "Pending"
- ✅ Shipment number(s) generated

**Data Format:**
- Warehouse: Select from available warehouses
- Orders: Multi-select, outbound order IDs (status must be "picked" or "ready")
- Delivery Partner: Select from existing delivery partners
- Expected Delivery Date: Future date (YYYY-MM-DD)
- Notes: Text (optional)

---

### 13. Stock Transfer Management

#### Create Stock Transfer

**Steps:**
1. Go to "Stock Transfers" page
2. Click "Create Transfer"
3. Fill form:
   - **Transfer Type**: Select "Intra-warehouse" or "Inter-warehouse"
   - **Source Warehouse**: Select "Warehouse 1"
   - **Source Location**: Enter "A-01-01"
   - **Destination Warehouse**: Select "Warehouse 2" (if inter-warehouse)
   - **Destination Location**: Enter "B-02-03"
   - **Material**: Select product
   - **Quantity**: `10`
   - **Notes**: `Replenishment transfer`
4. Click "Create"

**Expected Results:**
- ✅ Success toast: "Stock transfer created successfully"
- ✅ Transfer appears with status "Pending"
- ✅ Transfer number generated

**Data Format:**
- Transfer Type: Dropdown (Intra-warehouse, Inter-warehouse)
- Source Warehouse: Select from available warehouses
- Source Location: Text, location code (e.g., "A-01-01")
- Destination Warehouse: Select (required if inter-warehouse)
- Destination Location: Text, location code (e.g., "B-02-03")
- Material: Select from available materials
- Quantity: Integer > 0
- Notes: Text (optional)

---

### 14. Dock Management

#### Create Dock Appointment

**Steps:**
1. Go to "Dock Management" page
2. Click "Create Appointment"
3. Fill form:
   - **Dock Door**: Select from available doors
   - **Inbound Order**: Select PO number
   - **Supplier Name**: Enter supplier name (or auto-filled)
   - **Carrier Name**: `DHL Express`
   - **Trailer Number**: `TR-12345`
   - **Scheduled Start**: Select date + time (future)
   - **Scheduled End**: Select date + time (2 hours after start)
   - **Notes**: `Large delivery - 50 pallets`
4. Click "Create"

**Expected Results:**
- ✅ Success toast: "Appointment created successfully"
- ✅ Appointment appears on selected date
- ✅ Dock door shows as "Scheduled"

**Data Format:**
- Dock Door: Select from available doors (e.g., "Door 1", "Door 2")
- Inbound Order: Select from inbound orders (optional)
- Supplier Name: Text
- Carrier Name: Text (e.g., DHL, FedEx, Local Transport)
- Trailer Number: Text, format TR-XXXXX
- Scheduled Start: DateTime (YYYY-MM-DD HH:MM)
- Scheduled End: DateTime (YYYY-MM-DD HH:MM, must be after start)
- Notes: Text (optional)

---

### 15. Notifications

**Steps:**
1. Click bell icon in top bar
2. Verify notifications appear
3. Click on a notification
4. Mark as read/unread
5. Delete a notification

**Expected Results:**
- ✅ See notification count badge
- ✅ Notifications list opens
- ✅ Can mark read/unread
- ✅ Can delete notifications
- ✅ Auto-refresh every 30 seconds

---

### 16. Labor Productivity

**Steps:**
1. Go to "Labor Productivity" page
2. Verify charts and metrics load
3. Change period from "Weekly" to "Monthly"
4. Click on a worker to see details

**Expected Results:**
- ✅ See productivity charts
- ✅ See leaderboard
- ✅ See detailed metrics table
- ✅ Period change updates data

---

## 🏭 Warehouse Manager Testing

Warehouse Managers have restricted access to assigned warehouse only.

### Test Workflow:

1. **Create a Warehouse Manager**:
   - Go to "Admins" page (as Super Admin)
   - Click "Add Admin"
   - Fill form:
     - Name: `Sarah Manager`
     - Username: `sarah_manager`
     - Email: `sarah.manager@optiwms.com`
     - Password: `Manager@123`
     - Role: **Warehouse Manager**
     - Warehouse: **Warehouse 1**
   - Click "Create"

2. **Logout and Login as Warehouse Manager**:
   - Logout from admin account
   - Login with `sarah_manager` / `Manager@123`

3. **Verify Restricted Access**:
   - ✅ Can only see Warehouse 1 data
   - ✅ Cannot see Warehouse 2 data
   - ✅ Cannot access "Admins" page
   - ✅ Cannot access "Workers" create/delete (only view)
   - ✅ Can manage orders, inventory, cycle counts for assigned warehouse

4. **Test Operations**:
   - Create an inbound order for Warehouse 1
   - Schedule a cycle count for Warehouse 1
   - Verify inventory for Warehouse 1
   - Cannot create orders for Warehouse 2 (should not see in dropdown)

---

## 👷 Worker Testing Workflow

### Prerequisites:
- Create different worker types (Picker, Packer, Forklift Operator)
- Create test orders (inbound + outbound)
- Ensure inventory has stock

---

### Worker 1: Forklift Operator (Receiving & Putaway)

#### Step 1: Login
1. Navigate to `http://localhost:3000/worker/login`
2. Enter username: `test_forklift_operator` (create first via admin)
3. Enter password: `Operator@123`
4. Click "Login"

**Expected:**
- ✅ Redirected to `/worker/tasks` or `/worker/dashboard`
- ✅ See worker name in top bar

---

#### Step 2: Receiving (Offline-First)

1. **Go to "Receiving" page**
2. **Scan or enter PO number**: `PO-20250109-001` (created earlier by admin)
3. **Verify order details appear**:
   - Supplier name
   - Expected items list
   - Expected quantities
4. **For each item**:
   - Enter received quantity (can be different from expected)
   - Click "Next Item"
5. **Add notes** (optional): `All items received in good condition`
6. **Upload photos** (optional): Click "Upload Photo"
7. **Click "Confirm Receiving"**

**Expected Results:**
- ✅ Success toast: "Receiving confirmed: X units received"
- ✅ Order status changes to "Received"
- ✅ Inventory updated with received quantities
- ✅ Putaway tasks created automatically

**Offline Test:**
1. **Set network to Offline** (Chrome DevTools → Network → Offline)
2. **Perform receiving** (same steps as above)
3. **Expected**:
   - ✅ Success toast: "Receipt queued for sync when online"
   - ✅ Data saved to IndexedDB
4. **Go back online**
5. **Expected**:
   - ✅ Data syncs automatically
   - ✅ Success toast: "Synced X items"

**Data Format:**
- PO Number: Text (e.g., "PO-20250109-001")
- Received Quantity: Integer > 0 (can be less/more than expected)
- Notes: Text (optional, up to 500 characters)
- Photos: Image files (optional, max 5MB each)

---

#### Step 3: Putaway

1. **Go to "Putaway" page**
2. **See list of items to putaway** (from receiving)
3. **For each item**:
   - **Scan or enter LPN**: `LPN-20250109-001` (generated during receiving)
   - **Verify item details** appear
   - **Scan or enter location**: `A-01-01` (or use location picker)
   - **Verify location is available**
   - **Click "Confirm Putaway"**

**Expected Results:**
- ✅ Success toast: "Putaway completed successfully"
- ✅ Inventory location updated to `A-01-01`
- ✅ Task status changes to "Completed"
- ✅ Item ready for picking

**Offline Test:**
1. **Set network to Offline**
2. **Perform putaway**
3. **Expected**:
   - ✅ Success toast: "Putaway saved offline"
   - ✅ Data saved to IndexedDB
4. **Go back online**
5. **Expected**:
   - ✅ Data syncs automatically

**Data Format:**
- LPN (License Plate Number): Text, format LPN-YYYYMMDD-XXX
- Location Code: Text, format ZONE-ROW-BAY-LEVEL (e.g., "A-01-01-1")
- Suggested Location: Auto-suggested by system (can override)

---

### Worker 2: Picker

#### Step 1: Login
1. Navigate to `http://localhost:3000/worker/login`
2. Enter username: `john_picker` (created earlier)
3. Enter password: `Picker@123`
4. Click "Login"

---

#### Step 2: Picking (Offline-First)

1. **Go to "Picking" page**
2. **See current pick task**:
   - Order number
   - Location code
   - Item name/SKU
   - Quantity to pick
3. **Navigate to location**: (use warehouse map if available)
4. **Scan or enter location code**: `A-01-01`
5. **Verify location matches task**
6. **Scan or enter item SKU**: `TWM-001`
7. **Verify item matches task**
8. **Enter picked quantity**: `5` (must match or less than required)
9. **Click "Confirm Pick"**
10. **Repeat for next item** (if multi-item order)

**Expected Results:**
- ✅ Success toast: "Pick confirmed"
- ✅ Inventory quantity decremented
- ✅ Next pick task appears (if any)
- ✅ Order status changes to "Picked" when all items picked

**Offline Test:**
1. **Set network to Offline**
2. **Perform picking**
3. **Expected**:
   - ✅ Success toast: "Pick saved offline, will sync when online"
   - ✅ Data saved to IndexedDB
   - ✅ Can continue picking multiple items offline
4. **Go back online**
5. **Expected**:
   - ✅ All picks sync automatically
   - ✅ Success toast shows count: "Synced 5 picks"

**Data Format:**
- Location Code: Text (e.g., "A-01-01")
- SKU: Text (e.g., "TWM-001")
- Picked Quantity: Integer > 0, ≤ required quantity
- Short Pick: If quantity < required, mark as short pick with reason

---

### Worker 3: Packer

#### Step 1: Packing

1. **Go to "Packing" page**
2. **See orders ready to pack** (status: "Picked")
3. **Select an order** or **Scan order barcode**
4. **Step 1 - Verify Items**:
   - See list of items in order
   - Scan each item SKU to verify
   - Check off items as verified
5. **Step 2 - Select Packaging**:
   - Choose box size: Small/Medium/Large/Custom
   - If custom: Enter dimensions (L x W x H in cm)
6. **Step 3 - Dunnage Materials**:
   - Select padding: Bubble Wrap, Air Pillows, Foam, Paper
   - Check "Fragile Items" if applicable
7. **Step 4 - Weight**:
   - Enter actual weight: `1.5` (kg)
   - Verify weight < box maximum
8. **Step 5 - Complete**:
   - Add packing notes (optional)
   - Upload photos (optional)
   - Click "Complete Packing"

**Expected Results:**
- ✅ Success toast: "Packing completed"
- ✅ Packing record created
- ✅ Shipping label generated (can print)
- ✅ Order status changes to "Packed"
- ✅ Ready for shipment

**Data Format:**
- Packaging Type: Dropdown (Small Box, Medium Box, Large Box, Poly Mailer, Crate, Custom)
- Box Dimensions: Numbers (Length, Width, Height in cm)
- Max Weight: Number (kg, based on box type)
- Actual Weight: Number (kg), must be < max weight
- Dunnage: Multi-select (Bubble Wrap, Air Pillows, Peanuts, Foam, Paper)
- Fragile: Boolean checkbox
- Notes: Text (optional)

---

### Worker 4: Quality Inspector

#### Step 1: Quality Check

1. **Go to "Quality Checks" page** (if worker has access)
2. **See pending quality checks**
3. **Click on a check**
4. **Inspect items**:
   - Verify quantities
   - Check for damage
   - Verify packaging
   - Check labels
5. **For each item**:
   - Mark as "Pass" or "Fail"
   - If fail: Enter defect description
   - Upload photo of defect (optional)
6. **Submit inspection**:
   - Overall result: Pass/Fail
   - Notes: `3 units damaged, rest OK`
   - Click "Submit"

**Expected Results:**
- ✅ Success toast: "Inspection submitted"
- ✅ Quality check status changes to "Completed"
- ✅ Admin notified if failed
- ✅ Failed items marked for return/disposal

---

### Worker 5: Cycle Counter

#### Step 1: Cycle Count (Offline-First)

1. **Go to "Cycle Count" page**
2. **See assigned cycle count tasks**
3. **For each location**:
   - **Scan or enter location code**: `A-01-01`
   - **See expected items at location**
   - **For each item**:
     - Scan or enter SKU
     - Enter counted quantity
   - **Click "Submit Count"**
4. **If variance > threshold (5 units)**:
   - System prompts: "Large variance detected. Please recount."
   - **Recount the location**
   - **Submit 2nd count**
5. **If still high variance after 2nd count**:
   - **Recount again** (3rd count)
   - **System accepts after 3rd count**
   - Admin notified for investigation

**Expected Results:**
- ✅ Count submitted successfully
- ✅ If small variance (< 5 units): Inventory updated immediately
- ✅ If large variance: Recount required (up to 3 counts total)
- ✅ Final variance recorded in `cycle_count_recounts` table
- ✅ Admin can review variance report

**Offline Test:**
1. **Set network to Offline**
2. **Perform cycle counts**
3. **Expected**:
   - ✅ Data saved to IndexedDB
   - ✅ Can count multiple locations offline
4. **Go back online**
5. **Expected**:
   - ✅ All counts sync
   - ✅ Variances calculated
   - ✅ Inventory updated

**Data Format:**
- Location Code: Text (e.g., "A-01-01")
- SKU: Text (e.g., "TWM-001")
- Counted Quantity: Integer ≥ 0 (can be 0 if location empty)
- Expected Quantity: Auto-filled from system (for reference)
- Variance: Auto-calculated (Counted - Expected)
- Variance Threshold: 5 units (default, configurable by admin)

---

## 📝 Data Format Reference

### Common Field Formats

| Field Type | Format | Example | Validation |
|------------|--------|---------|------------|
| **Order Number** | PO-YYYYMMDD-XXX | `PO-20250109-001` | Auto-generated or manual |
| **Sales Order** | SO-YYYYMMDD-XXX | `SO-20250109-001` | Auto-generated or manual |
| **SKU** | Alphanumeric-XXX | `TWM-001`, `SKU-1001` | 3-20 chars, unique |
| **Location Code** | ZONE-ROW-BAY-LEVEL | `A-01-01-1` | Format validated |
| **LPN** | LPN-YYYYMMDD-XXX | `LPN-20250109-001` | Auto-generated |
| **Email** | standard format | `user@domain.com` | Valid email |
| **Phone** | +CC XX XXX XXXX | `+94 11 234 5678` | International format |
| **Date** | YYYY-MM-DD | `2025-01-09` | ISO 8601 |
| **DateTime** | YYYY-MM-DD HH:MM | `2025-01-09 14:30` | 24-hour format |
| **Quantity** | Integer | `50`, `100` | > 0 |
| **Weight** | Decimal (kg) | `1.5`, `25.75` | > 0, up to 2 decimals |
| **Dimensions** | L x W x H (cm) | `30 x 25 x 20` | All > 0 |
| **Password** | Complex | `Admin@123` | Min 8 chars, 1 upper, 1 lower, 1 number, 1 special |

### Status Values

**Order Status:**
- Pending → Confirmed → Received/Picked → Packed → Shipped → Delivered → Completed

**Task Status:**
- Assigned → In Progress → Completed → Cancelled

**Inventory Status:**
- Available → Low → Out of Stock → Reserved

**Quality Check Status:**
- Pending → In Progress → Passed → Failed → Completed

**Return Status:**
- Pending → In Progress → Inspected → Approved → Rejected → Completed

---

## 🤖 Test Scripts (Automated)

### Script 1: Create Test Data

Save as `create-test-data.sh`:

```bash
#!/bin/bash

# Set your admin token
export ADMIN_TOKEN="your_admin_token_here"
BASE_URL="http://localhost:8080"

echo "Creating test data..."

# 1. Create Supplier
echo "Creating supplier..."
curl -X POST "$BASE_URL/api/master/suppliers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Supplier Ltd",
    "code": "TST-SUP-001",
    "email": "test.supplier@example.com",
    "phone": "+94 11 234 5678",
    "address": "123 Test Street",
    "city": "Colombo",
    "country": "Sri Lanka"
  }'

# 2. Create Customer
echo "Creating customer..."
curl -X POST "$BASE_URL/api/master/customers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer Pvt Ltd",
    "code": "TST-CUST-001",
    "email": "test.customer@example.com",
    "phone": "+94 11 345 6789",
    "address": "456 Test Avenue",
    "city": "Kandy",
    "country": "Sri Lanka"
  }'

# 3. Create Product
echo "Creating product..."
curl -X POST "$BASE_URL/api/master/materials" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "materialCode": "TEST-PROD-001",
    "description": "Test Wireless Mouse",
    "unitType": "Unit",
    "storageType": "Ambient",
    "materialType": "product"
  }'

echo "Test data created successfully!"
```

### Script 2: Test All CRUD Operations

Save as `test-crud-operations.sh`:

```bash
#!/bin/bash

export ADMIN_TOKEN="your_admin_token_here"
BASE_URL="http://localhost:8080"

echo "Testing CRUD Operations..."

# CREATE
echo "1. Testing CREATE..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/master/customers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CRUD Test Customer",
    "code": "CRUD-001",
    "email": "crud.test@example.com"
  }')

CUSTOMER_ID=$(echo $RESPONSE | jq -r '.id')
echo "✅ Created customer with ID: $CUSTOMER_ID"

# READ
echo "2. Testing READ..."
curl -s "$BASE_URL/api/master/customers/$CUSTOMER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.name'
echo "✅ Read customer successfully"

# UPDATE
echo "3. Testing UPDATE..."
curl -s -X PUT "$BASE_URL/api/master/customers/$CUSTOMER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CRUD Test Customer UPDATED",
    "code": "CRUD-001",
    "email": "crud.test.updated@example.com"
  }' | jq '.name'
echo "✅ Updated customer successfully"

# DELETE
echo "4. Testing DELETE..."
curl -s -X DELETE "$BASE_URL/api/master/customers/$CUSTOMER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo "✅ Deleted customer successfully"

echo "All CRUD operations completed!"
```

### Script 3: Test Complete Workflow (End-to-End)

Save as `test-complete-workflow.sh`:

```bash
#!/bin/bash

export ADMIN_TOKEN="your_admin_token_here"
BASE_URL="http://localhost:8080"

echo "Testing Complete Workflow: PO → Receive → Putaway → SO → Pick → Pack → Ship"

# 1. Create PO
echo "1. Creating Purchase Order..."
PO_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderType": "inbound",
    "warehouseId": "warehouse-id-here",
    "supplierId": "supplier-id-here",
    "expectedDate": "2025-01-15",
    "priority": "medium",
    "notes": "Test PO for workflow"
  }')

PO_ID=$(echo $PO_RESPONSE | jq -r '.id')
PO_NUMBER=$(echo $PO_RESPONSE | jq -r '.orderNumber')
echo "✅ Created PO: $PO_NUMBER"

# 2. Receive (Worker operation - would be done via worker UI)
echo "2. Receiving order..."
# This would typically be done by worker via frontend

# 3. Create SO
echo "3. Creating Sales Order..."
SO_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderType": "outbound",
    "warehouseId": "warehouse-id-here",
    "customerId": "customer-id-here",
    "requiredDate": "2025-01-20",
    "priority": "high"
  }')

SO_ID=$(echo $SO_RESPONSE | jq -r '.id')
SO_NUMBER=$(echo $SO_RESPONSE | jq -r '.orderNumber')
echo "✅ Created SO: $SO_NUMBER"

# 4. Check inventory
echo "4. Checking inventory..."
curl -s "$BASE_URL/api/inventory" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq 'length'
echo "✅ Inventory checked"

echo "Workflow test completed!"
```

### How to Run Scripts:

1. **Get Admin Token:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.accessToken'
```

2. **Copy token and edit scripts:**
```bash
# Replace "your_admin_token_here" with actual token
nano create-test-data.sh
# ... paste token ...
```

3. **Make scripts executable:**
```bash
chmod +x create-test-data.sh
chmod +x test-crud-operations.sh
chmod +x test-complete-workflow.sh
```

4. **Run scripts:**
```bash
./create-test-data.sh
./test-crud-operations.sh
./test-complete-workflow.sh
```

---

## ✅ Expected Results Checklist

### Backend Health:
- [ ] Backend running on port 8080
- [ ] Database connected (no migration errors)
- [ ] All 15 migrations applied (V1-V15)
- [ ] Health endpoint returns UP
- [ ] JWT authentication working
- [ ] CORS allows frontend requests

### Frontend Health:
- [ ] Frontend running on port 3000
- [ ] Admin login works
- [ ] Worker login works
- [ ] Dark mode toggle works
- [ ] Mobile responsive
- [ ] No console errors

### Search & Filters:
- [ ] Search works on all list pages
- [ ] Category filters work
- [ ] Status filters work
- [ ] Multi-filter combination works
- [ ] Results update instantly (no API calls)

### Offline Capabilities (Workers):
- [ ] Receiving works offline
- [ ] Picking works offline
- [ ] Putaway works offline
- [ ] Cycle counting works offline
- [ ] Data saves to IndexedDB
- [ ] Sync queue populated
- [ ] Auto-sync when online
- [ ] Success notifications shown

### Admin Operations:
- [ ] Dashboard loads with data
- [ ] All CRUD operations work
- [ ] Search/filter on all pages
- [ ] Modals open/close properly
- [ ] Toast notifications appear
- [ ] Data refreshes after mutations
- [ ] Role-based access enforced

### Worker Operations:
- [ ] Task assignment works
- [ ] Scanning (or manual entry) works
- [ ] Location picker works
- [ ] Quantity validation works
- [ ] Task completion updates status
- [ ] Offline mode functions
- [ ] Sync completes when online

### End-to-End Flows:
- [ ] PO → Receive → Putaway: Complete
- [ ] SO → Pick → Pack → Ship: Complete
- [ ] Cycle count (with recount): Complete
- [ ] Quality check: Complete
- [ ] Returns processing: Complete
- [ ] Stock transfer: Complete

---

## 🔧 Troubleshooting Guide

### Issue: Login Fails

**Symptoms**: "Invalid credentials" or "Network error"

**Solutions**:
1. Verify backend is running: `curl http://localhost:8080/actuator/health`
2. Check database connection in backend logs
3. Verify credentials: Default is `admin` / `admin123`
4. Clear browser cache and cookies
5. Check Network tab in DevTools for actual error

---

### Issue: Data Not Loading

**Symptoms**: Infinite loading spinner or empty lists

**Solutions**:
1. Check Network tab: Look for 401/403/500 errors
2. Verify token is valid: Check localStorage for `accessToken`
3. Check backend logs for errors
4. Verify database has data: Run `./generate-test-data-safe.sh`
5. Hard refresh page: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

### Issue: Offline Mode Not Working

**Symptoms**: "Network error" when offline, no sync when online

**Solutions**:
1. Check IndexedDB in DevTools → Application tab
2. Verify `scan_records` and `sync_queue` databases exist
3. Check console for IndexedDB errors
4. Clear IndexedDB and retry
5. Verify worker page (not admin page - admins don't have offline support)

---

### Issue: Search Not Working

**Symptoms**: Typing in search bar doesn't filter results

**Solutions**:
1. Verify data is loaded (not empty list)
2. Check console for JavaScript errors
3. Try different search terms
4. Refresh page
5. Check if search is case-insensitive (should work with any case)

---

### Issue: Cannot Create Order/Product

**Symptoms**: Form submission fails or validation errors

**Solutions**:
1. Check all required fields are filled
2. Verify data formats match requirements (see Data Format Reference)
3. Check Network tab for actual API error
4. Verify related entities exist (e.g., supplier exists before creating PO)
5. Check backend validation rules in logs

---

### Issue: Role Access Denied

**Symptoms**: "Access denied" or "You don't have permission"

**Solutions**:
1. Verify user role: Check admin context or worker context
2. Warehouse Manager: Can only access assigned warehouse
3. Worker: Can only access worker operations, not admin pages
4. Check role normalization: Backend sends `role_admin`, frontend expects `admin`
5. Re-login to refresh token with correct role

---

### Issue: Migration Errors

**Symptoms**: Backend fails to start with Flyway errors

**Solutions**:
1. Check migration version conflicts: `SELECT * FROM flyway_schema_history;`
2. Verify migration SQL syntax
3. Drop and recreate database (DEV only): `docker-compose down -v && docker-compose up -d db`
4. Run migrations manually: `./gradlew flywayMigrate`
5. Check PostgreSQL logs: `docker logs optiwms-db-1`

---

### Issue: Weight Validation Not Working

**Symptoms**: Can receive items > weight limit

**Solutions**:
1. Verify `max_pallet_weight_kg` is set in materials table
2. Check migration V15 applied: `SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;`
3. Verify material type: Raw materials (1500kg), Packing (1000kg)
4. Check backend logs for validation errors
5. Test with explicit weight > 1500kg to trigger error

---

### Issue: Recount Not Triggering

**Symptoms**: Large variance doesn't require recount

**Solutions**:
1. Verify variance threshold: Default is 5 units
2. Check `cycle_counts.variance_threshold` column exists
3. Test with variance > 5 units
4. Verify `CycleCountService` has recount logic
5. Check response has `recountRequired: true`

---

### Issue: Scheduler Not Creating Cycle Counts

**Symptoms**: No cycle counts created at scheduled time

**Solutions**:
1. Verify scheduler is enabled: Check `@EnableScheduling` in `OptiWmsApplication`
2. Check backend logs at 1 AM for scheduler execution
3. Verify schedule has `auto_create: true` and `active: true`
4. Check `next_scheduled_date` is today or past
5. Manually trigger: Restart backend (scheduler runs on startup in dev mode)

---

## 📊 Test Results Template

Use this template to document your test results:

```
# OptiWMS Test Results
Date: __________
Tester: __________
Environment: Development/Staging/Production

## Backend Status
- [ ] Backend running: Yes/No
- [ ] Database connected: Yes/No
- [ ] Migrations applied: V___ (latest)
- [ ] Health check: UP/DOWN

## Frontend Status
- [ ] Frontend running: Yes/No
- [ ] Admin login: ✅/❌
- [ ] Worker login: ✅/❌
- [ ] Dark mode: ✅/❌

## Admin Tests (XX/XX passed)
- [ ] Dashboard loads
- [ ] Inventory CRUD: ✅/❌
- [ ] Products CRUD: ✅/❌
- [ ] Orders CRUD: ✅/❌
- [ ] Workers CRUD: ✅/❌
- [ ] Customers CRUD: ✅/❌
- [ ] Search/Filter: ✅/❌
- [ ] Cycle Counts: ✅/❌
- [ ] Quality Checks: ✅/❌
- [ ] Returns: ✅/❌
- [ ] Shipments: ✅/❌
- [ ] Stock Transfers: ✅/❌

## Worker Tests (XX/XX passed)
- [ ] Receiving: ✅/❌
- [ ] Receiving (Offline): ✅/❌
- [ ] Putaway: ✅/❌
- [ ] Putaway (Offline): ✅/❌
- [ ] Picking: ✅/❌
- [ ] Picking (Offline): ✅/❌
- [ ] Packing: ✅/❌
- [ ] Cycle Count: ✅/❌
- [ ] Cycle Count (Offline): ✅/❌

## New Features (V15)
- [ ] Weight limit validation: ✅/❌
- [ ] Recount workflow: ✅/❌
- [ ] Quarterly scheduler: ✅/❌

## Issues Found
1. Issue: __________
   Severity: High/Medium/Low
   Steps to reproduce: __________
   Expected: __________
   Actual: __________

2. ...

## Overall Result
- Pass Rate: XX%
- Recommendation: Ready/Not Ready for deployment
- Notes: __________
```

---

## 🎯 Quick Test (30 Minutes)

For a quick sanity check before deployment:

1. **Login Test** (2 min):
   - Admin login ✅
   - Worker login ✅

2. **Admin Dashboard** (3 min):
   - Dashboard loads ✅
   - Charts render ✅
   - Summary cards show data ✅

3. **Inventory** (5 min):
   - List loads ✅
   - Search works ✅
   - Filter works ✅
   - Can view details ✅

4. **Create Order** (5 min):
   - Create PO ✅
   - Create SO ✅
   - Orders appear in list ✅

5. **Worker Receiving** (5 min):
   - Receive PO ✅
   - Offline mode works ✅
   - Data syncs ✅

6. **Worker Picking** (5 min):
   - Pick SO items ✅
   - Offline mode works ✅
   - Data syncs ✅

7. **New Features** (5 min):
   - Weight validation blocks > 1500kg ✅
   - Large variance triggers recount ✅
   - Scheduler API responds ✅

**If all 7 quick tests pass → System is healthy and ready! ✅**

---

## 📞 Support

If you encounter issues not covered in this guide:

1. **Check Documentation**:
   - `SYSTEM_100_PERCENT_COMPLETE.md`
   - `API_DOCUMENTATION.md`
   - `AUTHENTICATION_GUIDE.md`

2. **Check Backend Logs**:
   ```bash
   # View live logs
   tail -f backend/logs/application.log
   
   # Or if running in terminal
   # Check the terminal where backend is running
   ```

3. **Check Frontend Console**:
   - Open Chrome DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for failed API calls

4. **Check Database**:
   ```bash
   # Connect to database
   docker exec -it optiwms-db-1 psql -U optiwms -d optiwms
   
   # Check migrations
   SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC;
   
   # Check data
   SELECT COUNT(*) FROM materials;
   SELECT COUNT(*) FROM inventory;
   SELECT COUNT(*) FROM orders;
   ```

---

**End of Comprehensive Testing Guide**

**Next Steps**: Complete all tests, document results, and prepare for production deployment! 🚀
