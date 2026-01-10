# Quick Fix: 403 Forbidden Error in Data Generation Scripts

## 🔴 Problem

The data generation scripts were failing with **403 Forbidden** errors because:
- Scripts used **Basic Auth** (`-u "admin:admin123"`)
- Backend requires **JWT token** with `ADMIN` role
- Security config: `/api/integration/**` requires `hasRole("ADMIN")`

## ✅ Solution

**All scripts have been updated to use JWT authentication!**

### Updated Scripts:
1. ✅ `generate-synthetic.sh` - Now uses JWT
2. ✅ `generate-test-data-safe.sh` - Now uses JWT
3. ✅ `generate-synthetic-jwt.sh` - New JWT version (backup)
4. ✅ `generate-test-data-safe-jwt.sh` - New JWT version (backup)

## 🚀 How to Use

### **Option 1: Use Updated Scripts (Recommended)**

```bash
cd backend

# Generate suppliers, customers, delivery partners
./generate-synthetic.sh

# Generate orders and tasks (checks if master data exists first)
./generate-test-data-safe.sh
```

### **Option 2: Manual API Calls**

```bash
# 1. Login and get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.accessToken')

# 2. Generate data
curl -X POST http://localhost:8080/api/integration/synthetic/all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"suppliersCount":15,"couriersCount":10,"customersCount":30}'
```

## ✅ What Changed

### Before (❌ Failed):
```bash
curl -X POST -u "admin:admin123" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/integration/synthetic/all"
# Result: 403 Forbidden
```

### After (✅ Works):
```bash
# 1. Login first
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.accessToken')

# 2. Use JWT token
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/integration/synthetic/all"
# Result: ✅ Success
```

## 📝 Important Notes

1. **Data Persists**: Generated data is stored in PostgreSQL permanently
2. **One-Time Setup**: Run scripts once to populate test data
3. **Admin Required**: Must login as `admin` user (not worker)
4. **JWT Expires**: Token expires after 15 minutes (scripts handle this)

## 🎯 Next Steps

1. Run the updated scripts
2. Verify data in database or frontend
3. Data will persist across restarts!
