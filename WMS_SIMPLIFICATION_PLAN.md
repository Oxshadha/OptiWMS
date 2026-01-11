# WMS System Simplification & Centralization Plan

## Executive Summary

**Goal**: Simplify and centralize the WMS system to be clean, generalized, and focused on core operations (receiving, putaway, picking, shipping) with a simple 2D map showing only storage racks.

**Key Principles**:
1. **Simple Location Codes**: `C-01-01-1-A` or `CM-01-01-1-A` format
2. **Storage-Only in 2D Map**: Only show STORAGE locations, hide receiving/packing/shipping
3. **No Material Type Categorization**: Let inventory and product catalog handle raw/finished goods
4. **Rack-Centric View**: Show racks with weight, capacity, occupancy
5. **Future-Ready**: Support ABC/FMS classifications and optimal storage suggestions
6. **Path Finding Ready**: Coordinates for staging areas and bin locations

---

## Phase 1: Location Code Standardization

### 1.1 Standardize Location Code Format

**Current Problem**: Mixed formats like `FG-WH-001-14-...`, `RM-RFW-08-00...`, `PA-WH-002-03-...`

**Solution**: Use simple format: `{AREA}-{ROW}-{BAY}-{LEVEL}-{POSITION}`

**Format Options**:
- **Option A**: `C-01-01-1-A` (Area = C, Row = 01, Bay = 01, Level = 1, Position = A)
- **Option B**: `CM-01-01-1-A` (CM = Colombo Main, Row = 01, Bay = 01, Level = 1, Position = A)

**Recommendation**: Use Option A for simplicity. Warehouse association is already handled by `warehouse_id`.

**Implementation**:
- Create migration to standardize existing location codes
- Add validation to ensure new locations follow format
- Update location code generation logic

### 1.2 Location Code Structure

```
Format: {AREA}-{ROW}-{BAY}-{LEVEL}-{POSITION}

Examples:
- C-01-01-1-A  (Area C, Row 01, Bay 01, Level 1, Position A)
- C-01-01-2-B  (Area C, Row 01, Bay 01, Level 2, Position B)
- C-02-05-3-C  (Area C, Row 02, Bay 05, Level 3, Position C)

Area: Single letter (A, B, C, D, etc.) - represents warehouse zone/area
Row: Two digits (01-99) - represents aisle/row
Bay: Two digits (01-99) - represents bay/rack
Level: Single digit (1-9) - represents vertical level
Position: Single letter (A-Z) - represents bin position on level
```

---

## Phase 2: Zone Type Simplification

### 2.1 Current State

**Problem**: Too many zone types and location types causing confusion:
- `zoneType`: STORAGE, STAGING, RECEIVING, SHIPMENT, PACKING
- `locationType`: storage, storage_rm, storage_fg, storage_pm, picking, putaway, quarantine

### 2.2 Simplified Approach

**For 2D Map Display**:
- **ONLY show**: `zoneType = 'STORAGE'` locations
- **Hide**: RECEIVING, SHIPMENT, PACKING, STAGING (these are operational areas, not storage)

**For Operations**:
- Keep all zone types in database (needed for operations)
- But filter by `zoneType = 'STORAGE'` for 2D map visualization
- Don't categorize storage by material type (storage_rm, storage_fg, storage_pm)
- Let inventory and product catalog handle material categorization

### 2.3 Database Changes

**Keep existing structure** but add clear separation:

```sql
-- Storage locations (shown in 2D map)
WHERE zone_type = 'STORAGE' AND is_active = TRUE

-- Operational areas (hidden from 2D map, used for operations)
WHERE zone_type IN ('RECEIVING', 'SHIPMENT', 'PACKING', 'STAGING')
```

**No changes needed to schema** - just use filtering logic.

---

## Phase 3: Rack System Enhancement

### 3.1 Current Rack Fields (Already Exist)

✅ Already in database:
- `coordinate_x`, `coordinate_y`, `coordinate_z` - for path finding
- `max_pallet_capacity` - pallet capacity
- `current_pallet_count` - current pallets
- `accessibility_rating` - for path optimization
- `rack_status` - active/inactive
- `capacity` - general capacity

