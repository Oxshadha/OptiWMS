# Realistic Storage Zones Guide

## Overview

This guide explains how to create realistic storage locations with proper ABC/FMS zones (A, B, C, D) based on the Training Report structure.

---

## Zone Structure

### Zone A: High Accessibility (Front/Ground)
- **Rows**: 1 row
- **Bays**: 5 bays per row
- **Levels**: 4 levels per bay
- **Bins**: 3 bins per level (A, B, C)
- **Accessibility**: 9-10 (highest)
- **Purpose**: ABC-A items (fast movers, high value)
- **Location Format**: `A-01-01-1-A`, `A-01-02-2-B`, etc.
- **Total Locations**: 60 locations (1 × 5 × 4 × 3)

### Zone B: Medium Accessibility (Middle)
- **Rows**: 2 rows
- **Bays**: 8 bays per row
- **Levels**: 5 levels per bay
- **Bins**: 3 bins per level
- **Accessibility**: 6-8 (medium)
- **Purpose**: ABC-B items (medium movers)
- **Location Format**: `B-01-01-1-A`, `B-02-08-5-C`, etc.
- **Total Locations**: 240 locations (2 × 8 × 5 × 3)

### Zone C: Main Storage (Most Locations)
- **Rows**: 10 rows
- **Bays**: 12 bays per row
- **Levels**: 5 levels per bay
- **Bins**: 3 bins per level
- **Accessibility**: 4-6 (medium-low)
- **Purpose**: ABC-C items and general storage
- **Location Format**: `C-01-01-1-A`, `C-10-12-5-C`, etc.
- **Total Locations**: 1,800 locations (10 × 12 × 5 × 3)

### Zone D: Low Accessibility (Back/Upper)
- **Rows**: 3 rows
- **Bays**: 10 bays per row
- **Levels**: 5 levels per bay
- **Bins**: 3 bins per level
- **Accessibility**: 1-3 (lowest)
- **Purpose**: Slow movers, bulk storage
- **Location Format**: `D-01-01-1-A`, `D-03-10-5-C`, etc.
- **Total Locations**: 450 locations (3 × 10 × 5 × 3)

**Total Storage Locations**: 2,550 locations

---

## Location Code Format

**Format**: `{AREA}-{ROW}-{BAY}-{LEVEL}-{POSITION}`

**Examples**:
- `A-01-01-1-A` (Zone A, Row 01, Bay 01, Level 1, Position A)
- `C-05-08-3-B` (Zone C, Row 05, Bay 08, Level 3, Position B)
- `D-02-07-4-C` (Zone D, Row 02, Bay 07, Level 4, Position C)

**Components**:
- **AREA**: Single letter (A, B, C, D) - Storage zone
- **ROW**: Two digits (01-99) - Aisle/row number
- **BAY**: Two digits (01-99) - Bay/rack number
- **LEVEL**: Single digit (1-5) - Vertical level
- **POSITION**: Single letter (A, B, C) - Bin position on level

---

## Accessibility Ratings

### Zone-Based Accessibility
- **Zone A**: 9-10 (highest accessibility - front/ground)
- **Zone B**: 6-8 (medium accessibility - middle)
- **Zone C**: 4-6 (medium-low accessibility - main storage)
- **Zone D**: 1-3 (lowest accessibility - back/upper)

### Level-Based Adjustment
- **Level 1** (ground): Full accessibility (100% of rack rating)
- **Level 2**: 90% of rack rating
- **Level 3**: 80% of rack rating
- **Level 4**: 70% of rack rating
- **Level 5** (top): 60% of rack rating

### Position-Based Adjustment
- **Front rows**: +30% accessibility boost
- **Front bays**: +20% accessibility boost

---

## Weight Capacity by Level

- **Level 1**: 2,000 kg (ground level - highest capacity)
- **Level 2**: 1,500 kg
- **Level 3**: 1,000 kg
- **Level 4**: 800 kg
- **Level 5**: 500 kg (top level - lowest capacity)

