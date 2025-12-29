# Team Database Access Guide - OptiWMS

## 🚀 Quick Start (All Platforms: Windows, Linux, Mac)

### Prerequisites
- Docker Desktop installed and running
- Git repository cloned

### Step 1: Start Database + pgAdmin
```bash
cd infra
docker-compose up -d db pgadmin
```

**Wait 10-15 seconds** for services to start.

### Step 2: Access pgAdmin (Web Interface)
1. Open browser: **http://localhost:5050**
2. Login:
   - **Email:** `admin@optiwms.com`
   - **Password:** `admin123`

### Step 3: Connect to Database
1. Right-click **"Servers"** → **"Register"** → **"Server"**
2. **General Tab:**
   - Name: `OptiWMS Database`
3. **Connection Tab:**
   - **Host:** `db` (or `localhost` if connecting from outside Docker)
   - **Port:** `5432` (or `5434` if from host machine)
   - **Database:** `optiwms`
   - **Username:** `optiwms`
   - **Password:** `optiwms`
   - ✅ Check **"Save password"**
4. Click **"Save"**

### Step 4: Browse Data
Navigate: **Servers** → **OptiWMS Database** → **Databases** → **optiwms** → **Schemas** → **public** → **Tables**

Right-click any table → **"View/Edit Data"** → **"All Rows"**

---

## 📊 Quick Database Check

### Verify Database is Running:
```bash
# Check containers
docker ps | grep optiwms

# Windows PowerShell:
docker ps | Select-String optiwms
```

### Check Data Counts:
```bash
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "
SELECT 
  (SELECT COUNT(*) FROM materials) as materials,
  (SELECT COUNT(*) FROM suppliers) as suppliers,
  (SELECT COUNT(*) FROM customers) as customers,
  (SELECT COUNT(*) FROM delivery_partners) as couriers,
  (SELECT COUNT(*) FROM inventory) as inventory;
"
```

---

## 🔧 Troubleshooting

### pgAdmin Not Accessible?
```bash
# Check if running
docker ps | grep pgadmin

# Restart pgAdmin
cd infra
docker-compose restart pgadmin

# View logs
docker-compose logs pgadmin
```

### Database Not Starting?
```bash
# Check logs
cd infra
docker-compose logs db

# Restart database
docker-compose restart db
```

### Port Already in Use?
```bash
# Check what's using port 5050 (pgAdmin)
# Windows:
netstat -ano | findstr :5050

# Linux/Mac:
lsof -i :5050

# Check port 5434 (database)
# Windows:
netstat -ano | findstr :5434

# Linux/Mac:
lsof -i :5434
```

---

## 🎯 Alternative: Command Line Access

### Connect via psql:
```bash
docker exec -it optiwms-db psql -U optiwms -d optiwms
```

### Useful Commands:
```sql
-- List all tables
\dt

-- View table structure
\d materials

-- View data
SELECT * FROM materials LIMIT 10;
SELECT * FROM suppliers LIMIT 10;
SELECT * FROM customers LIMIT 10;

-- Count records
SELECT COUNT(*) FROM materials;
SELECT COUNT(*) FROM suppliers;
```

---

## 📝 Connection Details

| Service | URL/Port | Credentials |
|---------|----------|------------|
| **pgAdmin** | http://localhost:5050 | admin@optiwms.com / admin123 |
| **Database** | localhost:5434 | optiwms / optiwms |
| **Backend API** | http://localhost:8080 | admin / admin123 |

---

## ✅ First Time Setup

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd OptiWMS
   ```

2. **Start database:**
   ```bash
   cd infra
   docker-compose up -d db pgadmin
   ```

3. **Wait for database to be ready** (10-15 seconds)

4. **Access pgAdmin:** http://localhost:5050

5. **Connect to database** (see Step 3 above)

---

## 🎉 You're Ready!

Your database includes:
- ✅ All migrations applied (V1-V4)
- ✅ Schema with international support
- ✅ Actual CSV data (300+ materials)
- ✅ Synthetic data (15 suppliers, 30 customers, 10 couriers)

**Happy coding!** 🚀

---

**Last Updated:** 2025-12-29  
**Works on:** Windows, Linux, Mac

