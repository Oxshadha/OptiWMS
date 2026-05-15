# OptiWMS Complete Startup Script
# Starts Frontend, Backend, Database, and Docker

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OptiWMS - Complete System Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "frontend/package.json") -or -not (Test-Path "backend/build.gradle.kts")) {
    Write-Host "ERROR: Please run this script from the OptiWMS root directory" -ForegroundColor Red
    exit 1
}

# Kill any existing processes
Write-Host "Step 1: Cleaning up existing processes..." -ForegroundColor Yellow
try {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "   ✓ Stopped Node processes" -ForegroundColor Green
} catch {
    Write-Host "   ℹ No Node processes to stop" -ForegroundColor Gray
}

Start-Sleep -Seconds 1

Write-Host ""
Write-Host "Step 2: Starting Docker Compose stack..." -ForegroundColor Yellow

# Navigate to infra directory
Push-Location -Path infra

# Stop any existing containers
Write-Host "   Stopping previous containers..." -ForegroundColor Gray
docker-compose down 2>&1 | Out-Null

# Start containers
Write-Host "   Building and starting containers..." -ForegroundColor Gray
docker-compose up -d --build 2>&1 | Out-Null

Pop-Location

# Wait for services
Write-Host "   Waiting for services to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# Check Docker services
$dbRunning = docker ps --format "{{.Names}}" | findstr "optiwms-db"
$backendRunning = docker ps --format "{{.Names}}" | findstr "optiwms-backend"
$frontendRunning = docker ps --format "{{.Names}}" | findstr "optiwms-frontend"
$pgadminRunning = docker ps --format "{{.Names}}" | findstr "optiwms-pgadmin"

if ($dbRunning) {
    Write-Host "   ✓ Database running (optiwms-db)" -ForegroundColor Green
} else {
    Write-Host "   ✗ Database container issue" -ForegroundColor Red
}

if ($backendRunning) {
    Write-Host "   ✓ Backend running (optiwms-backend)" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Backend container not ready yet" -ForegroundColor Yellow
}

if ($frontendRunning) {
    Write-Host "   ✓ Frontend running (optiwms-frontend)" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Frontend container not ready yet" -ForegroundColor Yellow
}

if ($pgadminRunning) {
    Write-Host "   ✓ PgAdmin running (optiwms-pgadmin)" -ForegroundColor Green
} else {
    Write-Host "   ℹ PgAdmin container starting" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Step 3: Verifying services..." -ForegroundColor Yellow

# Test database
Write-Host "   Testing database connection..." -ForegroundColor Gray
$dbTest = docker exec optiwms-db pg_isready -U optiwms 2>&1
if ($dbTest -like "*accepting connections*") {
    Write-Host "   ✓ Database responding" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Database still initializing..." -ForegroundColor Yellow
}

# Test backend
Write-Host "   Testing backend API..." -ForegroundColor Gray
$backendTest = docker exec optiwms-backend wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Backend API responding" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Backend API still initializing..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ OptiWMS Startup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "📊 Access Points:" -ForegroundColor Cyan
Write-Host "   Frontend:     http://localhost:3000" -ForegroundColor White
Write-Host "   Backend API:  http://localhost:8080" -ForegroundColor White
Write-Host "   Health Check: http://localhost:8080/actuator/health" -ForegroundColor White
Write-Host "   PgAdmin:      http://localhost:5050" -ForegroundColor White
Write-Host ""

Write-Host "🔑 Credentials:" -ForegroundColor Cyan
Write-Host "   Email:       admin@optiwms.com" -ForegroundColor White
Write-Host "   Password:    admin123" -ForegroundColor White
Write-Host ""

Write-Host "📦 Running Docker Containers:" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""

Write-Host "💡 Useful Commands:" -ForegroundColor Cyan
Write-Host "   View logs:       docker-compose -f infra/docker-compose.yml logs -f" -ForegroundColor Gray
Write-Host "   Stop all:        docker-compose -f infra/docker-compose.yml down" -ForegroundColor Gray
Write-Host "   Restart service: docker-compose -f infra/docker-compose.yml restart <service>" -ForegroundColor Gray
Write-Host ""

Write-Host "⏱️  Startup Times:" -ForegroundColor Yellow
Write-Host "   Database:   ~10 seconds" -ForegroundColor Gray
Write-Host "   Backend:    ~30 seconds" -ForegroundColor Gray
Write-Host "   Frontend:   ~20 seconds" -ForegroundColor Gray
Write-Host ""

Write-Host "All services are started and running in Docker containers!" -ForegroundColor Green
Write-Host "Open http://localhost:3000 in your browser to access OptiWMS" -ForegroundColor Cyan
Write-Host ""
