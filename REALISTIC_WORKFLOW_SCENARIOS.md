# 📖 OptiWMS - Realistic Workflow Scenarios

**"A Day in the Life" Testing Scenarios**

Use these realistic scenarios to test the system as it would actually be used in a Sri Lankan warehouse.

---

## 🏢 Scenario 1: Morning Operations at Central Warehouse

**Time**: 8:00 AM - 12:00 PM  
**Location**: Central Warehouse, Colombo  
**Roles Involved**: Warehouse Manager, Forklift Operator, Picker, Quality Inspector

---

### 8:00 AM - Warehouse Manager (Sarah) Starts Day

**Login**: `http://localhost:3000/admin/login`
- Username: `sarah_manager`
- Password: `Manager@123`

#### Step 1: Check Dashboard
1. Review today's metrics:
   - 12 pending inbound orders
   - 8 pending outbound orders
   - 3 low stock items
   - 2 quality checks pending
2. Click on low stock alert → See "Sunlight Soap 100g" at 15 units (reorder point: 50)
3. Mental note: Need to create PO for soap

#### Step 2: Create Purchase Order for Restock
1. Go to "Orders" → "Inbound"
2. Click "Create PO"
3. Fill details:
   - **Supplier**: Select "Unilever Lanka"
   - **Warehouse**: "Central Warehouse" (auto-selected)
   - **Expected Date**: Tomorrow (2025-01-10)
   - **Priority**: "High" (low stock)
   - **Add Items**:
     - Sunlight Soap 100g: 500 units
     - Sunlight Soap 200g: 300 units
     - Vim Dishwash 500ml: 200 units
   - **Notes**: "Urgent restock - low inventory"
4. Click "Create Order"
5. **Expected**: PO number generated: `PO-20250109-003`
6. Email/notification sent to supplier (simulated)

#### Step 3: Schedule Cycle Count for Zone A
1. Go to "Cycle Counts"
2. Click "Schedule Count"
3. Fill details:
   - **Count Number**: `CC-20250109-A01` (auto)
   - **Warehouse**: "Central Warehouse"
   - **Location**: "A%" (all Zone A locations)
   - **Scheduled Date**: Today
   - **Assign Workers**: Select "Ravi Perera" and "Nimal Silva" (cycle counters)
   - **Notes**: "Monthly Zone A verification"
4. Click "Schedule"
5. **Expected**: Workers receive notification on mobile/dashboard

---

### 8:30 AM - Forklift Operator (Lakshan) Receives Delivery

**Login**: `http://localhost:3000/worker/login`
- Username: `lakshan_forklift`
- Password: `Forklift@123`

#### Step 1: Check Receiving Queue
1. Go to "Receiving" page
2. See 3 pending deliveries:
   - `PO-20250108-015` - Cargills (Expected yesterday - delayed)
   - `PO-20250109-001` - Keells (Expected today)
   - `PO-20250109-002` - Maliban (Expected today)
3. Truck arrives → Driver shows delivery note for Keells
4. Verify: PO number matches `PO-20250109-001`

#### Step 2: Receive Goods (Blind Receiving)
1. Enter PO number: `PO-20250109-001`
2. Order details load:
   - Supplier: Keells
   - Expected items:
     - Keells Cream Crackers 190g: 200 units
     - Keells Biscuits Assorted 400g: 150 units
     - Keells Rice Crackers 100g: 300 units
3. Count actual items received:
   - Cream Crackers: 195 units (5 short)
   - Biscuits Assorted: 150 units (OK)
   - Rice Crackers: 305 units (5 extra)
4. For each item, enter actual quantity
5. Add photo of delivery note (using camera)
6. Add notes: "5 units Cream Crackers damaged (wet boxes), 5 extra Rice Crackers received as bonus"
7. Click "Confirm Receiving"
8. **Expected**: 
   - Success toast: "Receiving confirmed: 650 units received"
   - LPNs generated: `LPN-20250109-001`, `LPN-20250109-002`, `LPN-20250109-003`
   - Putaway tasks created automatically
   - Variance report sent to manager (5 short, 5 extra)

