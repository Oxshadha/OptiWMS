# Quick Test Guide - Account Settings

## ✅ Implementation Complete

All account settings functionality is now **fully functional** for:
- ✅ Admins
- ✅ Warehouse Managers  
- ✅ Workers

---

## 🚀 Quick Test (5 Minutes)

### 1. Start the System

```bash
# Terminal 1: Start backend
cd /Users/k.e.oshada/Documents/OptiWMS/backend
./gradlew bootRun

# Terminal 2: Start frontend
cd /Users/k.e.oshada/Documents/OptiWMS/frontend
npm run dev
```

### 2. Test Admin Account Settings

```bash
# Open: http://localhost:3000/admin/login
# Login: admin / admin123
# Navigate to: http://localhost:3000/admin/account-settings
```

**Test Profile Update:**
1. Change "First Name" to "Admin Updated"
2. Change "Email" to "admin.updated@optiwms.com"
3. Click "Save Changes"
4. ✅ **Expected**: Success toast appears, profile card updates

**Test Password Change:**
1. Scroll to "Security" section
2. Enter current password: `admin123`
3. Enter new password: `newPass123`
4. Confirm new password: `newPass123`
5. Click "Update Password"
6. ✅ **Expected**: Success toast, password fields clear

**Test New Password:**
1. Logout
2. Login with: `admin` / `newPass123`
3. ✅ **Expected**: Login successful

### 3. Test Worker Account Settings

```bash
# Open: http://localhost:3000/worker/login
# Login: (use any worker credentials from your database)
# Navigate to: http://localhost:3000/worker/account-settings
```

**Repeat the same tests** as admin. Everything should work identically.

---

## 🔐 Security Tests

### Test 1: Wrong Current Password
1. Try to change password
2. Enter WRONG current password
3. ✅ **Expected**: Error toast "Current password is incorrect"

### Test 2: Password Mismatch
1. Enter correct current password
2. Enter new password: `test123`
3. Enter confirm: `test456` (different)
4. ✅ **Expected**: Error toast "New passwords do not match"

### Test 3: Short Password
1. Enter new password: `abc` (too short)
2. ✅ **Expected**: Browser validation error OR error toast "Password must be at least 6 characters"

### Test 4: Duplicate Email
1. Try to change email to another user's email
2. ✅ **Expected**: Error toast "Email is already in use"

### Test 5: Console Check (Production Safety)
1. Open DevTools (F12) → Console
2. Perform profile update and password change
3. ✅ **Expected**: NO `console.log` with tokens or passwords
4. ✅ **Expected**: Only `[AccountAPI]` logger messages in development

---

## 📱 What You Can Do Now

### Profile Management
- ✅ Update first name
- ✅ Update last name
- ✅ Update email (with uniqueness validation)
- ✅ Update phone number
- ✅ View username (read-only)
- ✅ View role (read-only)

### Password Management
- ✅ Change password (requires current password)
- ✅ Minimum 6 characters validation
- ✅ Password confirmation match check
- ✅ Secure password hashing (BCrypt)

### Security Features
- ✅ Current password verification before change
- ✅ Email uniqueness check
- ✅ Production-safe logging (no sensitive data)
- ✅ Proper authentication (JWT)
- ✅ Role-agnostic (works for all user types)

---

## 🎯 API Endpoints (for reference)

```bash
# Get current user
GET /api/auth/me
Authorization: Bearer <token>

# Update profile
PUT /api/auth/me/profile
Authorization: Bearer <token>
Body: {
  "firstName": "Updated",
  "lastName": "Name",
  "email": "new@email.com",
  "phone": "+1-555-0100"
}

# Change password
PUT /api/auth/me/password
Authorization: Bearer <token>
Body: {
  "currentPassword": "oldPass",
  "newPassword": "newPass"
}
```

---

## 📝 Notes

1. **No Re-login Required**: After changing password, user stays logged in (current JWT remains valid)
2. **Cross-Role Compatibility**: Same endpoints work for all user types
3. **Mobile-Friendly**: Worker UI is optimized for mobile devices
4. **Desktop-Friendly**: Admin UI uses a 3-column grid layout
5. **Real-time Feedback**: Loading states, toast notifications, disabled buttons during operations

---

## ✅ Summary

**What's Working:**
- ✅ Profile updates (name, email, phone)
- ✅ Password changes (with security validation)
- ✅ Admin account settings
- ✅ Worker account settings
- ✅ Warehouse manager account settings
- ✅ Security validation
- ✅ Production-safe logging

**Implementation:**
- ✅ Centralized API service
- ✅ Backend security validation
- ✅ Frontend error handling
- ✅ Industry best practices

**Ready for:**
- ✅ Production deployment
- ✅ User testing
- ✅ Security audit

---

## 🐛 If Something Doesn't Work

1. **Check backend is running**: `http://localhost:8080/actuator/health`
2. **Check frontend is running**: `http://localhost:3000`
3. **Check browser console** (F12) for errors
4. **Check backend logs** for detailed error messages
5. **Verify you're logged in** (valid JWT token)

---

**Full documentation available in:** `ACCOUNT_SETTINGS_IMPLEMENTATION.md`
