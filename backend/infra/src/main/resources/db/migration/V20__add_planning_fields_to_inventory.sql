-- Add additional planning fields from Active stock.csv to inventory table
-- These fields are used for supply planning and inventory management

ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS buffer_days INTEGER,
ADD COLUMN IF NOT EXISTS lead_time_months DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS rop_in_days DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS variance_demand DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS variance_lead_time_demand DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS difference DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS order_delivery_days INTEGER,
ADD COLUMN IF NOT EXISTS order_quantity DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS pallet_requirement DECIMAL(10,2);

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_inventory_rop_in_days ON inventory(rop_in_days);
CREATE INDEX IF NOT EXISTS idx_inventory_order_delivery ON inventory(order_delivery_days);

COMMENT ON COLUMN inventory.buffer_days IS 'Buffer days for safety stock calculation';
COMMENT ON COLUMN inventory.lead_time_months IS 'Lead time in months (for planning)';
COMMENT ON COLUMN inventory.rop_in_days IS 'Reorder point calculated in days';
COMMENT ON COLUMN inventory.variance_demand IS 'Variance in demand forecasting';
COMMENT ON COLUMN inventory.variance_lead_time_demand IS 'Variance in lead time demand';
COMMENT ON COLUMN inventory.difference IS 'Difference between planned and actual';
COMMENT ON COLUMN inventory.order_delivery_days IS 'Order delivery time in days';
COMMENT ON COLUMN inventory.order_quantity IS 'Recommended order quantity';
COMMENT ON COLUMN inventory.pallet_requirement IS 'Number of pallets required';
