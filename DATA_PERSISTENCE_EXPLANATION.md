# Data Persistence & Industry Best Practices

## ✅ **IMPORTANT: Data DOES Persist in Database**

Your data is **NOT regenerated every startup**. Data is stored permanently in PostgreSQL and persists across:
- Backend restarts
- Frontend restarts
- System reboots
- Docker container restarts

**Data only disappears if you:**
- Drop the database
- Delete Docker volumes
- Manually truncate tables

---

## 🔄 What Happens on Backend Startup

### ✅ **Automatically Created (System Data)**
These are created via **database migrations** and **seeders**:

1. **Database Schema** (Flyway migrations)
   - All tables, indexes, constraints
   - Runs automatically on first startup

2. **Default Admin User**
   - Username: `admin`
   - Password: `admin123`
   - Created via migration `V2__seed_initial_data.sql`

3. **Default Warehouses**
   - 3 warehouses (Colombo, Kandy, Galle)
   - Created via migration `V2__seed_initial_data.sql`

4. **Default Locations/Racks**
   - Storage areas (ST, RM, FG, PK, PA, RC, SH)
   - Created via `RackDataSeeder` (runs on startup)
   - Only creates if missing (idempotent)

### ❌ **NOT Created Automatically (Business Data)**
These are **business/operational data** and must be created manually:

- **Suppliers** - Business partners
- **Customers** - Business customers  
- **Delivery Partners** - Courier companies
- **Materials** - Products/items
- **Orders** - Purchase orders, sales orders
- **Tasks** - Picking, putaway, packing tasks
- **Inventory** - Stock levels

**Why?** In enterprise systems, business data comes from:
- Real business operations
- ERP system integration
- Manual data entry
- CSV imports
- API integrations

---

## 🏭 Industry Best Practices

### **Enterprise-Level Applications**

1. **System Data vs Business Data**
   ```
   System Data (Auto-created):
   ✅ Users, Roles, Permissions
   ✅ Warehouses, Locations (structure)
   ✅ Configuration, Settings
   
   Business Data (Manual/Integration):
   ❌ Suppliers, Customers
   ❌ Products, Inventory
   ❌ Orders, Transactions
   ```

2. **Data Persistence**
   - ✅ All data stored in **persistent database** (PostgreSQL)
   - ✅ Data survives restarts, deployments, updates
   - ✅ Database backups are standard practice
   - ❌ Data is **NEVER** regenerated on startup

3. **Test Data Generation**
   - Used **only for development/testing**
   - Not used in production
   - Scripts available for convenience
   - Production uses real business data

4. **Database Migrations**
   - Schema changes via Flyway migrations
   - Idempotent (safe to run multiple times)
   - Version controlled
   - Run automatically on startup

---

## 🔧 How to Generate Test Data (Development Only)

### **Option 1: Using Scripts (Requires Admin Login)**

```bash
# 1. Login as admin first to get JWT token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. Use the token in scripts (see updated scripts below)
```

### **Option 2: Direct API Calls**

```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.accessToken')

# Generate data
curl -X POST http://localhost:8080/api/integration/synthetic/all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"suppliersCount":15,"couriersCount":10,"customersCount":30}'
```

### **Option 3: Check if Data Already Exists**

```bash
# Check database directly
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "SELECT COUNT(*) FROM suppliers;"
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "SELECT COUNT(*) FROM customers;"
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "SELECT COUNT(*) FROM delivery_partners;"
```

---

## 📊 Data Flow in Production

```
┌─────────────────┐
│   ERP System    │  ← Real business data
└────────┬────────┘
         │ API/Integration
         ▼
┌─────────────────┐
│   OptiWMS API   │  ← Receives and stores
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │  ← Permanent storage
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Frontend UI    │  ← Displays data
└─────────────────┘
```

**In Production:**
- Data comes from ERP/integrations
- Stored permanently in PostgreSQL
- Frontend reads from database via API
- No data generation scripts used

**In Development:**
- Use generation scripts for testing
- Data persists until manually deleted
- Can regenerate if needed (for fresh testing)

---

## 🚨 Common Misconceptions

### ❌ **"Data is regenerated every startup"**
**FALSE** - Data persists in PostgreSQL. Only system data (users, warehouses, locations) is created if missing.

### ❌ **"I need to run scripts every time"**
**FALSE** - Run scripts **once** to populate test data. Data persists across restarts.

### ❌ **"Empty dropdowns mean data is lost"**
**FALSE** - Empty dropdowns mean:
1. Database is empty (need to generate data)
2. API call failed (check permissions/network)
3. Frontend not loading data (check API calls)

### ✅ **"Data should persist in database"**
**TRUE** - This is exactly how it works! Data is stored in PostgreSQL permanently.

---

## 🔍 How to Verify Data Persistence

### **1. Check Database Directly**
```bash
docker exec -it optiwms-db psql -U optiwms -d optiwms

# In psql:
SELECT COUNT(*) FROM suppliers;
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM orders;
```

### **2. Check via API**
```bash
# Get admin token first
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.accessToken')

# Check data
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/master/suppliers | jq '. | length'
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/master/customers | jq '. | length'
```

### **3. Restart Backend and Check Again**
```bash
# Stop backend
# Start backend
# Check data again - it should still be there!
```

---

## 📝 Summary

| Aspect | How It Works |
|--------|-------------|
| **Data Storage** | PostgreSQL (persistent) |
| **Data Persistence** | Survives restarts, deployments |
| **System Data** | Auto-created on startup (if missing) |
| **Business Data** | Manual/API/Integration |
| **Test Data** | Generated via scripts (dev only) |
| **Production Data** | From ERP/integrations |
| **Data Regeneration** | **NEVER** on startup |

---

## ✅ **Your System is Following Industry Best Practices!**

- ✅ Persistent database storage
- ✅ System data auto-created
- ✅ Business data manually entered
- ✅ Test data generation available
- ✅ Data survives restarts
- ✅ No data loss on startup

**The only issue was the 403 permission error in the scripts - which we'll fix next!**
