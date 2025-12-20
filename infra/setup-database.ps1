# OptiWMS Database Setup Script for Windows
# This script ensures the database exists and is properly configured

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "OptiWMS Database Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker status..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running or not installed!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Check if database container is running
Write-Host "Checking database container..." -ForegroundColor Yellow
$containerStatus = docker ps -a --filter "name=optiwms-db" --format "{{.Status}}"
if ($containerStatus -match "Up") {
    Write-Host "OK - Database container is running" -ForegroundColor Green
} else {
    Write-Host "Starting database container..." -ForegroundColor Yellow
    Set-Location $PSScriptRoot
    docker-compose up -d db
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to start database container!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Waiting for database to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Wait for database to be ready
Write-Host "Waiting for database to accept connections..." -ForegroundColor Yellow
$maxRetries = 30
$retryCount = 0
$dbReady = $false

while ($retryCount -lt $maxRetries -and -not $dbReady) {
    $result = docker exec optiwms-db pg_isready -U optiwms 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dbReady = $true
        Write-Host "OK - Database is ready" -ForegroundColor Green
    } else {
        $retryCount++
        Write-Host "  Retrying... ($retryCount/$maxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $dbReady) {
    Write-Host "ERROR: Database did not become ready in time!" -ForegroundColor Red
    exit 1
}

# Check if database exists
Write-Host "Checking if database 'optiwms' exists..." -ForegroundColor Yellow
$dbExists = docker exec optiwms-db psql -U optiwms -lqt 2>&1 | Select-String "optiwms"
if ($dbExists) {
    Write-Host "OK - Database 'optiwms' exists" -ForegroundColor Green
} else {
    Write-Host "Database 'optiwms' does not exist. Creating it..." -ForegroundColor Yellow
    docker exec optiwms-db psql -U optiwms -c "CREATE DATABASE optiwms;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK - Database 'optiwms' created successfully" -ForegroundColor Green
    } else {
        # Try connecting to postgres database first
        Write-Host "Attempting to create database via postgres database..." -ForegroundColor Yellow
        docker exec optiwms-db psql -U optiwms -d postgres -c "CREATE DATABASE optiwms;" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK - Database 'optiwms' created successfully" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Failed to create database!" -ForegroundColor Red
            Write-Host "You may need to create it manually:" -ForegroundColor Yellow
            Write-Host "  docker exec -it optiwms-db psql -U optiwms -d postgres" -ForegroundColor Cyan
            Write-Host "  CREATE DATABASE optiwms;" -ForegroundColor Cyan
            exit 1
        }
    }
}

# Verify connection
Write-Host "Verifying database connection..." -ForegroundColor Yellow
$connectionTest = docker exec optiwms-db psql -U optiwms -d optiwms -c "SELECT version();" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Database connection successful" -ForegroundColor Green
} else {
    Write-Host "WARNING: Could not verify connection, but database exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Database setup complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database is running on port 5435 (to avoid conflict with local PostgreSQL)" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now start the backend with:" -ForegroundColor Yellow
Write-Host "  cd backend" -ForegroundColor Cyan
Write-Host "  gradlew.bat :core-api:bootRun" -ForegroundColor Cyan
Write-Host ""