#### Step 3: Putaway to Storage
1. Go to "Putaway" page
2. See 3 pending putaway tasks
3. Select first task:
   - LPN: `LPN-20250109-001`
   - Item: Keells Cream Crackers 190g
   - Quantity: 195 units
   - Suggested Location: `A-02-05-1` (AI suggested, fast-moving area)
4. Drive forklift to suggested location
5. Verify location is available (check on screen, shows "Available - 80% capacity")
6. Scan location barcode: `A-02-05-1`
7. Confirm putaway
8. **Expected**: 
   - Success toast: "Putaway completed"
   - Inventory updated: A-02-05-1 now has 195 units
   - Location capacity: 90% (near full, may need replenishment spot)
9. Repeat for other 2 items

---

### 9:30 AM - Quality Inspector (Dilini) Inspects Received Goods

**Login**: `http://localhost:3000/worker/login`
- Username: `dilini_qc`
- Password: `Quality@123`

#### Step 1: Review Pending Quality Checks
1. Go to "Quality Checks" page
2. See 2 pending checks:
   - `PO-20250109-001` - Keells delivery (just received)
   - `PO-20250108-015` - Cargills delivery (received yesterday)
3. Select Keells delivery (priority)

#### Step 2: Inspect Keells Delivery
1. Click on `PO-20250109-001`
2. Go to receiving location (temporary holding)
3. Physically inspect items:
   - **Cream Crackers**: 5 boxes water damaged (as noted by forklift operator)
   - **Biscuits**: All good condition
   - **Rice Crackers**: All good condition, 5 bonus units
4. In app, for each item:
   - Cream Crackers: Mark "Fail" for 5 units
     - Defect: "Water damage"
     - Photo: Upload image of damaged boxes
     - Action: "Reject & Return"
   - Biscuits: Mark "Pass" - 150 units
   - Rice Crackers: Mark "Pass" - 305 units
5. Overall result: "Partial Pass" (95/100)
6. Notes: "5 units rejected due to water damage. Recommend supplier use waterproof packaging."
7. Click "Submit Inspection"
8. **Expected**:
   - 5 damaged units moved to "Rejected" status
   - Return created automatically for 5 units
   - 645 good units moved to "Available" inventory
   - Manager notified of rejection

---

### 10:00 AM - Warehouse Manager Creates Sales Orders

Sarah receives 3 customer orders via email:

#### Order 1: ABC Electronics (Regular customer)
1. Go to "Orders" → "Outbound"
2. Click "Create SO"
3. Fill details:
   - **Customer**: "ABC Electronics Ltd"
   - **Warehouse**: "Central Warehouse"
   - **Required Date**: Tomorrow (2025-01-10)
   - **Priority**: "High" (regular customer)
   - **Shipping Address**: "456 Galle Road, Colombo 03"
   - **Add Items**:
     - Vim Dishwash 500ml: 50 units
     - Sunlight Soap 100g: 100 units (will deplete low stock!)
     - Keells Cream Crackers 190g: 30 units
   - **Notes**: "Deliver before 2 PM"
4. Click "Create Order"
5. **Expected**: Order number `SO-20250109-005`
6. System shows warning: "Sunlight Soap below reorder point after this order" ✅ (Good - already created PO earlier)

#### Order 2: XYZ Supermarket (New customer)
1. First, create customer:
   - Go to "Customers"
   - Click "Add Customer"
   - Name: "XYZ Supermarket Pvt Ltd"
   - Code: "XYZ-001"
   - Email: "orders@xyzsupermarket.lk"
   - Phone: "+94 11 555 1234"
   - City: "Kandy"
   - Click "Create"
2. Create SO:
   - Same steps as above
   - Items: Mixed products
3. **Expected**: Order created successfully

---

### 10:30 AM - Picker (Ravi) Starts Picking

**Login**: `http://localhost:3000/worker/login`
- Username: `ravi_picker`
- Password: `Picker@123`

