# OptiWMS - Quick Start (Current Deployment)

## Status: ✅ RUNNING

The OptiWMS warehouse management system is **currently running** on your system with all three components operational.

## Quick Access

| Component | URL | Status |
|-----------|-----|--------|
| Admin/Worker Interface | http://localhost:3000 | ✅ Running |
| REST API | http://localhost:8080 | ✅ Running |
| API Health | http://localhost:8080/actuator/health | ✅ UP |
| Database | localhost:5434 | ✅ Connected |

## Login Credentials

**Default Admin Account:**
- Email: `admin@optiwms.com`
- Password: `admin123`

## What's Running

### Frontend (Next.js 14)
- Port: **3000**
- Status: Running (npm dev server)
- Technology: React 18, TypeScript, Tailwind CSS, DaisyUI
- Terminal: Open in VS Code terminal or separate window

### Backend (Spring Boot 3.3)
- Port: **8080**
- Status: Running (Gradle bootRun)
- Technology: Java 21, Spring Boot, Spring Security, JPA/Hibernate
- Terminal: Open in VS Code terminal or separate window

### Database (PostgreSQL 17)
- Port: **5434**
- Status: Running as Windows service
- Tables: 50+ initialized (WMS schema)
- User: `optiwms` / `optiwms`

## How to Stop Services

### Option 1: Ctrl+C in Terminal
If services are running in a terminal, press **Ctrl+C** to stop gracefully.

### Option 2: Kill Processes
```powershell
# Stop all Node.js processes (Frontend)
Get-Process node | Stop-Process -Force

# Stop all Java processes (Backend)
Get-Process java | Stop-Process -Force

# PostgreSQL continues running as service
```

## How to Restart Services

### Backend
```powershell
cd backend
.\gradlew.bat :core-api:bootRun
```

### Frontend
```powershell
cd frontend
npm run dev
```

### Both Services
Use the provided startup scripts:
- **Batch**: `START_PROJECT.bat` (Windows Command Prompt)
- **PowerShell**: `START_PROJECT.ps1` (PowerShell)

## Features Available

With the system running and logged in, you can:

✅ **Inbound Management**
- Create inbound orders
- Receive goods
- Perform quality checks
- Manage putaway operations

✅ **Outbound Management**
- Create sales orders
- Pick items for orders
- Pack shipments
- Manage shipping

✅ **Inventory Management**
- View stock levels by location
- Track material movements
- Check inventory visibility
- Monitor low stock items

✅ **Warehouse Operations**
- Manage warehouse locations
- Handle stock transfers
- Schedule cycle counts
- Track returns

✅ **Analytics & Reporting**
- View dashboard KPIs
- Monitor productivity
- Track velocity heatmaps
- Generate reports

## Database Management

### Connect to Database
```powershell
psql -U optiwms -h 127.0.0.1 -p 5434 optiwms
```

### Common Queries
```sql
-- List all users
SELECT id, email, username, role FROM users;

-- List warehouses
SELECT id, code, name, status FROM warehouses;

-- List current inventory
SELECT material_id, warehouse_id, location_code, quantity FROM inventory LIMIT 10;
```

### Reset Admin User (if locked out)
```sql
DELETE FROM users WHERE email='admin@optiwms.com';
```
Then restart the backend to recreate the admin user.

## Troubleshooting

### Frontend Not Loading
1. Verify port 3000 is open: `netstat -ano | findstr :3000`
2. Stop conflicting processes: `Get-Process node | Stop-Process -Force`
3. Restart frontend: `cd frontend && npm run dev`

### Backend Not Responding
1. Check port 8080: `netstat -ano | findstr :8080`
2. Check health: `curl http://localhost:8080/actuator/health`
3. Stop and restart: `Get-Process java | Stop-Process -Force` then restart

### Database Connection Failed
1. Verify PostgreSQL service: `Get-Service -Name "postgresql-x64-17"`
2. Test connection: `psql -U optiwms -h 127.0.0.1 -p 5434 optiwms -c "SELECT 1;"`
3. Restart PostgreSQL if needed: `Restart-Service -Name "postgresql-x64-17" -Force`

### Login Fails
1. Ensure backend is running with health UP
2. Verify credentials: admin@optiwms.com / admin123
3. Check database user exists: `psql -U optiwms -h 127.0.0.1 -p 5434 optiwms -c "SELECT * FROM users;"`
4. If user missing, restart backend to recreate

## Development Notes

### Project Structure
```
OptiWMS/
├── frontend/          # Next.js application
│   ├── app/          # App Router pages
│   ├── components/   # React components
│   └── lib/          # Utilities
├── backend/          # Spring Boot application
│   ├── core-api/     # REST controllers
│   ├── core-app/     # Business logic
│   ├── core-domain/  # Domain models
│   ├── infra/        # JPA entities, repos, migrations
│   └── integration/  # Seeders, importers
└── infra/            # Docker Compose configurations
```

### Modifying Code
- **Frontend**: Changes auto-reload (npm dev watches)
- **Backend**: Changes require rebuild and restart
  ```powershell
  cd backend
  .\gradlew.bat :core-api:bootRun  # Rebuilds on start
  ```
- **Database**: Use Flyway migrations for schema changes

### Running Tests
Backend tests:
```powershell
cd backend
.\gradlew.bat test
```

Frontend tests (if configured):
```powershell
cd frontend
npm test
```

## Production Deployment

Before deploying to production:

1. **Security**
   - Change default admin password
   - Configure proper database authentication (scram-sha-256)
   - Enable HTTPS/TLS
   - Setup environment variables for secrets

2. **Performance**
   - Enable connection pooling
   - Configure caching (Redis/Memcached)
   - Optimize database queries
   - Build frontend: `npm run build`

3. **Infrastructure**
   - Deploy to Docker/Kubernetes
   - Setup load balancing
   - Configure monitoring/alerting
   - Setup automated backups

4. **Validation**
   - Run full test suite
   - Performance testing
   - Security scanning
   - UAT testing

## Support & Documentation

- **Main README**: [README.md](README.md)
- **Backend Docs**: [Help/BACKEND_CLASS_DOCUMENTATION.md](Help/BACKEND_CLASS_DOCUMENTATION.md)
- **Database Schema**: [DB-schema.txt](DB-schema.txt)
- **Startup Guides**: [STARTUP_GUIDE.md](STARTUP_GUIDE.md)
- **Deployment Info**: [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)

## Next Steps

1. Open http://localhost:3000 in your browser
2. Login with admin@optiwms.com / admin123
3. Explore the warehouse management features
4. Create test data to familiarize yourself with the system
5. Check the documentation for detailed feature information

---

**System Status**: All components running and operational  
**Last Updated**: Current session  
**System Ready**: Yes
