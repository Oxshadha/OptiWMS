# ✅ YOONUS Components - Individual Test Checklist Form
## Mark Each Component as You Test It
### Complete This Form to Verify All Components Working

---

## 🔍 COMPONENT 1: AlertType.java (Backend)

**What it is**: Java enum with 40+ alert types  
**Location**: `backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertType.java`

### Check These:
- [ ] File exists at correct path
- [ ] File contains 40+ alert types (count them: `LOW_STOCK`, `OVERSTOCKED`, `PICKING_QUEUE`, etc.)
- [ ] Each alert has displayName and category
- [ ] Can view full content: `cat backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertType.java`
- [ ] No syntax errors (looks like valid Java)
- [ ] Compiles without error: `cd backend && ./gradlew compileJava`

### Test Result:
Status: **[ ] PASS** or **[ ] FAIL**

If FAIL, describe issue:
```
_________________________________________________
_________________________________________________
```

---

## 🔍 COMPONENT 2: AlertSeverity.java (Backend)

**What it is**: Java enum with 4 severity levels  
**Location**: `backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertSeverity.java`

### Check These:
- [ ] File exists at correct path
- [ ] File contains exactly 4 levels: `INFO`, `WARNING`, `CRITICAL`, `URGENT`
- [ ] Each has a level number (0, 1, 2, 3) and displayName
- [ ] Contains `fromLevel()` method
- [ ] Can view: `cat backend/core-app/src/main/java/com/optiwms/coreapp/notifications/AlertSeverity.java`
- [ ] No syntax errors (valid Java)
- [ ] Compiles: `cd backend && ./gradlew compileJava`

### Test Result:
Status: **[ ] PASS** or **[ ] FAIL**

If FAIL, describe issue:
```
_________________________________________________
_________________________________________________
```

---

## 🔍 COMPONENT 3: AdminLoginForm.tsx (Frontend)

**What it is**: Admin login form component (React TypeScript)  
**Location**: `frontend/components/AdminLoginForm.tsx` + `AdminLoginForm.module.css`

### Check File Existence:
- [ ] `AdminLoginForm.tsx` exists
- [ ] `AdminLoginForm.module.css` exists

### Check Code Structure:
- [ ] Component exports `AdminLoginForm` function
- [ ] Has props: `onSubmit`, `isLoading`, `error`
- [ ] State: `email`, `password`, `showPassword`, `localError`
- [ ] Email input field
- [ ] Password input field (with show/hide toggle)
- [ ] submit button
- [ ] Error message display

### Visual Test in Browser:
```bash
cd frontend
npm run dev
# Open: http://localhost:3000/admin/login
```

- [ ] Email input field displays
- [ ] Password input field displays
- [ ] "Show password" eye icon works (click it)
- [ ] Submit button visible
- [ ] Button styled (pink/gradient color)
- [ ] Responsive on mobile (F12 → Ctrl+Shift+M)
- [ ] No red errors in Console (F12 → Console tab)

### Console Check:
```
Press F12 → Console tab
Look for red error messages: ___NO RED ERRORS___
```

### Test Result:
Status: **[ ] PASS** or **[ ] FAIL**

If FAIL, what's wrong:
```
_________________________________________________
_________________________________________________
```

---

## 🔍 COMPONENT 4: WorkerLoginForm.tsx (Frontend)

**What it is**: Worker login form with role selection (React TypeScript)  
**Location**: `frontend/components/WorkerLoginForm.tsx` + `WorkerLoginForm.module.css`

### Check File Existence:
- [ ] `WorkerLoginForm.tsx` exists
- [ ] `WorkerLoginForm.module.css` exists

### Check Code Structure:
- [ ] Component exports `WorkerLoginForm` function
- [ ] Has props: `onSubmit`, `isLoading`, `error`
- [ ] State: `employeeId`, `password`, `role`, `showPassword`, `localError`
- [ ] Employee ID input
- [ ] Password input (with toggle)
- [ ] Role dropdown (select element)
- [ ] Submit button

