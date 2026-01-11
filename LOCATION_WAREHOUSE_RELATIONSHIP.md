# Location-Warehouse Relationship in Database

## Overview

**Yes, locations belong to different warehouses!** Each location is associated with exactly one warehouse through a foreign key relationship.

## Database Structure

### Table: `locations`

The `locations` table stores all warehouse locations with a direct link to warehouses:

```sql
CREATE TABLE locations (
    id UUID PRIMARY KEY,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    location_code VARCHAR(50) UNIQUE NOT NULL,  -- e.g., "C-01-01-1-A"
    area VARCHAR(10) NOT NULL,                   -- e.g., "C"
    row_number VARCHAR(10) NOT NULL,             -- e.g., "01"
    bay_number VARCHAR(10) NOT NULL,             -- e.g., "01"
    level_number INTEGER NOT NULL,               -- e.g., 1
    bin_position VARCHAR(10) NOT NULL,          -- e.g., "A"
    location_type VARCHAR(50) DEFAULT 'storage',
    is_active BOOLEAN DEFAULT TRUE,
    -- ... other fields
);
```

### Key Points:

1. **`warehouse_id`** (UUID) - Foreign key to `warehouses` table
   - **Required** (NOT NULL)
   - Each location MUST belong to a warehouse
   - If warehouse is deleted, locations are cascaded (ON DELETE CASCADE)

2. **`location_code`** (VARCHAR) - Unique identifier like "C-01-01-1-A"
   - **Unique across ALL warehouses** (UNIQUE constraint)
   - Format: `{AREA}-{ROW}-{BAY}-{LEVEL}-{POSITION}`
   - Example: "C-01-01-1-A" means:
     - Area: C (could represent warehouse or zone)
     - Row: 01
     - Bay: 01
     - Level: 1
     - Position: A

3. **Indexes** for performance:
   ```sql
   CREATE INDEX idx_location_code ON locations(location_code);
   CREATE INDEX idx_warehouse_location ON locations(warehouse_id, area, row_number, bay_number);
   CREATE INDEX idx_location_warehouse ON locations(warehouse_id);
   ```

## How to Query Locations by Warehouse

### SQL Queries

**1. Get all locations for a specific warehouse:**
```sql
SELECT * FROM locations 
WHERE warehouse_id = '7262019d-9bf4-4824-997c-d7b5c9158ef3'
AND is_active = TRUE;
```

**2. Check which warehouse a location belongs to:**
```sql
SELECT l.location_code, l.warehouse_id, w.name as warehouse_name
FROM locations l
JOIN warehouses w ON l.warehouse_id = w.id
WHERE l.location_code = 'C-01-01-1-A';
```

**3. Find locations that DON'T belong to a warehouse (data quality check):**
```sql
SELECT location_code, warehouse_id
FROM locations
WHERE warehouse_id != '7262019d-9bf4-4824-997c-d7b5c9158ef3'
AND location_code LIKE 'C-%';  -- Locations starting with 'C' but in different warehouse
```

**4. Count locations per warehouse:**
```sql
SELECT w.name, COUNT(l.id) as location_count
FROM warehouses w
LEFT JOIN locations l ON w.id = l.warehouse_id
GROUP BY w.id, w.name
ORDER BY location_count DESC;
```

### Java/Spring Code

**1. In LocationService:**
```java
// Get locations by warehouse
List<Location> locations = locationService.findByWarehouse(warehouseId);

// Get location by code (returns location with warehouse_id)
Location location = locationService.findByLocationCode("C-01-01-1-A");
UUID locationWarehouseId = location.getWarehouseId();
```

**2. In LocationRepository:**
```java
@Repository
public interface LocationRepository extends JpaRepository<LocationEntity, UUID> {
    List<LocationEntity> findByWarehouseId(UUID warehouseId);
    Optional<LocationEntity> findByLocationCode(String locationCode);
    List<LocationEntity> findByWarehouseIdAndIsActive(UUID warehouseId, Boolean isActive);
}
```

## The Error You're Seeing

**Error:** `Location does not belong to warehouse: 7262019d-9bf4-4824-997c-d7b5c9158ef3`

**What it means:**
- Location "C-01-01-1-A" exists in the database
- BUT it belongs to a **different warehouse** than the one the worker is assigned to
- The validation happens in `MaterialLocationAssignmentService.java` line 57-58:

```java
if (!location.getWarehouseId().equals(warehouseId)) {
    throw new RuntimeException("Location does not belong to warehouse: " + warehouseId);
}
```

## How to Fix the Issue

### Option 1: Check Location's Warehouse (Recommended)

**Query the database to see which warehouse the location belongs to:**
```sql
SELECT 
    l.location_code,
    l.warehouse_id,
    w.name as warehouse_name,
    w.code as warehouse_code
FROM locations l
JOIN warehouses w ON l.warehouse_id = w.id
WHERE l.location_code = 'C-01-01-1-A';
```

**Then either:**
- Use a location that belongs to the correct warehouse
- OR update the location to belong to the correct warehouse (if it's a data issue)

### Option 2: Update Location's Warehouse (If Data is Wrong)

**If the location should belong to a different warehouse:**
```sql
UPDATE locations
SET warehouse_id = '7262019d-9bf4-4824-997c-d7b5c9158ef3'
WHERE location_code = 'C-01-01-1-A';
```

⚠️ **Warning:** Only do this if you're sure the location should be moved to a different warehouse!

### Option 3: Check Worker's Warehouse Assignment

**Verify the worker is assigned to the correct warehouse:**
```sql
SELECT u.id, u.username, u.warehouse_id, w.name as warehouse_name
FROM users u
LEFT JOIN warehouses w ON u.warehouse_id = w.id
WHERE u.username = 'worker_username';
```

## Entity Structure

### LocationEntity (Database Layer)
```java
@Entity
@Table(name = "locations")
public class LocationEntity {
    @Column(name = "warehouse_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID warehouseId;  // ← Links to warehouses table
}
```

### Location (Domain Layer)
```java
public class Location {
    private UUID warehouseId;  // ← Foreign key to warehouse
    private String locationCode; // ← Unique code like "C-01-01-1-A"
}
```

## Best Practices

1. **Always validate location belongs to warehouse** before putaway/picking operations
2. **Use warehouse-scoped queries** when fetching locations for workers
3. **Location codes are globally unique** but locations belong to specific warehouses
4. **Check `is_active` flag** to ensure location is available

## Example: Finding Available Locations for a Worker

```java
// In PutawayService or similar
UUID workerWarehouseId = worker.getWarehouseId();

// Get only locations for this worker's warehouse
List<Location> availableLocations = locationService
    .findAvailableByWarehouse(workerWarehouseId);

// Filter by location type if needed
List<Location> storageLocations = availableLocations.stream()
    .filter(loc -> "storage".equals(loc.getLocationType()))
    .collect(Collectors.toList());
```

## Summary

- ✅ **Locations DO belong to different warehouses**
- ✅ **Stored in `locations.warehouse_id` column** (UUID foreign key)
- ✅ **Each location belongs to exactly ONE warehouse**
- ✅ **Location codes are globally unique** but locations are warehouse-scoped
- ✅ **Validation ensures** workers can only use locations from their assigned warehouse
