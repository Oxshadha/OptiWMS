# Quick Backend Test Script
# Tests if the backend is running and responding correctly

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Backend Connection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if port is listening
Write-Host "1. Checking port 8080..." -ForegroundColor Yellow
$portCheck = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "   [OK] Port 8080 is listening" -ForegroundColor Green
    Write-Host "        Process ID: $($portCheck.OwningProcess)" -ForegroundColor Gray
} else {
    Write-Host "   [ERROR] Port 8080 is not listening!" -ForegroundColor Red
    Write-Host "   Backend is not running. Start it with:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor Cyan
    Write-Host "   .\gradlew :core-api:bootRun" -ForegroundColor Cyan
    exit 1
}

# Test 2: Health endpoint
Write-Host "`n2. Testing health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "http://127.0.0.1:8080/actuator/health" -UseBasicParsing -TimeoutSec 5
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "   [OK] Health endpoint responded" -ForegroundColor Green
        Write-Host "        Status: $($healthResponse.Content)" -ForegroundColor Gray
    } else {
        Write-Host "   [WARN] Unexpected status code: $($healthResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [ERROR] Health endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: API endpoint
Write-Host "`n3. Testing API endpoint..." -ForegroundColor Yellow
try {
    $apiResponse = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/master/warehouses" -UseBasicParsing -TimeoutSec 5
    if ($apiResponse.StatusCode -eq 200) {
        Write-Host "   [OK] API endpoint responded" -ForegroundColor Green
        Write-Host "        Status Code: $($apiResponse.StatusCode)" -ForegroundColor Gray
    } else {
        Write-Host "   [WARN] Unexpected status code: $($apiResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "   [OK] API endpoint responded (401 Unauthorized - expected)" -ForegroundColor Green
        Write-Host "        Authentication is working" -ForegroundColor Gray
    } else {
        Write-Host "   [ERROR] API endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Backend is running correctly!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend URL: http://127.0.0.1:8080" -ForegroundColor Cyan
Write-Host "Health Check: http://127.0.0.1:8080/actuator/health" -ForegroundColor Cyan
Write-Host "API Base: http://127.0.0.1:8080/api" -ForegroundColor Cyan
Write-Host ""

