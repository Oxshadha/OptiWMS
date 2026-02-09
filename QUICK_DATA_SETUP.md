# Quick Data Setup Guide

## Problem: Empty Dropdowns / No Data

If you see empty dropdowns (delivery partners, orders, etc.), you need to generate data first.

---

## Quick Fix (5 minutes)

### Step 1: Start Database
```bash
cd infra
docker-compose up -d db
```

### Step 2: Start Backend
```bash
cd backend
./gradlew :core-api:bootRun
```

### Step 3: Generate Data (New Terminal)
```bash
cd backend

# Generate all master data (suppliers, delivery partners, customers)
./generate-synthetic.sh

# Generate orders and tasks
./generate-test-data-safe.sh
```

---

## Verify Data Generated

```bash
# Check delivery partners
curl -u admin:admin123 http://localhost:8080/api/master/delivery-partners | jq '. | length'

# Should return a number > 0
```

---

## What Gets Generated?

✅ **Master Data** (Persistent):
- Suppliers (15)
- Delivery Partners (10)
- Customers (30)
- Warehouses (from migrations)
- Materials (from migrations)
- Locations (from RackDataSeeder)

✅ **Operational Data**:
- Orders (inbound & outbound)
- Tasks (putaway, picking, packing)
- Inventory (when orders received)

---

## Frontend Data Source

**All frontend data comes from database** - No mock data!

- Warehouses → Database
- Delivery Partners → Database
- Orders → Database
- Customers → Database
- Suppliers → Database

**If dropdowns are empty = No data in database = Need to generate**

---

## View Database

### pgAdmin (Easiest)
1. `cd infra && docker-compose up -d db pgadmin`
2. Open http://localhost:5050
3. Login: `admin@optiwms.com` / `admin123`
4. Connect to `optiwms` database

### Command Line
```bash
docker exec -it optiwms-db psql -U optiwms -d optiwms

# View tables
\dt

# Count records
SELECT COUNT(*) FROM delivery_partners;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM customers;
```

---

## Common Issues

### Issue: Delivery Partners dropdown empty
**Fix:**
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 10}' \
  http://localhost:8080/api/integration/synthetic/delivery-partners
```

### Issue: No orders to select
**Fix:**
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"inboundCount": 5, "outboundCount": 10}' \
  http://localhost:8080/api/integration/synthetic/orders
```

### Issue: All dropdowns empty
**Fix:** Generate all data:
```bash
cd backend
./generate-synthetic.sh
```

---

## Summary

1. **Data is NOT auto-generated** - Must run scripts
2. **Frontend uses real database** - No mock data
3. **Empty dropdowns = No data** - Generate data first
4. **Data persists** - Saved to PostgreSQL
5. **View in pgAdmin** - http://localhost:5050
