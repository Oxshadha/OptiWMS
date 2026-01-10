# Rack System & Storage Area Requirements

## Executive Summary

Based on the Pallet Project PDF and Training Report, this document outlines the complete requirements for implementing a comprehensive rack management system that supports:
- Multi-level rack storage with weight capacity per level
- Storage area management (Reception, Shipping, Main Storage, Picking, Putaway)
- Location coordinates for optimal path finding
- Pallet capacity tracking
- Future AI integration for optimal storage suggestions
- Normal operations without AI dependency

---

## Current Issues Identified

### 1. API Endpoint Mismatch (404 Errors)
- **Problem**: Frontend calls `/api/master/locations/*` but backend is at `/api/locations/*`
- **Impact**: All location/rack API calls fail with 404
- **Fix Required**: Update frontend API client or add backend route mapping

### 2. Rack System Not Connected to Backend
- **Problem**: Rack edit modal tries to call non-existent endpoints
- **Impact**: Cannot edit rack status, description, or notes
- **Fix Required**: Implement rack update endpoints in backend

### 3. Products vs Inventory vs Raw Materials Confusion
- **Current State**:
  - `materials` table stores all materials (RM, PM, FG)
  - `inventory` table stores stock quantities for materials
  - No separate "products" table - products are materials with `material_type='FG'`
  - Raw materials are materials with `material_type='RM'`
- **Issue**: Frontend shows "Products" as empty while "Inventory" and "Raw Materials" are filled
- **Fix Required**: Clarify data model and update frontend to use correct material types

---

## Storage Areas Required

Based on warehouse operations flow:

### 1. **Reception Area**
- **Purpose**: Products/materials received from suppliers
- **Location Type**: `reception`
- **Operations**: Receiving, inspection, temporary storage
- **Characteristics**: 
  - High accessibility (ground level preferred)
  - Temporary storage (short dwell time)
  - No racking system (floor storage or staging areas)

### 2. **Shipping Area**
- **Purpose**: Products ready for dispatch
- **Location Type**: `shipping`
- **Operations**: Picking consolidation, packing, staging for dispatch
- **Characteristics**:
  - High accessibility
  - Temporary storage
  - Staging areas for outbound orders

### 3. **Main Storage Area**
- **Purpose**: Long-term storage
- **Location Type**: `storage`
- **Sub-Areas**:
  - **Raw Materials Storage**: `storage_rm` (for RM materials)
  - **Packing Materials Storage**: `storage_pm` (for PM materials)
  - **Finished Goods Storage**: `storage_fg` (for FG materials)
- **Operations**: Putaway, storage, picking
- **Characteristics**:
  - Racking system with multiple levels
  - Weight capacity per level
  - Accessibility ratings
  - Pallet capacity tracking

### 4. **Picking Area** (Optional but Recommended)
- **Purpose**: Fast-moving items for quick picking
- **Location Type**: `picking`
- **Operations**: High-velocity picking
- **Characteristics**:
  - Highest accessibility
  - Ground level or low levels
  - Smaller quantities, frequent replenishment

### 5. **Putaway Area** (Optional but Recommended)
- **Purpose**: Staging area before putaway to main storage
- **Location Type**: `putaway`
- **Operations**: Temporary storage before final putaway
- **Characteristics**:
  - Medium accessibility
  - Short-term storage

### 6. **Quarantine Area**
- **Purpose**: Damaged/defective items
- **Location Type**: `quarantine`
- **Operations**: Quality control, returns processing

---

## Rack System Requirements

### 1. Rack Structure
Each rack represents a **Bay** in the location hierarchy:
- **Zone** (Area): e.g., "ST" (Storage), "PK" (Picking), "RC" (Reception)
- **Aisle** (Row): e.g., "01", "02"
- **Bay**: e.g., "001", "002"
- **Levels**: Multiple vertical levels (typically 1-5)
- **Bins**: Each level can have multiple bin positions (A, B, C)

### 2. Rack Properties (Per Rack)
- **Rack ID**: Unique identifier (e.g., "ST-01-004")
- **Status**: `active`, `maintenance`, `reserved`, `out_of_service`
- **Description**: What's typically stored
- **Notes**: Special instructions
- **Zone**: Storage area identifier
- **Aisle**: Row number
- **Bay**: Bay number
- **Max Levels**: Maximum number of vertical levels
- **Total Pallet Capacity**: Total pallets the rack can hold
- **Accessibility Rating**: 1-10 (1 = least accessible, 10 = most accessible)
- **Coordinates**: X, Y position for path finding (optional for now)