---

## ABC/FMS Zone Assignment

Based on Training Report and ABC/FMS classification:

### ABC-A Items (Fast Movers, High Value)
- **Recommended Zone**: Zone A
- **Accessibility**: 9-10
- **Preferred Level**: 1-2 (ground level)
- **Example Locations**: `A-01-01-1-A`, `A-01-02-1-B`

### ABC-B Items (Medium Movers)
- **Recommended Zone**: Zone B
- **Accessibility**: 6-8
- **Preferred Level**: 2-3 (middle levels)
- **Example Locations**: `B-01-01-2-A`, `B-02-05-3-B`

### ABC-C Items (Slow Movers, Low Value)
- **Recommended Zone**: Zone C or D
- **Accessibility**: 4-6 (Zone C) or 1-3 (Zone D)
- **Preferred Level**: 3-5 (upper levels)
- **Example Locations**: `C-05-08-4-A`, `D-02-07-5-C`

---

## How to Generate Locations

### Option 1: Via API Endpoint (Recommended)

**Endpoint**: `POST /api/integration/locations/generate/{warehouseId}`

**Example**:
```bash
curl -X POST http://localhost:8080/api/integration/locations/generate/7262019d-9bf4-4824-997c-d7b5c9158ef3 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Generated 2550 realistic storage locations with zones A, B, C, D",
  "locationCount": 2550
}
```

### Option 2: Via Database Migration

Run the migration:
```sql
-- V27 migration will standardize area codes and add indexes
-- Then use the API endpoint to generate locations
```

---

## Database Storage

### Locations Table
- `area`: Zone code (A, B, C, D)
- `location_code`: Full code (e.g., `C-01-01-1-A`)
- `zone_type`: `STORAGE` (for all zones A, B, C, D)
- `accessibility_rating`: 1-10 (based on zone and level)
- `coordinate_x`, `coordinate_y`, `coordinate_z`: For path finding

### Location Levels Table
- `location_id`: Links to location
- `level_number`: 1-5
- `weight_capacity_kg`: Based on level (500-2000 kg)
- `pallet_capacity`: 1 pallet per level
- `height_cm`: 150 cm per level
- `accessibility_rating`: Level-specific accessibility

---

## Verification

### Check Generated Zones
```sql
SELECT 
    area,
    COUNT(*) as location_count,
    MIN(accessibility_rating) as min_access,
    MAX(accessibility_rating) as max_access,
    AVG(accessibility_rating) as avg_access
FROM locations
WHERE zone_type = 'STORAGE'
  AND area IN ('A', 'B', 'C', 'D')
GROUP BY area
ORDER BY area;
```

### Check Location Codes
```sql
SELECT location_code, area, row_number, bay_number, level_number, bin_position
FROM locations
WHERE zone_type = 'STORAGE'
  AND area = 'C'
ORDER BY row_number, bay_number, level_number, bin_position
LIMIT 20;
```

---

## Benefits

1. **ABC/FMS Ready**: Zones structured for optimal storage assignment
2. **Generalized**: Works for any warehouse type (raw materials, finished goods, etc.)
3. **Realistic**: Based on industry standards and Training Report
4. **Scalable**: Easy to add more rows/bays to any zone
5. **Path Finding Ready**: Coordinates stored for optimal route calculation

---

## Next Steps

1. **Generate locations** using API endpoint
2. **Verify zones** in database
3. **Test 2D map** - should show zones A, B, C, D
4. **Assign materials** to zones based on ABC/FMS classification
5. **Use for optimal storage suggestions** in future AI features

---

## Summary

- **Zone A**: 60 locations (1 row, 5 bays) - High accessibility
- **Zone B**: 240 locations (2 rows, 8 bays) - Medium accessibility
- **Zone C**: 1,800 locations (10 rows, 12 bays) - Main storage (most locations)
- **Zone D**: 450 locations (3 rows, 10 bays) - Low accessibility

**Total**: 2,550 storage locations ready for ABC/FMS categorization