### 3.2 Missing Fields for Full Requirements

**Need to add** (if not already in location_levels table):
- `weight_capacity` - max weight per level/rack (kg)
- `current_weight` - current weight stored (kg)
- `height_cm` - height of level/rack (cm)

**Check**: The image shows a `location_levels` table with these fields. Need to verify if we're using it or if we need to add to `locations` table.

### 3.3 Rack Data Structure

**For 2D Map Display**, each rack should show:
```typescript
interface RackDisplay {
  locationCode: string;           // "C-01-01-1-A"
  area: string;                    // "C"
  row: string;                     // "01"
  bay: string;                     // "01"
  coordinates: {
    x: number;                     // For path finding
    y: number;                     // For path finding
    z?: number;                    // Optional height
  };
  capacity: {
    maxWeight: number;             // kg
    maxPallets: number;
    height: number;                // cm
  };
  current: {
    weight: number;                 // kg
    pallets: number;
    occupancyPercent: number;      // Calculated: (current/max) * 100
  };
  products: Array<{
    materialId: string;
    materialCode: string;
    quantity: number;
  }>;
  status: 'empty' | 'partial' | 'full' | 'overloaded';
  color: string;                    // For visualization (green/yellow/red)
}
```

---

## Phase 4: 2D Map Visualization

### 4.1 Map Display Rules

**Show Only**:
- `zoneType = 'STORAGE'`
- `isActive = TRUE`
- Grouped by Area → Row → Bay

**Display Information**:
- Rack location code
- Current products (from inventory)
- Occupancy (weight/pallets)
- Color coding:
  - 🟢 Green: Empty or < 50% full
  - 🟡 Yellow: 50-80% full
  - 🟠 Orange: 80-95% full
  - 🔴 Red: > 95% full or overloaded

### 4.2 Data Flow

```
1. Fetch STORAGE locations for warehouse
   ↓
2. Fetch inventory for those locations
   ↓
3. Calculate occupancy (weight, pallets)
   ↓
4. Map products to racks
   ↓
5. Generate color codes
   ↓
6. Render 2D map
```

---

## Phase 5: Inventory-Location Integration

### 5.1 Current State

✅ Already working:
- `inventory.location_code` links to `locations.location_code`
- `MaterialLocationAssignmentService` assigns materials to locations
- Inventory tracks quantity per location

### 5.2 Enhancement Needed

**Add weight tracking**:
- When inventory is added, calculate total weight
- Update `current_weight` on location/rack
- Use material weight from product catalog

**Formula**:
```java
currentWeight = SUM(inventory.quantity * material.unit_weight)
```

---

## Phase 6: Path Finding Preparation

### 6.1 Coordinate System

**Already have**:
- `coordinate_x`, `coordinate_y`, `coordinate_z` in locations table

**Need to ensure**:
- All STORAGE locations have coordinates
- Staging areas (RECEIVING, PACKING, SHIPMENT) have coordinates
- Coordinates are in consistent units (meters or centimeters)

### 6.2 Staging Area Coordinates

**For path finding**, we need coordinates for:
- Receiving staging area
- Packing staging area
- Shipping staging area

**These are operational areas** (not shown in 2D map) but needed for path calculation.

---

## Phase 7: ABC/FMS Classification Support (Future)

### 7.1 Data Requirements

**For ABC/FMS classification**, we need:
- Product velocity (picks per period)
- Product value
- Product weight/volume
- Current storage location
- Rack characteristics (accessibility, capacity)

**Current state**: Most data exists, just need to aggregate and classify.

### 7.2 Storage Suggestion Algorithm (Future)

```
1. Classify products by ABC/FMS
2. Match product characteristics to rack characteristics
3. Suggest optimal locations based on:
   - Velocity (fast movers → high accessibility)
   - Weight (heavy items → ground level)
   - Value (high value → secure areas)
   - Compatibility (similar products together)
```

---

## Phase 8: Core Operations Simplification

### 8.1 Receiving → Putaway Flow

**Current**: ✅ Working
**Enhancement**: Ensure location validation uses STORAGE locations only

### 8.2 Picking Flow

