# OptiWMS Setup Guide

Complete guide to set up OptiWMS development environment on any machine (Mac, Windows, Linux).

## 📋 Prerequisites

### Required Software
- **Java Development Kit (JDK)**: Version 21 or 25
  - Mac: `brew install openjdk@21` or download from [Adoptium](https://adoptium.net/)
  - Windows: Download from [Adoptium](https://adoptium.net/) or use [Chocolatey](https://chocolatey.org/): `choco install openjdk21`
  - Linux: `sudo apt-get install openjdk-21-jdk` (Ubuntu/Debian) or `sudo yum install java-21-openjdk-devel` (RHEL/CentOS)

- **Node.js**: Version 20 or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Or use `nvm`: `nvm install 20 && nvm use 20`

- **Docker Desktop**: For database and optional containerized development
  - Mac: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
  - Windows: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
  - Linux: `sudo apt-get install docker.io docker-compose` (Ubuntu/Debian)

- **PostgreSQL**: Version 16 (optional if using Docker)
  - Mac: `brew install postgresql@16`
  - Windows: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
  - Linux: `sudo apt-get install postgresql-16` (Ubuntu/Debian)

- **Git**: For version control
  - Usually pre-installed, or download from [git-scm.com](https://git-scm.com/)

## 🚀 Quick Start (Recommended: Docker)

### Step 1: Clone the Repository
```bash
git clone <your-repo-url>
cd OptiWMS
```

### Step 2: Start Database with Docker
```bash
cd infra
docker-compose up -d db
```

Wait for database to be ready (about 10-15 seconds).

**Important:** Ensure the database is created before starting the backend:
```bash
# Windows (PowerShell)
.\setup-database.ps1

# Mac/Linux
chmod +x setup-database.sh
./setup-database.sh
```

Or manually verify:
```bash
docker exec optiwms-db psql -U optiwms -lqt | grep optiwms
```

### Step 3: Start Backend
```bash
cd ../backend
./gradlew :core-api:bootRun
```

**Windows users:** Use `gradlew.bat` instead:
```cmd
gradlew.bat :core-api:bootRun
```

### Step 4: Start Frontend (in a new terminal)
```bash
cd frontend
npm install
npm run dev
```

### Step 5: Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Health Check**: http://localhost:8080/actuator/health

## 🛠️ Manual Setup (Without Docker)

### Database Setup

#### Option A: Using Docker (Easiest)
```bash
cd infra
docker-compose up -d db
```

#### Option B: Local PostgreSQL Installation

1. **Create Database:**
```sql
CREATE DATABASE optiwms;
CREATE USER optiwms WITH PASSWORD 'optiwms';
GRANT ALL PRIVILEGES ON DATABASE optiwms TO optiwms;
```

2. **Update Connection Settings:**
Edit `backend/core-api/src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/optiwms
    username: optiwms
    password: optiwms
```

### Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Verify Java version:**
```bash
java -version  # Should show 21 or 25
```

3. **Build the project:**
```bash
./gradlew build -x test
```

**Windows users:**
```cmd
gradlew.bat build -x test
```

4. **Start the backend:**
```bash
./gradlew :core-api:bootRun
```

**Windows users:**
```cmd
gradlew.bat :core-api:bootRun
```

5. **Verify backend is running:**
```bash
curl http://localhost:8080/actuator/health
# Should return: {"status":"UP"}
```

### Frontend Setup

1. **Navigate to frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start development server:**
```bash
npm run dev
```

4. **Verify frontend is running:**
Open http://localhost:3000 in your browser

## 🐳 Full Docker Setup (All Services)

To run everything in Docker:

```bash
cd infra
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5435 (changed from 5434 to avoid conflict with local PostgreSQL)
- Backend API on port 8080
- Frontend on port 3000

**Note:** First build may take 5-10 minutes to download images and build.

## 🔧 Configuration

### Environment Variables

#### Backend
Create `backend/.env` (optional, defaults work for local dev):
```env
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5435/optiwms
SPRING_DATASOURCE_USERNAME=optiwms
SPRING_DATASOURCE_PASSWORD=optiwms
```

#### Frontend
Create `frontend/.env.local` (optional):
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

### Database Connection

Default connection (works with Docker setup):
- **Host**: localhost
- **Port**: 5435 (Docker - changed from 5434 to avoid conflict with local PostgreSQL) or 5432 (local PostgreSQL)
- **Database**: optiwms
- **Username**: optiwms
- **Password**: optiwms

**Note:** Port 5435 is used to avoid conflict with local PostgreSQL Server that may be running on port 5434.

## ✅ Verification Checklist

After setup, verify everything works:

### 1. Database
```bash
# Using Docker
docker ps | grep optiwms-db

# Or test connection
psql -h localhost -p 5435 -U optiwms -d optiwms
# Password: optiwms
```

### 2. Backend
```bash
# Health check
curl http://localhost:8080/actuator/health

# Test API (with authentication)
curl -u admin:admin123 http://localhost:8080/api/master/warehouses
```

### 3. Frontend
- Open http://localhost:3000
- Should see login page or dashboard
- No console errors

### 4. Integration
- Open http://localhost:3000/admin/warehouses
- Should load warehouses from backend API
- Try creating a new warehouse

## ⚡ Quick Fix: Database "optiwms" does not exist

If you see the error `FATAL: database "optiwms" does not exist` when starting the backend:

**Windows (PowerShell):**
```powershell
cd infra
.\setup-database.ps1
```

**Mac/Linux:**
```bash
cd infra
chmod +x setup-database.sh
./setup-database.sh
```

**Or manually:**
```bash
# Ensure Docker container is running
docker ps | grep optiwms-db

# Create database if it doesn't exist
docker exec optiwms-db psql -U optiwms -d postgres -c "CREATE DATABASE optiwms;"

# Verify
docker exec optiwms-db psql -U optiwms -d optiwms -c "SELECT 1;"
```

Then restart the backend:
```bash
cd backend
gradlew.bat :core-api:bootRun  # Windows
# or
./gradlew :core-api:bootRun    # Mac/Linux
```

## 🐛 Troubleshooting

### Port Already in Use

**Backend (8080):**
```bash
# Find process
lsof -i :8080  # Mac/Linux
netstat -ano | findstr :8080  # Windows

# Kill process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

**Frontend (3000):**
```bash
# Find process
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill process (same as above)
```

**Database (5435):**
```bash
# Stop Docker container
docker stop optiwms-db
```

### Gradle Issues

**Gradle wrapper not executable (Mac/Linux):**
```bash
chmod +x backend/gradlew
```

**Gradle daemon issues:**
```bash
cd backend
./gradlew --stop
./gradlew clean build
```

### Database Connection Issues

#### Error: "FATAL: database 'optiwms' does not exist"

This error occurs when the database hasn't been created yet. Here's how to fix it:

**Option 1: Use the setup script (Recommended)**
```bash
# Windows (PowerShell)
cd infra
.\setup-database.ps1

# Mac/Linux
cd infra
chmod +x setup-database.sh
./setup-database.sh
```

**Option 2: Manual database creation**
```bash
# Check if container is running
docker ps | grep optiwms-db

# Create database manually
docker exec optiwms-db psql -U optiwms -d postgres -c "CREATE DATABASE optiwms;"

# Verify database exists
docker exec optiwms-db psql -U optiwms -lqt | grep optiwms
```

**Option 3: Reset database container (WARNING: Deletes all data)**
```bash
cd infra
docker-compose down -v
docker-compose up -d db
# Wait 10-15 seconds for database to initialize
```

#### Other Database Issues

1. **Check if database is running:**
```bash
# Windows
docker ps | findstr optiwms-db

# Mac/Linux
docker ps | grep optiwms-db
```

2. **Check database logs:**
```bash
docker logs optiwms-db
```

3. **Test database connection:**
```bash
# Windows
docker exec optiwms-db psql -U optiwms -d optiwms -c "SELECT version();"

# Mac/Linux (same command)
docker exec optiwms-db psql -U optiwms -d optiwms -c "SELECT version();"
```

4. **Verify database exists:**
```bash
docker exec optiwms-db psql -U optiwms -lqt
```

5. **Check connection settings:**
- Verify `application.yml` has correct port (5435 for Docker, 5432 for local PostgreSQL)
- Verify username and password match Docker environment variables
- Check if firewall is blocking port 5435
- **Note:** Port was changed from 5434 to 5435 to avoid conflict with local PostgreSQL Server

### Java Version Issues

**Check Java version:**
```bash
java -version
javac -version
```

**Set JAVA_HOME (if needed):**
```bash
# Mac (Homebrew)
export JAVA_HOME=$(/usr/libexec/java_home -v 21)

# Linux
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk

# Windows (PowerShell)
$env:JAVA_HOME="C:\Program Files\Java\jdk-21"
```

### Node.js Issues

**Clear npm cache:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Use correct Node version:**
```bash
nvm use 20
```

## 📦 Project Structure

```
OptiWMS/
├── backend/              # Spring Boot backend
│   ├── core-api/        # REST API layer
│   ├── core-app/        # Business logic
│   ├── core-domain/     # Domain models
│   ├── infra/           # Infrastructure (JPA, repositories)
│   └── build.gradle.kts # Build configuration
├── frontend/            # Next.js frontend
│   ├── app/            # Next.js app directory
│   ├── components/     # React components
│   └── lib/            # Utilities and API clients
├── infra/              # Docker Compose configuration
│   └── docker-compose.yml
└── README.md
```

## 🔐 Default Credentials

**Backend API:**
- Username: `admin`
- Password: `admin123`

**Database (Docker):**
- Username: `optiwms`
- Password: `optiwms`
- Database: `optiwms`

**⚠️ Change these in production!**

## 🚀 Development Workflow

### 1. Start Services
```bash
# Terminal 1: Database
cd infra && docker-compose up -d db

# Terminal 2: Backend
cd backend && ./gradlew :core-api:bootRun

# Terminal 3: Frontend
cd frontend && npm run dev
```

### 2. Make Changes
- Backend changes: Restart backend (Ctrl+C, then `./gradlew :core-api:bootRun`)
- Frontend changes: Hot reload (automatic)
- Database changes: Create Flyway migration in `backend/infra/src/main/resources/db/migration/`

### 3. Test Changes
- Backend: Test API endpoints with `curl` or Postman
- Frontend: Check browser console and network tab
- Integration: Test full flow in browser

## 📝 Important Notes

### Cross-Platform Compatibility

✅ **Works on:**
- macOS (Intel & Apple Silicon)
- Windows 10/11
- Linux (Ubuntu, Debian, RHEL, etc.)

✅ **Gradle Wrapper:**
- Included in repository (`gradlew` for Unix, `gradlew.bat` for Windows)
- No need to install Gradle separately
- Automatically downloads correct Gradle version

✅ **Docker:**
- Works the same on all platforms
- Database setup is identical

### File Paths
- All paths in documentation use forward slashes (`/`)
- Windows users: Use backslashes (`\`) or Git Bash for Unix-style commands

### Line Endings
- Repository uses LF (Unix) line endings
- Git should auto-convert on Windows
- If issues occur: `git config core.autocrlf true`

## 🆘 Getting Help

If you encounter issues:

1. **Check logs:**
   - Backend: Terminal output or `backend/logs/`
   - Frontend: Browser console and terminal
   - Database: `docker logs optiwms-db`

2. **Verify prerequisites:**
   - Java 21+: `java -version`
   - Node 20+: `node -v`
   - Docker: `docker --version`

3. **Check common issues** in Troubleshooting section above

4. **Reset everything:**
   ```bash
   # Stop all services
   docker-compose down -v
   cd backend && ./gradlew clean
   cd ../frontend && rm -rf node_modules .next
   
   # Start fresh
   cd ../infra && docker-compose up -d db
   cd ../backend && ./gradlew :core-api:bootRun
   cd ../frontend && npm install && npm run dev
   ```

## ✅ Success Indicators

You're ready to develop when:

- ✅ Database is running and accessible
- ✅ Backend starts without errors
- ✅ Backend shows "Found 8 JPA repository interfaces"
- ✅ Backend health check returns `{"status":"UP"}`
- ✅ Frontend compiles without errors
- ✅ Frontend loads at http://localhost:3000
- ✅ Warehouses page loads data from backend API

## 🎯 Next Steps

1. **Explore the codebase:**
   - Backend APIs: `backend/core-api/src/main/java/com/optiwms/coreapi/`
   - Frontend pages: `frontend/app/`
   - Database schema: `backend/infra/src/main/resources/db/migration/V1__initial_schema.sql`

2. **Read documentation:**
   - `BACKEND_IMPLEMENTATION_PLAN.md` - Backend architecture
   - `FRONTEND_STRUCTURE.md` - Frontend structure
   - `DEVELOPMENT_GUIDE.md` - Development practices

3. **Start developing:**
   - Pick a feature from the plan
   - Create a branch: `git checkout -b feature/your-feature`
   - Make changes and test
   - Commit and push

Happy coding! 🚀

