-- Reconcile completed operational receipts that were left in an aggregate
-- (location_code IS NULL) inventory bucket. Exact located duplicates are
-- removed; remaining quantities are merged into the material's primary bin.
-- This is intentionally limited to WH-001 operational-entry rows.

WITH exact_located_duplicates AS (
    SELECT unassigned.id
    FROM inventory unassigned
    JOIN warehouses w ON w.id = unassigned.warehouse_id AND w.code = 'WH-001'
    WHERE unassigned.location_code IS NULL
      AND unassigned.data_quality_tier = 'OPERATIONAL_ENTRY'
      AND EXISTS (
          SELECT 1
          FROM inventory located
          WHERE located.material_id = unassigned.material_id
            AND located.warehouse_id = unassigned.warehouse_id
            AND located.location_code IS NOT NULL
            AND located.data_quality_tier = unassigned.data_quality_tier
            AND located.quantity = unassigned.quantity
            AND located.available_quantity = unassigned.available_quantity
            AND located.reserved_quantity = unassigned.reserved_quantity
      )
)
DELETE FROM inventory inventory_row
USING exact_located_duplicates duplicate
WHERE inventory_row.id = duplicate.id;

WITH candidates AS (
    SELECT source.id AS source_id,
           source.material_id,
           source.warehouse_id,
           source.quantity,
           source.available_quantity,
           source.reserved_quantity,
           source.lpn_code,
           source.batch_number,
           source.expiry_date,
           primary_bin.location_code AS destination_code
    FROM inventory source
    JOIN warehouses w ON w.id = source.warehouse_id AND w.code = 'WH-001'
    JOIN LATERAL (
        SELECT mdl.location_code
        FROM material_default_locations mdl
        JOIN locations l
          ON l.warehouse_id = mdl.warehouse_id
         AND l.location_code = mdl.location_code
        WHERE mdl.material_id = source.material_id
          AND mdl.warehouse_id = source.warehouse_id
          AND l.is_active = TRUE
          AND COALESCE(l.rack_status, 'active') = 'active'
        ORDER BY mdl.priority, mdl.location_code
        LIMIT 1
    ) primary_bin ON TRUE
    WHERE source.location_code IS NULL
      AND source.data_quality_tier = 'OPERATIONAL_ENTRY'
), merged AS (
    UPDATE inventory target
    SET quantity = target.quantity + candidate.quantity,
        available_quantity = target.available_quantity + candidate.available_quantity,
        reserved_quantity = target.reserved_quantity + candidate.reserved_quantity,
        source_lineage = COALESCE(target.source_lineage, '{}'::JSONB)
            || JSONB_BUILD_OBJECT(
                'operational_receipt_reconciled', TRUE,
                'operational_receipt_reconciled_at', TO_JSONB(NOW())
            ),
        updated_at = NOW()
    FROM candidates candidate
    WHERE target.material_id = candidate.material_id
      AND target.warehouse_id = candidate.warehouse_id
      AND target.location_code = candidate.destination_code
      AND COALESCE(target.lpn_code, '') = COALESCE(candidate.lpn_code, '')
      AND COALESCE(target.batch_number, '') = COALESCE(candidate.batch_number, '')
      AND COALESCE(target.expiry_date, DATE '0001-01-01') = COALESCE(candidate.expiry_date, DATE '0001-01-01')
    RETURNING candidate.source_id
)
DELETE FROM inventory source
USING merged
WHERE source.id = merged.source_id;

-- If no bucket existed at the primary bin, move the remaining row in place.
WITH destinations AS (
    SELECT source.id AS source_id, primary_bin.location_code AS destination_code
    FROM inventory source
    JOIN warehouses w ON w.id = source.warehouse_id AND w.code = 'WH-001'
    JOIN LATERAL (
        SELECT mdl.location_code
        FROM material_default_locations mdl
        JOIN locations l
          ON l.warehouse_id = mdl.warehouse_id
         AND l.location_code = mdl.location_code
        WHERE mdl.material_id = source.material_id
          AND mdl.warehouse_id = source.warehouse_id
          AND l.is_active = TRUE
          AND COALESCE(l.rack_status, 'active') = 'active'
        ORDER BY mdl.priority, mdl.location_code
        LIMIT 1
    ) primary_bin ON TRUE
    WHERE source.location_code IS NULL
      AND source.data_quality_tier = 'OPERATIONAL_ENTRY'
)
UPDATE inventory source
SET location_code = destination.destination_code,
    source_lineage = COALESCE(source.source_lineage, '{}'::JSONB)
        || JSONB_BUILD_OBJECT(
            'operational_receipt_reconciled', TRUE,
            'operational_receipt_reconciled_at', TO_JSONB(NOW())
        ),
    updated_at = NOW()
FROM destinations destination
WHERE source.id = destination.source_id;
