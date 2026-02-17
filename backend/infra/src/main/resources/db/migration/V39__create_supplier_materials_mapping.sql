-- Supplier-Material many-to-many mapping
-- Enables selecting only supplier-provided materials for inbound orders.

CREATE TABLE IF NOT EXISTS supplier_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uk_supplier_material UNIQUE (supplier_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_materials_supplier ON supplier_materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_materials_material ON supplier_materials(material_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_supplier_materials_updated_at'
    ) THEN
        CREATE TRIGGER update_supplier_materials_updated_at
            BEFORE UPDATE ON supplier_materials
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Backfill links from existing inbound orders to preserve current behavior.
INSERT INTO supplier_materials (supplier_id, material_id)
SELECT DISTINCT o.supplier_id, oi.material_id
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE LOWER(COALESCE(o.order_type, '')) = 'inbound'
  AND o.supplier_id IS NOT NULL
  AND oi.material_id IS NOT NULL
ON CONFLICT (supplier_id, material_id) DO NOTHING;
