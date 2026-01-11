-- Migration: Standardize location format to C-02-05-3-B
-- Industry standard: AREA-ROW-BAY-LEVEL-POS (no warehouse code needed)
-- LPN removed for MVP - not needed for basic functionality

-- ============================================
-- Standardize Location Format
-- Convert existing locations to C-02-05-3-B format
-- ============================================

-- Function to normalize location codes to standard format
CREATE OR REPLACE FUNCTION normalize_location_code(input_code VARCHAR(50))
RETURNS VARCHAR(50) AS $$
DECLARE
    parts TEXT[];
    area VARCHAR(10);
    row_num VARCHAR(10);
    bay_num VARCHAR(10);
    level_num VARCHAR(10);
    position VARCHAR(10);
    normalized VARCHAR(50);
BEGIN
    -- Remove whitespace and convert to uppercase
    input_code := UPPER(TRIM(input_code));
    
    -- Split by hyphen
    parts := string_to_array(input_code, '-');
    
    -- Handle different formats
    IF array_length(parts, 1) = 7 AND parts[1] = 'ST' AND parts[2] = 'WH' THEN
        -- Format: ST-WH-001-01-001-1-A
        -- Extract: area=ST (convert to single letter), row=01, bay=001, level=1, position=A
        area := 'C'; -- Default to C for storage
        row_num := LPAD(parts[4], 2, '0'); -- Ensure 2 digits
        -- For bay: if 3 digits, take last 2 (e.g., 001 -> 01, 012 -> 12, 123 -> 23)
        IF LENGTH(parts[5]) = 3 THEN
            bay_num := RIGHT(parts[5], 2); -- Take last 2 digits
        ELSE
            bay_num := LPAD(parts[5], 2, '0'); -- Pad to 2 digits
        END IF;
        level_num := parts[6];
        position := parts[7];
        normalized := area || '-' || row_num || '-' || bay_num || '-' || level_num || '-' || position;
    ELSIF array_length(parts, 1) = 5 THEN
        -- Format: A-01-01-1-A or C-02-05-3-B
        area := parts[1];
        row_num := LPAD(parts[2], 2, '0');
        -- Handle bay: if 3 digits, take last 2; if 2 digits, use as-is; if 1 digit, pad
        IF LENGTH(parts[3]) = 3 THEN
            bay_num := RIGHT(parts[3], 2); -- Take last 2 digits
        ELSE
            bay_num := LPAD(parts[3], 2, '0'); -- Pad to 2 digits
        END IF;
        level_num := parts[4];
        position := parts[5];
        normalized := area || '-' || row_num || '-' || bay_num || '-' || level_num || '-' || position;
    ELSE
        -- Return as-is if can't parse (will need manual fix)
        RETURN input_code;
    END IF;
    
    RETURN normalized;
END;
$$ LANGUAGE plpgsql;

-- Temporarily disable foreign key constraints for location_code updates
-- This allows us to update location codes without violating FK constraints
ALTER TABLE material_default_locations DROP CONSTRAINT IF EXISTS material_default_locations_location_code_fkey;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_location_code_fkey;

-- Update existing locations to standard format
-- Handle duplicates by keeping the first one and updating references
DO $$
DECLARE
    loc_record RECORD;
    normalized_code VARCHAR(50);
    existing_id UUID;
