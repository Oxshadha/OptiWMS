-- Migration: Assign all inventory to Colombo Main Warehouse
-- This ensures all existing inventory items are linked to a warehouse

-- Step 1: Find or get Colombo Main Warehouse ID
DO $$
DECLARE
    colombo_warehouse_id UUID;
BEGIN
    -- Try to find Colombo Main Warehouse by name or code
    SELECT id INTO colombo_warehouse_id
    FROM warehouses
    WHERE name ILIKE '%Colombo%' 
       OR code = 'WH-001'
    LIMIT 1;
    
    -- If not found, get the first warehouse
    IF colombo_warehouse_id IS NULL THEN
        SELECT id INTO colombo_warehouse_id
        FROM warehouses
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;
    
    -- If still no warehouse exists, we can't proceed
    IF colombo_warehouse_id IS NULL THEN
        RAISE EXCEPTION 'No warehouse found. Please create a warehouse first.';
    END IF;
    
    -- Step 2: Update all inventory items without warehouse_id to Colombo warehouse
    UPDATE inventory
    SET warehouse_id = colombo_warehouse_id
    WHERE warehouse_id IS NULL;
    
    -- Step 3: Also update any inventory that might have invalid warehouse_id
    -- (warehouse_id that doesn't exist in warehouses table)
    UPDATE inventory i
    SET warehouse_id = colombo_warehouse_id
    WHERE NOT EXISTS (
        SELECT 1 FROM warehouses w WHERE w.id = i.warehouse_id
    );
    
    RAISE NOTICE 'Assigned % inventory items to warehouse: %', 
        (SELECT COUNT(*) FROM inventory WHERE warehouse_id = colombo_warehouse_id),
        (SELECT name FROM warehouses WHERE id = colombo_warehouse_id);
END $$;
