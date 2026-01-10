# 🚀 OptiWMS Testing - Quick Reference Card

**Print this page for easy reference during testing!**

---

## 🔑 Default Credentials

| Role | Username | Password | URL |
|------|----------|----------|-----|
| **Admin** | `admin` | `admin123` | `http://localhost:3000/admin/login` |
| **Worker** | Create via Admin Portal | - | `http://localhost:3000/worker/login` |

---

## 📝 Common Data Formats

| Field | Format | Example |
|-------|--------|---------|
| **Order Number** | `PO-YYYYMMDD-XXX` | `PO-20250109-001` |
| **SKU** | `TEXT-XXX` | `TWM-001` |
| **Location Code** | `Z-RR-BB-L` | `A-01-01-1` |
| **Email** | `user@domain.com` | `john@example.com` |
| **Phone** | `+CC XX XXX XXXX` | `+94 11 234 5678` |
| **Password** | 8+ chars, 1 upper, 1 lower, 1 number, 1 special | `Admin@123` |
| **Date** | `YYYY-MM-DD` | `2025-01-09` |
| **Weight** | Decimal (kg) | `1.5`, `25.75` |

---

## 🔄 Order Status Flow

```
Inbound: Pending → Confirmed → Received → Putaway → Completed
Outbound: Pending → Confirmed → Picked → Packed → Shipped → Delivered → Completed
```

---

## 🧪 Quick Tests (5 min each)

### ✅ Admin Tests
1. **Login**: `admin` / `admin123` → Dashboard appears
2. **Create Product**: Name, SKU, Category → Product in list
3. **Search**: Type in search bar → Results filter instantly
4. **Create PO**: Supplier + Items → Order appears
5. **Create SO**: Customer + Items → Order appears

### ✅ Worker Tests (Offline-First)
1. **Receiving**: Enter PO → Receive items → Success
2. **Offline Test**: Chrome DevTools → Network → Offline → Receive → "Queued for sync"
3. **Online**: Network → Online → Auto-sync → Success
4. **Picking**: Pick location → Pick items → Success
5. **Offline Pick**: Offline → Pick → "Saved offline" → Online → Syncs

---

## 🔍 Search/Filter - All Pages Working

**Pages with Search**: Inventory, Products, Orders (In/Out), Workers, Customers, Suppliers, Tasks, Cycle Counts, Quality Checks, Returns, Shipments, Stock Transfers

**Test**: Type any text → Results filter instantly (no API calls)

---

## 💾 Offline Support (Workers Only)

| Operation | Offline? | Notes |
|-----------|----------|-------|
| **Receiving** | ✅ Yes | Saves to IndexedDB, syncs when online |
| **Picking** | ✅ Yes | Saves to IndexedDB, syncs when online |
| **Putaway** | ✅ Yes | Saves to IndexedDB, syncs when online |
| **Cycle Count** | ✅ Yes | Saves to IndexedDB, syncs when online |
| **Packing** | ❌ No | Requires order data from API |
| **Admin Pages** | ❌ No | Always requires online connection |

---

## 🔢 Test with Admin Token

```bash
# 1. Get Token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.accessToken'

# 2. Export Token
export ADMIN_TOKEN="paste_token_here"

# 3. Test API
curl http://localhost:8080/api/master/materials \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Run Scripts
chmod +x create-test-data.sh
./create-test-data.sh
```

---

## ⚖️ Weight Validation (NEW)

- **Raw Materials**: Max 1500 kg/pallet
- **Packing Materials**: Max 1000 kg/pallet
- **Tolerance**: Configurable % per material
- **Test**: Try to receive > max weight → Error: "Exceeds limit"

---

## 🔁 Recount Workflow (NEW)

1. **Variance ≤ 5 units**: Auto-accept, update inventory
2. **Variance > 5 units**: Require recount (up to 3 times)
3. **After 3rd count**: Accept final count, admin investigates

**Test**: Count with 10-unit variance → System prompts recount

---

## 📅 Quarterly Scheduler (NEW)

- **Runs**: Daily at 1:00 AM
- **Creates**: Cycle counts for active schedules
- **Test API**:
  ```bash
  # Get schedules
  curl http://localhost:8080/api/operations/cycle-count-schedules \
    -H "Authorization: Bearer $ADMIN_TOKEN"
  
  # Create schedule
  curl -X POST http://localhost:8080/api/operations/cycle-count-schedules \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "warehouseId": "warehouse-uuid",
      "frequency": "quarterly",
      "nextScheduledDate": "2025-04-01",
      "autoCreate": true,
      "active": true
    }'
  ```

---

## 🐛 Common Issues & Quick Fixes

| Issue | Solution |
|-------|----------|
| **Login fails** | 1. Check backend running (`curl localhost:8080/actuator/health`) 2. Use correct credentials 3. Clear cache |
| **Data not loading** | 1. Check Network tab (F12) 2. Verify token in localStorage 3. Refresh page (Ctrl+Shift+R) |
| **Search not working** | 1. Verify data loaded 2. Check console errors 3. Try different search term |
| **Offline mode fails** | 1. Check IndexedDB exists (F12 → Application) 2. Verify worker page (not admin) 3. Clear IndexedDB |
| **Cannot create order** | 1. Check all required fields 2. Verify related entities exist (supplier, customer) 3. Check data formats |

---

## ✅ 30-Minute Quick Test Checklist

- [ ] **Login**: Admin + Worker (2 min)
- [ ] **Dashboard**: Loads with data (3 min)
- [ ] **Inventory**: List + Search + Filter (5 min)
- [ ] **Create Orders**: PO + SO (5 min)
- [ ] **Receiving**: Online + Offline (5 min)
- [ ] **Picking**: Online + Offline (5 min)
- [ ] **New Features**: Weight + Recount + Scheduler (5 min)

**Result**: All ✅ → System is ready! 🚀

---

## 📊 Status Summary

| Feature | Status | Notes |
|---------|--------|-------|
| **Search/Filter** | ✅ Working | All admin pages, client-side |
| **Offline (Workers)** | ✅ Working | Receiving, Picking, Putaway, Cycle Count |
| **Offline (Admin)** | ⚠️ N/A | Online-only (by design) |
| **Weight Validation** | ✅ Working | V15 migration applied |
| **Recount Workflow** | ✅ Working | Up to 3 recounts |
| **Quarterly Scheduler** | ✅ Working | Daily at 1 AM |
| **Dark Mode** | ✅ Working | Toggle in top bar |
| **Role-Based Access** | ✅ Working | Admin, Warehouse Manager, Workers |
| **JWT Auth** | ✅ Working | Token refresh, cross-tab sync |

---

## 📞 Quick Links

- **Full Guide**: `COMPREHENSIVE_TESTING_GUIDE.md`
- **API Docs**: `API_DOCUMENTATION.md`
- **System Status**: `SYSTEM_100_PERCENT_COMPLETE.md`
- **Auth Guide**: `AUTHENTICATION_GUIDE.md`

---

**Happy Testing! 🎉**

_For detailed instructions, see `COMPREHENSIVE_TESTING_GUIDE.md`_
