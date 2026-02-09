# Quick Start Guide - Backend Development

## 🚀 Quick Start with Docker (Recommended)

### Prerequisites
- Docker Desktop installed (Mac/Windows)
- Git

### Steps

1. **Start all services**
```bash
cd infra
docker-compose up -d
```

2. **Check services are running**
```bash
docker-compose ps
```

3. **View logs**
```bash
# Backend logs
docker-compose logs -f backend

# Database logs
docker-compose logs -f db

# All logs
docker-compose logs -f
```

4. **Stop services**
```bash
docker-compose down
```

## 🛠️ Local Development (Without Docker)

### Prerequisites
- JDK 21 or 25
- PostgreSQL 16
- Node.js 20+

### Steps

1. **Start Database (Docker)**
```bash
cd infra
docker-compose up db -d
```

2. **Start Backend**
```bash
cd backend
./gradlew bootRun
```

3. **Start Frontend**
```bash
cd frontend
npm install
npm run dev
```

## 📝 Gradle Wrapper Setup

If Gradle wrapper is missing:

```bash
cd backend
gradle wrapper --gradle-version 8.5 --distribution-type all
```

Or manually create:
- `gradlew` / `gradlew.bat`
- `gradle/wrapper/gradle-wrapper.jar`
- `gradle/wrapper/gradle-wrapper.properties`

## 🔧 Troubleshooting

### Gradle Issues
- **Mac/Windows JDK mismatch**: Use Docker (recommended)
- **Gradle not found**: Use wrapper (`./gradlew` instead of `gradle`)
- **Build errors**: Check JDK version (should be 21)

### Docker Issues
- **Port conflicts**: Change ports in `docker-compose.yml`
- **Build fails**: Check Docker logs: `docker-compose logs backend`
- **Database connection**: Wait for health check (10-15 seconds)

### Database Connection
- **Host**: `localhost` (local) or `db` (Docker)
- **Port**: `5434` (local) or `5432` (Docker)
- **Database**: `optiwms`
- **User**: `optiwms`
- **Password**: `optiwms`

## 📚 Next Steps

1. Review `BACKEND_IMPLEMENTATION_PLAN.md`
2. Set up database schema
3. Import CSV data
4. Start implementing APIs

