# 📦 OptiWMS - Receiving Functionality Testing Guide

**Version**: 1.0  
**Date**: January 2026  
**Purpose**: Complete testing workflow for the Receiving functionality in Worker App

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [What is Blind Receiving?](#what-is-blind-receiving)
3. [Pre-Testing Setup](#pre-testing-setup)
4. [Testing Flow - Regular Receiving](#testing-flow---regular-receiving)
5. [Testing Flow - Blind Receiving](#testing-flow---blind-receiving)
6. [Known Issues & Fixes](#known-issues--fixes)
7. [Expected Behavior](#expected-behavior)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The Receiving functionality allows warehouse workers to:
- Receive inbound orders (PO/ASN)
- Enter received quantities for items
- Work in **Regular Mode** (see expected quantities) or **Blind Mode** (hide expected quantities)
- Add photos and notes to receipts
- Work offline with automatic sync

---

## ❓ What is Blind Receiving?

**Blind Receiving Mode** is a feature that:
- **Hides expected quantities** from the worker during receiving
- **Improves accuracy** by preventing workers from being biased by expected quantities
- **Requires manual SKU entry** when items are unknown (not in the order)
- **Allows receiving items** even when the order doesn't exist in the system

### When to Use Blind Receiving:
- ✅ Quality control scenarios where you want unbiased counting
- ✅ Receiving unexpected items not in the original order
- ✅ Training new workers to count accurately
- ✅ Auditing and verification processes

### Toggle Button Behavior:
- **OFF (Unchecked)**: Regular receiving mode - shows expected quantities
- **ON (Checked)**: Blind receiving mode - hides expected quantities, shows primary color
- The toggle should show proper colors (not fully white) - if it appears white, check CSS theme

---

## 🔧 Pre-Testing Setup

### Step 1: Verify Services

```bash
# Check backend is running
curl http://localhost:8080/actuator/health
# Expected: {"status":"UP"}

# Check frontend is running
curl http://localhost:3000
# Expected: HTML response
```

### Step 2: Login as Worker

1. Open Worker App: `http://localhost:3000/worker`
2. Login with worker credentials:
   - Username: `test_worker` (or your test worker)
   - Password: `Test@123`
3. Navigate to **Receiving** page

### Step 3: Prepare Test Data

**Option A: Use Existing Order**
- Create an inbound order in Admin panel
- Note the PO/ASN number (e.g., `PO-001`)

**Option B: Test Blind Mode (No Order Required)**
- Blind mode can work without an existing order
- You'll need to manually enter SKU/Material ID

---

## 📝 Testing Flow - Regular Receiving

### Test Case 1: Basic Receiving with Existing Order

**Steps:**
1. ✅ **Verify Toggle Button**
   - Toggle should be **OFF** (unchecked) by default
   - Toggle should show proper styling (not fully white)
   - Click toggle to verify it changes state

2. ✅ **Scan/Enter PO/ASN**
   - Enter a valid PO/ASN number (e.g., `PO-001`)
   - OR click the scanner button to scan QR code
   - Wait for order details to load

3. ✅ **Verify Order Items Display**
   - Items should appear in cards
   - Each item should show:
     - Item name
     - SKU
     - **Expected quantity** (visible in regular mode)
     - Received quantity input (starts at 0)

4. ✅ **Enter Received Quantity**
   - Use +/- buttons to adjust quantity
   - OR type directly in the quantity input
   - Verify quantity updates correctly
   - Check status messages:
     - "X remaining" (if less than expected)
     - "Complete" (if equal to expected)
     - "X over expected" (if more than expected) - should show warning color

5. ✅ **Add Optional Details**
   - Click "Take Photo" to add photos
   - Click "Add Note" to add notes
   - Verify photos and notes are saved

6. ✅ **Confirm Receipt**
   - Click "Confirm Receipt" button
   - Verify success toast message
   - Verify form resets after successful receipt

**Expected Results:**
- ✅ Order loads successfully
- ✅ Expected quantities are visible
- ✅ Quantity input works correctly
- ✅ Receipt is confirmed and inventory is updated
- ✅ Success message appears

---

## 🔒 Testing Flow - Blind Receiving

### Test Case 2: Blind Receiving Mode

**Steps:**
1. ✅ **Enable Blind Mode**
   - Toggle "Blind Receiving Mode" to **ON**
   - Verify toggle shows primary color (not white)
   - Verify description: "Hide expected quantities to improve accuracy"

2. ✅ **Scan/Enter PO/ASN**
   - Enter PO/ASN number
   - If order exists, items will load
   - If order doesn't exist, you'll see "No items found" (this is OK for blind mode)

3. ✅ **Verify Blind Mode Behavior**
   - **Expected quantities should be HIDDEN**
   - Only item name and SKU should be visible
   - No "remaining" or "over expected" messages

4. ✅ **Enter SKU for Unknown Items** ⚠️ **CRITICAL TEST**
   - If item has no materialId, SKU input field should appear
   - **Test SKU Input Field:**
     - Click in the SKU input field
     - Type multiple characters (e.g., "MAT-12345")
     - ✅ **VERIFY: You can type more than one letter**
     - ✅ **VERIFY: All characters are saved correctly**
     - ✅ **VERIFY: Field accepts alphanumeric characters, dashes, underscores**
   - If SKU input only allows one letter, this is a **BUG** (should be fixed)

5. ✅ **Enter Received Quantity**
   - Use +/- buttons or type directly
   - Verify quantity updates

6. ✅ **Confirm Blind Receipt**
   - Click "Confirm Blind Receipt" button
   - Verify success message
   - Verify inventory is updated even without order validation

**Expected Results:**
- ✅ Expected quantities are hidden
- ✅ SKU input field works correctly (allows multiple characters)
- ✅ Blind receipt is confirmed successfully
- ✅ Inventory is updated

---

## 🐛 Known Issues & Fixes

### Issue 1: SKU Input Only Allows One Letter

**Symptom:**
- When typing in SKU/Material ID field, only one character is accepted
- Subsequent characters are ignored or field resets

**Root Cause:**
- React state update issue or event handler interference

**Fix Applied:**
- Added `value={item.sku || ""}` to ensure proper value binding
- Added `onKeyDown` handler to prevent event propagation
- Added `autoComplete="off"` to prevent browser interference
- Ensured state update uses direct value from event

**How to Verify Fix:**
1. Enable Blind Receiving Mode
2. Enter a PO/ASN that doesn't exist (or has unknown items)
3. Type in SKU field: "MAT-12345"
4. ✅ Should accept all characters
5. ✅ Should save correctly

### Issue 2: Toggle Button Appears Fully White

**Symptom:**
- Toggle button appears white/unstyled before toggling
- No visual indication of state

**Root Cause:**
- CSS theme issue or DaisyUI toggle styling not applied

**Fix Applied:**
- Verified `toggle toggle-primary` classes are correct
- Toggle should show:
  - **OFF**: Grey/unchecked state
  - **ON**: Primary color (usually red/pink in theme)

**How to Verify Fix:**
1. Check toggle button appearance
2. ✅ Should show proper styling (not fully white)
3. ✅ Should change color when toggled ON
4. If still white, check:
   - CSS theme is loaded
   - DaisyUI styles are imported
   - Browser console for CSS errors

---

## ✅ Expected Behavior

### Regular Receiving Mode:
- ✅ Shows expected quantities
- ✅ Shows "remaining" / "over expected" messages
- ✅ Validates against order
- ✅ Requires valid PO/ASN

### Blind Receiving Mode:
- ✅ Hides expected quantities
- ✅ Allows receiving without order validation
- ✅ Shows SKU input for unknown items
- ✅ SKU input accepts multiple characters
- ✅ Works offline

### Toggle Button:
- ✅ Shows proper styling (not white)
- ✅ Changes state when clicked
- ✅ Saves preference to user profile
- ✅ Persists across sessions

### SKU Input Field:
- ✅ Appears when blind mode is ON and item has no materialId
- ✅ Accepts multiple characters
- ✅ Accepts alphanumeric, dashes, underscores
- ✅ Required field (shows asterisk)
- ✅ Has warning background color

---

## 🔍 Troubleshooting

### Problem: SKU input still only accepts one letter

**Solution:**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check browser console for errors
4. Verify the fix is deployed (check file timestamp)
5. Try in incognito/private mode

### Problem: Toggle button is white

**Solution:**
1. Check if DaisyUI theme is loaded
2. Verify CSS imports in `_app.tsx` or layout
3. Check browser console for CSS errors
4. Try different browser
5. Check if theme CSS variables are defined

### Problem: Order not loading

**Solution:**
1. Verify backend is running
2. Check network tab for API errors
3. Verify PO/ASN number is correct
4. Check if order exists in database
5. For blind mode, this is OK - you can proceed without order

### Problem: Receipt confirmation fails

**Solution:**
1. Check backend logs
2. Verify all required fields are filled
3. Check network tab for error messages
4. Verify worker has proper permissions
5. Check if offline mode is active (will queue for sync)

---

## 📊 Test Checklist

### Regular Receiving:
- [ ] Toggle is OFF by default
- [ ] Can scan/enter PO/ASN
- [ ] Order items load correctly
- [ ] Expected quantities are visible
- [ ] Quantity input works (+/- buttons)
- [ ] Quantity input accepts direct typing
- [ ] Status messages show correctly
- [ ] Can add photos
- [ ] Can add notes
- [ ] Receipt confirms successfully
- [ ] Form resets after confirmation

### Blind Receiving:
- [ ] Toggle changes to ON
- [ ] Toggle shows proper color (not white)
- [ ] Expected quantities are hidden
- [ ] Can scan/enter PO/ASN
- [ ] Works with or without existing order
- [ ] SKU input field appears for unknown items
- [ ] **SKU input accepts multiple characters** ⚠️
- [ ] SKU input saves correctly
- [ ] Quantity input works
- [ ] Can add photos and notes
- [ ] Blind receipt confirms successfully
- [ ] Inventory updates correctly

### Toggle Button:
- [ ] Shows proper styling (not white)
- [ ] Changes state when clicked
- [ ] Preference saves to user profile
- [ ] Preference persists on page reload

---

## 🎯 Quick Test Script

```bash
# 1. Start services
docker-compose up -d
npm run dev  # Frontend
./mvnw spring-boot:run  # Backend

# 2. Login as worker
# Navigate to: http://localhost:3000/worker
# Login with test worker credentials

# 3. Test Regular Receiving
# - Toggle OFF
# - Enter PO-001
# - Verify expected quantities visible
# - Enter quantity
# - Confirm receipt

# 4. Test Blind Receiving
# - Toggle ON
# - Verify toggle color (not white)
# - Enter PO-001 (or non-existent PO)
# - Verify expected quantities hidden
# - If unknown item, test SKU input (type "MAT-12345")
# - Verify SKU accepts multiple characters
# - Enter quantity
# - Confirm blind receipt

# 5. Verify Fixes
# - SKU input: Type "TEST-12345" - should accept all characters
# - Toggle: Should show proper colors, not white
```

---

## 📝 Notes

- **Blind Receiving** is useful for quality control and unbiased counting
- **SKU Input** should work smoothly - if not, it's a bug that needs fixing
- **Toggle Button** should have proper styling - if white, check CSS theme
- All functionality should work **offline** and sync when online

---

**Last Updated**: January 2026  
**Tested By**: [Your Name]  
**Status**: Ready for Testing
