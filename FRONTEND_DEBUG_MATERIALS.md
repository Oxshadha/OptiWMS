# Frontend Materials Debug Guide

## 🔍 Issue: Materials Not Showing in Frontend

**Status**: Database has 317 materials, but frontend shows empty table

---

## ✅ What I Added

### 1. **Enhanced Error Handling** ✅

**File**: `frontend/lib/hooks/useQuery.ts`

- Added `onError` callback to log errors
- Added `staleTime` for better caching
- Added `retry` for automatic retries

### 2. **Debug Logging** ✅

**File**: `frontend/app/admin/materials/page.tsx`

- Added `useEffect` to log:
  - Number of materials loaded
  - Loading state
  - Error details

---

## 🔍 How to Debug

### Step 1: Open Browser Console

1. Open `/admin/materials` page
2. Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
3. Go to "Console" tab

### Step 2: Check Logs

Look for:
- `[Materials] Loading materials...` - API call started
- `[Materials] Loaded X materials from API` - Success (should show 317)
- `[Materials] Error loading materials:` - Error occurred

### Step 3: Check Network Tab

1. Go to "Network" tab
2. Filter by "materials"
3. Check the request to `/api/master/materials`
4. Look at:
   - **Status Code**: Should be `200`
   - **Response**: Should contain array of materials
   - **Headers**: Check if `Authorization` header is present

---

## 🐛 Common Issues

### Issue 1: 401 Unauthorized

**Symptom**: Network request shows `401`

**Fix**: 
- Check if user is logged in
- Check if token is valid
- Try logging out and logging back in

### Issue 2: 403 Forbidden

**Symptom**: Network request shows `403`

**Fix**:
- Check user role (should be `admin` or `warehouse_manager`)
- Check backend security configuration

### Issue 3: Empty Array Returned

**Symptom**: API returns `200` but empty array `[]`

**Fix**:
- Check database: `SELECT COUNT(*) FROM materials;`
- Check if materials have correct `material_type`
- Check if filter is too restrictive

### Issue 4: CORS Error

**Symptom**: Console shows CORS error

**Fix**:
- Check `application.properties`: `frontend.url`
- Check backend CORS configuration

---

## 🔧 Quick Fixes

### Fix 1: Clear React Query Cache

```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Fix 2: Force Refetch

Click the refresh button on the materials page, or:
```javascript
// In browser console:
queryClient.invalidateQueries({ queryKey: ['materials'] });
```

### Fix 3: Check API Directly

```bash
# Get token first (login)
TOKEN="your_jwt_token"

# Test API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/master/materials
```

---

## ✅ Expected Behavior

### Console Logs:
```
[Materials] Loading materials...
[Materials] Loaded 317 materials from API
```

### Network Request:
- **URL**: `http://localhost:8080/api/master/materials`
- **Method**: `GET`
- **Status**: `200 OK`
- **Response**: Array of 317 materials

### Frontend Display:
- Summary cards show correct counts
- Table shows all materials
- Filters work correctly

---

## 📝 Next Steps

1. **Check Browser Console** - Look for error messages
2. **Check Network Tab** - Verify API call succeeds
3. **Check Database** - Verify data exists
4. **Check Authentication** - Verify token is valid

**Once you check the console, share the error message and I'll fix it!** 🔧
