# Offline-First PWA Testing Guide

## How to Test Offline-First Features

### 1. Check Network Status Indicator

**What to look for:**
- When online: No banner should appear
- When offline: Yellow warning banner at top saying "You are offline. Data will sync when connection is restored."

**How to test:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Select "Offline" from the throttling dropdown
4. Refresh the page or navigate
5. You should see the offline indicator banner

### 2. Test IndexedDB Storage

**What to test:**
- Data persists when app is closed
- Data persists when browser is closed
- Data persists when device restarts

**How to test:**
1. Open browser DevTools (F12)
2. Go to Application tab
3. Click "IndexedDB" in left sidebar
4. You should see "OptiWMS_Worker" database
5. Expand to see stores: tasks, optimal_paths, scan_records, operation_logs, sync_queue, worker_data
6. Perform any action in the PWA (scan, pick, etc.)
7. Check IndexedDB - data should appear immediately
8. Close and reopen browser - data should still be there

### 3. Test Offline Functionality

**What to test:**
- App works without internet
- Data is saved locally
- Operations can be performed offline

**How to test:**
1. Go offline (Network tab > Offline)
2. Navigate to any worker page (Picking, Putaway, Cycle Count, etc.)
3. Perform actions (scan QR codes, enter quantities, etc.)
4. All actions should work normally
5. Data should be saved to IndexedDB (check Application tab)

### 4. Test Auto-Sync

**What to test:**
- Data syncs automatically when coming online
- Sync queue processes pending items
- Failed syncs retry automatically

**How to test:**
1. Go offline
2. Perform several operations (create tasks, scan items, etc.)
3. Check IndexedDB sync_queue store - should have pending items
4. Go back online
5. Wait 30 seconds (or check console for sync logs)
6. Check sync_queue - items should move to "completed" status
7. Check Network tab - should see API calls being made

### 5. Test Optimal Path Offline

**What to test:**
- Optimal paths are cached in IndexedDB
- Paths work offline once loaded
- Path progress is saved locally

**How to test:**
1. Go online
2. Open a picking task (should load optimal path from backend)
3. Check IndexedDB optimal_paths store - path should be cached
4. Go offline
5. Open the same picking task - should load from IndexedDB
6. Scan locations - progress should be saved locally
7. Close and reopen app - progress should persist

### 6. Browser Console Checks

**What to check:**
- No errors related to IndexedDB
- Network status logs
- Sync operation logs

**How to check:**
1. Open Console tab in DevTools
2. Look for:
   - "IndexedDB initialized" (on app load)
   - "Offline - skipping sync" (when offline)
   - Sync success/failure messages (when online)

### 7. Service Worker (Future)

**Note:** Service Worker for full offline support is not yet implemented. This will be added next.

**What it will do:**
- Cache app assets for offline use
- Intercept network requests
- Serve cached content when offline

## Quick Test Checklist

- [ ] Offline indicator appears when network is disabled
- [ ] IndexedDB database is created on app load
- [ ] Data can be saved when offline
- [ ] Data persists after browser restart
- [ ] Sync queue has items when offline
- [ ] Sync happens automatically when coming online
- [ ] No console errors related to IndexedDB or network

## Common Issues

### Issue: "IndexedDB not available"
**Solution:** Make sure you're testing in a modern browser (Chrome, Firefox, Edge, Safari)

### Issue: "Network status not updating"
**Solution:** Check browser DevTools Network tab throttling settings

### Issue: "Sync not working"
**Solution:** 
1. Check if API_BASE_URL is set correctly
2. Check browser console for API errors
3. Verify backend is running and accessible

### Issue: "Data not persisting"
**Solution:**
1. Check IndexedDB in Application tab
2. Verify database was created
3. Check for errors in console

