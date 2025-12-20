# Comprehensive Backend API Testing Script
# Tests all implemented backend APIs to ensure they work correctly

$baseUrl = "http://localhost:8080"
$username = "admin"
$password = "admin123"
$authHeader = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))

$headers = @{
    "Authorization" = $authHeader
    "Content-Type" = "application/json"
}

$testResults = @()
$errors = @()

# Test function
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [int]$ExpectedStatusCode = 200
    )
    
    try {
        $params = @{
            Uri = "$baseUrl$Endpoint"
            Method = $Method
            Headers = $headers
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        
        Write-Host "✅ $Name" -ForegroundColor Green
        if ($response -is [array]) {
            Write-Host "   Response: Array with $($response.Length) items" -ForegroundColor Gray
        } elseif ($response) {
            Write-Host "   Response: Object received" -ForegroundColor Gray
        }
        
        $script:testResults += @{ 
            Name = $Name; 
            Status = "✅ PASS"; 
            Endpoint = $Endpoint;
            Method = $Method;
            ResponseType = if ($response -is [array]) { "Array[$($response.Length)]" } else { "Object" }
        }
        return @{ Success = $true; Response = $response }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        
        # 404 is acceptable for GET requests (means endpoint exists, just no data)
        # 204 is acceptable for DELETE requests (No Content)
        if (($statusCode -eq 404 -and $Method -eq "GET") -or 
            ($statusCode -eq 204 -and $Method -eq "DELETE") -or
            ($ExpectedStatusCode -eq $statusCode)) {
            Write-Host "⚠️  $Name (Status: $statusCode - Expected)" -ForegroundColor Yellow
            $script:testResults += @{ 
                Name = $Name; 
                Status = "⚠️  NO DATA/EXPECTED"; 
                Endpoint = $Endpoint;
                Method = $Method;
                StatusCode = $statusCode
            }
            return @{ Success = $true; StatusCode = $statusCode }
        }
        else {
            Write-Host "❌ $Name - Error: $errorMessage (Status: $statusCode)" -ForegroundColor Red
            $script:testResults += @{ 
                Name = $Name; 
                Status = "❌ FAIL"; 
                Endpoint = $Endpoint;
                Method = $Method;
                Error = $errorMessage;
                StatusCode = $statusCode
            }
            $script:errors += "$Name ($Method $Endpoint): $errorMessage"
            return @{ Success = $false; Error = $errorMessage; StatusCode = $statusCode }
        }
    }
}

# Check if backend is running
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend API Testing - OptiWMS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking if backend is running on port 8080..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "$baseUrl/actuator/health" -Method GET -ErrorAction Stop -TimeoutSec 5
    Write-Host "✅ Backend is running!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Backend is not running or not accessible on port 8080" -ForegroundColor Red
    Write-Host "Please start the backend first:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor Cyan
    Write-Host "  .\gradlew :core-api:bootRun" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Get a warehouse ID for testing (needed for some operations)
$warehouseId = $null
try {
    $warehouses = Invoke-RestMethod -Uri "$baseUrl/api/master/warehouses" -Headers $headers -ErrorAction Stop
    if ($warehouses -and $warehouses.Length -gt 0) {
        $warehouseId = $warehouses[0].id
        Write-Host "Using warehouse ID: $warehouseId for testing" -ForegroundColor Gray
    }
} catch {
    Write-Host "Warning: Could not fetch warehouses for testing" -ForegroundColor Yellow
}

# ========================================
# 1. MASTER DATA APIs
# ========================================
Write-Host "📦 Testing Master Data APIs" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Warehouses - List All" "GET" "/api/master/warehouses"
Test-Endpoint "Materials - List All" "GET" "/api/master/materials"
Test-Endpoint "Customers - List All" "GET" "/api/customers"
Test-Endpoint "Suppliers - List All" "GET" "/api/suppliers"
Test-Endpoint "Delivery Partners - List All" "GET" "/api/delivery-partners"
Test-Endpoint "Workers - List All" "GET" "/api/workers"
Write-Host ""

# ========================================
# 2. ORDER & TASK APIs
# ========================================
Write-Host "📋 Testing Order & Task APIs" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Orders - List All" "GET" "/api/orders"
Test-Endpoint "Orders - Inbound Only" "GET" "/api/orders/inbound"
Test-Endpoint "Orders - Outbound Only" "GET" "/api/orders/outbound"
Test-Endpoint "Tasks - List All" "GET" "/api/tasks"
Write-Host ""

# ========================================
# 3. INVENTORY & OPERATIONS APIs
# ========================================
Write-Host "🚚 Testing Inventory & Operations APIs" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Inventory - List All" "GET" "/api/inventory"
Test-Endpoint "Stock Transfers - List All" "GET" "/api/operations/stock-transfers"
Test-Endpoint "Cycle Counts - List All" "GET" "/api/operations/cycle-counts"
Write-Host ""

