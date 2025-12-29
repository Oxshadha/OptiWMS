# Docker Setup Complete - OptiWMS

## ✅ What's Included

### Services in Docker Compose:

1. **PostgreSQL Database** (`db`)
   - Port: `5434` (host) → `5432` (container)
   - Database: `optiwms`
   - User: `optiwms` / Password: `optiwms`
   - Includes all migrations (V1-V4)
   - Persistent data volume

2. **Backend API** (`backend`)
   - Port: `8080`
   - Spring Boot application
   - Auto-connects to database
   - Runs migrations on startup

3. **Frontend** (`frontend`)
   - Port: `3000`
   - Next.js application
   - Connects to backend API

4. **pgAdmin** (`pgadmin`) ⭐ **NEW**
   - Port: `5050`
   - Web-based database administration
   - Access: http://localhost:5050
   - Login: `admin@optiwms.com` / `admin123`

---

## 🚀 Quick Start

### Start Everything:
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/infra
docker-compose up -d
```

### Start Only Database + pgAdmin:
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/infra
docker-compose up -d db pgadmin
```

### View Logs:
```bash
docker-compose logs -f
```

### Stop Everything:
```bash
docker-compose down
```

---

## 📊 Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **pgAdmin** | http://localhost:5050 | admin@optiwms.com / admin123 |
| **Backend API** | http://localhost:8080 | admin / admin123 |
| **Frontend** | http://localhost:3000 | - |
| **Database** | localhost:5434 | optiwms / optiwms |

---

## 🔧 Database Connection

### From Host Machine:
- **Host:** `localhost`
- **Port:** `5434`
- **Database:** `optiwms`
- **Username:** `optiwms`
- **Password:** `optiwms`

### From Docker Containers:
- **Host:** `db`
- **Port:** `5432`
- **Database:** `optiwms`
- **Username:** `optiwms`
- **Password:** `optiwms`

---

## 📝 Database Status

### Check if Database is Ready:
```bash
# Check container status
docker ps | grep optiwms-db

# Check migrations
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "SELECT version, description FROM flyway_schema_history ORDER BY installed_rank;"

# Check tables
docker exec -it optiwms-db psql -U optiwms -d optiwms -c "\dt"
```

### Expected Migrations:
- ✅ V1__initial_schema.sql
- ✅ V2__seed_initial_data.sql
- ✅ V3__add_delivery_partners.sql
- ✅ V4__finalized_schema_with_ai_support.sql

---

## 🎯 View Database in pgAdmin

1. **Start pgAdmin:**
   ```bash
   docker-compose up -d pgadmin
   ```

2. **Open Browser:**
   ```
   http://localhost:5050
   ```

3. **Login:**
   - Email: `admin@optiwms.com`
   - Password: `admin123`

4. **Add Server:**
   - Name: `OptiWMS Database`
   - Host: `db` (or `localhost` if connecting from host)
   - Port: `5432` (or `5434` if from host)
   - Database: `optiwms`
   - Username: `optiwms`
   - Password: `optiwms`

5. **Browse Tables:**
   - Navigate: Servers → OptiWMS Database → Databases → optiwms → Schemas → public → Tables
   - Right-click any table → "View/Edit Data"

---

## 🔄 Update Database Schema

The database schema is managed by Flyway migrations. When you add new migrations:

1. **Add migration file:**
   ```
   backend/infra/src/main/resources/db/migration/V5__your_migration.sql
   ```

2. **Restart backend:**
   ```bash
   docker-compose restart backend
   ```

3. **Migrations run automatically** on startup

---

## 🗑️ Reset Database (⚠️ WARNING)

**This will delete all data!**

```bash
# Stop and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d db

# Restart backend to run migrations
docker-compose up -d backend
```

---

## 📦 Volumes

Data is persisted in Docker volumes:
- `db_data` - PostgreSQL data
- `pgadmin_data` - pgAdmin settings
- `backend_build` - Backend build cache

To view volumes:
```bash
docker volume ls | grep optiwms
```

---

## 🐛 Troubleshooting

### Database not starting:
```bash
# Check logs
docker-compose logs db

# Check if port is in use
lsof -i :5434
```

### pgAdmin not accessible:
```bash
# Check if running
docker ps | grep pgadmin

# Check logs
docker-compose logs pgadmin

# Restart
docker-compose restart pgadmin
```

### Backend can't connect to database:
```bash
# Verify database is healthy
docker-compose ps

# Check backend logs
docker-compose logs backend

# Verify network
docker network inspect infra_optiwms-network
```

---

## ✅ Verification Checklist

- [ ] Database container is running
- [ ] pgAdmin is accessible at http://localhost:5050
- [ ] All 4 migrations have run (check flyway_schema_history)
- [ ] Tables exist (materials, suppliers, customers, delivery_partners, etc.)
- [ ] Can connect from pgAdmin
- [ ] Can view data in tables
- [ ] Backend can connect to database
- [ ] Synthetic data was generated (15 suppliers, 10 couriers, 30 customers)

---

**Last Updated:** 2025-12-29  
**Status:** ✅ Ready to Use

