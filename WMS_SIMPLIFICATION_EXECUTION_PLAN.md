# WMS Simplification - Detailed Execution Plan

## Current State Analysis

✅ **Good News**:
- `location_levels` table exists with weight capacity, pallet capacity, current weight
- Coordinates (x, y, z) already in locations table
- Zone type filtering already partially implemented
- Storage-only filtering method exists in LocationService

❌ **Issues to Fix**:
- Location codes are inconsistent (FG-WH-001, RM-RFW-08, etc.)
- 2D map might be showing non-storage locations
- Need to link inventory to location_levels for weight tracking
- Need to standardize location code format

---

## Execution Steps

### STEP 1: Update LocationService - Storage-Only Filtering ✅

**File**: `backend/core-app/src/main/java/com/optiwms/coreapp/master/LocationService.java`

**Current**: Method `findStorageLocationsByWarehouse` exists but checks both `locationType` and `zoneType`

**Action**: Simplify to use ONLY `zoneType = 'STORAGE'`

```java
public List<Location> findStorageLocationsByWarehouse(UUID warehouseId) {
    return repository.findByWarehouseId(warehouseId).stream()
            .filter(entity -> "STORAGE".equals(entity.getZoneType()) && Boolean.TRUE.equals(entity.getIsActive()))
            .map(this::toDomain)
            .collect(Collectors.toList());
}
```

---

### STEP 2: Update Frontend - Use Storage-Only Endpoint

**File**: `frontend/lib/api/locations.ts`

**Action**: Ensure 2D map uses `getStorageLocationsByWarehouse` instead of `getByWarehouse`

**File**: `frontend/app/admin/warehouses/page.tsx` (or wherever 2D map is rendered)

**Action**: Update to use storage-only locations

---

### STEP 3: Location Code Standardization

**Option**: Create a migration to standardize existing codes OR add validation for new codes

**Format**: `{AREA}-{ROW}-{BAY}-{LEVEL}-{POSITION}`

**Examples**:
- `C-01-01-1-A` (Area C, Row 01, Bay 01, Level 1, Position A)
- `C-02-05-3-B` (Area C, Row 02, Bay 05, Level 3, Position B)

**Action**: 
1. Create validation function for location code format
2. Add validation in LocationService.create() and update()
3. Create migration script to standardize existing codes (optional, can be gradual)

---

### STEP 4: Create Rack Display Service

**New File**: `backend/core-app/src/main/java/com/optiwms/coreapp/master/RackDisplayService.java`

**Purpose**: Aggregate location + location_levels + inventory data for 2D map display

**Returns**:
```java
public record RackDisplay(
    String locationCode,
    String area,
    String row,
    String bay,
    Integer level,
    String position,
    BigDecimal coordinateX,
    BigDecimal coordinateY,
    BigDecimal coordinateZ,
    RackCapacity capacity,
    RackCurrent current,
    List<ProductInfo> products,
    String status, // empty, partial, full, overloaded
    String colorCode // green, yellow, orange, red
) {}

public record RackCapacity(
    BigDecimal maxWeightKg,
    Integer maxPallets,
    BigDecimal heightCm
) {}

public record RackCurrent(
    BigDecimal currentWeightKg,
    Integer currentPallets,
    BigDecimal occupancyPercent
) {}

public record ProductInfo(
    String materialId,
    String materialCode,
    String description,
    Integer quantity
) {}
```

---

### STEP 5: Create Rack Display API Endpoint

**File**: `backend/core-api/src/main/java/com/optiwms/coreapi/master/LocationController.java`

**New Endpoint**:
```java
@GetMapping("/warehouse/{warehouseId}/racks")
public ResponseEntity<List<RackDisplayDto>> getRacksForMap(@PathVariable UUID warehouseId) {
    var racks = rackDisplayService.getRacksForWarehouse(warehouseId);
    return ResponseEntity.ok(racks.stream().map(this::toRackDto).toList());
}
```

---

### STEP 6: Update Inventory Service - Weight Tracking

**File**: `backend/core-app/src/main/java/com/optiwms/coreapp/inventory/InventoryService.java`

**Action**: When inventory is created/updated, calculate and update location_levels.current_weight_kg

**Logic**:
```java
// When inventory added/updated at location
1. Get material weight from materials table
2. Calculate: totalWeight = quantity * unit_weight
3. Find location_levels for this location_code and level_number
4. Update current_weight_kg = SUM(all inventory weights at this level)
5. Update current_pallet_count = COUNT(pallets at this level)
```

---

### STEP 7: Frontend - 2D Map Updates

**Files**:
- `frontend/app/admin/warehouses/page.tsx`
- `frontend/lib/utils/location-to-layout.ts`
- `frontend/components/WarehouseMap.tsx` (if exists)

**Changes**:
1. Fetch racks using new `/racks` endpoint
2. Filter by `zoneType = 'STORAGE'` (already done by endpoint)
3. Display color coding based on occupancy:
   - Green: < 50%
   - Yellow: 50-80%
   - Orange: 80-95%
   - Red: > 95%
4. Show products per rack
5. Show weight/capacity information

---

### STEP 8: Remove Material Type Categorization from Storage

**Action**: Don't use `locationType` values like `storage_rm`, `storage_fg`, `storage_pm`

