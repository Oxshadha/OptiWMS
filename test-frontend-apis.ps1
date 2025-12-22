# Quick Frontend API Integration Test
# Tests the APIs that frontend pages are now connected to

$baseUrl = "http://localhost:8080/api"
$username = "admin"
$password = "admin123"
$authHeader = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))

$headers = @{
    "Authorization" = $authHeader
    "Content-Type" = "application/json"
}

Write-Host "`n=== Testing Frontend-Connected APIs ===" -ForegroundColor Cyan
Write-Host ""

$tests = @(
    @{ Name = "Materials API"; Endpoint = "/master/materials"; Method = "GET" },
    @{ Name = "Inventory API"; Endpoint = "/inventory"; Method = "GET" },
    @{ Name = "Stock Transfers API"; Endpoint = "/operations/stock-transfers"; Method = "GET" },
    @{ Name = "Cycle Counts API"; Endpoint = "/operations/cycle-counts"; Method = "GET" },
    @{ Name = "Orders API"; Endpoint = "/orders"; Method = "GET" },
    @{ Name = "Tasks API"; Endpoint = "/tasks"; Method = "GET" },
    @{ Name = "Warehouses API"; Endpoint = "/master/warehouses"; Method = "GET" }
)

$passed = 0
$failed = 0

foreach ($test in $tests) {
    try {
        Write-Host "Testing: $($test.Name)..." -NoNewline
        $response = Invoke-RestMethod -Uri "$baseUrl$($test.Endpoint)" -Method $test.Method -Headers $headers -ErrorAction Stop
        
        if ($response -is [array]) {
            Write-Host " ✅ PASS (Returned $($response.Length) items)" -ForegroundColor Green
        } else {
            Write-Host " ✅ PASS" -ForegroundColor Green
        }
        $passed++
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host " ❌ FAILED (Status: $statusCode)" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
        $failed++
    }
}

Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -eq 0) {
    Write-Host "`n✅ All APIs are working! Frontend pages should connect successfully." -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some APIs failed. Check backend logs and ensure backend is running." -ForegroundColor Yellow
}

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Start frontend: cd frontend; npm run dev" -ForegroundColor White
Write-Host "2. Open browser: http://localhost:3000" -ForegroundColor White
Write-Host "3. Test pages: /admin/products, /admin/inventory, /admin/stock-transfers" -ForegroundColor White

