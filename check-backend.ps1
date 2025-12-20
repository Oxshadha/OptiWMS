# OptiWMS Backend Status Checker

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "OptiWMS Backend Status Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check 1: Health Endpoint
Write-Host "1. Checking health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/actuator/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "   [OK] Backend is running!" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Green
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Backend is healthy and running!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "   [FAIL] Backend is not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Check 2: Java Processes
Write-Host "`n2. Checking Java processes..." -ForegroundColor Yellow
$javaProcesses = Get-Process | Where-Object {$_.ProcessName -eq "java"} -ErrorAction SilentlyContinue
if ($javaProcesses) {
    Write-Host "   Found $($javaProcesses.Count) Java process(es):" -ForegroundColor Green
    $javaProcesses | ForEach-Object {
        $memoryMB = [math]::Round($_.WorkingSet64/1MB, 2)
        $uptime = (Get-Date) - $_.StartTime
        Write-Host "   - PID: $($_.Id), Memory: ${memoryMB}MB, Uptime: $($uptime.ToString('mm\:ss'))" -ForegroundColor Cyan
    }
} else {
    Write-Host "   [WARN] No Java processes found" -ForegroundColor Yellow
}

# Check 3: Port 8080
Write-Host "`n3. Checking port 8080..." -ForegroundColor Yellow
$port8080 = netstat -ano 2>$null | Select-String ":8080"
if ($port8080) {
    Write-Host "   [INFO] Port 8080 is in use:" -ForegroundColor Green
    $port8080 | ForEach-Object { Write-Host "   $_" -ForegroundColor Cyan }
} else {
    Write-Host "   [INFO] Port 8080 is not in use" -ForegroundColor Yellow
    Write-Host "   (Backend may not have started yet)" -ForegroundColor Yellow
}

# Check 4: Database Connection
Write-Host "`n4. Checking database..." -ForegroundColor Yellow
$dbContainer = docker ps --filter "name=optiwms-db" --format "{{.Names}}" 2>$null
if ($dbContainer -match "optiwms-db") {
    $dbCheck = docker exec optiwms-db psql -U optiwms -d optiwms -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Database is accessible" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] Database connection failed" -ForegroundColor Red
        Write-Host "   Run: cd infra; .\setup-database.ps1" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [WARN] Database container not running" -ForegroundColor Yellow
    Write-Host "   Start it with: cd infra; docker-compose up -d db" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  If backend is not running:" -ForegroundColor Yellow
Write-Host "    1. Ensure database is ready: cd infra; .\setup-database.ps1" -ForegroundColor Cyan
Write-Host "    2. Start backend: cd backend; gradlew.bat :core-api:bootRun" -ForegroundColor Cyan
Write-Host "    3. Wait 30-60 seconds for startup" -ForegroundColor Cyan
Write-Host "    4. Run this script again to verify" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