### 3. Level Properties (Per Level)
- **Level Number**: 1, 2, 3, 4, 5 (from bottom to top)
- **Weight Capacity**: Maximum weight in kg
- **Pallet Capacity**: Number of pallets per level
- **Height**: Level height in cm
- **Accessibility**: Level-specific accessibility (lower levels = more accessible)
- **Current Weight**: Current weight stored
- **Current Pallets**: Current pallets stored

### 4. Bin Properties (Per Bin)
- **Bin Position**: A, B, C (left to right)
- **Status**: `available`, `occupied`, `reserved`
- **Material ID**: What's stored (if occupied)
- **Quantity**: Quantity stored
- **Weight**: Weight of stored items
- **Last Updated**: When last updated

---

## Database Schema Changes Required

### 1. Extend `locations` Table
```sql
-- Add rack-specific fields
ALTER TABLE locations ADD COLUMN IF NOT EXISTS rack_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS accessibility_rating INTEGER CHECK (accessibility_rating BETWEEN 1 AND 10);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS coordinate_x DECIMAL(10,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS coordinate_y DECIMAL(10,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS max_pallet_capacity INTEGER;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS current_pallet_count INTEGER DEFAULT 0;

-- Add level-specific capacity (stored as JSON or separate table)
-- Option 1: JSON column
ALTER TABLE locations ADD COLUMN IF NOT EXISTS level_capacities JSONB;
-- Example: {"1": {"weight_kg": 1000, "pallet_count": 2}, "2": {"weight_kg": 800, "pallet_count": 2}, ...}

-- Option 2: Separate table (recommended for better querying)
CREATE TABLE IF NOT EXISTS location_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    level_number INTEGER NOT NULL CHECK (level_number BETWEEN 1 AND 10),
    weight_capacity_kg DECIMAL(10,2) NOT NULL,
    pallet_capacity INTEGER NOT NULL,
    height_cm DECIMAL(10,2),
    accessibility_rating INTEGER CHECK (accessibility_rating BETWEEN 1 AND 10),
    current_weight_kg DECIMAL(10,2) DEFAULT 0,
    current_pallet_count INTEGER DEFAULT 0,
    UNIQUE(location_id, level_number)
);
```

### 2. Update `location_type` Values
Ensure location types support all storage areas:
- `reception` - Reception area
- `shipping` - Shipping area
- `storage` - Main storage (default)
- `storage_rm` - Raw materials storage
- `storage_pm` - Packing materials storage
- `storage_fg` - Finished goods storage
- `picking` - Picking area
- `putaway` - Putaway staging area
- `quarantine` - Quarantine area

### 3. Material Type Clarification
The `materials` table already has `material_type` field:
- `RM` - Raw Materials
- `PM` - Packing Materials
- `FG` - Finished Goods (Products)

**Frontend should filter by `material_type` to show:**
- Products = materials where `material_type = 'FG'`
- Raw Materials = materials where `material_type = 'RM'`
- Packing Materials = materials where `material_type = 'PM'`

---

## Backend API Requirements

### 1. Fix Location Controller Route
**Current**: `/api/locations/*`
**Frontend Expects**: `/api/master/locations/*`

**Solution Options**:
- Option A: Update frontend to use `/api/locations/*`
- Option B: Add route mapping in backend to support both
- Option C: Move LocationController to `/api/master/locations/*` (recommended for consistency)

### 2. Rack Management Endpoints
```java
// Get rack details (aggregated from locations by bay)
GET /api/master/locations/racks/{rackId}
GET /api/master/locations/racks/warehouse/{warehouseId}

// Update rack properties
PUT /api/master/locations/racks/{rackId}
Body: {
  status: "active" | "maintenance" | "reserved" | "out_of_service",
  description: string,
  notes: string,
  accessibilityRating: number
}

// Get rack levels
GET /api/master/locations/racks/{rackId}/levels

// Update level capacity
PUT /api/master/locations/racks/{rackId}/levels/{levelNumber}
Body: {
  weightCapacityKg: number,
  palletCapacity: number,
  heightCm: number,
  accessibilityRating: number
}
```

### 3. Storage Area Endpoints
```java
// Get locations by storage area
GET /api/master/locations/warehouse/{warehouseId}?area={areaType}
// areaType: reception, shipping, storage, storage_rm, storage_pm, storage_fg, picking, putaway, quarantine

// Get hierarchy by storage area
GET /api/master/locations/hierarchy?warehouseId={id}&area={areaType}
```

---

## Frontend Requirements

### 1. Fix API Client
Update `frontend/lib/api/locations.ts`:
- Change all `/master/locations` to `/locations` OR
- Backend should support both routes

### 2. Rack Edit Modal
- Connect to backend API
- Support updating: status, description, notes
- Show level capacities
- Allow editing level capacities (if user has permission)

### 3. Storage Area Filtering
- Add filter dropdown in warehouse layout page
- Filter by: Reception, Shipping, Main Storage, Raw Materials, Finished Goods, Picking, Putaway
- Show appropriate racks for each area