#### Step 1: View Assigned Tasks
1. Go to "Picking" page
2. See pick list for `SO-20250109-005` (ABC Electronics):
   - **Pick 1**: A-02-05-1 → Vim Dishwash 500ml → 50 units
   - **Pick 2**: A-01-03-2 → Sunlight Soap 100g → 100 units
   - **Pick 3**: A-02-05-1 → Keells Cream Crackers 190g → 30 units
3. Notice: Picks 1 & 3 are same location (optimized path)

#### Step 2: Pick Items (Following Optimal Path)
**Pick 1 & 3 (Same location A-02-05-1):**
1. Navigate to Zone A, Aisle 2, Bay 5, Level 1
2. Scan location barcode: `A-02-05-1`
3. ✅ Location verified
4. Pick Item 1: Vim Dishwash
   - Scan item SKU: `VIM-500ML`
   - ✅ Item verified
   - Enter quantity: 50
   - Click "Confirm Pick"
   - **Expected**: "Pick confirmed" toast
5. Pick Item 3 (same location): Cream Crackers
   - Scan SKU: `KEELLS-CC-190`
   - Enter quantity: 30
   - Confirm
6. Place both in pick cart, move to next location

**Pick 2 (Location A-01-03-2):**
1. Navigate to Zone A, Aisle 1, Bay 3, Level 2
2. Scan location: `A-01-03-2`
3. Pick Sunlight Soap:
   - Scan SKU: `SUNLIGHT-100G`
   - Need: 100 units
   - Available at this location: 95 units
   - Enter: 95 units
   - Mark as "Short Pick"
4. System prompts: "Short pick detected. Search alternate locations?"
5. Click "Yes" → System shows: `B-02-01-1` has 50 units
6. Navigate to B-02-01-1
7. Pick remaining 5 units
8. Total picked: 100 units (95 + 5)
9. Click "Complete Pick"

#### Step 3: All Items Picked
1. **Expected**:
   - Order status: "Picked"
   - Packing task created
   - Inventory updated (quantities deducted from locations)
2. Move cart to packing station

---

### 11:00 AM - Packer (Chaminda) Packs Order

**Login**: `http://localhost:3000/worker/login`
- Username: `chaminda_packer`
- Password: `Packer@123`

#### Step 1: Start Packing
1. Go to "Packing" page
2. See 1 order ready: `SO-20250109-005`
3. Click "Start Packing"

#### Step 2: Verify Items
1. Scan each item to verify:
   - Scan: `VIM-500ML` → ✅ Verified
   - Scan: `SUNLIGHT-100G` → ✅ Verified
   - Scan: `KEELLS-CC-190` → ✅ Verified
2. All items checked off

#### Step 3: Select Packaging
1. Choose box size:
   - Items total weight: ~8 kg
   - Items total volume: 0.08 m³
   - Select: "Medium Box" (40x30x30 cm, max 20 kg)
2. Select dunnage:
   - Check: "Bubble Wrap" (for crackers - fragile)
   - Check: "Air Pillows" (void fill)
3. Pack items carefully

#### Step 4: Weigh and Complete
1. Place packed box on scale
2. Enter actual weight: 8.5 kg
3. System checks: 8.5 < 20 (max) ✅
4. Upload photo of packed box (optional)
5. Add notes: "Fragile items wrapped separately"
6. Click "Complete Packing"
7. **Expected**:
   - Shipping label generated
   - Barcode printed: `SHIP-20250109-005-001`
   - Order status: "Packed"
   - Ready for shipment

---

### 11:30 AM - Warehouse Manager Creates Shipment

#### Step 1: Create Shipment
1. Go to "Shipments"
2. Click "Create Shipment"
3. Fill details:
   - **Warehouse**: "Central Warehouse"
   - **Select Orders**: Check `SO-20250109-005` (ABC Electronics)
   - **Delivery Partner**: "DHL Express"
   - **Expected Delivery**: Tomorrow (2025-01-10)
   - **Special Instructions**: "Deliver before 2 PM. Call customer first."
4. Click "Create"
5. **Expected**:
   - Shipment number: `SHP-20250109-001`
   - Tracking number generated (if DHL integration)
   - Customer notified via email (simulated)
   - Order status: "Shipped"

---

### 12:00 PM - Cycle Counters (Ravi & Nimal) Count Zone A

