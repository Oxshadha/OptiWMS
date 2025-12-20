# OptiWMS Backend Startup Script
# This script ensures all prerequisites are met and starts the backend

param(
    [switch]$Force,
    [switch]$SkipChecks
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OptiWMS Backend Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Function to check if port is in use
function Test-Port {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $connection
}

# Function to kill process on port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        try {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process -and $process.ProcessName -eq "java") {
                Write-Host "Stopping Java process (PID: $($process.Id)) on port $Port..." -ForegroundColor Yellow
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
                Write-Host "Process stopped." -ForegroundColor Green
            }
        } catch {
            Write-Host "Could not stop process: $_" -ForegroundColor Yellow
        }
    }
}

# Check 1: Verify we're in the right directory
Write-Host "1. Checking directory..." -ForegroundColor Yellow
if (-not (Test-Path "backend\gradlew.bat")) {
    Write-Host "ERROR: Please run this script from the project root directory!" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}
Write-Host "   [OK] In correct directory" -ForegroundColor Green

# Check 2: Verify Java is installed
Write-Host "`n2. Checking Java..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-String "version"
    if ($javaVersion -match "21|25") {
        Write-Host "   [OK] Java is installed: $javaVersion" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] Java version may not be 21 or 25: $javaVersion" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [ERROR] Java is not installed or not in PATH!" -ForegroundColor Red
    exit 1
}

# Check 3: Verify Docker is running
Write-Host "`n3. Checking Docker..." -ForegroundColor Yellow
try {
    $dockerStatus = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Docker is running" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] Docker is not running!" -ForegroundColor Red
        Write-Host "   Please start Docker Desktop and try again." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   [ERROR] Docker is not installed or not in PATH!" -ForegroundColor Red
    exit 1
}

# Check 4: Verify database container is running
Write-Host "`n4. Checking database container..." -ForegroundColor Yellow
$dbContainer = docker ps --filter "name=optiwms-db" --format "{{.Names}}" 2>&1
if ($dbContainer -match "optiwms-db") {
    Write-Host "   [OK] Database container is running" -ForegroundColor Green
} else {
    Write-Host "   [WARN] Database container not running. Starting it..." -ForegroundColor Yellow
    Set-Location "infra"
    docker-compose up -d db
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Database container started. Waiting 10 seconds..." -ForegroundColor Green
        Start-Sleep -Seconds 10
    } else {
        Write-Host "   [ERROR] Failed to start database container!" -ForegroundColor Red
        exit 1
    }
    Set-Location ".."
}

# Check 5: Verify database exists
Write-Host "`n5. Verifying database..." -ForegroundColor Yellow
$dbCheck = docker exec optiwms-db psql -U optiwms -d optiwms -c "SELECT 1;" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Database is accessible" -ForegroundColor Green
} else {
    Write-Host "   [WARN] Database may not exist. Running setup script..." -ForegroundColor Yellow
    Set-Location "infra"
    .\setup-database.ps1
    Set-Location ".."
}

# Check 6: Check port 8080
Write-Host "`n6. Checking port 8080..." -ForegroundColor Yellow
if (Test-Port -Port 8080) {
    Write-Host "   [WARN] Port 8080 is already in use!" -ForegroundColor Yellow
    
    if ($Force) {
        Write-Host "   Force flag set. Attempting to free port 8080..." -ForegroundColor Cyan
        Stop-ProcessOnPort -Port 8080
        Start-Sleep -Seconds 2
        
        if (Test-Port -Port 8080) {
            Write-Host "   [ERROR] Could not free port 8080. Please manually stop the process using it." -ForegroundColor Red
            Write-Host "   Run: netstat -ano | findstr :8080" -ForegroundColor Cyan
            Write-Host "   Then: taskkill /PID <PID> /F" -ForegroundColor Cyan
            exit 1
        } else {
            Write-Host "   [OK] Port 8080 is now available" -ForegroundColor Green
        }
    } else {
        Write-Host "   [INFO] Port 8080 is in use. Use -Force flag to automatically stop the process." -ForegroundColor Cyan
        Write-Host "   Or manually stop it with: taskkill /PID <PID> /F" -ForegroundColor Cyan
        Write-Host "   Find PID with: netstat -ano | findstr :8080" -ForegroundColor Cyan
        exit 1
    }
} else {
    Write-Host "   [OK] Port 8080 is available" -ForegroundColor Green
}

# Check 7: Verify port 5435 (database) is accessible
Write-Host "`n7. Checking database port 5435..." -ForegroundColor Yellow
if (Test-Port -Port 5435) {
    Write-Host "   [OK] Database port 5435 is accessible" -ForegroundColor Green
} else {
    Write-Host "   [WARN] Database port 5435 is not accessible" -ForegroundColor Yellow
    Write-Host "   This might be okay if Docker networking is used" -ForegroundColor Cyan
}

# All checks passed, start backend
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Starting backend..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "backend"

try {
    .\gradlew.bat :core-api:bootRun
} catch {
    Write-Host "`n[ERROR] Backend failed to start: $_" -ForegroundColor Red
    Set-Location ".."
    exit 1
} finally {
    Set-Location ".."
}

