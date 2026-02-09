# UUID Migration Fix Summary

## Problem
After fixing the entity table name mismatch, compilation failed with:
```
error: incompatible types: UUID cannot be converted to Long
```

## Root Cause
The entity was updated to use `UUID`, but the domain model and DTOs were still using `Long`.

## Files Fixed

### 1. `BaseEntity.java` (core-domain)
- Changed `private Long id` → `private UUID id`
- Updated getter/setter to use `UUID`
- Added `import java.util.UUID`

### 2. `WarehouseDto.java` (core-api)
- Changed `WarehouseDto(Long id, ...)` → `WarehouseDto(UUID id, ...)`
- Added `import java.util.UUID`

### 3. `WarehouseEntity.java` (infra) - Already fixed
- Uses `UUID` with proper generation strategy
- Table name fixed to `warehouses` (plural)

## Verification

All files now consistently use `UUID`:
- ✅ `WarehouseEntity` → `UUID id`
- ✅ `BaseEntity` → `UUID id`
- ✅ `WarehouseDto` → `UUID id`
- ✅ `WarehouseService` → Maps `UUID` correctly

## Next Steps

1. **Build the project**:
   ```bash
   cd backend
   ./gradlew clean build -x test
   ```

2. **Run the application**:
   ```bash
   ./gradlew :core-api:bootRun
   ```

3. **Expected output**:
   ```
   Started OptiWmsApplication in X.XXX seconds
   Tomcat started on port(s): 8080 (http)
   ```

4. **Test the API**:
   ```bash
   curl -u admin:admin123 http://localhost:8080/api/master/warehouses
   ```

## If Still Having Issues

1. **Check database tables exist**:
   ```bash
   docker exec -it optiwms-db psql -U optiwms -d optiwms -c "\dt"
   ```

2. **Check Flyway migrations**:
   ```bash
   docker exec -it optiwms-db psql -U optiwms -d optiwms -c "SELECT * FROM flyway_schema_history;"
   ```

3. **Reset if needed** (WARNING: Drops all data):
   ```bash
   docker exec -it optiwms-db psql -U optiwms -d optiwms -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```
   Then restart the application to re-run migrations.

