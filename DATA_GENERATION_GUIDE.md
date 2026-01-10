# Data Generation Guide

## Overview

OptiWMS uses **synthetic data generation** to populate the database with test data. Data is **NOT automatically generated** on backend startup - it must be generated manually via API calls or scripts.

---

## Data Generation Methods

### Method 1: Using Scripts (Recommended)

#### Generate All Master Data
```bash
cd backend
./generate-synthetic.sh
```

This generates:
- 15 Suppliers
- 10 Delivery Partners
- 30 Customers

#### Generate Custom Amounts
```bash
./generate-synthetic.sh 20 15 50
# Generates: 20 suppliers, 15 delivery partners, 50 customers
```

#### Generate Orders and Tasks
```bash
./generate-test-data-safe.sh
```

This generates:
- Orders (inbound and outbound)
- Tasks (putaway, picking, packing)
- Only generates if master data exists

---

### Method 2: Using API Directly

#### Generate All Master Data
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "suppliersCount": 15,
    "couriersCount": 10,
    "customersCount": 30
  }' \
  http://localhost:8080/api/integration/synthetic/all
```

#### Generate Delivery Partners Only
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 10}' \
  http://localhost:8080/api/integration/synthetic/delivery-partners
```

#### Generate Orders
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "inboundCount": 10,
    "outboundCount": 15
  }' \
  http://localhost:8080/api/integration/synthetic/orders
```

---

## What Data is Generated?

### Master Data (Persistent)
- ✅ **Suppliers** - Saved to database
- ✅ **Delivery Partners** - Saved to database
- ✅ **Customers** - Saved to database
- ✅ **Warehouses** - Created via migrations
- ✅ **Materials** - Created via migrations
- ✅ **Locations** - Created via RackDataSeeder (on startup)
- ✅ **Users** - Created via DefaultUserSeeder (on startup)

### Operational Data (Generated on Demand)
- ✅ **Orders** - Inbound and outbound orders
- ✅ **Order Items** - Items for each order
- ✅ **Tasks** - Putaway, picking, packing tasks
- ✅ **Inventory** - Created when orders are received

---

## Data Persistence

### ✅ Persistent Data
- Data generated via synthetic data API is **saved to PostgreSQL database**
- Data persists across backend restarts
- Data is stored in actual database tables

### ❌ Not Auto-Generated
- Data is **NOT automatically generated** on backend startup
- You must run generation scripts/API calls manually
- First time setup requires running generation scripts

---

## How to View Database

### Option 1: pgAdmin (Recommended)
1. Start Docker: `cd infra && docker-compose up -d db pgadmin`
2. Access: http://localhost:5050
3. Login: `admin@optiwms.com` / `admin123`
4. Connect to database:
   - Host: `db` (or `localhost` if connecting from host)
   - Port: `5432` (or `5434` if connecting from host)
   - Database: `optiwms`
   - Username: `optiwms`
   - Password: `optiwms`

### Option 2: psql Command Line
```bash
# Connect to database
docker exec -it optiwms-db psql -U optiwms -d optiwms

# View tables
\dt

# View data
SELECT * FROM suppliers LIMIT 10;
SELECT * FROM delivery_partners LIMIT 10;
SELECT * FROM customers LIMIT 10;
SELECT * FROM orders LIMIT 10;
```

### Option 3: Database Client
Use any PostgreSQL client (DBeaver, TablePlus, etc.) with:
- Host: `localhost`
- Port: `5434`
- Database: `optiwms`
- Username: `optiwms`
- Password: `optiwms`

---

## Quick Start: Generate All Data

```bash
# 1. Start database
cd infra
docker-compose up -d db

# 2. Start backend
cd ../backend
./gradlew :core-api:bootRun

# 3. Generate data (in new terminal)
cd backend
./generate-synthetic.sh
./generate-test-data-safe.sh
```

---

## Data Status Check

### Check if Data Exists
```bash
# Check suppliers
curl -u admin:admin123 http://localhost:8080/api/master/suppliers | jq '. | length'

# Check delivery partners
curl -u admin:admin123 http://localhost:8080/api/master/delivery-partners | jq '. | length'

# Check customers
curl -u admin:admin123 http://localhost:8080/api/master/customers | jq '. | length'

# Check orders
curl -u admin:admin123 http://localhost:8080/api/orders | jq '. | length'
```

---

## Frontend Data Source

### ✅ Real Database Data
Most frontend pages now load data from **actual database** via API:
- Warehouses → `GET /api/master/warehouses`
- Materials → `GET /api/master/materials`
- Customers → `GET /api/master/customers`
- Suppliers → `GET /api/master/suppliers`
- Delivery Partners → `GET /api/master/delivery-partners`
- Orders → `GET /api/orders`
- Shipments → `GET /api/operations/shipments`
- Inventory → `GET /api/inventory`

### ❌ Mock Data (Remaining)
Some pages may still have mock data fallbacks, but these are being replaced.

---

## Troubleshooting

### Issue: No delivery partners showing
**Solution:**
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 10}' \
  http://localhost:8080/api/integration/synthetic/delivery-partners
```

### Issue: No orders ready for shipment
**Solution:** Orders need to be in `picked` or `ready_to_ship` status. Generate orders:
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"inboundCount": 5, "outboundCount": 10}' \
  http://localhost:8080/api/integration/synthetic/orders
```

### Issue: Empty dropdowns in forms
**Solution:** Generate master data first:
```bash
cd backend
./generate-synthetic.sh
```

---

## Summary

1. **Data is NOT auto-generated** - Must run scripts manually
2. **Data is persistent** - Saved to PostgreSQL database
3. **Frontend uses real data** - Loads from database via API
4. **Generate data first** - Run `./generate-synthetic.sh` before using system
5. **View database** - Use pgAdmin at http://localhost:5050