**Both login and count simultaneously**

#### Ravi Counts Locations A-01 to A-05
**Login**: `http://localhost:3000/worker/login`
- Username: `ravi_picker` (also does cycle counting)
- Password: `Picker@123`

1. Go to "Cycle Count" page
2. See assigned task: `CC-20250109-A01` (Zone A)
3. Start counting:

**Location A-01-03-2** (Sunlight Soap location):
1. Scan location: `A-01-03-2`
2. System shows expected: 95 units Sunlight Soap
3. Physical count: 90 units (Ravi picked 95 earlier, but system shows 95? Wait...)
4. **Actually**: System should show 0 now (Ravi picked all 95 earlier)
5. **Variance detected**: System expected 0, Ravi counted 90
   - This indicates: Someone returned items? Or system error?
6. Enter count: 90 units
7. System: "Large variance (90 units). Please recount."
8. Ravi recounts: 90 units (confirmed)
9. System: "Recount confirmed. Manager notified for investigation."
10. **Expected**:
    - Recount #1 recorded in `cycle_count_recounts`
    - Manager gets alert: "Variance in A-01-03-2: Expected 0, Counted 90"
    - Manager investigates → Finds data entry error from previous day

**Location A-02-05-1** (Vim & Crackers):
1. Scan location: `A-02-05-1`
2. System shows expected:
   - Vim Dishwash: 150 units (had 200, picked 50)
   - Cream Crackers: 165 units (had 195, picked 30)
3. Ravi counts:
   - Vim: 150 units ✅
   - Crackers: 165 units ✅
4. Both match → No variance
5. **Expected**: Count accepted, inventory confirmed

---

## 🏢 Scenario 2: Afternoon Operations - Returns & Quality Issues

**Time**: 2:00 PM - 5:00 PM

---

### 2:00 PM - Customer Return Arrives

**Warehouse Manager (Sarah) receives call:**
- Customer: "LMN Retailers"
- Issue: "Received wrong items yesterday"
- Original Order: `SO-20250108-010`

#### Step 1: Create Return
1. Go to "Returns"
2. Click "Create Return"
3. Fill details:
   - **Customer**: "LMN Retailers Pvt Ltd"
   - **Order Reference**: `SO-20250108-010`
   - **Return Reason**: "Wrong Item Shipped"
   - **Add Items**:
     - Item customer received: "Vim Dishwash 500ml" (50 units)
     - Item customer ordered: "Harpic Toilet Cleaner 500ml" (50 units)
   - **Notes**: "Customer received Vim instead of Harpic. Our picking error."
4. Click "Create Return"
5. **Expected**: Return number `RET-20250109-001`

#### Step 2: Assign Worker to Process Return
1. Click "Assign Worker"
2. Select: "Lakshan" (forklift operator, available)
3. Click "Assign"
4. **Expected**: Lakshan gets notification

---

### 2:30 PM - Forklift Operator Receives Return

**Lakshan login (already logged in)**

#### Step 1: Process Return
1. Go to "Returns" page (or notification)
2. See assigned return: `RET-20250109-001`
3. Click "Process"
4. Customer truck arrives with items
5. Verify items:
   - Scan barcode: `VIM-500ML`
   - ✅ Matches (wrong item that customer received)
   - Count: 50 units
   - Check condition: All sealed, good condition
6. Scan/enter received items
7. Add photo of returned items
8. Notes: "50 units Vim received back. All sealed, resaleable."
9. Click "Confirm Receipt"
10. **Expected**:
    - Return status: "Received"
    - Items moved to "Return Holding" area
    - Quality inspection task created

---

### 3:00 PM - Quality Inspector Reviews Return

**Dilini (QC) inspects returned items:**

1. Go to "Quality Checks" (returns section)
2. See return inspection: `RET-20250109-001`
3. Physically inspect 50 units:
   - Check seals: All intact ✅
   - Check expiry dates: All > 6 months ✅
   - Check packaging: No damage ✅
4. In app:
   - Overall Resolution: "Re-stock" (items are good)
   - Inspection Notes: "All units in resaleable condition. Restocking to inventory."