**Current**: ✅ Working
**Enhancement**: 
- Show product locations on 2D map
- Optimize pick path using coordinates
- Group picks by area/row

### 8.3 Shipping Flow

**Current**: ✅ Working
**Enhancement**: Use staging area coordinates for consolidation

---

## Implementation Plan

### Step 1: Location Code Standardization
- [ ] Create migration to standardize location codes
- [ ] Add validation for location code format
- [ ] Update location creation/update logic

### Step 2: Zone Type Filtering
- [ ] Update LocationService to filter STORAGE only for map
- [ ] Update frontend to only fetch STORAGE locations
- [ ] Keep all zone types for operations

### Step 3: Rack Data Enhancement
- [ ] Verify/add weight capacity fields
- [ ] Add weight calculation on inventory updates
- [ ] Update rack status based on occupancy

### Step 4: 2D Map Updates
- [ ] Update map to show only STORAGE locations
- [ ] Add occupancy color coding
- [ ] Show products per rack
- [ ] Add weight/capacity display

### Step 5: Coordinate System
- [ ] Ensure all locations have coordinates
- [ ] Add staging area coordinates
- [ ] Validate coordinate consistency

### Step 6: Testing & Validation
- [ ] Test receiving → putaway flow
- [ ] Test picking with location display
- [ ] Test 2D map rendering
- [ ] Validate location code format

---

## Database Schema Changes

### Minimal Changes Needed

**Option 1: Use existing `locations` table** (Recommended)
- Add `weight_capacity` if missing
- Add `current_weight` if missing
- Ensure coordinates are populated

**Option 2: Use `location_levels` table** (If exists)
- Link locations to location_levels
- Use location_levels for weight/capacity data

**Decision needed**: Check if `location_levels` table exists and is being used.

---

## API Changes

### New/Updated Endpoints

1. **GET /api/master/locations/storage-only** ✅ Already exists
   - Returns only STORAGE locations
   - Used for 2D map

2. **GET /api/master/locations/{warehouseId}/racks**
   - Returns racks with occupancy data
   - Includes products, weight, capacity

3. **GET /api/master/locations/{warehouseId}/map-data**
   - Returns formatted data for 2D map
   - Includes color codes, occupancy

---

## Frontend Changes

### 2D Map Component Updates

1. **Filter locations**: Only STORAGE zone type
2. **Color coding**: Based on occupancy
3. **Product display**: Show materials per rack
4. **Capacity display**: Show weight/pallet capacity
5. **Real-time updates**: Sync with inventory changes

---

## Migration Strategy

### Phase 1: Non-Breaking Changes
1. Add new fields (nullable)
2. Populate coordinates
3. Standardize location codes (gradual)

### Phase 2: Filtering Logic
1. Update services to filter STORAGE
2. Update frontend to use filtered data
3. Keep all data in database

### Phase 3: Enhancement
1. Add weight tracking
2. Add occupancy calculations
3. Add color coding

---

## Success Criteria

✅ **Location codes**: Simple format `C-01-01-1-A`
✅ **2D Map**: Shows only STORAGE locations
✅ **Rack display**: Shows products, weight, capacity, occupancy
✅ **Color coding**: Visual indication of rack fill level
✅ **Operations**: Receiving, putaway, picking, shipping work seamlessly
✅ **Generalized**: Works for any warehouse type (raw materials, finished goods, etc.)
✅ **Future-ready**: Supports ABC/FMS classifications

---

## Next Steps

1. **Review this plan** and confirm approach
2. **Check location_levels table** - does it exist? Should we use it?
3. **Start with Phase 1**: Location code standardization
4. **Then Phase 2**: Zone type filtering
5. **Then Phase 3**: Rack enhancements
6. **Then Phase 4**: 2D map updates

---

## Questions to Resolve

1. **Location code format**: `C-01-01-1-A` or `CM-01-01-1-A`?
2. **Location levels table**: Does it exist? Should we use it for weight/capacity?
3. **Weight tracking**: Should we add to `locations` table or use `location_levels`?
4. **Staging areas**: Do we need to create specific staging locations, or use existing RECEIVING/PACKING zones?
