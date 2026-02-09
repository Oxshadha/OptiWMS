# Quick Database Access - OptiWMS

## 🚀 Fastest Way to View Database

### Step 1: Start pgAdmin
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/infra
docker-compose up -d pgadmin
```

### Step 2: Open Browser
```
http://localhost:5050
```

### Step 3: Login
- **Email:** `admin@optiwms.com`
- **Password:** `admin123`

### Step 4: Connect to Database
1. Right-click "Servers" → "Register" → "Server"
2. **General:** Name = `OptiWMS Database`
3. **Connection:**
   - Host: `db` (or `localhost` if from host)
   - Port: `5432` (or `5434` if from host)
   - Database: `optiwms`
   - Username: `optiwms`
   - Password: `optiwms`
4. Click "Save"

### Step 5: Browse Data
- Navigate: **Servers** → **OptiWMS Database** → **Databases** → **optiwms** → **Schemas** → **public** → **Tables**
- Right-click any table → "View/Edit Data" → "All Rows"

---

## 📊 Quick Database Check

### Verify Data Exists:
```bash
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "
SELECT 
  (SELECT COUNT(*) FROM materials) as materials,
  (SELECT COUNT(*) FROM suppliers) as suppliers,
  (SELECT COUNT(*) FROM customers) as customers,
  (SELECT COUNT(*) FROM delivery_partners) as couriers,
  (SELECT COUNT(*) FROM inventory) as inventory_items;
"
```

**Expected Results (after synthetic generation):**
- Materials: ~300+ (from CSV import)
- Suppliers: 15 (synthetic)
- Customers: 30 (synthetic)
- Delivery Partners: 10 (synthetic)
- Inventory: varies (from CSV import)

---

## 🎯 All Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| **pgAdmin** | http://localhost:5050 | Database admin UI |
| **Backend API** | http://localhost:8080 | REST API |
| **Frontend** | http://localhost:3000 | Web application |
| **Database** | localhost:5434 | Direct PostgreSQL |

---

## ✅ Database is Good to Go!

Your database includes:
- ✅ All 4 migrations applied (V1-V4)
- ✅ Schema with international support
- ✅ AI service fields (optional)
- ✅ Raw/finished goods support
- ✅ Actual CSV data imported (materials, inventory)
- ✅ Synthetic data generated (suppliers, customers, couriers)

**Everything is ready!** 🎉

