# Database Viewing Guide - OptiWMS

## 🎯 Quick Access to Your Database

### Option 1: pgAdmin (Web Interface) - **RECOMMENDED** ⭐

pgAdmin is included in Docker Compose and provides a full-featured web interface.

#### Start pgAdmin:
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/infra
docker-compose up -d pgadmin
```

#### Access pgAdmin:
1. Open browser: **http://localhost:5050**
2. Login:
   - **Email:** `admin@optiwms.com`
   - **Password:** `admin123`

#### Connect to Database:
1. Right-click "Servers" → "Register" → "Server"
2. **General Tab:**
   - Name: `OptiWMS Database`
3. **Connection Tab:**
   - Host: `db` (or `localhost` if connecting from outside Docker)
   - Port: `5432` (inside Docker) or `5434` (from host)
   - Database: `optiwms`
   - Username: `optiwms`
   - Password: `optiwms`
   - ✅ Check "Save password"
4. Click "Save"

#### View Your Data:
- Navigate: **Servers** → **OptiWMS Database** → **Databases** → **optiwms** → **Schemas** → **public** → **Tables**
- Right-click any table → "View/Edit Data" → "All Rows"

---

### Option 2: Command Line (psql)

#### If using Docker:
```bash
docker exec -it optiwms-db psql -U optiwms -d optiwms
```

#### If PostgreSQL is installed locally:
```bash
psql -h localhost -p 5434 -U optiwms -d optiwms
```

#### Useful Commands:
```sql
-- List all tables
\dt

-- View table structure
\d materials

-- View data
SELECT * FROM materials LIMIT 10;
SELECT * FROM suppliers LIMIT 10;
SELECT * FROM customers LIMIT 10;
SELECT * FROM delivery_partners LIMIT 10;

-- Count records
SELECT COUNT(*) FROM materials;
SELECT COUNT(*) FROM suppliers;
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM delivery_partners;
SELECT COUNT(*) FROM inventory;

-- View recent data
SELECT * FROM materials ORDER BY created_at DESC LIMIT 20;
```

---

### Option 3: VS Code Extension

1. Install **PostgreSQL** extension in VS Code
2. Add connection:
   - Host: `localhost`
   - Port: `5434`
   - Database: `optiwms`
   - Username: `optiwms`
   - Password: `optiwms`
3. Browse tables and run queries directly in VS Code

---

## 📊 Check Database Status

### Verify Database is Running:
```bash
# Check Docker container
docker ps | grep optiwms-db

# Check if port is accessible
lsof -i :5434

# Test connection
docker exec -it optiwms-db pg_isready -U optiwms
```

### Check Migration Status:
```bash
# Connect to database
docker exec -it optiwms-db psql -U optiwms -d optiwms

# Check Flyway migration history
SELECT * FROM flyway_schema_history ORDER BY installed_rank;
```

---

## 🔍 Quick Database Queries

### View All Tables:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Check Data Counts:
```sql
-- Materials
SELECT COUNT(*) as material_count FROM materials;

-- Suppliers (should be 15 after synthetic generation)
SELECT COUNT(*) as supplier_count, country, COUNT(*) 
FROM suppliers 
GROUP BY country;

-- Customers (should be 30 after synthetic generation)
SELECT COUNT(*) as customer_count, country, COUNT(*) 
FROM customers 
GROUP BY country;

-- Delivery Partners (should be 10 after synthetic generation)
SELECT COUNT(*) as courier_count, carrier_type, COUNT(*) 
FROM delivery_partners 
GROUP BY carrier_type;

-- Inventory
SELECT COUNT(*) as inventory_count FROM inventory;
```

### View Sample Data:
```sql
-- Suppliers by country
SELECT code, name, country, country_code, currency_code, lead_time_days, rating
FROM suppliers
ORDER BY country, code
LIMIT 20;

-- Customers by country
SELECT code, name, country, country_code, priority_tier, lifetime_value
FROM customers
ORDER BY country, priority_tier DESC
LIMIT 20;

-- Delivery Partners
SELECT partner_code, company_name, country, carrier_type, rating, cost_per_delivery
FROM delivery_partners
ORDER BY carrier_type, rating DESC;
```

---

## 🐳 Docker Commands

### Start All Services (Database + pgAdmin):
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/infra
docker-compose up -d db pgadmin
```

### Start Full Stack (Database + Backend + Frontend + pgAdmin):
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/infra
docker-compose up -d
```

### View Logs:
```bash
# Database logs
docker-compose logs -f db

# pgAdmin logs
docker-compose logs -f pgadmin

# All logs
docker-compose logs -f
```

### Stop Services:
```bash
docker-compose stop
# or
docker-compose down
```

### Reset Database (⚠️ WARNING: Deletes all data):
```bash
docker-compose down -v
docker-compose up -d db
# Then restart backend to run migrations
```

---

## ✅ Database Health Check

### Verify Everything is Working:
```bash
# 1. Check database is running
docker ps | grep optiwms-db

# 2. Check migrations ran
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "SELECT COUNT(*) FROM flyway_schema_history;"

# 3. Check tables exist
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "\dt"

# 4. Check data exists
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "SELECT COUNT(*) FROM materials;"
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "SELECT COUNT(*) FROM suppliers;"
```

---

## 📝 Database Connection Details

### Local Development (Outside Docker):
- **Host:** `localhost`
- **Port:** `5434`
- **Database:** `optiwms`
- **Username:** `optiwms`
- **Password:** `optiwms`

### Docker Network (Inside Docker):
- **Host:** `db`
- **Port:** `5432`
- **Database:** `optiwms`
- **Username:** `optiwms`
- **Password:** `optiwms`

---

## 🎨 pgAdmin Features

Once connected, you can:
- ✅ Browse all tables and views
- ✅ View and edit data
- ✅ Run SQL queries
- ✅ Export data to CSV/JSON
- ✅ View table structures
- ✅ Check indexes and constraints
- ✅ Monitor database performance
- ✅ View query execution plans

---

## 🚀 Quick Start

1. **Start pgAdmin:**
   ```bash
   cd /Users/k.e.oshada/Documents/OptiWMS/infra
   docker-compose up -d pgadmin
   ```

2. **Open Browser:**
   ```
   http://localhost:5050
   ```

3. **Login:**
   - Email: `admin@optiwms.com`
   - Password: `admin123`

4. **Connect to Database:**
   - Host: `db` (or `localhost` if from host)
   - Port: `5432` (or `5434` if from host)
   - Database: `optiwms`
   - Username: `optiwms`
   - Password: `optiwms`

5. **Browse Your Data!** 🎉

---

**Last Updated:** 2025-12-29  
**Status:** ✅ Ready to Use

