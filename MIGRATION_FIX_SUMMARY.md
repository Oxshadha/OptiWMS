# Migration V26 Fix Summary

## Issue
Migration was failing with duplicate key violation:
```
ERROR: duplicate key value violates unique constraint "locations_location_code_key"
Detail: Key (location_code)=(C-01-00-1-C) already exists.
```

## Root Cause
When normalizing location codes, multiple different location codes were being normalized to the same value (e.g., `C-01-00-1-C`), causing duplicate key violations when trying to UPDATE.

## Solution Implemented

### 1. Fixed Bay Number Normalization
- **Before**: Taking first 2 digits from 3-digit bay numbers (e.g., "001" -> "00")
- **After**: Taking last 2 digits (e.g., "001" -> "01", "012" -> "12", "123" -> "23")
- **Function**: Using `RIGHT(parts[5], 2)` instead of `SUBSTRING`

### 2. Improved Duplicate Handling
- **Check before update**: Verify normalized code doesn't exist before updating
- **Temp code approach**: Use temporary unique code during update to avoid constraint violations
- **Merge duplicates**: If duplicates are found, merge references and delete duplicate location

### 3. Migration Logic
1. For each location:
   - Normalize location code
   - Check if normalized code already exists
   - If duplicate: Update references → Delete duplicate location
   - If no duplicate: Update to temp code → Update to normalized code

## Testing
After running migration:
1. All locations should be in C-02-05-3-B format
2. No duplicate location codes
3. All references (material_default_locations, inventory) updated correctly

## Next Steps
1. Run migration: `./gradlew :core-api:bootRun`
2. Verify locations are normalized
3. Test receiving and putaway workflows
