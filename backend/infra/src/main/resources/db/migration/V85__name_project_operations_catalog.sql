-- Replace opaque simulation descriptions with stable, operator-friendly names.
-- Material codes and IDs stay unchanged, preserving every inventory, BOM,
-- order, slotting and forecast relationship.
WITH catalog(prefix, names) AS (
    VALUES
    ('FG', ARRAY[
        'FreshCare Aloe Hand Wash 250 ml',
        'FreshCare Lemon Hand Wash 250 ml',
        'FreshCare Lavender Hand Wash 250 ml',
        'FreshCare Sensitive Hand Wash 250 ml',
        'PureGlow Citrus Body Wash 250 ml',
        'PureGlow Floral Body Wash 250 ml',
        'PureGlow Herbal Body Wash 250 ml',
        'PureGlow Ocean Body Wash 250 ml',
        'SilkRoot Daily Care Shampoo 200 ml',
        'SilkRoot Anti-Dandruff Shampoo 200 ml',
        'SilkRoot Nourishing Shampoo 200 ml',
        'SilkRoot Gentle Conditioner 200 ml',
        'HomeBright Lemon Dishwash Liquid 500 ml',
        'HomeBright Lime Dishwash Liquid 500 ml',
        'HomeBright Antibacterial Dishwash Liquid 500 ml',
        'HomeBright Multi-Surface Cleaner 500 ml',
        'FreshHome Glass Cleaner 500 ml',
        'FreshHome Floor Cleaner 1 L',
        'FreshHome Toilet Cleaner 500 ml',
        'FreshHome Disinfectant Liquid 1 L',
        'CleanWave Laundry Liquid 1 L',
        'CleanWave Fabric Conditioner 1 L',
        'CleanWave Laundry Powder 1 kg',
        'CleanWave Delicates Wash 500 ml'
    ]::TEXT[]),
    ('RM', ARRAY[
        'Purified Water', 'Sodium Laureth Sulfate', 'Cocamidopropyl Betaine', 'Glycerine',
        'Sodium Chloride', 'Citric Acid', 'Sodium Hydroxide Solution', 'Preservative Blend',
        'Fresh Citrus Fragrance', 'Floral Fragrance', 'Herbal Fragrance', 'Ocean Fresh Fragrance',
        'Blue Colourant', 'Green Colourant', 'Pink Colourant', 'Yellow Colourant',
        'EDTA Chelating Agent', 'Xanthan Gum', 'Cellulose Thickener', 'Sodium Benzoate',
        'Potassium Sorbate', 'Lactic Acid', 'Aloe Vera Extract', 'Neem Extract',
        'Tea Tree Extract', 'Coconut-Derived Surfactant', 'Decyl Glucoside', 'Lauryl Glucoside',
        'Sodium Coco Sulfate', 'Amine Oxide Surfactant', 'Linear Alkylbenzene Sulfonate',
        'Alpha Olefin Sulfonate', 'Nonionic Surfactant Blend', 'Vegetable Soap Base',
        'Foam Booster', 'Pearlising Agent', 'Conditioning Polymer', 'Moisturising Complex',
        'Panthenol', 'Vitamin E Acetate', 'Silicone Emulsion', 'Anti-Redeposition Polymer',
        'Optical Brightener', 'Laundry Enzyme Blend', 'Soil Release Polymer',
        'Fabric Softening Agent', 'Anti-Foam Emulsion', 'Corrosion Inhibitor',
        'Sodium Carbonate', 'Sodium Bicarbonate', 'Sodium Sulfate', 'Zeolite Builder',
        'Sodium Silicate', 'Oxygen Bleach', 'Bleach Activator', 'Hypochlorite Solution',
        'Hydrogen Peroxide', 'Isopropyl Alcohol', 'Ethyl Alcohol', 'Propylene Glycol',
        'Sorbitol', 'Urea', 'Talcum Powder', 'Calcium Carbonate', 'Silica Thickener',
        'Corn Starch Binder', 'Polymer Opacifier', 'Titanium Dioxide', 'Perfume Solubiliser',
        'Hydrotrope', 'pH Buffer Blend', 'Water Softening Agent', 'Antibacterial Active',
        'Antifungal Active', 'Deodorising Active', 'Degreasing Solvent', 'Citrus Terpene',
        'Pine Oil', 'Eucalyptus Oil', 'Lavender Oil', 'Lemongrass Oil',
        'Rose Fragrance Compound', 'Jasmine Fragrance Compound', 'Herbal Fragrance Compound',
        'Mint Fragrance Compound', 'Marine Fragrance Compound', 'Colour Stabiliser',
        'UV Stabiliser', 'Viscosity Stabiliser', 'Formulation Processing Aid'
    ]::TEXT[]),
    ('PM', ARRAY[
        '100 ml PET Bottle Pack Kit', '200 ml PET Bottle Pack Kit',
        '250 ml HDPE Bottle Pack Kit', '500 ml HDPE Bottle Pack Kit',
        '1 L HDPE Bottle Pack Kit', '100 ml Flip-Top Closure Kit',
        '200 ml Flip-Top Closure Kit', '250 ml Pump Closure Kit',
        '500 ml Trigger Closure Kit', '1 L Tamper-Evident Closure Kit',
        '100 ml Printed Label Set', '200 ml Printed Label Set',
        '250 ml Printed Label Set', '500 ml Printed Label Set',
        '1 L Printed Label Set', '100 ml Printed Shrink Sleeve',
        '200 ml Printed Shrink Sleeve', '250 ml Printed Shrink Sleeve',
        '500 ml Printed Shrink Sleeve', '1 L Printed Shrink Sleeve',
        '12 x 100 ml Corrugated Case', '12 x 200 ml Corrugated Case',
        '12 x 250 ml Corrugated Case', '12 x 500 ml Corrugated Case',
        '6 x 1 L Corrugated Case', 'Corrugated Divider Insert',
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
            'display_catalog', 'PROJECT_OPS_CONSUMER_CARE_V1',
            'display_name_updated_at', TO_JSONB(NOW())
        ),
    updated_at = NOW()
FROM expanded
WHERE material.material_code = expanded.material_code
  AND material.data_quality_tier = 'PROJECT_OPERATIONAL_SIMULATION';
