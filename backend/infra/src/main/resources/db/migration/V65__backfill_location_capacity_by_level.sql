-- V65: Backfill rack level capacity constraints on locations (per-bin, keyed by level_number)
-- Defaults align with Slotting Planner L1–L5 profiles

UPDATE locations SET
    max_weight_kg = CASE COALESCE(level_number, 3)
        WHEN 1 THEN 1000
        WHEN 2 THEN 900
        WHEN 3 THEN 800
        WHEN 4 THEN 600
        WHEN 5 THEN 500
        ELSE 700
    END,
    max_volume_cm3 = CASE COALESCE(level_number, 3)
        WHEN 1 THEN 1200000
        WHEN 2 THEN 1000000
        WHEN 3 THEN 800000
        WHEN 4 THEN 600000
        WHEN 5 THEN 500000
        ELSE 700000
    END,
    capacity = CASE COALESCE(level_number, 3)
        WHEN 1 THEN 120
        WHEN 2 THEN 100
        WHEN 3 THEN 80
        WHEN 4 THEN 60
        WHEN 5 THEN 50
        ELSE 70
    END,
    max_lpn_count = CASE COALESCE(level_number, 3)
        WHEN 1 THEN 4
        WHEN 2 THEN 4
        WHEN 3 THEN 3
        WHEN 4 THEN 2
        WHEN 5 THEN 2
        ELSE 3
    END,
    max_pallet_capacity = CASE COALESCE(level_number, 3)
        WHEN 1 THEN 2
        WHEN 2 THEN 2
        WHEN 3 THEN 1
        WHEN 4 THEN 1
        WHEN 5 THEN 1
        ELSE 1
    END
WHERE max_weight_kg IS NULL
   OR max_volume_cm3 IS NULL
   OR capacity IS NULL
   OR max_lpn_count IS NULL
   OR max_pallet_capacity IS NULL;
