-- Refine finished-good and packaging display names after checking every V8 BOM.
-- The generated BOM mixes packaging formats, so display names intentionally do
-- not claim a volume that the source data cannot support. Codes and IDs remain
-- unchanged and all BOM, stock, order and forecast foreign keys are preserved.
WITH catalog(prefix, names) AS (
    VALUES
    ('FG', ARRAY[
        'CleanWave Fresh Laundry Liquid',
        'HomeBright Mineral Surface Cream',
        'FreshHome Pine Floor Cleaner',
        'FreshHome Aloe Mint Surface Cleaner',
        'HomeBright Heavy-Duty Kitchen Degreaser',
        'CleanWave Oxygen-Action Laundry Detergent',
        'FreshHome Citrus Pine Multi-Surface Cleaner',
        'FreshHome Active Bathroom Cleaner',
        'HomeBright Aloe Citrus Dishwash Liquid',
        'HomeBright Lavender Dishwash Gel',
        'HomeBright Lavender Scouring Cream',
        'HomeBright Fragrance-Free Dishwash Concentrate',
        'CleanWave Oxygen Stain Remover',
        'HomeBright Mineral Cleaning Cream',
        'CleanWave Antibacterial Fabric Wash',
        'CleanWave Citrus Soil-Release Detergent',
        'CleanWave Rose & Jasmine Laundry Booster',
        'HomeBright Citrus Neem Kitchen Spray',
        'CleanWave Lavender Fabric Wash',
        'FreshHome Antibacterial Pine Cleaner',
        'FreshHome Herbal Surface Sanitiser',
        'HomeBright Citrus Bicarbonate Cleaner',
        'CleanWave Lemongrass Chlorine Laundry Cleaner',
        'HomeBright Citrus Herbal Dishwash Liquid'
    ]::TEXT[]),
    ('PM', ARRAY[
        'PET Bottle — Format A', 'PET Bottle — Format B',
        'HDPE Bottle — Format A', 'HDPE Bottle — Format B',
        'HDPE Bottle — Format C', 'Flip-Top Closure — Format A',
        'Flip-Top Closure — Format B', 'Pump Closure',
        'Trigger-Spray Closure', 'Tamper-Evident Closure',
        'Printed Label Set — Format A', 'Printed Label Set — Format B',
        'Printed Label Set — Format C', 'Printed Label Set — Format D',
        'Printed Label Set — Format E', 'Printed Shrink Sleeve — Format A',
        'Printed Shrink Sleeve — Format B', 'Printed Shrink Sleeve — Format C',
        'Printed Shrink Sleeve — Format D', 'Printed Shrink Sleeve — Format E',
        'Corrugated Shipping Case — Format A', 'Corrugated Shipping Case — Format B',
        'Corrugated Shipping Case — Format C', 'Corrugated Shipping Case — Format D',
        'Corrugated Shipping Case — Format E', 'Corrugated Divider Insert',
        'Batch and Expiry Ink Ribbon', 'GS1 Barcode Label Roll',
        'Pallet Stretch-Wrap Film', 'Pallet Identification Label'
    ]::TEXT[])
), expanded AS (
    SELECT prefix || '-' || LPAD(ordinality::TEXT, 4, '0') AS material_code,
           display_name
    FROM catalog
    CROSS JOIN LATERAL UNNEST(names) WITH ORDINALITY AS item(display_name, ordinality)
)
UPDATE materials material
SET description = expanded.display_name,
    source_lineage = COALESCE(material.source_lineage, '{}'::JSONB)
        || JSONB_BUILD_OBJECT(
            'display_catalog', 'PROJECT_OPS_HOUSEHOLD_CARE_V2',
            'display_name_updated_at', TO_JSONB(NOW())
        ),
    updated_at = NOW()
FROM expanded
WHERE material.material_code = expanded.material_code
  AND material.data_quality_tier = 'PROJECT_OPERATIONAL_SIMULATION';