### 4. Products vs Inventory Display
- **Products Page**: Show materials where `material_type = 'FG'`
- **Raw Materials Page**: Show materials where `material_type = 'RM'`
- **Inventory Page**: Show all inventory items (regardless of material type)
- **Storage Sections**: Filter by storage area type

---

## Future AI Integration Points

### 1. Optimal Storage Suggestion Service
When receiving materials/products:
- Input: Material ID, Weight, Quantity, Demand Pattern
- AI Service: Genetic Algorithm Microservice
- Output: Suggested storage location (rack + level + bin)
- Factors:
  - Weight capacity per level
  - Accessibility rating
  - Demand frequency (fast-moving = high accessibility)
  - Material type (RM vs FG storage areas)
  - Current occupancy

### 2. Optimal Path Finding
For picking/putaway operations:
- Input: Start location, Target locations
- AI Service: Path optimization algorithm
- Output: Optimal route
- Uses: Location coordinates (X, Y)

### 3. Fallback to Normal Operations
- If AI service unavailable: Use rule-based logic
- Rules:
  - First available location in appropriate storage area
  - Check weight capacity
  - Check pallet capacity
  - Prefer lower levels (more accessible)
  - Prefer locations with similar materials (zone picking)

---

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. ✅ Fix API endpoint mismatch (404 errors)
2. ✅ Connect rack edit modal to backend
3. ✅ Clarify products vs inventory vs raw materials
4. ✅ Add storage area types to database

### Phase 2: Core Rack System (Week 1-2)
1. Add rack properties to database
2. Implement rack management endpoints
3. Update frontend to display rack properties
4. Add level capacity management

### Phase 3: Storage Areas (Week 2-3)
1. Create storage areas in database
2. Update location creation to support areas
3. Add area filtering in frontend
4. Update putaway/picking to use correct areas

### Phase 4: Advanced Features (Week 3-4)
1. Add weight capacity per level
2. Add pallet capacity tracking
3. Add accessibility ratings
4. Add coordinates for path finding

### Phase 5: AI Integration (Future)
1. Design AI service interface
2. Implement fallback logic
3. Integrate AI suggestions
4. Test with and without AI service

---

## Database Migration Script

```sql
-- V9__add_rack_system_fields.sql

-- Add rack properties to locations
ALTER TABLE locations 
  ADD COLUMN IF NOT EXISTS rack_status VARCHAR(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS accessibility_rating INTEGER CHECK (accessibility_rating BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS coordinate_x DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS coordinate_y DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS max_pallet_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS current_pallet_count INTEGER DEFAULT 0;

-- Create location_levels table
CREATE TABLE IF NOT EXISTS location_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    level_number INTEGER NOT NULL CHECK (level_number BETWEEN 1 AND 10),
    weight_capacity_kg DECIMAL(10,2) NOT NULL,
    pallet_capacity INTEGER NOT NULL,
    height_cm DECIMAL(10,2),
    accessibility_rating INTEGER CHECK (accessibility_rating BETWEEN 1 AND 10),
    current_weight_kg DECIMAL(10,2) DEFAULT 0,
    current_pallet_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(location_id, level_number)
);

CREATE INDEX idx_location_levels_location ON location_levels(location_id);
CREATE INDEX idx_location_levels_level ON location_levels(level_number);

-- Update location_type constraint to include new types
-- Note: PostgreSQL doesn't support ALTER COLUMN to change CHECK constraint easily
-- May need to drop and recreate constraint

-- Add comments
COMMENT ON COLUMN locations.rack_status IS 'Rack status: active, maintenance, reserved, out_of_service';
COMMENT ON COLUMN locations.accessibility_rating IS 'Accessibility rating 1-10 (1=least, 10=most accessible)';
COMMENT ON COLUMN locations.coordinate_x IS 'X coordinate for path finding';
COMMENT ON COLUMN locations.coordinate_y IS 'Y coordinate for path finding';
COMMENT ON COLUMN locations.max_pallet_capacity IS 'Maximum pallets this rack can hold';
COMMENT ON COLUMN locations.current_pallet_count IS 'Current pallets stored in this rack';
```

---

## Next Steps

1. **Review this document** with team
2. **Prioritize implementation** based on business needs
3. **Create database migration** for Phase 1
4. **Update backend API** to fix 404 errors
5. **Update frontend** to connect rack system
6. **Test end-to-end** rack management flow
7. **Plan AI integration** architecture

---

## References

- Pallet Project PDF: Pallet reverse logistics, inventory models, racking systems
- Training Report PDF: Warehouse operations, inventory optimization, racking systems
- Current Codebase: LocationController, LocationEntity, RackEditModal, WarehouseLayout

