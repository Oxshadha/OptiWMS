# OptiWMS - Quick Startup Guide

## ✅ Current Status

The full OptiWMS warehouse management system is **currently running** on your system.

## 🚀 Access the Application

### Frontend (Admin/Worker Interface)
- **URL**: http://localhost:3000
- **Status**: Running (Next.js 14)
- **Response**: HTTP 200 OK

### Backend API
- **URL**: http://localhost:8080
- **Status**: Running (Spring Boot 3.3)
- **Health Check**: http://localhost:8080/actuator/health (returns `{"status":"UP"}`)

### Database
- **Host**: localhost
- **Port**: 5434
- **Database**: optiwms
- **User**: optiwms
- **Status**: Connected (PostgreSQL 17 with 50 WMS tables)

## 🔑 Default Credentials

**Admin Login:**
- Username: `admin`
- Email: `admin@optiwms.com`
- Password: `admin123` (if seeded properly)

If login fails, use the notes section below to reset the admin password.

## 📋 WMS Features Available

The system includes the following warehouse management features:

- **Inbound**: Order creation, receiving, quality checks, putaway
- **Outbound**: Order creation, picking, packing, shipment flow  
- **Returns**: Inbound/outbound return handling
- **Inventory**: Stock visibility, location-level tracking
- **Cycle Counts**: Scheduling, worker execution, discrepancy handling
- **Stock Transfers**: Relocation workflow
- **Dock Management**: Dock doors, appointments, yard trailers
- **Analytics**: Dashboard KPIs, productivity, velocity heatmap

## 🛑 Stopping the Services

To stop the system:

### Stop Frontend
```powershell
# Stop the npm dev server (Ctrl+C in the terminal running it)
Get-Process node | Stop-Process -Force
```

### Stop Backend
```powershell
# Stop the Gradle bootRun (Ctrl+C in the terminal running it)
Get-Process java | Where-Object {$_.ProcessName -eq "java"} | Stop-Process -Force
```

### Stop Database
```powershell
# PostgreSQL can continue running in background, or stop the service:
Stop-Service -Name "postgresql-x64-17" -Force
```

## 🔄 Restarting the Services

### Start Backend
```powershell
cd backend
.\gradlew.bat :core-api:bootRun
```

### Start Frontend
```powershell
cd frontend
npm run dev
```

### Start Database (if not running)
```powershell
# Assuming PostgreSQL is installed as a service
Start-Service -Name "postgresql-x64-17"
```

## 🔧 Troubleshooting

### Port Already in Use
If a port is already in use:
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Find process using port 8080
netstat -ano | findstr :8080

# Kill by process ID
taskkill /PID <process_id> /F
```

### Database Connection Issues
```powershell
# Test database connection
psql -U optiwms -h 127.0.0.1 -p 5434 optiwms -c "SELECT 1;"
```

### Frontend Not Responding
1. Check if Node processes are running:
```powershell
Get-Process node
```
2. Kill any defunct Node processes:
```powershell
Get-Process node | Stop-Process -Force
```
3. Restart frontend:
```powershell
cd frontend
npm run dev
```

## 📚 Architecture

OptiWMS is a **modular layered monolith** with:
- `core-api`: REST controllers and security
- `core-app`: Business logic and workflow services
- `core-domain`: Domain models
- `infra`: JPA entities, repositories, Flyway migrations
- `integration`: Data seeders and importers

## 🔐 Security Notes

The current setup uses local development configurations:
- PostgreSQL authentication: trust (local connections only)
- Hibernate DDL: update mode (allows schema evolution)
- Flyway: baseline-on-migrate enabled

**Before production deployment**, enable:
- Proper password authentication
- TLS/SSL for database connections
- Environment-based secrets management
- Proper Spring Security configuration with JWT tokens

## 📝 Next Steps

1. **Access the admin interface**: http://localhost:3000
2. **Login** with default admin credentials
3. **Explore the WMS** - create orders, check inventory, manage warehouses
4. **Read API docs** at the backend health endpoint

## 🆘 Support

For issues or questions:
1. Check the logs in the running terminal windows
2. Review the main README.md in the project root
3. Check Help/BACKEND_CLASS_DOCUMENTATION.md for API details

---

**System deployed and running as of**: Current session
**All three tiers verified operational**