### Visual Test in Browser:
```bash
# Frontend already running from test 3
# Open: http://localhost:3000/worker/login
```

- [ ] Employee ID input field visible
- [ ] Password input field visible
- [ ] Role dropdown visible (shows "Select Role...")
- [ ] Click dropdown - options appear
- [ ] Can select: Picker, Packer, Receiver, etc.
- [ ] "Show password" eye icon works
- [ ] "Remember device" checkbox present
- [ ] Submit button present
- [ ] Button styled (green color)
- [ ] Responsive on mobile (F12 → Ctrl+Shift+M)
- [ ] No red errors in Console

### Test Selecting Roles:
- [ ] Click role dropdown
- [ ] At least 3+ role options visible
- [ ] Can select each role
- [ ] Selected role shows in dropdown

### Test Result:
Status: **[ ] PASS** or **[ ] FAIL**

If FAIL, what's wrong:
```
_________________________________________________
_________________________________________________
```

---

## 🔍 COMPONENT 5: NotificationBell.tsx (Frontend)

**What it is**: Real-time notification bell in topbar (React TypeScript)  
**Location**: `frontend/components/NotificationBell.tsx` + `NotificationBell.module.css`

### Start Browser Test:
```bash
# Must be in admin dashboard (logged in)
# Go to: http://localhost:3000/admin/dashboard
```

### Look for Bell Icon in Topbar:
- [ ] Bell icon visible in top-right corner
- [ ] Has badge with number (e.g., "9+")
- [ ] Badge shows unread count
- [ ] Click bell icon
- [ ] Dropdown opens with notifications list

### Check Notifications List:
- [ ] At least 1 notification shows (or empty is OK)
- [ ] Each notification shows: type, title, message
- [ ] Have "Mark as read" button
- [ ] Have "Delete" button
- [ ] Have "Mark all as read" button

### Test Interactions:
- [ ] Click "Mark as read" → notification marked
- [ ] Click "Delete" → notification removed
- [ ] Click outside dropdown → it closes
- [ ] Click bell again → dropdown opens

### Test Auto-Refresh:
```bash
# Open DevTools: F12
# Go to Network tab
# Watch for /api/notifications requests
# Should happen every 30 seconds automatically
```

- [ ] Notifications auto-refresh (no manual button needed)
- [ ] Network tab shows /api/notifications requests

### Styling Check:
- [ ] Different colors for severity levels
- [ ] Red for CRITICAL
- [ ] Yellow/Orange for WARNING
- [ ] Blue for INFO
- [ ] Responsive on mobile

### No Console Errors:
- [ ] F12 → Console tab
- [ ] No red error messages

### Test Result:
Status: **[ ] PASS** or **[ ] FAIL**

If FAIL, what's wrong:
```
_________________________________________________
_________________________________________________
```

---

## 🔍 COMPONENT 6: ProfileMenu.tsx (Frontend)

**What it is**: User profile dropdown menu (React TypeScript)  
**Location**: `frontend/components/ProfileMenu.tsx` + `ProfileMenu.module.css`

### Browser Test:
```bash
# Must be logged in as admin
# http://localhost:3000/admin/dashboard
```

### Look for Profile Avatar:
- [ ] Avatar visible in top-right (shows user initials)
- [ ] Click avatar
- [ ] Dropdown menu opens

### Check Profile Information:
- [ ] User name displays
- [ ] User role displays
- [ ] User email displays
- [ ] Warehouse name displays (if assigned)

### Check Menu Buttons:
- [ ] "My Profile" button visible → Click it
- [ ] "Settings" button visible → Click it
- [ ] "Help & Support" button visible → Click it
- [ ] "Logout" button visible

### Test Navigation:
- [ ] Click "My Profile" → goes to /admin/profile
- [ ] Click "Settings" → goes to /admin/settings
- [ ] Click "Help & Support" → goes to /help (or expected page)

### Test Logout:
- [ ] Click "Logout" button
- [ ] Loading spinner shows
- [ ] Redirected to /admin/login
- [ ] User session cleared
- [ ] Token removed

