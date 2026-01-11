# Debug: Why Available Quantity is Not Fetching

## Issue
Available quantity shows 0 in outbound order form even though inventory exists in database.

## Root Cause Analysis

### Step-by-Step Debugging

1. **Check Browser Console Logs**
   - Look for `[Inventory API] ===== START FETCH =====`
   - Check the materialId and warehouseId being sent
   - Verify they are valid UUIDs

2. **Check Network Tab**
   - Open DevTools → Network tab
   - Filter by "inventory"
   - Select a product in the form
   - Look for the GET request to `/api/inventory?materialId=...&warehouseId=...`
   - Check:
     - **Request URL**: Are the IDs correct?
     - **Response Status**: Is it 200 OK?
     - **Response Body**: What does it contain? (empty array `[]` or data?)

3. **Verify Database State**

   **Check if inventory exists for the material+warehouse:**
   ```sql
   -- Replace MATERIAL_ID and WAREHOUSE_ID with actual UUIDs from console logs
   SELECT 
     i.id,
     i.material_id,
     i.warehouse_id,
     i.quantity,
     i.available_quantity,
     m.material_code,
     m.description,
     w.code as warehouse_code,
     w.name as warehouse_name
   FROM inventory i
   LEFT JOIN materials m ON i.material_id = m.id
   LEFT JOIN warehouses w ON i.warehouse_id = w.id
   WHERE i.material_id = 'MATERIAL_ID'
     AND i.warehouse_id = 'WAREHOUSE_ID';
   ```

   **Check all inventory for the warehouse:**
   ```sql
   -- Replace WAREHOUSE_ID with actual UUID
   SELECT 
     COUNT(*) as total_items,
     COUNT(CASE WHEN available_quantity > 0 THEN 1 END) as items_with_stock
   FROM inventory
   WHERE warehouse_id = 'WAREHOUSE_ID';
   ```

4. **Common Issues**

   **Issue 1: UUID Mismatch**
   - The warehouse ID selected in the form might not match the warehouse_id in the database
   - Check: Compare the warehouse ID from console logs with database
   - Fix: Ensure the warehouse dropdown uses the correct warehouse ID

   **Issue 2: Material ID Mismatch**
   - The material ID from the product dropdown might not match the material_id in inventory
   - Check: Compare material ID from console logs with database
   - Fix: Ensure product dropdown uses correct material IDs

   **Issue 3: No Inventory Record**
   - Inventory might not exist for that material+warehouse combination
   - Check: Run the SQL query above
   - Fix: Create inventory record or assign inventory to the correct warehouse

   **Issue 4: Migration Not Run**
   - V22 migration might not have run, so warehouse_id is still NULL
   - Check: `SELECT COUNT(*) FROM inventory WHERE warehouse_id IS NULL;`
   - Fix: Restart backend to trigger migration, or run manually

   **Issue 5: Available Quantity is Actually 0**
   - Inventory exists but `available_quantity` is 0
   - Check: `SELECT quantity, available_quantity FROM inventory WHERE ...`
   - Fix: Update inventory quantities

## What the Logs Will Show

### If Inventory Exists:
```
[Inventory API] ===== FOUND INVENTORY =====
[Inventory API] availableQuantity: 23 (type: string)
[Inventory API] quantity: 23 (type: string)
```

### If Inventory Doesn't Exist:
```
[Inventory API] ===== NO INVENTORY FOUND =====
[Inventory API] Response was empty or not an array
```

### If API Error:
```
[Inventory API] ===== ERROR =====
[Inventory API] Error message: ...
```

## Next Steps

1. **Check Console Logs**: Look for the detailed logs when selecting a product
2. **Check Network Tab**: Verify the API request and response
3. **Run SQL Query**: Verify inventory exists in database
4. **Compare IDs**: Ensure warehouse and material IDs match between form and database

## Quick Test

Test the API directly:
```bash
# Replace with actual IDs from console logs
curl -X GET "http://localhost:8080/api/inventory?materialId=MATERIAL_ID&warehouseId=WAREHOUSE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response if inventory exists:
```json
[
  {
    "id": "...",
    "materialId": "...",
    "warehouseId": "...",
    "quantity": "23",
    "availableQuantity": "23",
    ...
  }
]
```

Expected response if no inventory:
```json
[]
```
