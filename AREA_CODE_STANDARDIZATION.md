# Area Code Standardization

## Issue

**Problem**: Inconsistent area codes in storage locations
- One rack uses area code **"A"** (e.g., `A-01-01`)
- Other racks use area code **"ST"** (e.g., `ST-09-003`)

**Impact**: Rack names are inconsistent in the 2D map visualization

## Solution

### Standardization Rule

For **STORAGE locations** (zone_type = 'STORAGE'):
- Convert **"ST"** → **"C"** (Storage area uses single letter "C")
- Keep **"A"**, **"B"**, **"D"** as-is (already single letters)

**Result**: All storage racks will use consistent single-letter area codes:
- `C-01-01`, `C-09-003` (instead of `ST-09-003`)
- `A-01-01` (kept as-is)

### Implementation

#### 1. Frontend Normalization (Already Done) ✅

**File**: `frontend/lib/utils/location-to-layout.ts`

**Change**: Added normalization in `groupLocationsByRack()`:
```typescript
// Normalize area code: Convert "ST" to "C" for consistency
let area = location.area || 'C';
if (area === 'ST') {
  area = 'C'; // Standardize ST (Storage) to C for consistency
}
```

**Result**: Frontend now displays all storage racks with consistent area codes.

#### 2. Database Standardization (Optional)

**File**: `backend/scripts/standardize_area_codes.sql`

**Action**: Run this SQL script to permanently standardize area codes in the database:

```sql
-- Convert "ST" to "C" for storage locations
UPDATE locations
SET area = 'C'
WHERE area = 'ST' 
  AND zone_type = 'STORAGE'
  AND is_active = TRUE;

-- Also update location_code to match
UPDATE locations
SET location_code = REPLACE(location_code, 'ST-', 'C-')
WHERE location_code LIKE 'ST-%'
  AND zone_type = 'STORAGE'
  AND is_active = TRUE;
```

**When to run**: 
- If you want to permanently fix the database
- If you want location_code and area field to match exactly

**Note**: Frontend normalization works without database changes, but database standardization ensures consistency across the entire system.

---

## Area Code Standards

### Storage Locations (zone_type = 'STORAGE')
- **Single letter**: A, B, C, D, etc.
- **"C"** is the standard for main storage area
- **"A"**, **"B"**, **"D"** can be used for different storage zones

### Operational Areas (not shown in 2D map)
- **"ST"** - Staging (hidden from map)
- **"RC"** - Receiving (hidden from map)
- **"PK"** - Picking (hidden from map)
- **"PA"** - Putaway (hidden from map)
- **"SH"** - Shipping (hidden from map)

---

## Current State

### Before
- Racks: `A-01-01`, `ST-09-003`, `ST-09-004`
- Inconsistent area codes

### After (Frontend Normalization)
- Racks: `A-01-01`, `C-09-003`, `C-09-004`
- Consistent single-letter area codes

### After (Database Standardization)
- Database: All storage locations have `area = 'C'` (or A, B, D)
- Location codes: `C-09-003` (instead of `ST-09-003`)
- Complete consistency

---

## Testing

1. **Check current area codes**:
```sql
SELECT area, COUNT(*) 
FROM locations 
WHERE zone_type = 'STORAGE'
GROUP BY area;
```

2. **Verify frontend display**:
   - Open warehouse 2D map
   - Check that all racks use single-letter area codes (A, C, etc.)
   - No "ST-" prefixes should appear

3. **After database update**:
   - Verify area codes are standardized
   - Verify location_code matches area field

---

## Recommendation

**Option 1: Frontend Only (Current)**
- ✅ Works immediately
- ✅ No database changes needed
- ✅ Displays consistently

**Option 2: Database Standardization (Recommended for long-term)**
- ✅ Permanent fix
- ✅ Consistent across entire system
- ✅ Location_code matches area field
- ⚠️ Requires running SQL script

**Recommendation**: Use frontend normalization for now, then run database standardization script when convenient.