### UI Check:
- [ ] Smooth animations
- [ ] Responsive on mobile
- [ ] Menu closes when clicking outside

### No Console Errors:
- [ ] F12 → Console tab
- [ ] No red error messages

### Test Result:
Status: **[ ] PASS** or **[ ] FAIL**

If FAIL, what's wrong:
```
_________________________________________________
_________________________________________________
```

---

## 🔍 COMPONENT 7: PickingRouteGuide.tsx (Frontend)

**What it is**: Turn-by-turn picking instructions (React TypeScript)  
**Location**: `frontend/components/PickingRouteGuide.tsx` + `PickingRouteGuide.module.css`

### Browser Test:
```bash
# Go to worker picking page
# http://localhost:3000/worker/picking
# Or navigate to page using this component
```

### Check Component Display:
- [ ] Progress bar visible (shows current/total items)
- [ ] Current item information visible
- [ ] Item code shown
- [ ] Item name shown
- [ ] Quantity shown
- [ ] Location/bin number shown

### Check Route Information:
- [ ] Estimated time displays (e.g., "28 seconds")
- [ ] Distance metric displays (e.g., "45.5 m")
- [ ] Route to location calculated

### Check Instructions:
- [ ] Step-by-step instructions display
- [ ] Turn-by-turn directions (North, South, East, West)
- [ ] Each step numbered
- [ ] Clear and readable

### Check Buttons:
- [ ] "Item Picked" button visible
- [ ] "Next Item (X remaining)" button visible (if more items)

### Test Item Confirmation:
- [ ] Click "Item Picked"
- [ ] Progress bar updates
- [ ] Current item index advances
- [ ] Next item loads
- [ ] Route recalculates for new item
- [ ] Instructions update

### Check Upcoming Items:
- [ ] "Upcoming Items" section shows
- [ ] Lists next 2-3 items
- [ ] Shows "+N more items" if applicable

### Test Completion:
- [ ] Pick all items in list
- [ ] Final item picked
- [ ] Completion screen shows
- [ ] "All items picked!" message displays

### Mobile Responsiveness:
- [ ] F12 → Ctrl+Shift+M (mobile mode)
- [ ] All elements fit on screen
- [ ] Buttons large enough to tap
- [ ] Text readable
- [ ] No horizontal scroll

### No Console Errors:
- [ ] F12 → Console tab
- [ ] No red error messages

### Test Result:
Status: **[ ] PASS** or **[ ] FAIL**

If FAIL, what's wrong:
```
_________________________________________________
_________________________________________________
```

---

# 📊 FINAL SUMMARY - FILL THIS IN

## Overall Testing Status

| Component | Status | Notes |
|-----------|--------|-------|
| AlertType.java | [ ] PASS / [ ] FAIL | __________ |
| AlertSeverity.java | [ ] PASS / [ ] FAIL | __________ |
| AdminLoginForm | [ ] PASS / [ ] FAIL | __________ |
| WorkerLoginForm | [ ] PASS / [ ] FAIL | __________ |
| NotificationBell | [ ] PASS / [ ] FAIL | __________ |
| ProfileMenu | [ ] PASS / [ ] FAIL | __________ |
| PickingRouteGuide | [ ] PASS / [ ] FAIL | __________ |

## Count Results:
- **Total PASS**: ___ / 7
- **Total FAIL**: ___ / 7

## Overall Status:
- [ ] **ALL COMPONENTS WORKING** (7/7 PASS)
- [ ] **Some issues found** (need fixes)
- [ ] **Major problems** (need review)

## Issues Found (if any):
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

## Next Steps:
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## 🎯 Definition of PASS for Each Component:

### Backend Components (AlertType, AlertSeverity):
✅ **PASS** = File exists, correct Java syntax, compiles with no errors

### Frontend Components (LoginForms, NotificationBell, etc.):
✅ **PASS** = Component displays in browser, all visual elements present, no red console errors, responsive design works

---

## 📝 Date Tested: _______________

## ✍️ Tester Name: _______________

---

**Use this checklist to test each component individually!**