5. Click "Submit Inspection"
6. **Expected**:
   - 50 units Vim added back to inventory
   - Putaway task created for returned items
   - Manager notified: "Return processed. 50 units restocked."

---

### 3:30 PM - Manager Corrects Original Order

**Sarah fixes the wrong shipment:**

1. Check original order: `SO-20250108-010`
   - Customer ordered: Harpic 50 units
   - Customer received: Vim 50 units
   - Root cause: Picker scanned wrong item (similar SKUs)
2. Create corrective shipment:
   - Go to "Orders" → "Outbound"
   - Create new SO for LMN Retailers:
     - Harpic Toilet Cleaner 500ml: 50 units
     - Priority: "Urgent" (corrective shipment)
     - Notes: "URGENT: Corrective shipment for wrong item. Free shipping."
3. Assign to picker immediately
4. Track in real-time until shipped

---

### 4:00 PM - Cycle Count Variance Investigation

**Sarah investigates the 90-unit variance from morning:**

#### Step 1: Review Variance Report
1. Go to "Cycle Counts"
2. Open `CC-20250109-A01`
3. See details:
   - Location: A-01-03-2
   - Expected: 0 units
   - Counted: 90 units (twice confirmed)
   - Variance: +90 units

#### Step 2: Check Transaction History
1. Click "View Transaction History" for location A-01-03-2
2. See recent transactions:
   - 8:30 AM: Putaway of 195 units (Keells delivery)
   - 10:30 AM: Pick of 95 units (SO-20250109-005)
   - 10:32 AM: Pick of 5 units (short pick completion)
   - **Expected remaining**: 195 - 95 - 5 = 95 units
3. But system showed 0? Check inventory table...
4. **Found issue**: Putaway was recorded to wrong location
   - Should be: A-02-03-2 (not A-01-03-2)
   - Transposition error in location code
5. **Resolution**: 
   - Update inventory record (move 90 units to correct location)
   - Accept cycle count (update inventory to match physical)
   - Train workers on location code verification

---

## 🏢 Scenario 3: Evening Operations - Stock Transfer

**Time**: 5:00 PM - 6:00 PM

---

### 5:00 PM - Inter-Warehouse Stock Transfer

**Warehouse Manager (Sarah) at Central Warehouse receives request:**
- From: Branch Warehouse (Kandy)
- Request: "Need Vim Dishwash 500ml - 100 units ASAP for large order"

#### Step 1: Check Stock Availability
1. Go to "Inventory"
2. Search: "Vim Dishwash 500ml"
3. See stock:
   - Central Warehouse: 150 units available
   - Branch Warehouse (Kandy): 5 units (low)
4. Decision: Transfer 100 units to Kandy

#### Step 2: Create Stock Transfer
1. Go to "Stock Transfers"
2. Click "Create Transfer"
3. Fill details:
   - **Transfer Type**: "Inter-warehouse"
   - **Source Warehouse**: "Central Warehouse"
   - **Source Location**: "A-02-05-1"
   - **Destination Warehouse**: "Branch Warehouse (Kandy)"
   - **Destination Location**: "K-01-02-1" (their location code)
   - **Material**: "Vim Dishwash 500ml"
   - **Quantity**: 100 units
   - **Priority**: "High"
   - **Expected Transfer Date**: Tomorrow morning
   - **Notes**: "Urgent transfer for large customer order"
4. Click "Create"
5. **Expected**:
   - Transfer number: `TRF-20250109-001`
   - Task created for forklift operator
   - Source inventory reserved (not available for other orders)
   - Email sent to Kandy warehouse manager

---

### 5:30 PM - Forklift Operator Prepares Transfer

**Lakshan processes the transfer:**

1. Go to "Tasks" (or notification)
2. See stock transfer task: `TRF-20250109-001`
3. Navigate to location A-02-05-1
4. Pick 100 units Vim Dishwash
5. Move to staging area for inter-warehouse transfers
6. Scan transfer barcode: `TRF-20250109-001`
7. Scan items: VIM-500ML (x100)
8. Click "Confirm Transfer Out"
9. **Expected**:
   - Inventory deducted from Central Warehouse
   - Transfer status: "In Transit"
   - Tracking number generated (if courier)
   - Items loaded on truck to Kandy

