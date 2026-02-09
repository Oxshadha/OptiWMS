# Profile Update 404 Error - Fix Guide

## 🐛 Current Issue

- Profile page loads ✅
- But "Save Changes" button returns **404 Not Found** ❌
- Error in console: `Failed to update profile: {}`

---

## 🔍 Why 404 Happens

The 404 error means the backend endpoint is not found. This could be because:

1. Backend server isn't running the latest compiled code
2. Endpoint path is wrong
3. Backend didn't restart after code changes

---

## ✅ Quick Fix - Restart Backend

The backend **MUST be restarted** to pick up the new endpoint changes!

### Step 1: Stop Current Backend

**Find the terminal running backend:**
- Look for terminal with `./gradlew bootRun`
- Press `Ctrl+C` to stop it

### Step 2: Restart Backend

```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend
./gradlew bootRun
```

**Wait for this message:**
```
Started Application in X.XXX seconds
```

### Step 3: Test Profile Update Again

1. Refresh browser (`Ctrl+R` or `Cmd+R`)
2. Go to: `http://localhost:3000/admin/profile`
3. Change your name
4. Click "Save Changes"
5. **Should work now!** ✅

---

## 🧪 How to Verify Endpoints Exist

### Test 1: Check if backend is running
```bash
curl http://localhost:8080/actuator/health
```

**Expected:**
```json
{"status":"UP"}
```

### Test 2: Check if /me endpoint works
```bash
# Get your token from browser console:
# Open F12 → Console → Type: localStorage.getItem('accessToken')

# Then test:
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     http://localhost:8080/api/auth/me
```

**Expected:** Your user data in JSON

### Test 3: Check if update endpoint exists
```bash
curl -X PUT \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -d '{"firstName":"Test","lastName":"User"}' \
     http://localhost:8080/api/auth/me/profile
```

**Expected:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {...}
}
```

**If you get 404**, the backend needs to be restarted!

---

## 🎯 What Changed

### Backend Endpoints (AuthController.java)
```java
@PutMapping("/me/profile")  // ✅ Exists
public ResponseEntity<Map<String, Object>> updateProfile(...)

@PutMapping("/me/password")  // ✅ Exists
public ResponseEntity<Map<String, Object>> changePassword(...)
```

### Frontend API Calls (account.ts)
```typescript
// GET current user
apiClient.get('/auth/me')  // → /api/auth/me ✅

// UPDATE profile  
apiClient.put('/auth/me/profile', data)  // → /api/auth/me/profile ✅

// CHANGE password
apiClient.put('/auth/me/password', data)  // → /api/auth/me/password ✅
```

---

## 🔧 Additional Fixes Applied

### 1. Profile Image - Shows Initials
**Before:** Generic person icon
**After:** User's initials (e.g., "AU" for Admin User)

```typescript
// Now shows initials instead of icon
<div className="text-4xl font-bold text-primary">
  {profile.firstName?.[0]?.toUpperCase() || ''}
  {profile.lastName?.[0]?.toUpperCase() || ''}
</div>
```

### 2. Handles Missing Names
If first/last name is empty, shows username instead:
```typescript
{profile.firstName && profile.lastName 
  ? `${profile.firstName} ${profile.lastName}` 
  : profile.username}
```

---

## 📋 Complete Testing Checklist

### ✅ Profile Page (`/admin/profile`)
- [ ] Page loads without errors
- [ ] Shows user initials (not generic icon)
- [ ] Shows correct name or username
- [ ] Shows correct role
- [ ] Can edit first name
- [ ] Can edit last name
- [ ] Can edit email
- [ ] Can edit phone
- [ ] "Save Changes" works (no 404)
- [ ] Success toast appears
- [ ] Data reloads after save

### ✅ Account Settings (`/admin/account-settings`)
- [ ] Page loads without errors
- [ ] Shows correct user data
- [ ] Profile update works
- [ ] Password change works
- [ ] Shows initials or username

### ✅ Worker Pages
- [ ] `/worker/profile` loads
- [ ] `/worker/account-settings` loads
- [ ] All buttons work

---

## 🚨 If Still Getting 404

### Debug Steps:

1. **Check Browser Console (F12 → Console)**
   - What is the exact URL being called?
   - Copy the full error message

2. **Check Browser Network Tab (F12 → Network)**
   - Find the failed request
   - Click on it
   - Check "Request URL"
   - Check "Status Code"
   - Check "Response" tab

3. **Check Backend Terminal**
   - Is backend running?
   - Any error messages?
   - Does it show the PUT request?

4. **Common Issues:**
   ```
   404 with URL: http://localhost:8080/auth/me/profile
   ❌ Missing /api prefix
   
   404 with URL: http://localhost:8080/api/api/auth/me/profile
   ❌ Double /api prefix
   
   404 with URL: http://localhost:8080/api/auth/me/profile
   ✅ Correct! But backend needs restart
   ```

---

## 🎉 Expected Final Result

After restart:

- ✅ Profile page loads with user initials
- ✅ Shows correct name or username
- ✅ "Save Changes" updates profile successfully
- ✅ Success toast appears
- ✅ No 404 errors
- ✅ No console errors

---

**👉 RESTART THE BACKEND SERVER NOW!**

Then refresh your browser and try updating your profile again.

The 404 should be gone! 🚀
