# How to Assign Worker to Warehouse

## Problem
Worker EMP-001 (Kavinu Saputhanthri) shows "No warehouse assigned to your account" error.

## Solution: Assign Worker via Admin UI

### Step 1: Login as Admin
1. Go to Admin portal
2. Login with admin credentials

### Step 2: Navigate to Workers Page
1. Click on "Workers" in the sidebar
2. Find worker "EMP-001" or "Kavinu Saputhanthri"

### Step 3: Edit Worker
1. Click the "Edit" button (pencil icon) next to the worker
2. In the "Warehouse" dropdown, select "Colombo Main Warehouse"
3. Click "Update Worker"

### Step 4: Verify
1. Worker should now see tasks
2. Putaway page should load
3. No more "No warehouse assigned" error

## Alternative: Assign via API

If Admin UI doesn't work, use API:

```bash
# Step 1: Get worker ID
GET /api/users/username/EMP-001

# Step 2: Get warehouse ID
GET /api/master/warehouses
# Find "Colombo Main Warehouse" and note its ID

# Step 3: Assign warehouse
PUT /api/users/{worker-id}/assign-warehouse
Body: {
  "warehouseId": "<colombo-warehouse-id>"
}
```

## Why This Happens

Workers MUST have `warehouse_id` set in the database. The fallback (using first warehouse) is temporary and may not work if:
- API call fails (permission denied)
- No warehouses exist
- Worker context hasn't loaded yet

**Permanent Fix:** Always assign workers to warehouses when creating/editing them.
