# OptiWMS Infrastructure Setup

This directory contains Docker Compose configuration and database setup scripts for OptiWMS.

## Quick Start

### Start Database Only
```bash
docker-compose up -d db
```

### Setup Database (Ensures database exists)
```bash
# Windows
.\setup-database.ps1

# Mac/Linux
chmod +x setup-database.sh
./setup-database.sh
```

### Start All Services
```bash
docker-compose up -d
```

## Database Setup Scripts

### `setup-database.ps1` (Windows)
PowerShell script that:
- Checks if Docker is running
- Verifies database container is running
- Creates the `optiwms` database if it doesn't exist
- Verifies the connection

### `setup-database.sh` (Mac/Linux)
Bash script with the same functionality for Unix-based systems.

## Common Issues

### Database "optiwms" does not exist
Run the appropriate setup script:
- Windows: `.\setup-database.ps1`
- Mac/Linux: `./setup-database.sh`

### Container not starting
```bash
# Check Docker is running
docker ps

# View logs
docker logs optiwms-db

# Restart container
docker-compose restart db
```

### Reset everything (WARNING: Deletes all data)
```bash
docker-compose down -v
docker-compose up -d db
```

## Database Connection Details

- **Host**: localhost
- **Port**: 5434 (mapped from container port 5432)
- **Database**: optiwms
- **Username**: optiwms
- **Password**: optiwms

## Services

### Database (PostgreSQL 16)
- Container name: `optiwms-db`
- Port mapping: `5434:5432`
- Data volume: `db_data`
- Health check: Enabled

### Backend (Spring Boot)
- Container name: `optiwms-backend`
- Port mapping: `8080:8080`
- Depends on: Database service

### Frontend (Next.js)
- Container name: `optiwms-frontend`
- Port mapping: `3000:3000`
- Depends on: Backend service

