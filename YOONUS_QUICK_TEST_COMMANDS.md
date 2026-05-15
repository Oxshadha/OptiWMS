# YOONUS - Quick Commands for Individual Component Testing
## Copy-Paste Commands to Test Each Component Separately
### OptiWMS - 235548G

---

## 🧪 TEST 1: AlertType.java

### Command 1: View the file
```bash
cat backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertType.java
```

**What to look for:**
- All 40+ alert types listed
- Each has displayName and category
- Valid Java syntax

### Command 2: Count total alert types
```bash
grep -c "^[[:space:]]*[A-Z_]*(" backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertType.java
```

**Expected:** Should output a number ≥ 40

### Command 3: List all alert type names
```bash
grep -o "[A-Z_]*(" backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertType.java | grep -o "[A-Z_]*"
```

**Expected:** List of alert names like LOW_STOCK, OVERSTOCKED, etc.

### Command 4: Build to verify syntax
```bash
cd backend
./gradlew compileJava
cd ..
```

**Expected:** BUILD SUCCESSFUL (no errors)

### VERDICT: 
- ✅ **PASS** if: All commands work, ≥40 types, no compile errors
- ❌ **FAIL** if: Errors or missing types

---

## 🧪 TEST 2: AlertSeverity.java

### Command 1: View the file
```bash
cat backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertSeverity.java
```

**What to look for:**
- 4 severity levels: INFO, WARNING, CRITICAL, URGENT
- Each has level number and displayName
- Has fromLevel() method
- Valid Java syntax

### Command 2: Show just severity values
```bash
grep "^[[:space:]]*[A-Z]" backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertSeverity.java
```

**Expected output:**
```
INFO(0, "Information"),
WARNING(1, "Warning"),
CRITICAL(2, "Critical"),
URGENT(3, "Urgent");
```

### Command 3: Verify 4 levels
```bash
grep -c "INFO\|WARNING\|CRITICAL\|URGENT" backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertSeverity.java
```

**Expected:** 4

### Command 4: Compile  
```bash
cd backend
./gradlew compileJava
cd ..
```

**Expected:** BUILD SUCCESSFUL (no errors)

### VERDICT:
- ✅ **PASS** if: 4 levels present with correct names and values, no compile errors
- ❌ **FAIL** if: Wrong number of levels or compile errors

---

## 🧪 TEST 3: AdminLoginForm.tsx

### Command 1: Check file exists
```bash
ls -la frontend/components/AdminLoginForm.tsx
ls -la frontend/components/AdminLoginForm.module.css
```

**Expected:** Both files listed (should show file size and timestamp)

### Command 2: View component structure
```bash
cat frontend/components/AdminLoginForm.tsx | head -30
```

**What to look for:**
- Import statements
- Component function definition
- Props interface
- React hooks (useState)

### Command 3: Check for email input
```bash
grep -n "email" frontend/components/AdminLoginForm.tsx | head -3
```

**Expected:** At least 3 matches with email validation

### Command 4: Check for password input
```bash
grep -n "password" frontend/components/AdminLoginForm.tsx | head -3
```

**Expected:** At least 3 matches with password toggle

### Command 5: View CSS file
```bash
cat frontend/components/AdminLoginForm.module.css | head -20
```

**Expected:** CSS class definitions (colors, spacing, etc.)

### Command 6: VISUAL TEST - Start frontend
```bash
cd frontend
npm install
npm run dev
# Then open browser to: http://localhost:3000/admin/login
```

**What to see:**
- [ ] Email input field
- [ ] Password input field
- [ ] Show password button (eye icon)
- [ ] Submit button (pink/gradient colored)
- [ ] Responsive layout

### VERDICT:
- ✅ **PASS** if: Both files exist, component renders in browser, all elements visible
- ❌ **FAIL** if: Files missing or component doesn't render

---

## 🧪 TEST 4: WorkerLoginForm.tsx

### Command 1: Check file exists
```bash
ls -la frontend/components/WorkerLoginForm.tsx
ls -la frontend/components/WorkerLoginForm.module.css
```

**Expected:** Both files listed

### Command 2: View component structure
```bash
cat frontend/components/WorkerLoginForm.tsx | head -35
```

