# Debug: Available Quantity Not Fetching

## Issue
Available quantity shows 0 in outbound order creation form even after selecting warehouse and product.

## Debugging Steps

### 1. Check Browser Console
Open browser DevTools (F12) → Console tab, and look for:
- `[Outbound Order]` logs when selecting warehouse
- `[Inventory API]` logs when selecting product
- Any error messages

### 2. Verify Database State

**Check if inventory has warehouse_id set:**
```sql
-- Check inventory items without warehouse_id
SELECT COUNT(*) FROM inventory WHERE warehouse_id IS NULL;

-- Check inventory items with warehouse_id
SELECT COUNT(*) FROM inventory WHERE warehouse_id IS NOT NULL;

-- Check specific material in Colombo warehouse
SELECT i.*, w.name as warehouse_name, m.material_code, m.description
FROM inventory i
LEFT JOIN warehouses w ON i.warehouse_id = w.id
LEFT JOIN materials m ON i.material_id = m.id
WHERE w.name ILIKE '%Colombo%' OR w.code = 'WH-001'
LIMIT 10;

-- Check if specific material exists in any warehouse
SELECT i.*, w.name as warehouse_name, m.material_code
FROM inventory i
LEFT JOIN warehouses w ON i.warehouse_id = w.id
LEFT JOIN materials m ON i.material_id = m.id
WHERE m.material_code = 'YOUR_MATERIAL_CODE_HERE';
```

### 3. Test API Directly

**Test the inventory endpoint:**
```bash
# Replace MATERIAL_ID and WAREHOUSE_ID with actual UUIDs
curl -X GET "http://localhost:8080/api/inventory?materialId=MATERIAL_ID&warehouseId=WAREHOUSE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Common Issues

**Issue 1: Migration didn't run**
- Check if migration V22 ran: `SELECT * FROM flyway_schema_history WHERE version = '22';`
- If not, restart backend to trigger migration

**Issue 2: Inventory items have 0 availableQuantity**
- Even if inventory exists, `availableQuantity` might be 0
- Check: `SELECT material_id, warehouse_id, quantity, available_quantity FROM inventory WHERE warehouse_id IS NOT NULL;`

**Issue 3: Warehouse ID mismatch**
- The selected warehouse ID might not match the inventory's warehouse_id
- Check warehouse IDs: `SELECT id, code, name FROM warehouses;`
- Compare with what's selected in the form

**Issue 4: Material ID mismatch**
- The product/material ID might not match
- Check materials: `SELECT id, material_code, description FROM materials LIMIT 10;`

### 5. Quick Fix: Run Migration Manually

If migration didn't run automatically:
```sql
-- Find Colombo warehouse ID
SELECT id, code, name FROM warehouses WHERE name ILIKE '%Colombo%' OR code = 'WH-001';

-- Update inventory (replace WAREHOUSE_UUID with actual UUID from above)
UPDATE inventory
SET warehouse_id = 'WAREHOUSE_UUID'
WHERE warehouse_id IS NULL;
```

### 6. Verify Frontend-Backend Communication

**Check Network Tab:**
1. Open DevTools → Network tab
2. Select a product in the form
3. Look for request to `/api/inventory?materialId=...&warehouseId=...`
4. Check:
   - Request URL (are IDs correct?)
   - Response status (200 OK?)
   - Response body (empty array `[]` or has data?)

## Expected Behavior

1. **Step 2 (Order Details):**
   - User selects "Colombo Main Warehouse"
   - Console shows: `[Outbound Order] Warehouse selected: <UUID>`

2. **Step 3 (Add Items):**
   - User selects a product
   - Console shows:
     - `[Outbound Order] Fetching inventory for material: <UUID>, warehouse: <UUID>`
     - `[Inventory API] Request URL: /inventory?materialId=...&warehouseId=...`
     - `[Inventory API] Response: [...]`
     - `[Outbound Order] Available quantity: <number>`

3. **If inventory exists:**
   - Available Quantity field shows the number
   - Success toast: "Available quantity: X"

4. **If inventory doesn't exist:**
   - Available Quantity shows 0
   - Warning toast: "No inventory found for this product in selected warehouse"

## Next Steps

1. Check browser console for logs
2. Verify database has inventory with correct warehouse_id
3. Test API endpoint directly
4. Share console logs and API response for further debugging
