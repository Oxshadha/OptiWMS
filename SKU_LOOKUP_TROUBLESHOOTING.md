# 🔍 SKU Lookup Troubleshooting Guide

## Problem: SKU Shows in Inventory but Not Found in Worker Receiving

**Symptom**: 
- SKU (e.g., `100036`) appears in Admin Inventory page
- But when worker types the same SKU in receiving page, it shows "Material lookup pending..."
- Material is not found

---

## 🔍 Root Causes

### 1. **Material Doesn't Exist in Materials Table**
**Most Common Issue**

**Problem**: 
- Inventory items reference materials via `material_id` (UUID)
- If the material was deleted or never created, inventory shows the SKU from cached data
- But lookup by code fails because material doesn't exist

**Check**:
1. Go to Admin → Materials (`/admin/materials`)
2. Search for the SKU (e.g., `100036`)
3. If not found → Material doesn't exist

**Solution**:
- Create the material in Materials page
- Or re-import materials from CSV

---

### 2. **Case Sensitivity or Whitespace**
**Fixed in Latest Update**

**Problem**:
- Material code stored as `"100036"` (with spaces or different case)
- User types `"100036"` (different format)
- Exact match fails

**Solution**: ✅ **FIXED**
- Backend now does case-insensitive lookup
- Trims whitespace automatically
- Tries exact match first, then case-insensitive

---

### 3. **Data Inconsistency**
**Inventory References Non-Existent Material**

**Problem**:
- Inventory table has `material_id` pointing to a material
- But the material was deleted or material_code changed
- Inventory page shows SKU from old/cached data
- But lookup fails because material_code doesn't match

**Check**:
```sql
-- Check if material exists
SELECT * FROM materials WHERE material_code = '100036';

-- Check inventory references
SELECT i.*, m.material_code 
FROM inventory i 
LEFT JOIN materials m ON i.material_id = m.id 
WHERE m.material_code = '100036' OR i.material_id IN (
  SELECT id FROM materials WHERE material_code = '100036'
);
```

**Solution**:
- Fix data inconsistency
- Update inventory to reference correct material
- Or create missing material

---

## ✅ How to Fix

### Step 1: Verify Material Exists

1. **Go to Admin Panel → Materials** (`/admin/materials`)
2. **Search for the SKU** (e.g., `100036`)
3. **Check if it exists**:
   - ✅ **If found**: Material exists, check case/format
   - ❌ **If not found**: Material doesn't exist → Create it

### Step 2: Create Missing Material

**Option A: Via Admin Panel**
1. Go to `/admin/materials`
2. Click "Add Material"
3. Enter:
   - **Product Code**: `100036` (the SKU)
   - **Description**: `CAUSTIC SODA` (or correct name)
   - **Type**: Select appropriate type
4. Save

**Option B: Via CSV Import**
1. Prepare CSV with material codes
2. Go to Materials page
3. Import CSV

### Step 3: Verify Lookup Works

1. Go to Worker App → Receiving
2. Enable Blind Receiving Mode
3. Type the SKU (e.g., `100036`)
4. Should show: "Material found: [Description]"
5. If still fails, check browser console for errors

---

## 🐛 Debugging Steps

### Check Browser Console

1. Open Developer Tools (F12)
2. Go to Console tab
3. Type SKU in receiving page
4. Look for errors:
   - `Material not found for code: 100036`
   - `404 Not Found` → Material doesn't exist
   - `400 Bad Request` → Invalid format

### Check Network Tab

1. Open Developer Tools (F12)
2. Go to Network tab
3. Type SKU in receiving page
4. Look for API call: `GET /api/master/materials/code/100036`
5. Check response:
   - **200 OK** → Material found ✅
   - **404 Not Found** → Material doesn't exist ❌
   - **500 Error** → Server error

### Check Database

```sql
-- Find material by code
SELECT id, material_code, description 
FROM materials 
WHERE material_code = '100036' 
   OR LOWER(material_code) = LOWER('100036');

-- Check inventory references
SELECT i.id, i.material_id, m.material_code, m.description
FROM inventory i
LEFT JOIN materials m ON i.material_id = m.id
WHERE m.material_code = '100036' OR i.material_id IN (
  SELECT id FROM materials WHERE material_code = '100036'
);
```

---

## 🔧 Recent Fixes Applied

### ✅ Case-Insensitive Lookup
- Backend now tries exact match first
- Falls back to case-insensitive lookup
- Trims whitespace automatically

### ✅ Better Error Messages
- Shows specific error when material not found
- Suggests checking Materials page
- Logs detailed errors in console

### ✅ Improved Lookup Timing
- Looks up material as you type (after 1+ characters)
- Final lookup on blur (when leaving field)
- Shows success/error messages

---

## 📋 Checklist

When SKU lookup fails, check:

- [ ] Material exists in `/admin/materials` page
- [ ] Material code matches exactly (case/whitespace)
- [ ] Browser console shows no errors
- [ ] Network tab shows API call succeeded
- [ ] Database has material with correct code
- [ ] Inventory references correct material_id

---

## 💡 Prevention

### Best Practices:

1. **Always create materials first** before adding inventory
2. **Use consistent SKU format** (e.g., always uppercase, no spaces)
3. **Import materials from CSV** to ensure consistency
4. **Verify materials exist** before creating inventory items
5. **Regular data validation** to catch inconsistencies

---

## 🆘 Still Not Working?

If SKU lookup still fails after checking everything:

1. **Check backend logs** for detailed error messages
2. **Verify API endpoint** is accessible: `GET /api/master/materials/code/{code}`
3. **Test with different SKU** to isolate the issue
4. **Check database directly** to verify data exists
5. **Contact support** with:
   - SKU that's failing
   - Browser console errors
   - Network tab response
   - Database query results

---

**Last Updated**: January 2026
