-- Migration V8: Convert quantity columns from DECIMAL to INTEGER
-- Actual pallet quantities should be integers (rounded up from demand forecast)

-- Update inventory table quantities to INTEGER
ALTER TABLE inventory 
    ALTER COLUMN quantity TYPE INTEGER USING CEIL(quantity)::INTEGER,
    ALTER COLUMN available_quantity TYPE INTEGER USING CEIL(available_quantity)::INTEGER,
    ALTER COLUMN reserved_quantity TYPE INTEGER USING CEIL(reserved_quantity)::INTEGER;

-- Update order_items table quantities to INTEGER
ALTER TABLE order_items 
    ALTER COLUMN quantity TYPE INTEGER USING CEIL(quantity)::INTEGER,
    ALTER COLUMN picked_quantity TYPE INTEGER USING CEIL(COALESCE(picked_quantity, 0))::INTEGER,
    ALTER COLUMN packed_quantity TYPE INTEGER USING CEIL(COALESCE(packed_quantity, 0))::INTEGER;

-- Update stock_movements table quantity to INTEGER
ALTER TABLE stock_movements 
    ALTER COLUMN quantity TYPE INTEGER USING CEIL(quantity)::INTEGER;

-- Update stock_transfers table quantity to INTEGER
ALTER TABLE stock_transfers 
    ALTER COLUMN quantity TYPE INTEGER USING CEIL(quantity)::INTEGER;

-- Note: Demand forecast columns (predicted_quantity, recommended_quantity, planned_quantity, actual_quantity)
-- remain as DECIMAL(15,2) as they can have decimal values for forecasting purposes