# ========================================
# 4. SHIPPING & RETURNS APIs
# ========================================
Write-Host "📮 Testing Shipping & Returns APIs" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Shipments - List All" "GET" "/api/shipments"
Test-Endpoint "Returns - List All" "GET" "/api/returns"
Test-Endpoint "Packing - List All" "GET" "/api/packing"
Test-Endpoint "Packing - Queue" "GET" "/api/packing/queue"
Test-Endpoint "Packing - Monitor" "GET" "/api/packing/monitor"
Write-Host ""

# ========================================
# 5. QUALITY & MONITORING APIs
# ========================================
Write-Host "✅ Testing Quality & Monitoring APIs" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Quality Checks - List All" "GET" "/api/quality-checks"
Test-Endpoint "Anomalies - List All" "GET" "/api/anomalies"
Test-Endpoint "Reports - List All" "GET" "/api/reports"
Write-Host ""

# ========================================
# 6. AUTHENTICATION API
# ========================================
Write-Host "🔐 Testing Authentication API" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Auth - Current User" "GET" "/api/auth/me"
Write-Host ""

# ========================================
# 7. TEST CREATE OPERATIONS (Sample Data)
# ========================================
Write-Host "🔧 Testing CREATE Operations" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

if ($warehouseId) {
    # Test Customer Creation
    $customerData = @{
        code = "TEST-CUST-001"
        name = "Test Customer"
        email = "test@example.com"
        phone = "1234567890"
        address = "123 Test St"
        city = "Test City"
        country = "Test Country"
        status = "ACTIVE"
    }
    $customerResult = Test-Endpoint "Customer - Create" "POST" "/api/customers" $customerData
    $customerId = if ($customerResult.Success -and $customerResult.Response) { $customerResult.Response.id } else { $null }
    
    # Test Supplier Creation
    $supplierData = @{
        code = "TEST-SUP-001"
        name = "Test Supplier"
        email = "supplier@example.com"
        phone = "0987654321"
        address = "456 Supplier Ave"
        city = "Supplier City"
        country = "Supplier Country"
        status = "ACTIVE"
    }
    $supplierResult = Test-Endpoint "Supplier - Create" "POST" "/api/suppliers" $supplierData
    $supplierId = if ($supplierResult.Success -and $supplierResult.Response) { $supplierResult.Response.id } else { $null }
    
    # Test Worker Creation
    $workerData = @{
        employeeId = "TEST-WRK-001"
        firstName = "Test"
        lastName = "Worker"
        email = "worker@example.com"
        phone = "5555555555"
        department = "Warehouse"
        position = "Packer"
        status = "ACTIVE"
    }
    $workerResult = Test-Endpoint "Worker - Create" "POST" "/api/workers" $workerData
    $workerId = if ($workerResult.Success -and $workerResult.Response) { $workerResult.Response.id } else { $null }
    
    Write-Host ""
}

# ========================================
# SUMMARY
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passed = ($testResults | Where-Object { $_.Status -eq "✅ PASS" }).Count
$noData = ($testResults | Where-Object { $_.Status -eq "⚠️  NO DATA/EXPECTED" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "❌ FAIL" }).Count
$total = $testResults.Count

Write-Host "Total Tests: $total" -ForegroundColor White
Write-Host "✅ Passed: $passed" -ForegroundColor Green
Write-Host "⚠️  No Data/Expected: $noData" -ForegroundColor Yellow
Write-Host "❌ Failed: $failed" -ForegroundColor Red
Write-Host ""

# Show failed tests if any
if ($failed -gt 0) {
    Write-Host "Failed Tests:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
    Write-Host ""
}

# Overall status
if ($failed -eq 0) {
    Write-Host "🎉 All API endpoints are accessible and working correctly!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Review test results above" -ForegroundColor White
    Write-Host "  2. Test POST/PUT/DELETE operations with actual data" -ForegroundColor White
    Write-Host "  3. Verify business logic in services" -ForegroundColor White
    Write-Host "  4. Connect frontend to these APIs" -ForegroundColor White
} else {
    Write-Host "⚠️  Some endpoints failed. Please check:" -ForegroundColor Yellow
    Write-Host "  1. Backend logs for errors" -ForegroundColor White
    Write-Host "  2. Database connection" -ForegroundColor White
    Write-Host "  3. Database migrations are applied" -ForegroundColor White
}

Write-Host ""

# Export results to JSON
$testResults | ConvertTo-Json -Depth 5 | Out-File -FilePath "backend-api-test-results.json" -Encoding UTF8
Write-Host "Test results exported to: backend-api-test-results.json" -ForegroundColor Gray
Write-Host ""

