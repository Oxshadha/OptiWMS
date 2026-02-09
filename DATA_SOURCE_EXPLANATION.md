# Data Source Explanation

## Quick Answer

**Frontend shows REAL database data** - Not mock data!

**BUT:** Data must be **generated manually** first (not auto-generated on startup).

---

## Data Flow

```
┌─────────────────┐
│  PostgreSQL DB   │ ← Data stored here (persistent)
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Backend API    │ ← Reads from database
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Frontend       │ ← Shows real data from API
└─────────────────┘
```

---

## What Data is Real vs Mock?

### ✅ **REAL Database Data** (Most Pages)
- Warehouses → `GET /api/master/warehouses`
- Materials → `GET /api/master/materials`
- Customers → `GET /api/master/customers`
- Suppliers → `GET /api/master/suppliers`
- Delivery Partners → `GET /api/master/delivery-partners`
- Orders → `GET /api/orders`
- Shipments → `GET /api/operations/shipments`
- Inventory → `GET /api/inventory`
- Tasks → `GET /api/tasks`
- Locations → `GET /api/master/locations`

### ❌ **Mock Data** (Removed/Being Removed)
- Old mock data arrays have been replaced
- All pages now use API calls
- If you see empty data = Database is empty = Need to generate

---

## How Data Generation Works

### Data is NOT Auto-Generated

**On Backend Startup:**
- ✅ Database tables created (via Flyway migrations)
- ✅ Default admin user created (via DefaultUserSeeder)
- ✅ Rack locations created (via RackDataSeeder)
- ❌ **NO** suppliers, customers, delivery partners, orders generated

**You Must Generate Data Manually:**

```bash
# Generate master data
cd backend
./generate-synthetic.sh

# Generate orders and tasks
./generate-test-data-safe.sh
```

---

## Data Generation Scripts

### 1. `generate-synthetic.sh`
Generates:
- Suppliers (15)
- Delivery Partners (10)
- Customers (30)

**Location:** `backend/generate-synthetic.sh`

### 2. `generate-test-data-safe.sh`
Generates:
- Orders (inbound & outbound)
- Tasks (putaway, picking, packing)
- Only runs if master data exists

**Location:** `backend/generate-test-data-safe.sh`

### 3. API Endpoints
```bash
# Generate all
POST /api/integration/synthetic/all

# Generate specific
POST /api/integration/synthetic/suppliers
POST /api/integration/synthetic/delivery-partners
POST /api/integration/synthetic/customers
POST /api/integration/synthetic/orders
```

---

## Why Dropdowns Are Empty

### Reason 1: No Data in Database
**Solution:** Generate data
```bash
cd backend
./generate-synthetic.sh
```

### Reason 2: API Permission Issue
**Solution:** Check user role has permission

### Reason 3: Backend Not Running
**Solution:** Start backend
```bash
cd backend
./gradlew :core-api:bootRun
```

---

## How to View Database

### Method 1: pgAdmin (Easiest)
```bash
# Start pgAdmin
cd infra
docker-compose up -d db pgadmin

# Access
http://localhost:5050
Login: admin@optiwms.com / admin123

# Connect to database
Host: db (or localhost)
Port: 5432 (or 5434 from host)
Database: optiwms
User: optiwms
Password: optiwms
```

### Method 2: Command Line
```bash
docker exec -it optiwms-db psql -U optiwms -d optiwms

# View all tables
\dt

# Count records
SELECT COUNT(*) FROM delivery_partners;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM suppliers;

# View data
SELECT * FROM delivery_partners LIMIT 10;
SELECT * FROM orders LIMIT 10;
```

### Method 3: Database Client
Use DBeaver, TablePlus, or any PostgreSQL client:
- Host: `localhost`
- Port: `5434`
- Database: `optiwms`
- User: `optiwms`
- Password: `optiwms`

---

## Fixed Issues in Create Shipment Modal

### Issue 1: Delivery Partners Not Showing
**Fixed:**
- Changed `partner.name` → `partner.companyName`
- Added empty state message
- Better error handling

### Issue 2: Orders Not Selectable
**Fixed:**
- Changed filter from only `ready_to_ship` to include `picked`, `packing`, `packed`, `ready_to_ship`
- Fixed order display to use `orderNumber` instead of non-existent fields
- Added empty state message

---

## Complete Setup Checklist

```bash
# 1. Start database
cd infra
docker-compose up -d db

# 2. Start backend
cd ../backend
./gradlew :core-api:bootRun

# 3. Generate data (new terminal)
cd backend
./generate-synthetic.sh
./generate-test-data-safe.sh

# 4. Verify data
curl -u admin:admin123 http://localhost:8080/api/master/delivery-partners | jq '. | length'
# Should return > 0

# 5. Start frontend
cd ../frontend
npm run dev
```

---

## Summary

| Question | Answer |
|----------|--------|
| **Is frontend data mock?** | ❌ No - All real database data |
| **Is data auto-generated?** | ❌ No - Must run scripts manually |
| **Where is data stored?** | ✅ PostgreSQL database |
| **How to view database?** | ✅ pgAdmin at http://localhost:5050 |
| **Why are dropdowns empty?** | ❌ No data in database - Generate first |
| **Does data persist?** | ✅ Yes - Saved to database |

---

## Next Steps

1. **Generate data:** Run `./generate-synthetic.sh`
2. **Check database:** View in pgAdmin
3. **Refresh frontend:** Dropdowns should populate
4. **Create shipment:** Should work now!
