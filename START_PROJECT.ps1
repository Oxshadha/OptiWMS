# OptiWMS Full Project Startup Script (PowerShell)
# This script starts all three components of the OptiWMS system

Write-Host ""
Write-Host "=========================================="
Write-Host "OptiWMS Full Project Launcher"
Write-Host "=========================================="
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "backend\gradlew.bat")) {
    Write-Host "ERROR: Please run this script from the OptiWMS root directory" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Starting OptiWMS components..." -ForegroundColor Green
Write-Host ""

# Check PostgreSQL is running
Write-Host "Checking PostgreSQL connection..." -ForegroundColor Yellow
$dbTest = &"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U optiwms -h 127.0.0.1 -p 5434 optiwms -c "SELECT 1;" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot connect to PostgreSQL on port 5434" -ForegroundColor Red
    Write-Host "Please ensure PostgreSQL is running and the optiwms database exists"
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host " ✓ PostgreSQL connected" -ForegroundColor Green

# Start Backend
Write-Host ""
Write-Host "Starting Backend (Spring Boot on port 8080)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; .\gradlew.bat :core-api:bootRun" -WindowStyle Normal
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend (Next.js on port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=========================================="
Write-Host "OptiWMS is starting..." -ForegroundColor Green
Write-Host "=========================================="
Write-Host ""
Write-Host "Frontend:  http://localhost:3000"
Write-Host "Backend:   http://localhost:8080"
Write-Host "Database:  localhost:5434"
Write-Host ""
Write-Host "Admin credentials:"
Write-Host "  Email:    admin@optiwms.com"
Write-Host "  Password: admin123"
Write-Host ""
Write-Host "NOTE: Three windows will open:"
Write-Host "  - Backend terminal (Gradle/Java)"
Write-Host "  - Frontend terminal (Node.js/npm)"
Write-Host "  - This launcher window"
Write-Host ""
Write-Host "Close any window to stop that component."
Write-Host ""
Read-Host "Press Enter to close this launcher"
