# Quick API Connectivity Test
# This script quickly tests if the backend is running and APIs are accessible

$baseUrl = "http://localhost:8080"
$authHeader = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin123"))
$headers = @{ Authorization = $authHeader }

Write-Host "Quick Backend API Test" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Testing backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/actuator/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Backend is running!" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Backend is not running!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start the backend:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor Cyan
    Write-Host "  .\gradlew :core-api:bootRun" -ForegroundColor Cyan
    exit 1
}

Write-Host ""

# Test 2: Auth API
Write-Host "2. Testing Auth API..." -ForegroundColor Yellow
try {
    $user = Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -Headers $headers -ErrorAction Stop
    Write-Host "   ✅ Auth API working!" -ForegroundColor Green
    Write-Host "   User: $($user.username)" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  Auth API test failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Test 3: Test a few key endpoints
Write-Host "3. Testing key endpoints..." -ForegroundColor Yellow

$endpoints = @(
    @{ Name = "Warehouses"; Path = "/api/master/warehouses" },
    @{ Name = "Customers"; Path = "/api/customers" },
    @{ Name = "Orders"; Path = "/api/orders" },
    @{ Name = "Tasks"; Path = "/api/tasks" },
    @{ Name = "Inventory"; Path = "/api/inventory" }
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl$($endpoint.Path)" -Headers $headers -ErrorAction Stop
        if ($response -is [array]) {
            Write-Host "   ✅ $($endpoint.Name): $($response.Length) items" -ForegroundColor Green
        } else {
            Write-Host "   ✅ $($endpoint.Name): OK" -ForegroundColor Green
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404) {
            Write-Host "   ⚠️  $($endpoint.Name): No data (endpoint exists)" -ForegroundColor Yellow
        } else {
            Write-Host "   ❌ $($endpoint.Name): Error $statusCode" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "✅ Quick test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "For comprehensive testing, run:" -ForegroundColor Cyan
Write-Host "  .\test-backend-apis.ps1" -ForegroundColor White
Write-Host ""

