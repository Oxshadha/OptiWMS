-- OptiWMS Database Migration
-- Version 17: Seed Inventory Data from Active stock.csv
-- Industry Best Practice: Store data in database via Flyway migrations
-- This migration loads inventory stock levels (Column 9 = Future Average = Quantity)
-- Requires: V16__seed_materials_from_csv.sql must run first

DO $$
DECLARE
    warehouse_uuid UUID;
    material_uuid UUID;
    quantity_val INTEGER;
BEGIN
    -- Get default warehouse
    SELECT id INTO warehouse_uuid FROM warehouses WHERE code = 'WH-001' LIMIT 1;

    IF warehouse_uuid IS NULL THEN
        RAISE EXCEPTION 'No warehouse found. Please ensure V2__seed_initial_data.sql has run.';
    END IF;

    -- Material: 100036, Quantity: 88715
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100036';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 88715, 88715, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101054, Quantity: 63018
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101054';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 63018, 63018, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100098, Quantity: 66273
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100098';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 66273, 66273, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101293, Quantity: 56600
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101293';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 56600, 56600, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100108, Quantity: 31648
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100108';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 31648, 31648, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100323, Quantity: 21519
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100323';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 21519, 21519, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100094, Quantity: 8591
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100094';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 8591, 8591, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101466, Quantity: 3842
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101466';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 3842, 3842, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101580, Quantity: 22958
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101580';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 22958, 22958, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100460, Quantity: 17874
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100460';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 17874, 17874, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100039, Quantity: 3767
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100039';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 3767, 3767, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101300, Quantity: 4404
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101300';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 4404, 4404, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100714, Quantity: 9547
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100714';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 9547, 9547, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101308, Quantity: 7809
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101308';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 7809, 7809, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100050, Quantity: 10316
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100050';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 10316, 10316, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101413, Quantity: 4770
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101413';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 4770, 4770, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100403, Quantity: 5612
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100403';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 5612, 5612, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101736, Quantity: 1623
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101736';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1623, 1623, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100110, Quantity: 5600
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100110';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 5600, 5600, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101305, Quantity: 4404
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101305';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 4404, 4404, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101428, Quantity: 1262
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101428';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1262, 1262, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100030, Quantity: 1134
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100030';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1134, 1134, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100904, Quantity: 3893
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100904';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 3893, 3893, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101065, Quantity: 4886
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101065';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 4886, 4886, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101472, Quantity: 3436
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101472';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 3436, 3436, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101017, Quantity: 379
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101017';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 379, 379, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101302, Quantity: 2294
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101302';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 2294, 2294, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101398, Quantity: 4885
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101398';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 4885, 4885, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101389, Quantity: 307
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101389';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 307, 307, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101762, Quantity: 1649
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101762';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1649, 1649, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100006, Quantity: 2204
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100006';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 2204, 2204, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101399, Quantity: 5437
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101399';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 5437, 5437, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101471, Quantity: 2112
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101471';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 2112, 2112, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100038, Quantity: 2196
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100038';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 2196, 2196, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100525, Quantity: 923
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100525';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 923, 923, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101374, Quantity: 446
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101374';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 446, 446, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101390, Quantity: 2012
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101390';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 2012, 2012, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101429, Quantity: 644
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101429';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 644, 644, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101862, Quantity: 3807
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101862';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 3807, 3807, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100026, Quantity: 1809
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100026';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1809, 1809, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100105, Quantity: 1250
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100105';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1250, 1250, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100171, Quantity: 1469
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100171';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1469, 1469, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100835, Quantity: 916
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100835';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 916, 916, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100913, Quantity: 2674
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100913';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 2674, 2674, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100018, Quantity: 2008
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100018';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 2008, 2008, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100043, Quantity: 1241
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100043';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1241, 1241, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100093, Quantity: 1297
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100093';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1297, 1297, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100097, Quantity: 1484
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100097';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1484, 1484, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101295, Quantity: 1134
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101295';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1134, 1134, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101468, Quantity: 1980
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101468';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1980, 1980, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101470, Quantity: 1094
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101470';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1094, 1094, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101488, Quantity: 2918
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101488';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 2918, 2918, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101496, Quantity: 979
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101496';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 979, 979, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101517, Quantity: 1991
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101517';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1991, 1991, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101637, Quantity: 1032
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101637';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1032, 1032, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100035, Quantity: 250
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100035';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 250, 250, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100044, Quantity: 1406
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100044';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1406, 1406, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100069, Quantity: 754
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100069';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 754, 754, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100118, Quantity: 1379
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100118';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1379, 1379, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100119, Quantity: 789
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100119';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 789, 789, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100201, Quantity: 759
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100201';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 759, 759, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100903, Quantity: 1663
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100903';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1663, 1663, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101273, Quantity: 1028
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101273';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1028, 1028, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101409, Quantity: 721
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101409';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 721, 721, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101463, Quantity: 837
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101463';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 837, 837, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101467, Quantity: 1188
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101467';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1188, 1188, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101489, Quantity: 1944
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101489';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1944, 1944, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101623, Quantity: 738
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101623';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 738, 738, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101625, Quantity: 1452
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101625';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1452, 1452, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101763, Quantity: 1225
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101763';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1225, 1225, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101859, Quantity: 916
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101859';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 916, 916, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100010, Quantity: 42
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100010';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 42, 42, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100080, Quantity: 154
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100080';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 154, 154, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100099, Quantity: 352
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100099';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 352, 352, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100100, Quantity: 374
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100100';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 374, 374, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100198, Quantity: 452
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100198';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 452, 452, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100713, Quantity: 324
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100713';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 324, 324, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101015, Quantity: 57
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101015';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 57, 57, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101091, Quantity: 479
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101091';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 479, 479, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101282, Quantity: 39
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101282';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 39, 39, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101298, Quantity: 212
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101298';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 212, 212, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101370, Quantity: 21
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101370';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 21, 21, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101376, Quantity: 389
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101376';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 389, 389, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101380, Quantity: 300
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101380';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 300, 300, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101453, Quantity: 505
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101453';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 505, 505, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101469, Quantity: 368
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101469';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 368, 368, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101515, Quantity: 131
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101515';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 131, 131, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101605, Quantity: 36
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101605';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 36, 36, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101825, Quantity: 3
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101825';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 3, 3, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101832, Quantity: 154
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101832';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 154, 154, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 101841, Quantity: 132
    SELECT id INTO material_uuid FROM materials WHERE material_code = '101841';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 132, 132, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100448, Quantity: 34
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100448';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 34, 34, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100005, Quantity: 1455
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100005';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1455, 1455, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100012, Quantity: 130
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100012';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 130, 130, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100016, Quantity: 1
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100016';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 1, 1, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100019, Quantity: 212
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100019';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 212, 212, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100028, Quantity: 562
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100028';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 562, 562, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100031, Quantity: 50
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100031';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 50, 50, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100033, Quantity: 201
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100033';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 201, 201, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    -- Material: 100046, Quantity: 10
    SELECT id INTO material_uuid FROM materials WHERE material_code = '100046';
    IF material_uuid IS NOT NULL THEN
        INSERT INTO inventory (material_id, warehouse_id, quantity, available_quantity, reserved_quantity, status, created_at, updated_at)
        VALUES (material_uuid, warehouse_uuid, 10, 10, 0, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

END $$;
