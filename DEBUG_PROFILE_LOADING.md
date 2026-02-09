# Debug: Profile Loading Issue

## 🐛 Problem
- Page shows: "Failed to load profile"
- Spinning loader, then error message
- Backend is running and receiving requests

## 🔍 Quick Diagnosis Steps

### Step 1: Check Browser Console (MOST IMPORTANT!)

**Open Browser Developer Tools:**
1. Press `F12` (or right-click → Inspect)
2. Click "Console" tab
3. Look for RED error messages

**What to look for:**
```
❌ Error: API Error: 401 - Unauthorized
❌ Error: API Error: 500 - Internal Server Error
❌ TypeError: Cannot read property 'name' of undefined
❌ Network Error
```

**Take a screenshot of the console and share it!**

---

### Step 2: Check Network Tab

1. Press `F12`
2. Click "Network" tab
3. Reload the page (`Ctrl+R` or `Cmd+R`)
4. Look for the `/api/auth/me` request
5. Click on it
6. Check the "Response" tab

**What should you see:**
```json
{
  "userId": "...",
  "username": "admin",
  "email": "...",
  "name": "...",
  "role": "admin",
  "warehouseId": "..."
}
```

**If you see an error response, that's the problem!**

---

## 🔧 Common Causes & Fixes

### Cause 1: Not Logged In (Token Missing/Expired)
**Symptom**: Console shows "401 Unauthorized"

**Fix**: 
1. Go to: `http://localhost:3000/admin/login`
2. Login again: `admin` / `admin123`
3. Then try profile page again

---

### Cause 2: Backend Not Running
**Symptom**: Console shows "Network Error" or "Failed to fetch"

**Fix**:
```bash
# Terminal 1: Start backend
cd /Users/k.e.oshada/Documents/OptiWMS/backend
./gradlew bootRun
```

Wait for: `Started Application in X seconds`

---

### Cause 3: Wrong API Response Format
**Symptom**: Console shows "TypeError: Cannot read property 'name' of undefined"

**Check**: Look at Network tab → `/api/auth/me` → Response

If the response is missing `name`, `userId`, or other fields, the parsing fails.

---

### Cause 4: CORS Error
**Symptom**: Console shows "CORS policy: No 'Access-Control-Allow-Origin' header"

**Fix**: Backend needs to allow `http://localhost:3000`
(But this should already be configured)

---

## 🚀 Quick Fix to Try First

### Option 1: Clear Everything and Re-login
```bash
# In browser console (F12 → Console tab):
localStorage.clear();
location.href = '/admin/login';

# Then login again:
# Username: admin
# Password: admin123
```

### Option 2: Test API Directly
```bash
# Get your token from localStorage
# In browser console:
console.log(localStorage.getItem('accessToken'));

# Then test the API with curl:
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:8080/api/auth/me
```

**Expected response:**
```json
{
  "userId": "...",
  "username": "admin",
  "email": "...",
  "name": "...",
  "role": "admin"
}
```

**If you get an error, that's the root cause!**

---

## 📊 What I Can See

### Backend Logs:
```
✅ Backend is running
✅ Receiving /api/auth/me requests
✅ Spring Security is allowing requests through
❓ No response status shown (need browser console to see)
```

### Frontend Logs:
```
✅ Frontend is running
✅ Pages compile successfully (200 OK for page load)
❓ API call failing (need browser console to see why)
```

---

## 🎯 Next Steps

**Please send me:**
1. **Screenshot of Browser Console (F12 → Console tab)** - This will show the exact error!
2. **Screenshot of Network Tab** - Show the `/api/auth/me` request details

Or just tell me what error message you see in the console!

---

## 🔍 Most Likely Cause

Based on the symptoms, I suspect:

**Theory #1: User data is malformed in database**
- The `/api/auth/me` endpoint returns data
- But `response.name` is `null` or `undefined`
- Code tries to split `null` → crashes
- Shows "Failed to load profile"

**How to verify:**
Check backend database:
```sql
SELECT id, username, email, first_name, last_name, role 
FROM users 
WHERE username = 'admin';
```

If `first_name` or `last_name` is NULL, that could cause issues!

**Quick fix** (if this is the issue):
```sql
UPDATE users 
SET first_name = 'Admin', last_name = 'User' 
WHERE username = 'admin' AND (first_name IS NULL OR last_name IS NULL);
```

---

**PLEASE OPEN BROWSER CONSOLE (F12) AND TELL ME WHAT ERROR YOU SEE!** 

That will tell us exactly what's wrong! 🔍
