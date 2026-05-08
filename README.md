# OptiWMS

OptiWMS is a warehouse management system (WMS) with:
- Admin web app for planning, control, and reporting
- Worker mobile-first PWA for execution (receiving, putaway, picking, packing, shipping, cycle count, returns)
- Spring Boot + PostgreSQL backend with Flyway migrations

## Architecture

This project is a **modular layered monolith**:
- `backend/core-api`: REST controllers + security
- `backend/core-app`: business/workflow services
- `backend/core-domain`: domain models
- `backend/infra`: JPA entities, repositories, migrations
- `backend/integration`: seeders/importers/synthetic data helpers
- `frontend`: Next.js 14 App Router app (admin + worker UIs)

It is not a microservice architecture today. AI services are optional and additive.

## AI Services (Forecast Feature)

OptiWMS includes optional AI-powered forecasting capabilities:
- **Forecast Service**: Machine learning models for demand forecasting
- **Orchestrator Service**: Job scheduling and coordination
- **Shadow Mode**: Safe testing with automatic governance
- **Production Ready**: Quality gates and automatic model management

### Quick Start (AI Services)

1. **Prerequisites**
   ```bash
   # Ensure core services are running
   docker-compose -f infra/docker-compose.yml up -d
   ```

2. **Setup AI Services**
   ```bash
   cd ai-services
   cp .env.example .env
   # Edit .env with your configuration
   docker-compose -f docker-compose.ai.yml up -d
   ```

3. **Verify Installation**
   ```bash
   curl http://localhost:8091/health
   curl http://localhost:8092/health
   ```

### AI Service Architecture
- `ai-services/forecast-service/`: ML inference engine
- `ai-services/orchestrator-service/`: Job orchestration
- `ai-services/slotting-service/`: Inventory optimization (planned)

See [TEAM_COLLABORATION_GUIDE.md](TEAM_COLLABORATION_GUIDE.md) for team setup and [DEPLOYMENT_CHANGELOG.md](DEPLOYMENT_CHANGELOG.md) for implementation details.

## Tech Stack

- Backend: Java 21, Spring Boot 3.3, Spring Security, Spring Data JPA, Flyway
- Database: PostgreSQL 16
- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, DaisyUI
- Worker offline support: IndexedDB
- Infra/dev: Docker Compose (optional)

## Main Functional Areas

- Inbound: order creation, receiving, quality checks, putaway
- Outbound: order creation, picking, packing, shipment flow
- Returns: inbound/outbound return handling
- Inventory: stock visibility, location-level tracking
- Cycle counts: scheduling, worker execution, discrepancy handling
- Stock transfer: relocation workflow
- Dock management: dock doors, appointments, yard trailers (admin-oriented)
- Analytics: dashboard KPIs, productivity, velocity heatmap

## Repository Layout

```text
OptiWMS/
├── backend/
│   ├── core-api/
│   ├── core-app/
│   ├── core-domain/
│   ├── infra/
│   └── integration/
├── frontend/
├── infra/
│   └── docker-compose.yml
├── docs/
└── README.md
```

## Local Development Setup

### Prerequisites

- Java 21
- Node.js 18+
- npm
- Docker (optional, for DB/services)

### 1) Start PostgreSQL

Recommended:

```bash
docker compose -f infra/docker-compose.yml up -d db
```

Default local DB used by backend:
- host: `localhost`
- port: `5434`
- db: `optiwms`
- user: `optiwms`
- password: `optiwms`

### 2) Run Backend

```bash
cd backend
./gradlew bootRun
```

Backend runs at `http://localhost:8080`.

### 3) Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

Windows equivalents:

```powershell
cd backend
.\gradlew.bat :core-api:bootRun
```

```powershell
cd frontend
npm install
npm run dev
```

Helper scripts from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-db.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1
```

Optional AI agent:

```powershell
cd ai-services\ai-agent
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

If you want the frontend warehouse assistant to call the AI agent, copy
`frontend/.env.example` to `frontend/.env.local` and set:

```env
NEXT_PUBLIC_WAREHOUSE_AI_URL=http://localhost:8000/ask
```

## First-Run Troubleshooting

### 1) Frontend build error: `Module not found: Can't resolve '@tanstack/react-query'`

