# OptiWMS - Warehouse Management System

A comprehensive Warehouse Management System (WMS) with AI-ready architecture, built with Spring Boot and Next.js.

## 🚀 Quick Start

### Prerequisites

- Java 17+
- Node.js 18+
- PostgreSQL 16+ (or Docker)
- Docker & Docker Compose (optional)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/OptiWMS.git
   cd OptiWMS
   ```

2. **Configure environment**
   ```bash
   # Copy example files
   cp .env.example .env
   cp backend/core-api/src/main/resources/application.properties.example \
      backend/core-api/src/main/resources/application.properties
   cp infra/docker-compose.yml.example infra/docker-compose.yml
   
   # Generate JWT secret
   export JWT_SECRET=$(openssl rand -base64 64)
   echo "JWT_SECRET=$JWT_SECRET" >> .env
   
   # Edit .env and set your values
   nano .env
   ```

3. **Start database**
   ```bash
   docker-compose -f infra/docker-compose.yml up -d db
   ```

4. **Start backend**
   ```bash
   cd backend
   ./gradlew bootRun
   ```

5. **Start frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Access application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - pgAdmin: http://localhost:5050

## 📋 Default Credentials

**Admin Login:**
- Username: `admin`
- Password: `admin123` (⚠️ Change in production!)

**Database:**
- Database: `optiwms`
- Username: `optiwms`
- Password: Set in `.env` file

## 🏗️ Architecture

- **Backend**: Spring Boot (Modular Monolith with Clean Architecture)
- **Frontend**: Next.js 14 (Admin Dashboard + Worker PWA)
- **Database**: PostgreSQL 16
- **AI Services**: Optional microservices (graceful degradation)

## ✨ Features

- ✅ Complete WMS operations (Receiving, Putaway, Picking, Shipping)
- ✅ Role-based access control (Admin, Warehouse Manager, Workers)
- ✅ Offline-first Worker PWA (IndexedDB)
- ✅ Real-time notifications
- ✅ Inventory management
- ✅ Order processing
- ✅ Cycle counting
- ✅ Stock transfers
- ✅ Analytics and reporting
- ✅ AI-ready architecture (optional enhancements)

## 📚 Documentation

- [Quick Start Guide](./QUICK_START.md)
- [Security Guide](./START_HERE_SECURITY.md)
- [Testing Guide](./START_HERE_TESTING.md)
- [Deployment Guide](./DEPLOYMENT_STEP_BY_STEP.md)
- [AI Integration](./AI_INTEGRATION_ARCHITECTURE.md)
- [How System Works Without AI](./HOW_SYSTEM_WORKS_WITHOUT_AI.md)

## 🔒 Security

- ✅ JWT authentication
- ✅ Password hashing (BCrypt)
- ✅ Security headers
- ✅ Rate limiting
- ✅ Production-safe logging
- ✅ Connection pooling
- ✅ Input validation

## 🛠️ Technology Stack

**Backend:**
- Spring Boot 3.2
- PostgreSQL 16
- Flyway (migrations)
- HikariCP (connection pooling)
- JWT authentication

**Frontend:**
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS + DaisyUI
- React Query (caching)
- IndexedDB (offline storage)

## 📦 Docker

```bash
# Start all services
docker-compose -f infra/docker-compose.yml up -d

# Stop all services
docker-compose -f infra/docker-compose.yml down
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

[Your License Here]

## 👥 Authors

[Your Name/Team]

---

**For detailed setup instructions, see [QUICK_START.md](./QUICK_START.md)**
