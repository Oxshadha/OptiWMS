-- Auto-generated BOM seed data for V55 schema
-- Requires materials table to be populated first

DO $$ DECLARE
  v_bom_id UUID;
  v_parent_id UUID;
  v_comp_id UUID;
BEGIN
  -- BOM for FG001 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG001' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100078' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.223273, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.203318, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101700' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.358864, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.214545, 'kg');
    END IF;
  END IF;

  -- BOM for FG002 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG002' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101415' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.3005, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.184045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101470' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.277409, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100033' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.238045, 'kg');
    END IF;
  END IF;

  -- BOM for FG003 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG003' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101463' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.125364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101443' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.430409, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100132' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.123409, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.320818, 'kg');
    END IF;
  END IF;

  -- BOM for FG004 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG004' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101823' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.196364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100132' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.3095, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100033' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.276045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100105' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.218091, 'kg');
    END IF;
  END IF;

  -- BOM for FG005 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG005' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101742' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.146045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100132' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.088045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101505' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.310864, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101824' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.455045, 'kg');
    END IF;
  END IF;

  -- BOM for FG006 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG006' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100714' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.106773, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101823' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.304591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100127' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.344773, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.243864, 'kg');
    END IF;
  END IF;

  -- BOM for FG007 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG007' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101825' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.295059, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.216373, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100028' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.287468, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100039' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.2011, 'kg');
    END IF;
  END IF;

  -- BOM for FG008 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG008' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101826' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.400455, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100016' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.224409, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101742' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.228227, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100039' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.146909, 'kg');
    END IF;
  END IF;

  -- BOM for FG009 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG009' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101463' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.128818, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101812' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.191227, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.210864, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101742' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.469091, 'kg');
    END IF;
  END IF;

  -- BOM for FG010 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG010' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100078' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.540157, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101016' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.147857, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100039' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.185401, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.126585, 'kg');
    END IF;
  END IF;

  -- BOM for FG011 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG011' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101826' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.141773, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101737' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.367409, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101415' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.219682, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100033' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.271136, 'kg');
    END IF;
  END IF;

  -- BOM for FG012 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG012' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101828' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.298423, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100086' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.342788, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.211419, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.14737, 'kg');
    END IF;
  END IF;

  -- BOM for FG013 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG013' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101823' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.355, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101831' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.232591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100086' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.276273, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.136136, 'kg');
    END IF;
  END IF;

  -- BOM for FG014 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG014' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101505' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.1906, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100403' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.317378, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.401791, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101700' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.090231, 'kg');
    END IF;
  END IF;

  -- BOM for FG015 (SOAP)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG015' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101819' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.37879, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101831' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.246284, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101463' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.168826, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100714' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.2061, 'kg');
    END IF;
  END IF;

  -- BOM for FG016 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG016' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100105' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.530409, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100128' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.139364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101742' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.241409, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.088818, 'kg');
    END IF;
  END IF;

  -- BOM for FG017 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG017' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.1235, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100201' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.346364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100105' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.313136, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101830' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.217, 'kg');
    END IF;
  END IF;

  -- BOM for FG018 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG018' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100873' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.323318, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100078' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.281091, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101516' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.099591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100714' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.296, 'kg');
    END IF;
  END IF;

  -- BOM for FG019 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG019' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100006' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.428383, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100019' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.187599, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100033' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.190463, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101831' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.193554, 'kg');
    END IF;
  END IF;

  -- BOM for FG020 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG020' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100006' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.077545, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.260091, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101835' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.218455, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100036' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.443909, 'kg');
    END IF;
  END IF;

  -- BOM for FG021 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG021' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100028' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.173364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100128' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.307273, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100201' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.362955, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.156409, 'kg');
    END IF;
  END IF;

  -- BOM for FG022 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG022' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.325273, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100039' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.073364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101463' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.166, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100019' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.435364, 'kg');
    END IF;
  END IF;

  -- BOM for FG023 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG023' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100026' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.218399, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101415' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.278578, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101835' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.431071, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100039' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.071951, 'kg');
    END IF;
  END IF;

  -- BOM for FG024 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG024' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100010' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.288636, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.118227, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100201' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.170545, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101835' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.422591, 'kg');
    END IF;
  END IF;

  -- BOM for FG025 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG025' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.371818, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101415' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.286591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100039' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.241136, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100010' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.100455, 'kg');
    END IF;
  END IF;

  -- BOM for FG026 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG026' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100006' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.099823, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101831' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.191918, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100078' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.179281, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100714' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.528979, 'kg');
    END IF;
  END IF;

  -- BOM for FG027 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG027' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.253, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.113727, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100134' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.374909, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100201' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.258364, 'kg');
    END IF;
  END IF;

  -- BOM for FG028 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG028' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100006' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.260682, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.406909, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.097364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100134' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.235045, 'kg');
    END IF;
  END IF;

  -- BOM for FG029 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG029' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101463' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.239716, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101835' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.403527, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100026' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.225035, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101697' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.131721, 'kg');
    END IF;
  END IF;

  -- BOM for FG030 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG030' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101582' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.435273, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101831' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.134045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100873' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.179227, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100019' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.251455, 'kg');
    END IF;
  END IF;

  -- BOM for FG031 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG031' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100039' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.168053, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101463' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.221146, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100201' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.294968, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.315833, 'kg');
    END IF;
  END IF;

  -- BOM for FG032 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG032' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101516' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.305773, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100873' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.358091, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.092864, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100036' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.243273, 'kg');
    END IF;
  END IF;

  -- BOM for FG033 (SHAMPOO)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG033' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101742' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.291364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.391818, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101505' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.078364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100010' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.238455, 'kg');
    END IF;
  END IF;

  -- BOM for FG034 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG034' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100201' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.334515, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100039' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.200327, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101697' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.149643, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101794' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.315514, 'kg');
    END IF;
  END IF;

  -- BOM for FG035 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG035' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100201' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.139955, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101793' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.318, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.261409, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.280636, 'kg');
    END IF;
  END IF;

  -- BOM for FG036 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG036' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100033' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.295455, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100005' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.289818, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101697' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.205045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101760' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.209682, 'kg');
    END IF;
  END IF;

  -- BOM for FG037 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG037' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100031' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.249591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.158318, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.316364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101091' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.275727, 'kg');
    END IF;
  END IF;

  -- BOM for FG038 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG038' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100010' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.594636, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.235045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101835' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.085136, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100026' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.085182, 'kg');
    END IF;
  END IF;

  -- BOM for FG039 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG039' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100026' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.223101, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100127' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.290786, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.235783, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101597' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.25033, 'kg');
    END IF;
  END IF;

  -- BOM for FG040 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG040' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.252591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.559955, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100132' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.115636, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100134' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.071818, 'kg');
    END IF;
  END IF;

  -- BOM for FG041 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG041' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100035' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.2645, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100714' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.258909, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100201' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.297545, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101345' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.179045, 'kg');
    END IF;
  END IF;

  -- BOM for FG042 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG042' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100033' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.122364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100201' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.230591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101742' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.474045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101470' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.173, 'kg');
    END IF;
  END IF;

  -- BOM for FG043 (FACEWASH)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG043' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100006' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SOLVENT', 0.475842, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100010' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.088314, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.168265, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101835' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.267579, 'kg');
    END IF;
  END IF;

  -- BOM for FG044 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG044' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101812' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.153827, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101469' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.047522, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101653' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.798651, 'kg');
    END IF;
  END IF;

  -- BOM for FG045 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG045' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101823' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.481572, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101798' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.107616, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100904' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.342568, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101825' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.042772, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101698' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.025472, 'kg');
    END IF;
  END IF;

  -- BOM for FG046 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG046' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101515' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.493965, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101207' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.329786, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101307' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.176249, 'kg');
    END IF;
  END IF;

  -- BOM for FG047 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG047' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100904' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.149532, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101584' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.486363, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101733' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.272569, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101203' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.091536, 'kg');
    END IF;
  END IF;

  -- BOM for FG048 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG048' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101581' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.343589, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101469' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.358315, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101698' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.279282, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101525' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.018814, 'kg');
    END IF;
  END IF;

  -- BOM for FG049 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG049' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100097' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.060537, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101300' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.003611, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101515' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.02859, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101736' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.224655, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101380' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.682607, 'kg');
    END IF;
  END IF;

  -- BOM for FG050 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG050' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101800' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.133575, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101516' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.146386, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101428' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.515513, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100527' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.204526, 'kg');
    END IF;
  END IF;

  -- BOM for FG051 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG051' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101738' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.138411, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100904' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.335893, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101825' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.45173, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101273' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.073967, 'kg');
    END IF;
  END IF;

  -- BOM for FG052 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG052' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101293' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.657866, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100084' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.144583, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101814' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.067298, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101496' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.071335, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101467' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.058919, 'kg');
    END IF;
  END IF;

  -- BOM for FG053 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG053' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101806' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.512901, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101379' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.345435, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101429' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.088031, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101208' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.053633, 'kg');
    END IF;
  END IF;

  -- BOM for FG054 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG054' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101469' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.349311, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101282' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.23191, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101653' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.126684, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101287' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.209717, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100904' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.082379, 'kg');
    END IF;
  END IF;

  -- BOM for FG055 (Diaper)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG055' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101203' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.183404, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101346' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.57195, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101740' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.244646, 'kg');
    END IF;
  END IF;

  -- BOM for FG056 (Sanitary)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG056' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101466' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.094195, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100093' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.655383, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101697' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.250422, 'kg');
    END IF;
  END IF;

  -- BOM for FG057 (Sanitary)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG057' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101302' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.075904, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101823' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.011823, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101841' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.703929, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101797' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.208343, 'kg');
    END IF;
  END IF;

  -- BOM for FG058 (Sanitary)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG058' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101699' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.20419, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101581' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.423708, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101285' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.073873, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101525' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.298229, 'kg');
    END IF;
  END IF;

  -- BOM for FG059 (Sanitary)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG059' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101302' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.090632, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101288' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.117631, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100097' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.005512, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101373' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.304636, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101428' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.48159, 'kg');
    END IF;
  END IF;

  -- BOM for FG060 (Sanitary)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG060' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101373' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.20685, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100084' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.753886, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101379' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.039264, 'kg');
    END IF;
  END IF;

  -- BOM for FG061 (Sanitary)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG061' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101211' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.516007, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101799' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.097326, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101359' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.207805, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101832' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.096203, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100134' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.082658, 'kg');
    END IF;
  END IF;

  -- BOM for FG062 (Sanitary)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG062' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.250146, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101469' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.167808, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101274' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.209539, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101581' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.179803, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101376' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.192704, 'kg');
    END IF;
  END IF;

  -- BOM for FG063 (Sanitary)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG063' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101472' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'PACKAGING', 0.52209, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101083' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.223445, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101814' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.030008, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100117' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.224457, 'kg');
    END IF;
  END IF;

  -- BOM for FG064 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG064' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101394' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.181773, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.390182, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100134' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.178591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101577' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.249455, 'kg');
    END IF;
  END IF;

  -- BOM for FG065 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG065' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100019' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.274636, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101603' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.086091, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101831' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.329955, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100030' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.309318, 'kg');
    END IF;
  END IF;

  -- BOM for FG066 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG066' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101830' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.340318, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101375' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.312045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.184773, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100132' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.162864, 'kg');
    END IF;
  END IF;

  -- BOM for FG067 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG067' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101394' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.215682, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100019' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.332773, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100085' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.351364, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101835' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.100182, 'kg');
    END IF;
  END IF;

  -- BOM for FG068 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG068' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100030' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.213146, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101443' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.34797, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101833' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.36538, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101697' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.073503, 'kg');
    END IF;
  END IF;

  -- BOM for FG069 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG069' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101740' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.2975, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101394' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.216182, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101603' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.149909, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101831' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.336409, 'kg');
    END IF;
  END IF;

  -- BOM for FG070 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG070' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101697' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.190455, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101394' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.180182, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101525' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.129591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101346' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.499773, 'kg');
    END IF;
  END IF;

  -- BOM for FG071 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG071' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100128' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.345045, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100030' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.268136, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101760' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.228409, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.158409, 'kg');
    END IF;
  END IF;

  -- BOM for FG072 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG072' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101394' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.118864, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101375' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.486636, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.145091, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100128' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.249409, 'kg');
    END IF;
  END IF;

  -- BOM for FG073 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG073' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101793' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.09805, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101584' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.246829, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100010' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.30665, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101394' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.34847, 'kg');
    END IF;
  END IF;

  -- BOM for FG074 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG074' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.462566, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100085' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.331697, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101394' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.10996, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100147' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.095777, 'kg');
    END IF;
  END IF;

  -- BOM for FG075 (CREAM)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG075' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101831' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.26717, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100030' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.341621, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101740' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.242989, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101737' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.148221, 'kg');
    END IF;
  END IF;

  -- BOM for FG076 (Talc)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG076' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100986' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.116931, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101823' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.544327, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100016' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.286687, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101203' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.052055, 'kg');
    END IF;
  END IF;

  -- BOM for FG077 (Talc)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG077' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101083' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.149667, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101275' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.222567, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100086' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.627766, 'kg');
    END IF;
  END IF;

  -- BOM for FG078 (Talc)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG078' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101016' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.105804, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101488' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.080369, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101163' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.331907, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101841' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.206549, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101285' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.27537, 'kg');
    END IF;
  END IF;

  -- BOM for FG079 (Talc)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG079' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101017' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.657171, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101697' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.221681, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101363' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.121148, 'kg');
    END IF;
  END IF;

  -- BOM for FG080 (Talc)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG080' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101739' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.387067, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100030' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.051994, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101489' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.560939, 'kg');
    END IF;
  END IF;

  -- BOM for FG081 (Talc)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG081' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100128' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.372577, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101515' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'STARCH_GUM', 0.47067, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101411' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.156753, 'kg');
    END IF;
  END IF;

  -- BOM for FG082 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG082' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101399' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.222506, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100044' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.345999, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100105' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.431494, 'kg');
    END IF;
  END IF;

  -- BOM for FG083 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG083' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100078' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.120171, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100503' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.735777, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101534' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.144052, 'kg');
    END IF;
  END IF;

  -- BOM for FG084 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG084' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100120' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.177788, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100162' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.704118, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101017' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.118094, 'kg');
    END IF;
  END IF;

  -- BOM for FG085 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG085' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100031' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.606539, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101593' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.133391, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100109' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.26007, 'kg');
    END IF;
  END IF;

  -- BOM for FG086 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG086' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100071' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.05999, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100028' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.275583, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100046' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.07051, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100132' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.181189, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101839' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.412728, 'kg');
    END IF;
  END IF;

  -- BOM for FG087 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG087' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100100' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.62756, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101859' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.059566, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100080' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.05743, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101534' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.255444, 'kg');
    END IF;
  END IF;

  -- BOM for FG088 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG088' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100039' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.377362, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101505' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.054025, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100132' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.320226, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101566' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.248388, 'kg');
    END IF;
  END IF;

  -- BOM for FG089 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG089' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101583' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.228396, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100127' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.060742, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100713' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.156492, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100090' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.55437, 'kg');
    END IF;
  END IF;

  -- BOM for FG090 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG090' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100713' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.202663, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100473' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.478003, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101807' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.319334, 'kg');
    END IF;
  END IF;

  -- BOM for FG091 (Home Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG091' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101283' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.075591, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101786' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.21245, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100078' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACID_BASE', 0.166838, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101807' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.038605, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101085' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'COLORANT', 0.506517, 'kg');
    END IF;
  END IF;

  -- BOM for FG092 (Baby Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG092' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101839' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.02797, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101377' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.701351, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101819' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.089294, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101862' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.181386, 'kg');
    END IF;
  END IF;

  -- BOM for FG093 (Baby Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG093' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100093' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.64478, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101283' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.099606, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101398' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.035475, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101653' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.070575, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101814' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.149564, 'kg');
    END IF;
  END IF;

  -- BOM for FG094 (Baby Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG094' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101821' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.03647, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101402' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.17246, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100118' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.093229, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101800' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.625258, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101378' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.072583, 'kg');
    END IF;
  END IF;

  -- BOM for FG095 (Baby Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG095' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100152' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.319122, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101838' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.430572, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101443' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.133537, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100120' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.116769, 'kg');
    END IF;
  END IF;

  -- BOM for FG096 (Baby Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG096' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101735' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.419859, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101831' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.094167, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101275' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.128293, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100130' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.212229, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100071' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.145453, 'kg');
    END IF;
  END IF;

  -- BOM for FG097 (Baby Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG097' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101378' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.00182, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101028' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.078379, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101377' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.192558, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100038' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.324766, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101373' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.402476, 'kg');
    END IF;
  END IF;

  -- BOM for FG098 (Baby Care)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG098' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101830' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.34782, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101283' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.150084, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101840' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.495954, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100140' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.006142, 'kg');
    END IF;
  END IF;

  -- BOM for FG099 (Combo)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG099' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101738' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.018816, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100043' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.101975, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100066' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.18611, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101836' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.693099, 'kg');
    END IF;
  END IF;

  -- BOM for FG100 (Combo)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG100' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101833' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.023215, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101264' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.133266, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100071' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.843519, 'kg');
    END IF;
  END IF;

  -- BOM for FG101 (Combo)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG101' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101814' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.429418, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101378' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.313935, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101390' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.016177, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101416' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.157223, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101814' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.083247, 'kg');
    END IF;
  END IF;

  -- BOM for FG102 (Combo)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG102' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101583' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'FRAGRANCE_COOLANT', 0.091271, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101697' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.471403, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101797' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.061431, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100460' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.375894, 'kg');
    END IF;
  END IF;

  -- BOM for FG103 (Combo)
  SELECT id INTO v_parent_id FROM materials WHERE material_code = 'FG103' LIMIT 1;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO bom_headers (parent_material_id, version, status)
    VALUES (v_parent_id, 'v1', 'active') RETURNING id INTO v_bom_id;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101735' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'SURFACTANT', 0.542976, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM101701' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'ACTIVE', 0.29266, 'kg');
    END IF;
    SELECT id INTO v_comp_id FROM materials WHERE material_code = 'RM100403' LIMIT 1;
    IF v_comp_id IS NOT NULL THEN
      INSERT INTO bom_components (bom_header_id, component_material_id, component_type, qty_per_parent, uom)
      VALUES (v_bom_id, v_comp_id, 'OIL_WAX', 0.164364, 'kg');
    END IF;
  END IF;

END $$;