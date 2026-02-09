# Materials Not Loading - Troubleshooting Guide 🔍

## ❌ Problem
Materials page shows "No materials found" even though database has 317 materials (seeded via Flyway migrations).

## ✅ This is REAL DATA, NOT MOCK DATA
- Data is stored in PostgreSQL database
- Seeded via Flyway migration `V16__seed_materials_from_csv.sql`
- Backend logs show: "Current materials in database: 317"

---

## 🔍 Debugging Steps

### Step 1: Check Browser Console
Open browser DevTools (F12) → Console tab and look for:

```
[useMaterials] Fetching materials from API...
[useMaterials] Received materials: X items
[MaterialsPage] State: { isLoading, hasData, dataLength, error, filteredLength }
```

**What to look for:**
- ✅ If you see `Received materials: 317 items` → Data is loading, check filtering
- ❌ If you see `Received materials: 0 items` → API returning empty array
- ❌ If you see error messages → Authentication or API issue

### Step 2: Check Network Tab
Open browser DevTools → Network tab → Filter by "materials"

**Look for:**
- Request URL: `http://localhost:8080/api/master/materials`
- Request Method: `GET`
- Status Code:
  - ✅ `200 OK` → API working, check response body
  - ❌ `401 Unauthorized` → Authentication issue
  - ❌ `403 Forbidden` → Permission issue
  - ❌ `500 Internal Server Error` → Backend error

**Check Response Body:**
- If status is 200, click on the request → Response tab
- Should see JSON array with materials
- If empty array `[]` → Backend not returning data

### Step 3: Test API Directly
Open a new terminal and run:

```bash
# Get your JWT token (from browser localStorage or login)
TOKEN="your_jwt_token_here"

# Test API endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/master/materials
```

**Expected Response:**
```json
[
  {
    "id": "uuid-here",
    "materialCode": "100036",
    "description": "CAUSTIC SODA",
    "unitType": "Bags",
    "storageType": "pallet",
    "materialType": "raw_material"
  },
  ...
]
```

**If you get:**
- `[]` (empty array) → Backend issue
- `401 Unauthorized` → Token expired, login again
- `403 Forbidden` → Permission issue
- Connection refused → Backend not running

### Step 4: Check Backend Logs
Look at backend console output for:

```
Current materials in database: 317
Materials already exist in database (317 materials). Skipping CSV load.
```

**If you see errors:**
- Check database connection
- Check if Flyway migrations ran successfully
- Check if materials table has data

### Step 5: Verify Database
Connect to PostgreSQL and check:

```sql
-- Count materials
SELECT COUNT(*) FROM materials;

-- Should return: 317

-- Check sample data
SELECT material_code, description, material_type 
FROM materials 
LIMIT 5;

-- Should show materials like:
-- 100036 | CAUSTIC SODA | raw_material
```

---

## 🐛 Common Issues & Fixes

### Issue 1: Empty Array from API
**Symptoms:** Network tab shows `200 OK` but response is `[]`

**Possible Causes:**
1. **Repository not finding data** - Check if `MaterialRepository.findAll()` returns empty
2. **Security filter blocking** - Check Spring Security config
3. **Wrong database** - Check if backend is connected to correct database

**Fix:**
```java
// In MaterialService.java, add logging:
public List<Material> listAll() {
    List<MaterialEntity> entities = repository.findAll();
    System.out.println("Found " + entities.size() + " materials in repository");
    return entities.stream()
        .map(this::toDomain)
        .collect(Collectors.toList());
}
```

### Issue 2: Authentication Error (401)
**Symptoms:** Network tab shows `401 Unauthorized`

**Fix:**
1. Logout and login again
2. Check if token is expired
3. Check if token is in localStorage: `localStorage.getItem('accessToken')`

### Issue 3: Permission Error (403)
**Symptoms:** Network tab shows `403 Forbidden`

**Fix:**
1. Check if user has `admin` role
2. Check Spring Security configuration
3. Verify JWT token contains correct roles

### Issue 4: React Query Caching Empty Result
**Symptoms:** Console shows data loaded but page shows empty

**Fix:**
1. Clear React Query cache:
   ```javascript
   // In browser console:
   localStorage.clear();
   sessionStorage.clear();
   // Then refresh page
   ```

2. Or manually refetch:
   - Click "Retry" button if error shown
   - Or refresh page (F5)

### Issue 5: Filtering Hiding All Data
**Symptoms:** Console shows `Received materials: 317` but table is empty

**Fix:**
1. Check `typeFilter` - set to "All Materials"
2. Clear search query
3. Check `filteredMaterials` in console

---

## 🔧 Quick Fixes

### Fix 1: Force Refetch
In browser console:
```javascript
// Clear React Query cache
window.location.reload();
```

### Fix 2: Check API Directly
```bash
# Login first to get token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# Use token from response
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/master/materials
```

### Fix 3: Verify Backend is Running
```bash
# Check if backend is running
curl http://localhost:8080/actuator/health

# Should return: {"status":"UP"}
```

### Fix 4: Check Database Connection
In backend logs, look for:
```
HikariPool-1 - Starting...
HikariPool-1 - Start completed.
```

If you see connection errors, check:
- Docker is running: `docker ps`
- Database is up: `docker-compose -f infra/docker-compose.yml ps`

---

## 📊 Expected Behavior

### ✅ Working Correctly:
1. Browser console shows: `[useMaterials] Received materials: 317 items`
2. Network tab shows: `200 OK` with JSON array of 317 materials
3. Materials table shows all 317 materials
4. Summary cards show correct counts

### ❌ Not Working:
1. Browser console shows: `Received materials: 0 items` or error
2. Network tab shows: `401`, `403`, `500`, or empty array
3. Materials table shows: "No materials found"
4. Summary cards show: "0" for all counts

---

## 🎯 Next Steps

1. **Check browser console** - Look for debug messages I added
2. **Check network tab** - Verify API call and response
3. **Test API directly** - Use curl to test endpoint
4. **Check backend logs** - Look for errors or data counts
5. **Verify database** - Confirm materials exist in database

**Share the console/network output and I can help fix it!** 🚀

---

## 📝 Debug Logging Added

I've added comprehensive debug logging to:
- `frontend/lib/hooks/useQuery.ts` - Logs API calls and responses
- `frontend/app/admin/materials/page.tsx` - Logs component state

**Check browser console for these messages:**
- `[useMaterials] Fetching materials from API...`
- `[useMaterials] Received materials: X items`
- `[MaterialsPage] State: {...}`