**Keep**: Only `locationType = 'storage'` and `zoneType = 'STORAGE'`

**Reason**: Material type is handled by inventory and product catalog, not location

---

### STEP 9: Staging Area Coordinates

**Action**: Ensure staging areas (RECEIVING, PACKING, SHIPMENT zones) have coordinates

**Purpose**: For future path finding algorithms

**Query**: 
```sql
UPDATE locations 
SET coordinate_x = <value>, coordinate_y = <value>
WHERE zone_type IN ('RECEIVING', 'PACKING', 'SHIPMENT')
AND (coordinate_x IS NULL OR coordinate_y IS NULL);
```

---

### STEP 10: Location Code Validation

**New File**: `backend/core-app/src/main/java/com/optiwms/coreapp/master/LocationCodeValidator.java`

**Validation Pattern**: `^[A-Z]{1,2}-\\d{2}-\\d{2}-\\d{1}-[A-Z]{1}$`

**Examples**:
- ✅ `C-01-01-1-A` (valid)
- ✅ `CM-01-01-1-A` (valid - 2 letter area code)
- ❌ `FG-WH-001-14-...` (invalid - too complex)
- ❌ `RM-RFW-08-00...` (invalid - too complex)

---

## Implementation Order

### Phase 1: Quick Wins (Do First)
1. ✅ Update LocationService to filter by `zoneType = 'STORAGE'` only
2. ✅ Update frontend to use storage-only endpoint
3. ✅ Test 2D map shows only storage locations

### Phase 2: Core Functionality
4. ✅ Create RackDisplayService
5. ✅ Create rack display API endpoint
6. ✅ Update frontend 2D map to use new endpoint
7. ✅ Add color coding based on occupancy

### Phase 3: Data Enhancement
8. ✅ Add weight tracking to inventory service
9. ✅ Link inventory updates to location_levels
10. ✅ Calculate occupancy percentages

### Phase 4: Standardization
11. ✅ Add location code validation
12. ✅ Create migration to standardize existing codes (optional)
13. ✅ Update location creation/update to enforce format

### Phase 5: Future Features
14. ⏳ Path finding with coordinates
15. ⏳ ABC/FMS classification support
16. ⏳ Optimal storage suggestions

---

## Database Queries for Verification

### Check current location codes
```sql
SELECT DISTINCT 
    SUBSTRING(location_code FROM 1 FOR 3) as prefix,
    COUNT(*) as count
FROM locations
GROUP BY prefix
ORDER BY count DESC;
```

### Check zone types distribution
```sql
SELECT 
    zone_type,
    COUNT(*) as count
FROM locations
GROUP BY zone_type
ORDER BY count DESC;
```

### Check locations without coordinates
```sql
SELECT COUNT(*) 
FROM locations
WHERE zone_type = 'STORAGE'
AND (coordinate_x IS NULL OR coordinate_y IS NULL);
```

### Check location_levels data
```sql
SELECT 
    COUNT(*) as total_levels,
    COUNT(CASE WHEN current_weight_kg > 0 THEN 1 END) as levels_with_weight,
    AVG(weight_capacity_kg) as avg_capacity
FROM location_levels;
```

---

## Testing Checklist

- [ ] 2D map shows only STORAGE locations
- [ ] Receiving/Packing/Shipping areas hidden from map
- [ ] Racks display with correct capacity data
- [ ] Color coding works (green/yellow/orange/red)
- [ ] Products shown per rack
- [ ] Weight tracking updates when inventory changes
- [ ] Location code validation works
- [ ] New locations follow standard format
- [ ] Putaway assigns to STORAGE locations only
- [ ] Picking shows product locations correctly

---

## Files to Create/Modify

### Backend - New Files
1. `backend/core-app/src/main/java/com/optiwms/coreapp/master/RackDisplayService.java`
2. `backend/core-app/src/main/java/com/optiwms/coreapp/master/LocationCodeValidator.java`

### Backend - Modify Files
1. `backend/core-app/src/main/java/com/optiwms/coreapp/master/LocationService.java`
2. `backend/core-app/src/main/java/com/optiwms/coreapp/inventory/InventoryService.java`
3. `backend/core-api/src/main/java/com/optiwms/coreapi/master/LocationController.java`

### Frontend - Modify Files
1. `frontend/lib/api/locations.ts`
2. `frontend/app/admin/warehouses/page.tsx`
3. `frontend/lib/utils/location-to-layout.ts`
4. `frontend/components/WarehouseMap.tsx` (if exists)

### Database - Migrations (Optional)
1. `backend/infra/src/main/resources/db/migration/V27__standardize_location_codes.sql`

---

## Success Metrics

✅ **Simplification**:
- Only STORAGE locations in 2D map
- Simple location code format
- No material type categorization in locations

✅ **Functionality**:
- Racks show capacity and occupancy
- Color coding indicates fill level
- Products visible per rack
- Weight tracking accurate

✅ **Generalization**:
- Works for any warehouse type
- No hardcoded material types
- Flexible for future enhancements

---

## Next Action

**Start with Phase 1** - Quick wins to immediately improve the system:
1. Update LocationService filtering
2. Update frontend to use storage-only
3. Test and verify

Then proceed with Phase 2-5 incrementally.