**What to look for:**
- Import WorkerRole type
- Props with onSubmit function
- useState hooks
- Role dropdown

### Command 3: Check for employee ID
```bash
grep -n "employeeId" frontend/components/WorkerLoginForm.tsx | head -3
```

**Expected:** Multiple matches

### Command 4: Check for role dropdown
```bash
grep -n "role\|select" frontend/components/WorkerLoginForm.tsx | head -5
```

**Expected:** Multiple matches for role handling

### Command 5: Check CSS
```bash
cat frontend/components/WorkerLoginForm.module.css | grep -E "color|button|input" | head -10
```

**Expected:** CSS styling rules

### Command 6: VISUAL TEST - Use same dev server
```bash
# Frontend already running from Test 3
# Open browser to: http://localhost:3000/worker/login
```

**What to see:**
- [ ] Employee ID input
- [ ] Password input with toggle
- [ ] Role dropdown with options
- [ ] Green submit button
- [ ] Responsive layout

### Command 7: Test role dropdown
```
# In browser, click role dropdown
# Verify you can select: Picker, Packer, Receiver, etc.
```

### VERDICT:
- ✅ **PASS** if: Component renders, role dropdown works, responsive
- ❌ **FAIL** if: Component broken or role dropdown non-functional

---

## 🧪 TEST 5: NotificationBell.tsx

### Command 1: Check file exists
```bash
ls -la frontend/components/NotificationBell.tsx
ls -la frontend/components/NotificationBell.module.css
```

**Expected:** Both files listed

### Command 2: View component imports
```bash
cat frontend/components/NotificationBell.tsx | grep -E "^import|useState|useEffect" | head -10
```

**Expected:** Imports, useState calls, useEffect calls

### Command 3: Check for polling interval
```bash
grep -n "30000\|setInterval" frontend/components/NotificationBell.tsx
```

**Expected:** 30000 (milliseconds = 30 seconds polling)

### Command 4: Check notification handling
```bash
grep -n "handleMarkAsRead\|handleDelete\|fetchNotifications" frontend/components/NotificationBell.tsx
```

**Expected:** 3+ matches for these handlers

### Command 5: View CSS bell styling
```bash
cat frontend/components/NotificationBell.module.css | grep -E "bell|badge|dropdown"
```

**Expected:** CSS for bell icon and dropdown

### Command 6: VISUAL TEST - Go to admin dashboard
```bash
# Frontend running from Test 3 & 4
# Make sure you're logged in as admin
# Go to: http://localhost:3000/admin/dashboard
```

**What to see:**
- [ ] Bell icon in top-right corner
- [ ] Unread badge with number
- [ ] Click bell → dropdown opens
- [ ] Notifications list displays
- [ ] Mark as read button works
- [ ] Delete button works
- [ ] Close dropdown when clicking outside

### Command 7: Monitor network (auto-refresh test)
```
In browser:
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "notifications"
4. Wait 30 seconds
5. Watch for automatic API calls
```

**Expected:** Should see /api/notifications request every 30 seconds

### VERDICT:
- ✅ **PASS** if: Bell visible, dropdown works, auto-refresh works
- ❌ **FAIL** if: Bell missing or doesn't refresh

---

## 🧪 TEST 6: ProfileMenu.tsx

### Command 1: Check files exist
```bash
ls -la frontend/components/ProfileMenu.tsx
ls -la frontend/components/ProfileMenu.module.css
```

**Expected:** Both files listed

### Command 2: View imports
```bash
cat frontend/components/ProfileMenu.tsx | grep -E "^import|useRouter|useAdmin" | head -8
```

**Expected:** Router and context imports

### Command 3: Check logout handler
```bash
grep -n "handleLogout\|authApi.logout" frontend/components/ProfileMenu.tsx
```

**Expected:** logout function and API call

### Command 4: Check navigation links
```bash
grep -n "handleNavigate\|router.push" frontend/components/ProfileMenu.tsx
```

**Expected:** Multiple navigation calls

### Command 5: View CSS
```bash
cat frontend/components/ProfileMenu.module.css | grep -E "avatar|profile|button" | head -10
```

**Expected:** CSS styling

### Command 6: VISUAL TEST - View profile menu
```bash
# In admin dashboard (from previous tests)
# Look for profile avatar in top-right corner
# Click it to open menu
```

