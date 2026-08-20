-- Typed assistant tools require an explicit warehouse assignment, including for admins.
-- This updates only unassigned seeded administrators in the canonical project environment.
UPDATE users
SET warehouse_id = (SELECT id FROM warehouses WHERE code = 'WH-001' LIMIT 1),
    updated_at = now()
WHERE warehouse_id IS NULL
  AND lower(role) IN ('admin', 'system_admin', 'warehouse_manager')
  AND EXISTS (SELECT 1 FROM warehouses WHERE code = 'WH-001');