Run dependency install in `frontend`:

```bash
cd frontend
npm install
```

Windows clean reinstall (if still failing):

```powershell
cd frontend
rmdir /s /q node_modules
del package-lock.json
npm install
```

### 2) Cannot login with default admin (`admin@optiwms.com` / `admin123`)

Reason: if admin already exists in DB, seeder does not overwrite password.

Option A (SQL):

```sql
DELETE FROM users WHERE username='admin' OR email='admin@optiwms.com';
```

Option B (Docker command):

```bash
docker exec -it <postgres_container_name> psql -U postgres -d optiwms -c "DELETE FROM users WHERE username='admin' OR email='admin@optiwms.com';"
```

Then restart backend. Seeder recreates default admin for local development.

### 3) Backend startup fails during synthetic rack seeding

If startup fails in `RackDataSeeder` (location-code uniqueness/constraint issues), start backend with rack seeding disabled:

macOS/Linux:

```bash
cd backend
./gradlew :core-api:bootRun --args="--optiwms.seed.racks=false"
```

Windows:

```powershell
cd backend
.\gradlew.bat :core-api:bootRun --args="--optiwms.seed.racks=false"
```

This does not block normal API development; it only skips synthetic rack generation at startup.

### 4) Backend startup fails with Flyway migration validation/version errors

Common local causes:
- Duplicate migration version in `backend/infra/src/main/resources/db/migration`.
- Checksum mismatch in `flyway_schema_history` after editing an already-applied migration.

Quick checks:

```bash
cd backend/infra/src/main/resources/db/migration
ls V*.sql | sed 's/__.*//' | sort | uniq -d
```

If duplicates are found, keep historical versions stable and renumber only the new migration file.

If startup fails with checksum mismatch in local dev, repair the local DB history to match the current file checksum:

```bash
docker exec -i optiwms-db psql -U optiwms -d optiwms -c "SELECT version, description, checksum, success FROM flyway_schema_history ORDER BY installed_rank;"
```

Then update only the affected version checksum reported by Flyway:

```bash
docker exec -i optiwms-db psql -U optiwms -d optiwms -c "UPDATE flyway_schema_history SET checksum = <resolved_locally_checksum> WHERE version = '<version>';"
```

Re-run backend:

```bash
cd backend
./gradlew :core-api:bootRun
```

## Default Bootstrap Credentials (Dev Only)

Created by `backend/integration/src/main/java/com/optiwms/integration/UserSeederService.java`:

- Username: `admin`
- Email: `admin@optiwms.com`
- Password: `admin123`

These are for local development only. Do not use in production.

## Environment and Config

Primary backend config:
- `backend/core-api/src/main/resources/application.properties`
- `backend/core-api/src/main/resources/application.yml`

Key values to override in real environments:
- `JWT_SECRET`
- datasource URL/username/password
- allowed frontend origin/CORS
- seeding defaults for admin/dev accounts

Frontend API base URL is configured in:
- `frontend/lib/api/client.ts`

## API Surface

Core API base: `http://localhost:8080/api`

Major route groups include:
- `/api/orders`
- `/api/order-items`
- `/api/operations/*` (receiving, putaway, picking, packing, shipment, stock transfer, cycle count, returns)
- `/api/master/*` (materials, warehouses, locations, customers, suppliers)
- `/api/tasks`
- `/api/analytics/*`
- `/api/dock-management/*`
- `/api/reports`

## Build and Verification

Backend compile:

```bash
cd backend
./gradlew :core-app:compileJava :core-api:compileJava
```

Frontend build:

```bash
cd frontend
npm run build
```

## Docker (Full Stack)

To run DB + backend + frontend + pgAdmin:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Services:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- pgAdmin: `http://localhost:5050`

## Notes on Current State

- Core warehouse workflows are implemented and integrated.
- Some modules are still being refined continuously (UI/UX polish, deeper workflow hardening, and advanced operational controls).
- Dock management currently has strong admin coverage; worker-side dock execution is comparatively lighter.

## Useful Documents

- `QUICK_START.txt`
- `WMS_FLOW_DOCUMENTATION.md`
- `START_HERE_SECURITY.md`
- `START_HERE_TESTING.md`
- `DEPLOYMENT_STEP_BY_STEP.md`

## License


