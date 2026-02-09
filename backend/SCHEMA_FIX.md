# Schema Validation Fix

## Problem
Hibernate was failing with: `Schema-validation: missing table [warehouse]`

## Root Cause
1. **Table name mismatch**: Entity used `warehouse` (singular) but migration creates `warehouses` (plural)
2. **ID type mismatch**: Entity used `Long` but migration uses `UUID`
3. **Missing fields**: Entity was incomplete compared to migration schema

## Fix Applied
Updated `WarehouseEntity.java` to match the migration:
- Changed `@Table(name = "warehouse")` → `@Table(name = "warehouses")`
- Changed `Long id` → `UUID id` with proper generation
- Added all missing fields: `address`, `city`, `country`, `contactPerson`, `phone`, `email`, `createdAt`, `updatedAt`
- Added `@PrePersist` and `@PreUpdate` hooks for timestamps

## Next Steps

### 1. Ensure Database is Running
```bash
cd /Users/k.e.oshada/Documents/OptiWMS
docker-compose -f infra/docker-compose.yml up -d db
```

### 2. Reset Flyway if Needed
If Flyway thinks migrations ran but tables don't exist:
```bash
# Connect to database
docker exec -it optiwms-db psql -U optiwms -d optiwms

# Check Flyway schema history
SELECT * FROM flyway_schema_history;

# If needed, clean and re-run
# (WARNING: This will drop all tables)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

### 3. Run Application
```bash
cd backend
./gradlew :core-api:bootRun
```

### 4. Verify Tables Exist
```bash
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "\dt"
```

You should see tables like:
- `warehouses`
- `materials`
- `locations`
- etc.

## Expected Success Output
```
Started OptiWmsApplication in X.XXX seconds
Tomcat started on port(s): 8080 (http)
```

## If Still Failing

1. **Check database connection**: Verify `localhost:5434` is accessible
2. **Check Flyway migrations**: Ensure `V1__initial_schema.sql` and `V2__seed_initial_data.sql` exist
3. **Check application logs**: Look for Flyway migration messages
4. **Verify entity package scan**: Ensure `@EntityScan(basePackages = "com.optiwms.infra")` is correct