BEGIN
    -- Process locations one by one to handle duplicates
    FOR loc_record IN 
        SELECT id, location_code 
        FROM locations 
        WHERE location_code IS NOT NULL
        ORDER BY id
    LOOP
        normalized_code := normalize_location_code(loc_record.location_code);
        
        -- Skip if already in standard format
        IF normalized_code = loc_record.location_code THEN
            CONTINUE;
        END IF;
        
        -- Check if normalized code already exists
        SELECT id INTO existing_id 
        FROM locations 
        WHERE location_code = normalized_code 
          AND id != loc_record.id
        LIMIT 1;
        
        IF existing_id IS NOT NULL THEN
            -- Duplicate would be created - merge approach:
            -- 1. Update all references to point to existing location
            -- 2. Delete the duplicate location
            
            -- Update material_default_locations
            UPDATE material_default_locations
            SET location_code = normalized_code
            WHERE location_code = loc_record.location_code;
            
            -- Update inventory
            UPDATE inventory
            SET location_code = normalized_code
            WHERE location_code = loc_record.location_code;
            
            -- Delete the duplicate location (keep the one that already has normalized code)
            DELETE FROM locations WHERE id = loc_record.id;
        ELSE
            -- Safe to update - no duplicate
            -- FK constraints are temporarily disabled, so we can update in any order
            -- Update location first, then update foreign key references
            
            -- Update the location code itself first
            UPDATE locations
            SET location_code = normalized_code
            WHERE id = loc_record.id;
            
            -- Then update all foreign key references to use normalized code
            UPDATE material_default_locations
            SET location_code = normalized_code
            WHERE location_code = loc_record.location_code;
            
            UPDATE inventory
            SET location_code = normalized_code
            WHERE location_code = loc_record.location_code;
        END IF;
    END LOOP;
END $$;

-- Clean up empty/invalid location codes before adding FK constraints
-- Set empty strings and invalid codes to NULL
UPDATE inventory 
SET location_code = NULL 
WHERE location_code = '' 
   OR location_code IS NULL
   OR location_code NOT IN (SELECT location_code FROM locations WHERE location_code IS NOT NULL);

UPDATE material_default_locations 
SET location_code = NULL 
WHERE location_code = '' 
   OR location_code IS NULL
   OR location_code NOT IN (SELECT location_code FROM locations WHERE location_code IS NOT NULL);

-- Re-add foreign key constraints after all updates are complete
-- Only add if constraint doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'material_default_locations_location_code_fkey'
    ) THEN
        ALTER TABLE material_default_locations 
        ADD CONSTRAINT material_default_locations_location_code_fkey 
        FOREIGN KEY (location_code) REFERENCES locations(location_code) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_location_code_fkey'
    ) THEN
        ALTER TABLE inventory 
        ADD CONSTRAINT inventory_location_code_fkey 
        FOREIGN KEY (location_code) REFERENCES locations(location_code) ON DELETE SET NULL;
    END IF;
END $$;

-- Update material_default_locations to use normalized codes (for any remaining)
UPDATE material_default_locations mdl
SET location_code = normalize_location_code(mdl.location_code)
WHERE mdl.location_code != normalize_location_code(mdl.location_code)
  AND EXISTS (
      SELECT 1 FROM locations loc 
      WHERE loc.location_code = normalize_location_code(mdl.location_code)
  );

-- Update inventory to use normalized codes (for any remaining)
-- Only update non-null location codes that can be normalized
UPDATE inventory inv
SET location_code = normalize_location_code(inv.location_code)
WHERE inv.location_code IS NOT NULL
  AND inv.location_code != ''
  AND inv.location_code != normalize_location_code(inv.location_code)
  AND EXISTS (
      SELECT 1 FROM locations loc 
      WHERE loc.location_code = normalize_location_code(inv.location_code)
  );

-- Add constraint to ensure location_code follows standard format
-- Format: AREA-ROW-BAY-LEVEL-POS where:
-- AREA: Single letter (A-Z)
-- ROW: 2 digits (01-99)
-- BAY: 2 digits (01-99)
-- LEVEL: 1-2 digits (1-10)
-- POS: Single letter (A-Z)
-- Only add constraint if all locations are in correct format
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- Check if any locations don't match the format
    SELECT COUNT(*) INTO invalid_count
    FROM locations
    WHERE location_code IS NOT NULL
      AND location_code !~ '^[A-Z]-[0-9]{2}-[0-9]{2}-[0-9]{1,2}-[A-Z]$';
    
    -- Only add constraint if all locations are valid
    IF invalid_count = 0 THEN
        ALTER TABLE locations 
        ADD CONSTRAINT chk_location_code_format 
        CHECK (location_code ~ '^[A-Z]-[0-9]{2}-[0-9]{2}-[0-9]{1,2}-[A-Z]$');
    ELSE
        -- Log warning but don't fail migration
        RAISE NOTICE 'Warning: % locations do not match standard format. Constraint not added. Please fix manually.', invalid_count;
    END IF;
END $$;

-- LPN functionality removed for MVP
