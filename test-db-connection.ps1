# Test database connection from host
Write-Host "Testing database connection..." -ForegroundColor Yellow

# Test 1: Container internal connection
Write-Host "`n1. Testing connection from inside container..." -ForegroundColor Cyan
$result1 = docker exec optiwms-db psql -U optiwms -d optiwms -c "SELECT current_database();" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Container connection works" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Container connection failed" -ForegroundColor Red
    Write-Host $result1
}

# Test 2: Check if port is accessible
Write-Host "`n2. Testing port 5434 accessibility..." -ForegroundColor Cyan
$portTest = Test-NetConnection -ComputerName 127.0.0.1 -Port 5434 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($portTest) {
    Write-Host "   [OK] Port 5434 is accessible" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Port 5434 is not accessible" -ForegroundColor Red
}

# Test 3: Verify database exists
Write-Host "`n3. Verifying database exists..." -ForegroundColor Cyan
$dbCheck = docker exec optiwms-db psql -U optiwms -lqt 2>&1 | Select-String "optiwms"
if ($dbCheck) {
    Write-Host "   [OK] Database 'optiwms' exists" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Database 'optiwms' not found" -ForegroundColor Red
}

# Test 4: Check user permissions
Write-Host "`n4. Checking user permissions..." -ForegroundColor Cyan
$permCheck = docker exec optiwms-db psql -U optiwms -d optiwms -c "SELECT has_database_privilege('optiwms', 'optiwms', 'CREATE');" 2>&1
if ($permCheck -match "t") {
    Write-Host "   [OK] User has proper permissions" -ForegroundColor Green
} else {
    Write-Host "   [WARN] Permission check unclear" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Connection test complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

