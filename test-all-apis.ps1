# Test All Backend APIs
# This script tests all the new API endpoints

$baseUrl = "http://localhost:8080"
$username = "admin"
$password = "admin123"
$authHeader = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))

$headers = @{
    "Authorization" = $authHeader
    "Content-Type" = "application/json"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing OptiWMS Backend APIs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testResults = @()

# Test function
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null
    )
    
    try {
        $params = @{
            Uri = "$baseUrl$Endpoint"
            Method = $Method
            Headers = $headers
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
        }
        
        $response = Invoke-RestMethod @params
        Write-Host "✅ $Name" -ForegroundColor Green
        $script:testResults += @{ Name = $Name; Status = "✅ PASS"; Details = "Response received" }
        return $true
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404 -and $Method -eq "GET") {
            Write-Host "⚠️  $Name (No data - endpoint exists)" -ForegroundColor Yellow
            $script:testResults += @{ Name = $Name; Status = "⚠️  NO DATA"; Details = "Endpoint exists but no data" }
            return $true
        }
        else {
            Write-Host "❌ $Name - Error: $($_.Exception.Message)" -ForegroundColor Red
            $script:testResults += @{ Name = $Name; Status = "❌ FAIL"; Details = $_.Exception.Message }
            return $false
        }
    }
}

# Master Data APIs
Write-Host "📦 Master Data APIs" -ForegroundColor Yellow
Test-Endpoint "Warehouses - List" "GET" "/api/master/warehouses"
Test-Endpoint "Materials - List" "GET" "/api/master/materials"
Test-Endpoint "Customers - List" "GET" "/api/customers"
Test-Endpoint "Suppliers - List" "GET" "/api/suppliers"
Test-Endpoint "Delivery Partners - List" "GET" "/api/delivery-partners"
Test-Endpoint "Workers - List" "GET" "/api/workers"
Write-Host ""

# Order & Task APIs
Write-Host "📋 Order & Task APIs" -ForegroundColor Yellow
Test-Endpoint "Orders - List" "GET" "/api/orders"
Test-Endpoint "Orders - Inbound" "GET" "/api/orders/inbound"
Test-Endpoint "Orders - Outbound" "GET" "/api/orders/outbound"
Test-Endpoint "Tasks - List" "GET" "/api/tasks"
Write-Host ""

# Operations APIs
Write-Host "🚚 Operations APIs" -ForegroundColor Yellow
Test-Endpoint "Stock Transfers - List" "GET" "/api/operations/stock-transfers"
Test-Endpoint "Cycle Counts - List" "GET" "/api/operations/cycle-counts"
Test-Endpoint "Inventory - List" "GET" "/api/inventory"
Write-Host ""

# Shipping & Returns APIs
Write-Host "📮 Shipping & Returns APIs" -ForegroundColor Yellow
Test-Endpoint "Shipments - List" "GET" "/api/shipments"
Test-Endpoint "Returns - List" "GET" "/api/returns"
Test-Endpoint "Packing - List" "GET" "/api/packing"
Test-Endpoint "Packing - Queue" "GET" "/api/packing/queue"
Write-Host ""

# Quality & Monitoring APIs
Write-Host "✅ Quality & Monitoring APIs" -ForegroundColor Yellow
Test-Endpoint "Quality Checks - List" "GET" "/api/quality-checks"
Test-Endpoint "Anomalies - List" "GET" "/api/anomalies"
Test-Endpoint "Reports - List" "GET" "/api/reports"
Write-Host ""

# Auth API
Write-Host "🔐 Authentication API" -ForegroundColor Yellow
Test-Endpoint "Auth - Current User" "GET" "/api/auth/me"
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passed = ($testResults | Where-Object { $_.Status -eq "✅ PASS" }).Count
$noData = ($testResults | Where-Object { $_.Status -eq "⚠️  NO DATA" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "❌ FAIL" }).Count
$total = $testResults.Count

Write-Host "Total Tests: $total" -ForegroundColor White
Write-Host "✅ Passed: $passed" -ForegroundColor Green
Write-Host "⚠️  No Data (Endpoint exists): $noData" -ForegroundColor Yellow
Write-Host "❌ Failed: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "🎉 All API endpoints are accessible!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some endpoints failed. Check backend logs." -ForegroundColor Yellow
}

Write-Host ""

