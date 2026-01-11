# 🔍 Why SKU Shows in Inventory But Not Fetching in Worker Receiving

## Problem Summary

**Symptom**: 
- SKU `100036` (CAUSTIC SODA) appears in Admin Inventory page ✅
- SKU `100036` appears in Admin Materials/Product Catalog page ✅
- But when worker types `100036` in receiving page, shows "Material lookup pending..." ❌
- Material lookup fails

---

## 🔍 Root Causes

### 1. **Backend Not Restarted** ⚠️ **MOST LIKELY**

**Problem**: 
- New API endpoint `/api/master/materials/code/{code}` was just added
- Backend needs to be **restarted** for the new endpoint to be available
- If backend wasn't restarted, the endpoint returns 404

**Solution**:
```bash
# Stop the backend
# Then restart it
cd backend
./mvnw spring-boot:run
# OR if using IDE, restart the Spring Boot application
```

**How to Verify**:
1. Open browser Developer Tools (F12)
2. Go to Network tab
3. Type SKU in receiving page
4. Look for: `GET /api/master/materials/code/100036`
5. Check response:
   - **404 Not Found** → Backend not restarted or endpoint missing
   - **200 OK** → Endpoint works, check response data

---

### 2. **Material Code Format Mismatch**

**Problem**:
- Material stored as `"100036"` (exact)
- But lookup might be case-sensitive or have whitespace
- Database might have: `" 100036"` or `"100036 "` (with spaces)

**Solution**: ✅ **FIXED**
- Backend now does case-insensitive lookup
- Trims whitespace automatically
- Tries exact match first, then case-insensitive

**Check Database**:
```sql
-- Check exact material code
SELECT id, material_code, description 
FROM materials 
WHERE material_code = '100036';

-- Check with trimming
SELECT id, material_code, description 
FROM materials 
WHERE TRIM(material_code) = '100036';

-- Check case-insensitive
SELECT id, material_code, description 
FROM materials 
WHERE LOWER(TRIM(material_code)) = LOWER('100036');
```

---

### 3. **URL Encoding Issue**

**Problem**:
- Material code might have special characters
- URL not properly encoded
- API call fails silently

**Solution**: ✅ **FIXED**
- Frontend now URL-encodes material code
- Handles special characters properly

---

### 4. **Network/CORS Issue**

**Problem**:
- API call blocked by CORS
- Network error not shown to user
- Request fails silently

**How to Check**:
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for CORS errors or network errors
4. Check Network tab for failed requests (red)

**Solution**:
- Check backend CORS configuration
- Verify API base URL is correct
- Check if backend is running

---

### 5. **Material Doesn't Actually Exist**

**Problem**:
- Inventory shows SKU from cached/old data
- But material was deleted from materials table
- Or material_code was changed

**How to Verify**:
1. Go to Admin → Materials (`/admin/materials`)
2. Search for `100036`
3. If **NOT FOUND** → Material doesn't exist
4. If **FOUND** → Material exists, check other issues

**Solution**:
- Create the material if it doesn't exist
- Or fix data inconsistency

---

## ✅ Step-by-Step Debugging

### Step 1: Check Backend is Running
```bash
# Check if backend is running
curl http://localhost:8080/actuator/health
# Should return: {"status":"UP"}
```

### Step 2: Test API Endpoint Directly
```bash
# Test the lookup endpoint
curl http://localhost:8080/api/master/materials/code/100036

# Expected response (if material exists):
# {
#   "id": "uuid-here",
#   "materialCode": "100036",
#   "description": "CAUSTIC SODA",
#   ...
# }

# If 404: Material doesn't exist OR endpoint not available
# If 200: Material exists, check frontend code
```

### Step 3: Check Browser Console
1. Open Worker Receiving page
2. Open Developer Tools (F12)
3. Go to Console tab
4. Type SKU `100036`
5. Look for:
   - `[Receiving] Looking up material code: 100036`
   - `[Receiving] Material found:` (success)
   - `[Receiving] Material lookup failed` (error)

### Step 4: Check Network Tab
1. Open Developer Tools (F12)
2. Go to Network tab
3. Type SKU in receiving page
4. Look for request: `GET /api/master/materials/code/100036`
5. Check:
   - **Status**: 200 (success) or 404 (not found)
   - **Response**: Material data or error message
   - **Request URL**: Should be properly encoded

### Step 5: Check Database
```sql
-- Verify material exists
SELECT id, material_code, description, material_type
FROM materials
WHERE material_code = '100036'
   OR LOWER(TRIM(material_code)) = LOWER('100036');

-- Check inventory references
SELECT i.id, i.material_id, m.material_code, m.description
FROM inventory i
LEFT JOIN materials m ON i.material_id = m.id
WHERE m.material_code = '100036';
```

---

## 🔧 Quick Fixes

### Fix 1: Restart Backend
```bash
# If using Maven
cd backend
./mvnw spring-boot:run

# If using IDE
# Stop and restart Spring Boot application
```

### Fix 2: Verify Material Exists
1. Go to `/admin/materials`
2. Search for `100036`
3. If not found, create it:
   - Click "Add Product"
   - Product Code: `100036`
   - Description: `CAUSTIC SODA`
   - Type: `Raw Material`
   - Save

### Fix 3: Clear Browser Cache
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or clear browser cache
3. Try again

### Fix 4: Check API Base URL
Verify in browser console:
```javascript
// Check API base URL
console.log(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');
```

---

## 🎯 Most Likely Solution

**90% of the time, the issue is:**

1. **Backend not restarted** after adding the new endpoint
   - **Fix**: Restart the Spring Boot backend application

2. **Material doesn't exist in materials table**
   - **Fix**: Create the material in Admin → Materials page

---

## 📋 Checklist

When SKU lookup fails, check:

- [ ] Backend is running (`curl http://localhost:8080/actuator/health`)
- [ ] Backend was restarted after code changes
- [ ] API endpoint works: `curl http://localhost:8080/api/master/materials/code/100036`
- [ ] Material exists in `/admin/materials` page
- [ ] Browser console shows no errors
- [ ] Network tab shows API call (not 404)
- [ ] Database has material with code `100036`
- [ ] URL encoding is correct (no special characters)

---

## 🆘 Still Not Working?

If after all checks it still doesn't work:

1. **Check backend logs** for errors:
   ```bash
   # Look for errors in backend console
   # Check for: "Material not found: 100036"
   # Or: "No handler found for GET /api/master/materials/code/..."
   ```

2. **Test with different SKU** to isolate the issue

3. **Check API response** in Network tab:
   - Copy the full response
   - Check if it's a 404, 500, or other error

4. **Verify database directly**:
   ```sql
   SELECT * FROM materials WHERE material_code LIKE '%100036%';
   ```

---

**Last Updated**: January 2026