---

## 📊 End of Day Summary

### What We Tested (Realistic Scenarios):

1. ✅ **Dashboard Overview**: Manager checks metrics
2. ✅ **Purchase Order Creation**: Restock low inventory
3. ✅ **Receiving**: Blind receiving with variances (short/extra)
4. ✅ **Putaway**: AI-suggested locations, capacity checking
5. ✅ **Quality Inspection**: Pass/Fail with photos and notes
6. ✅ **Sales Order Creation**: Multiple orders, new customers
7. ✅ **Picking**: Optimal path, short picks, alternate locations
8. ✅ **Packing**: Verify, weigh, select packaging
9. ✅ **Shipment Creation**: Multiple orders, delivery partners
10. ✅ **Cycle Counting**: Variance detection, recount workflow
11. ✅ **Variance Investigation**: Transaction history, root cause analysis
12. ✅ **Returns Processing**: Receive, inspect, re-stock
13. ✅ **Corrective Actions**: Fix wrong shipments
14. ✅ **Inter-Warehouse Transfer**: Stock replenishment

---

## 🎯 Key Takeaways for Testers

### Real-World Patterns to Test:

1. **Short Picks**: Items not available in expected location
2. **Overage**: Receiving more items than expected
3. **Damaged Goods**: Items failing quality check
4. **Wrong Items**: Picking errors requiring returns
5. **Low Stock**: Triggering reorder point alerts
6. **Variances**: Cycle count mismatches requiring investigation
7. **Urgent Orders**: Priority handling and expedited processing
8. **Inter-Warehouse**: Coordinating between multiple locations

### Common Errors to Verify:

1. ✅ **Location Transposition**: A-01-03 vs A-03-01 (caught by cycle count)
2. ✅ **SKU Confusion**: Similar SKUs causing wrong picks
3. ✅ **Quantity Errors**: Data entry mistakes in receiving
4. ✅ **Weight Violations**: Exceeding pallet weight limits (should block)
5. ✅ **Large Variances**: Triggering recount workflow (should prompt)

### System Behaviors to Confirm:

1. ✅ **Auto-Creation**: Tasks auto-created from orders
2. ✅ **AI Suggestions**: Optimal location suggestions (if AI running)
3. ✅ **Fallback Logic**: Rule-based suggestions if AI unavailable
4. ✅ **Offline Mode**: Workers can continue without internet
5. ✅ **Auto-Sync**: Data syncs when connection restored
6. ✅ **Notifications**: Alerts for variances, low stock, quality fails
7. ✅ **Audit Trail**: All changes logged with user/timestamp

---

## 📝 Test Checklist

Use this to verify each scenario:

- [ ] **Scenario 1 - Morning Ops** (2 hours):
  - [ ] Manager: Dashboard, Create PO, Schedule Cycle Count
  - [ ] Forklift: Receive, Putaway
  - [ ] QC: Inspect, Pass/Fail
  - [ ] Manager: Create SO
  - [ ] Picker: Pick with short pick handling
  - [ ] Packer: Pack with weight check
  - [ ] Manager: Create Shipment
  - [ ] Cycle Counter: Count with variance, recount workflow

- [ ] **Scenario 2 - Returns** (1 hour):
  - [ ] Manager: Create Return
  - [ ] Forklift: Process Return
  - [ ] QC: Inspect Return, Re-stock decision
  - [ ] Manager: Investigate variance, correct error

- [ ] **Scenario 3 - Transfer** (30 min):
  - [ ] Manager: Check stock, Create Transfer
  - [ ] Forklift: Process Transfer Out

---

## 🚀 Ready to Test!

**Instructions**:
1. Print this document
2. Follow each scenario step-by-step
3. Check off each step as completed
4. Note any issues or discrepancies
5. Compare results with "Expected" sections
6. Report any failures with screenshots

**Time Required**: ~4 hours for all scenarios

**Good luck with testing! 🎉**
