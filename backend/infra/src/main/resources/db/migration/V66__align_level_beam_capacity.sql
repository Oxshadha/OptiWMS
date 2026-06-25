-- V66: Align level-beam weight caps (L1-L3: 500kg, L4-L5: 300kg) and standard 1-pallet-per-bin

UPDATE location_levels SET
    weight_capacity_kg = CASE COALESCE(level_number, 3)
        WHEN 1 THEN 500
        WHEN 2 THEN 500
        WHEN 3 THEN 500
        WHEN 4 THEN 300
        WHEN 5 THEN 300
        ELSE 400
    END,
    pallet_capacity = CASE
        WHEN pallet_capacity IS NULL OR pallet_capacity < 2 THEN 2
        ELSE pallet_capacity
    END;

UPDATE locations SET
    max_pallet_capacity = 1,
    max_weight_kg = CASE COALESCE(level_number, 3)
        WHEN 1 THEN 500
        WHEN 2 THEN 500
        WHEN 3 THEN 500
        WHEN 4 THEN 300
        WHEN 5 THEN 300
        ELSE 400
    END
WHERE zone_type = 'STORAGE'
  AND (max_pallet_capacity IS NULL OR max_pallet_capacity <> 1);