**What to see:**
- [ ] Avatar with user initials
- [ ] User name displayed
- [ ] User role displayed
- [ ] User email displayed
- [ ] "My Profile" button
- [ ] "Settings" button
- [ ] "Help & Support" button
- [ ] "Logout" button

### Command 7: Test logout
```
# In browser:
# Click "Logout" button
# Should redirect to /admin/login
# Session should be cleared
```

### VERDICT:
- ✅ **PASS** if: Menu displays, logout works, navigation works
- ❌ **FAIL** if: Menu broken or logout fails

---

## 🧪 TEST 7: PickingRouteGuide.tsx

### Command 1: Check files
```bash
ls -la frontend/components/PickingRouteGuide.tsx
ls -la frontend/components/PickingRouteGuide.module.css
```

**Expected:** Both files listed

### Command 2: View component props
```bash
cat frontend/components/PickingRouteGuide.tsx | grep -A 8 "interface PickingRouteGuideProps"
```

**Expected:** Props including items, currentLocation, callbacks

### Command 3: Check route fetching
```bash
grep -n "fetchRoute\|pathfindingApi" frontend/components/PickingRouteGuide.tsx
```

**Expected:** Multiple matches for route API calls

### Command 4: Check progress tracking
```bash
grep -n "currentItemIndex\|completedItems\|remainingItems" frontend/components/PickingRouteGuide.tsx
```

**Expected:** Progress tracking logic

### Command 5: Check instructions generation
```bash
grep -n "generateInstructions\|direction" frontend/components/PickingRouteGuide.tsx
```

**Expected:** Instruction generation logic

### Command 6: View CSS
```bash
cat frontend/components/PickingRouteGuide.module.css | grep -E "progress|route|instruction" | head -10
```

**Expected:** CSS styling for route display

### Command 7: VISUAL TEST - Go to picking page
```bash
# In browser:
# Go to: http://localhost:3000/worker/picking
# Or use dashboard to navigate to picking interface
```

**What to see:**
- [ ] Progress bar showing current/total items
- [ ] Current item information
- [ ] Item code, name, quantity, location
- [ ] Estimated time and distance
- [ ] Step-by-step route instructions
- [ ] "Item Picked" button
- [ ] "Next Item" button

### Command 8: Test picking workflow
```
# In browser:
# 1. Click "Item Picked" button
# 2. Progress updates
# 3. Next item loads
# 4. Route recalculates
# 5. Instructions update
# Repeat until all items picked
```

### Command 9: Test mobile view
```
# In browser:
# F12 → Ctrl+Shift+M (mobile view)
# Check responsive design
# All elements should fit
```

### VERDICT:
- ✅ **PASS** if: Component displays, route works, instructions show, responsive
- ❌ **FAIL** if: Component broken or route calculation fails

---

# 📋 QUICK TEST SUMMARY

Run these commands in order:

## Backend Tests (2 minutes)
```bash
# Test 1: AlertType
cat backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertType.java | wc -l
echo "Expected: 50+ lines"

# Test 2: AlertSeverity  
cat backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertSeverity.java | wc -l
echo "Expected: 20+ lines"

# Build both
cd backend && ./gradlew compileJava && cd ..
echo "Expected: BUILD SUCCESSFUL"
```

## Frontend Setup (1 minute)
```bash
cd frontend
npm install
npm run dev
# Wait for dev server to start
```

## Visual Tests (10 minutes - Do these in browser)

1. **Test 3**: http://localhost:3000/admin/login
2. **Test 4**: http://localhost:3000/worker/login  
3. **Test 5**: http://localhost:3000/admin/dashboard (look for bell icon)
4. **Test 6**: http://localhost:3000/admin/dashboard (look for profile avatar)
5. **Test 7**: http://localhost:3000/worker/picking

## Mark Your Results
```
AlertType: PASS / FAIL
AlertSeverity: PASS / FAIL
AdminLoginForm: PASS / FAIL
WorkerLoginForm: PASS / FAIL
NotificationBell: PASS / FAIL
ProfileMenu: PASS / FAIL
PickingRouteGuide: PASS / FAIL
```

---

**Copy commands above and run them one by one!**
