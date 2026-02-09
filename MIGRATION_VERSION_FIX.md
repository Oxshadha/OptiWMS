# 🔧 Migration Version Conflict - FIXED

## ❌ Problem

Backend failed to start with error:
```
Found more than one migration with version 12
Offenders:
-> V12__add_material_dimensions_and_location_z.sql (NEW - created by us)
-> V12__update_level_number_constraint.sql (EXISTING)
```

**Root Cause**: Two migration files with the same version number (V12)

---

## ✅ Solution

**Renamed migration file:**
- **Old**: `V12__add_material_dimensions_and_location_z.sql`
- **New**: `V14__add_material_dimensions_and_location_z.sql`

**Why V14?**
- V12: `V12__update_level_number_constraint.sql` (existing)
- V13: `V13__add_user_preferences.sql` (existing)
- V14: `V14__add_material_dimensions_and_location_z.sql` (our new one) ✅

---

## ✅ Verification

**Build Status**: ✅ SUCCESS
```bash
./gradlew clean build -x test
# BUILD SUCCESSFUL
```

**File Verified**:
```bash
ls -la backend/infra/src/main/resources/db/migration/V14*.sql
# V14__add_material_dimensions_and_location_z.sql ✅
```

---

## 🚀 Next Steps

1. **Restart Backend** (should start successfully now):
   ```bash
   cd backend
   ./gradlew :core-api:bootRun
   ```

2. **Verify Migration Applied**:
   - Check backend logs for: `Migrating schema to version 14`
   - Or check database: `SELECT * FROM flyway_schema_history ORDER BY installed_rank;`

3. **Test Import API**:
   ```bash
   # Login first
   curl -X POST http://localhost:8080/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "admin123"}'
   
   # Import data
   curl -X POST http://localhost:8080/api/integration/data-import/import-all \
     -H "Authorization: Bearer <YOUR_TOKEN>"
   ```

---

## 📋 Migration Order (Current)

```
V1  → Initial schema
V2  → Seed initial data
V3  → Add delivery partners
V4  → Finalized schema with AI support
V5  → Dock management tables
V6  → Reports tables
V7  → Worker achievements
V8  → Convert quantities to integer
V9  → Notifications table
V10 → Create default admin user
V11 → Add rack system fields
V12 → Update level number constraint
V13 → Add user preferences
V14 → Add material dimensions and location Z ✅ NEW
```

---

**Status**: ✅ **FIXED - Ready to Start Backend**
