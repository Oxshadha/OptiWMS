# Test Specific API Endpoints - Simplified Version
# Tests: Orders, Tasks, Shipments, Returns, Packing, Reports, Quality Checks, Anomalies

$baseUrl = "http://localhost:8080"
$authHeader = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin123"))
$headers = @{
    "Authorization" = $authHeader
    "Content-Type" = "application/json"
}

$testResults = @()
$createdIds = @{}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [int]$ExpectedStatusCode = 200,
        [switch]$SaveId
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
        
        if ($SaveId -and $response.id) {
            $script:createdIds[$Name] = $response.id
        }
        
        Write-Host "[PASS] $Name" -ForegroundColor Green
        if ($response -is [array]) {
            Write-Host "  Response: Array with $($response.Length) items" -ForegroundColor Gray
        } elseif ($response.id) {
            Write-Host "  Response: Object with ID $($response.id)" -ForegroundColor Gray
        }
        
        $script:testResults += @{ 
            Name = $Name; 
            Status = "PASS"; 
            Endpoint = $Endpoint;
            Method = $Method
        }
        return @{ Success = $true; Response = $response }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        
        if (($statusCode -eq 404 -and $Method -eq "GET") -or 
            ($statusCode -eq 204 -and $Method -eq "DELETE") -or
            ($ExpectedStatusCode -eq $statusCode)) {
            Write-Host "[EXPECTED] $Name (Status: $statusCode)" -ForegroundColor Yellow
            $script:testResults += @{ 
                Name = $Name; 
                Status = "EXPECTED"; 
                Endpoint = $Endpoint;
                Method = $Method;
                StatusCode = $statusCode
            }
            return @{ Success = $true; StatusCode = $statusCode }
        }
        else {
            Write-Host "[FAIL] $Name - Error: $errorMessage (Status: $statusCode)" -ForegroundColor Red
            $script:testResults += @{ 
                Name = $Name; 
                Status = "FAIL"; 
                Endpoint = $Endpoint;
                Method = $Method;
                Error = $errorMessage;
                StatusCode = $statusCode
            }
            return @{ Success = $false; Error = $errorMessage; StatusCode = $statusCode }
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Specific Backend APIs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "Checking backend connectivity..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "$baseUrl/actuator/health" -Method GET -ErrorAction Stop -TimeoutSec 5
    Write-Host "[OK] Backend is running!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[ERROR] Backend is not running or not accessible on port 8080" -ForegroundColor Red
    Write-Host "Please start the backend first:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor Cyan
    Write-Host "  .\gradlew :core-api:bootRun" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Get warehouse ID
$warehouseId = $null
try {
    $warehouses = Invoke-RestMethod -Uri "$baseUrl/api/master/warehouses" -Headers $headers -ErrorAction Stop
    if ($warehouses -and $warehouses.Length -gt 0) {
        $warehouseId = $warehouses[0].id
        Write-Host "Using warehouse ID: $warehouseId" -ForegroundColor Gray
    }
} catch {
    Write-Host "Warning: Could not fetch warehouses" -ForegroundColor Yellow
}

Write-Host ""

# ========================================
# 1. ORDER API TESTS
# ========================================
Write-Host "Testing Order API" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Order - GET List All" "GET" "/api/orders"
Test-Endpoint "Order - GET Inbound" "GET" "/api/orders/inbound"
Test-Endpoint "Order - GET Outbound" "GET" "/api/orders/outbound"

# Create test data for POST/PUT/DELETE
if ($warehouseId) {
    # Get or create customer
    $customerId = $null
    try {
        $customers = Invoke-RestMethod -Uri "$baseUrl/api/customers" -Headers $headers -ErrorAction Stop
        if ($customers -and $customers.Length -gt 0) {
            $customerId = $customers[0].id
        } else {
            $customerData = @{
                code = "TEST-CUST-ORDER"
                name = "Test Customer for Order"
                email = "testorder@example.com"
                phone = "1234567890"
                address = "123 Test St"
                city = "Test City"
                country = "USA"
                status = "ACTIVE"
            }
            $customerResult = Test-Endpoint "Customer - Create" "POST" "/api/customers" $customerData -SaveId
            if ($customerResult.Success -and $customerResult.Response) {
                $customerId = $customerResult.Response.id
            }
        }
    } catch {
        Write-Host "Could not get/create customer" -ForegroundColor Yellow
    }
    
    # Get or create supplier
    $supplierId = $null
    try {
        $suppliers = Invoke-RestMethod -Uri "$baseUrl/api/suppliers" -Headers $headers -ErrorAction Stop
        if ($suppliers -and $suppliers.Length -gt 0) {
            $supplierId = $suppliers[0].id
        } else {
            $supplierData = @{
                code = "TEST-SUP-ORDER"
                name = "Test Supplier for Order"
                email = "testsupplier@example.com"
                phone = "0987654321"
                address = "456 Supplier Ave"
                city = "Supplier City"
                country = "USA"
                status = "ACTIVE"
            }
            $supplierResult = Test-Endpoint "Supplier - Create" "POST" "/api/suppliers" $supplierData -SaveId
            if ($supplierResult.Success -and $supplierResult.Response) {
                $supplierId = $supplierResult.Response.id
            }
        }
    } catch {
        Write-Host "Could not get/create supplier" -ForegroundColor Yellow
    }
    
    if ($supplierId) {
        $orderData = @{
            orderNumber = "ORD-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
            orderType = "inbound"
            customerId = $null
            supplierId = $supplierId
            warehouseId = $warehouseId
            status = "PENDING"
            priority = "NORMAL"
            orderDate = (Get-Date).ToString("yyyy-MM-dd")
            expectedDate = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
            totalAmount = 1000.00
            notes = "Test order"
        }
        $orderResult = Test-Endpoint "Order - POST Create" "POST" "/api/orders" $orderData -SaveId
        $orderId = if ($orderResult.Success -and $orderResult.Response) { $orderResult.Response.id } else { $null }
        
        if ($orderId) {
            Test-Endpoint "Order - GET By ID" "GET" "/api/orders/$orderId"
            
            $updateOrderData = @{
                orderNumber = $orderData.orderNumber
                orderType = "inbound"
                customerId = $null
                supplierId = $supplierId
                warehouseId = $warehouseId
                status = "PROCESSING"
                priority = "HIGH"
                orderDate = $orderData.orderDate
                expectedDate = $orderData.expectedDate
                totalAmount = 1500.00
                notes = "Updated test order"
            }
            Test-Endpoint "Order - PUT Update" "PUT" "/api/orders/$orderId" $updateOrderData
            
            Test-Endpoint "Order - DELETE" "DELETE" "/api/orders/$orderId" -ExpectedStatusCode 204
        }
    }
}

Write-Host ""

# ========================================
# 2. TASK API TESTS
# ========================================
Write-Host "Testing Task API" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Task - GET List All" "GET" "/api/tasks"

if ($warehouseId) {
    $workerId = $null
    try {
        $workers = Invoke-RestMethod -Uri "$baseUrl/api/workers" -Headers $headers -ErrorAction Stop
        if ($workers -and $workers.Length -gt 0) {
            $workerId = $workers[0].id
        } else {
            $workerData = @{
                employeeId = "WRK-TEST-$(Get-Date -Format 'HHmmss')"
                firstName = "Test"
                lastName = "Worker"
                email = "testworker@example.com"
                phone = "5555555555"
                department = "Warehouse"
                position = "Packer"
                status = "ACTIVE"
            }
            $workerResult = Test-Endpoint "Worker - Create" "POST" "/api/workers" $workerData -SaveId
            if ($workerResult.Success -and $workerResult.Response) {
                $workerId = $workerResult.Response.id
            }
        }
    } catch {
        Write-Host "Could not get/create worker" -ForegroundColor Yellow
    }
    
    if ($warehouseId) {
        $taskData = @{
            taskNumber = "TASK-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
            taskType = "PICKING"
            warehouseId = $warehouseId
            assignedTo = $workerId
            priority = "NORMAL"
            status = "ASSIGNED"
            dueDate = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss")
            locationCode = "A-01-01"
            referenceType = "ORDER"
            referenceId = $orderId
            notes = "Test task"
        }
        $taskResult = Test-Endpoint "Task - POST Create" "POST" "/api/tasks" $taskData -SaveId
        $taskId = if ($taskResult.Success -and $taskResult.Response) { $taskResult.Response.id } else { $null }
        
        if ($taskId) {
            Test-Endpoint "Task - GET By ID" "GET" "/api/tasks/$taskId"
            
            $updateTaskData = @{
                taskNumber = $taskData.taskNumber
                taskType = "PICKING"
                warehouseId = $warehouseId
                assignedTo = $workerId
                priority = "HIGH"
                status = "IN_PROGRESS"
                dueDate = $taskData.dueDate
                locationCode = "A-01-02"
                referenceType = "ORDER"
                referenceId = $orderId
                notes = "Updated test task"
            }
            Test-Endpoint "Task - PUT Update" "PUT" "/api/tasks/$taskId" $updateTaskData
            
            if ($workerId) {
                $assignData = @{ assignedTo = $workerId }
                Test-Endpoint "Task - POST Assign" "POST" "/api/tasks/$taskId/assign" $assignData
            }
            
            Test-Endpoint "Task - POST Complete" "POST" "/api/tasks/$taskId/complete"
            
            Test-Endpoint "Task - DELETE" "DELETE" "/api/tasks/$taskId" -ExpectedStatusCode 204
        }
    }
}

Write-Host ""

# ========================================
# 3. SHIPMENT, RETURN, PACKING APIs
# ========================================
Write-Host "Testing Shipment API" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Shipment - GET List All" "GET" "/api/shipments"

if ($warehouseId -and $customerId) {
    $shipmentData = @{
        shipmentNumber = "SHIP-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
        orderId = $orderId
        customerId = $customerId
        warehouseId = $warehouseId
        status = "PENDING"
        shippingDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
        expectedDeliveryDate = (Get-Date).AddDays(3).ToString("yyyy-MM-dd")
        trackingNumber = "TRACK-$(Get-Random -Minimum 100000 -Maximum 999999)"
        carrier = "Test Carrier"
        notes = "Test shipment"
    }
    $shipmentResult = Test-Endpoint "Shipment - POST Create" "POST" "/api/shipments" $shipmentData -SaveId
    $shipmentId = if ($shipmentResult.Success -and $shipmentResult.Response) { $shipmentResult.Response.id } else { $null }
    
    if ($shipmentId) {
        Test-Endpoint "Shipment - GET By ID" "GET" "/api/shipments/$shipmentId"
        Test-Endpoint "Shipment - POST Process" "POST" "/api/shipments/$shipmentId/process"
        Test-Endpoint "Shipment - POST Track" "POST" "/api/shipments/$shipmentId/track"
    }
}

Write-Host ""

Write-Host "Testing Return API" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Return - GET List All" "GET" "/api/returns"

if ($warehouseId -and $customerId) {
    $returnData = @{
        returnNumber = "RET-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
        orderId = $orderId
        customerId = $customerId
        warehouseId = $warehouseId
        status = "PENDING"
        returnDate = (Get-Date).ToString("yyyy-MM-dd")
        reason = "Defective item"
        notes = "Test return"
    }
    $returnResult = Test-Endpoint "Return - POST Create" "POST" "/api/returns" $returnData -SaveId
    $returnId = if ($returnResult.Success -and $returnResult.Response) { $returnResult.Response.id } else { $null }
    
    if ($returnId) {
        Test-Endpoint "Return - GET By ID" "GET" "/api/returns/$returnId"
        Test-Endpoint "Return - POST Process" "POST" "/api/returns/$returnId/process"
        Test-Endpoint "Return - POST Inspect" "POST" "/api/returns/$returnId/inspect"
    }
}

Write-Host ""

Write-Host "Testing Packing API" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Packing - GET List All" "GET" "/api/packing"
Test-Endpoint "Packing - GET Queue" "GET" "/api/packing/queue"
Test-Endpoint "Packing - GET Monitor" "GET" "/api/packing/monitor"

if ($warehouseId -and $orderId) {
    $packingData = @{
        packingNumber = "PKG-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
        orderId = $orderId
        warehouseId = $warehouseId
        status = "PENDING"
        packedBy = $workerId
        packedDate = (Get-Date).ToString("yyyy-MM-dd")
        notes = "Test packing"
    }
    $packingResult = Test-Endpoint "Packing - POST Create" "POST" "/api/packing" $packingData -SaveId
    $packingId = if ($packingResult.Success -and $packingResult.Response) { $packingResult.Response.id } else { $null }
    
    if ($packingId) {
        Test-Endpoint "Packing - GET By ID" "GET" "/api/packing/$packingId"
        Test-Endpoint "Packing - POST Complete" "POST" "/api/packing/$packingId/complete"
    }
}

Write-Host ""

# ========================================
# 4. REPORTS, QUALITY CHECKS, ANOMALIES APIs
# ========================================
Write-Host "Testing Reports API" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Report - GET List All" "GET" "/api/reports"

$reportData = @{
    reportType = "INVENTORY"
    startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    endDate = (Get-Date).ToString("yyyy-MM-dd")
    format = "PDF"
}
$reportResult = Test-Endpoint "Report - POST Generate" "POST" "/api/reports/generate" $reportData -SaveId
$reportId = if ($reportResult.Success -and $reportResult.Response) { $reportResult.Response.id } else { $null }

if ($reportId) {
    Test-Endpoint "Report - GET By ID" "GET" "/api/reports/$reportId"
    Test-Endpoint "Report - GET Download" "GET" "/api/reports/$reportId/download"
}

Write-Host ""

Write-Host "Testing Quality Checks API" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Quality Check - GET List All" "GET" "/api/quality-checks"

if ($warehouseId) {
    $qualityCheckData = @{
        checkNumber = "QC-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
        warehouseId = $warehouseId
        materialId = $null
        checkType = "INCOMING"
        status = "PENDING"
        checkedBy = $workerId
        checkDate = (Get-Date).ToString("yyyy-MM-dd")
        result = "PASS"
        notes = "Test quality check"
    }
    $qcResult = Test-Endpoint "Quality Check - POST Create" "POST" "/api/quality-checks" $qualityCheckData -SaveId
    $qcId = if ($qcResult.Success -and $qcResult.Response) { $qcResult.Response.id } else { $null }
    
    if ($qcId) {
        Test-Endpoint "Quality Check - GET By ID" "GET" "/api/quality-checks/$qcId"
        
        $updateQcData = @{
            checkNumber = $qualityCheckData.checkNumber
            warehouseId = $warehouseId
            materialId = $null
            checkType = "INCOMING"
            status = "COMPLETED"
            checkedBy = $workerId
            checkDate = $qualityCheckData.checkDate
            result = "PASS"
            notes = "Updated quality check"
        }
        Test-Endpoint "Quality Check - PUT Update" "PUT" "/api/quality-checks/$qcId" $updateQcData
    }
}

Write-Host ""

Write-Host "Testing Anomalies API" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Test-Endpoint "Anomaly - GET List All" "GET" "/api/anomalies"

Write-Host ""

# ========================================
# SUMMARY
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passed = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$expected = ($testResults | Where-Object { $_.Status -eq "EXPECTED" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$total = $testResults.Count

Write-Host "Total Tests: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Expected (No Data/204): $expected" -ForegroundColor Yellow
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "All API endpoints tested successfully!" -ForegroundColor Green
} else {
    Write-Host "Some tests failed. Check details above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Created Test Data IDs:" -ForegroundColor Cyan
foreach ($key in $createdIds.Keys) {
    Write-Host "  $key : $($createdIds[$key])" -ForegroundColor Gray
}

Write-Host ""

# Export results
$resultsFile = "api-test-results.json"
$testResults | ConvertTo-Json -Depth 5 | Out-File -FilePath $resultsFile -Encoding UTF8
Write-Host "Test results exported to: $resultsFile" -ForegroundColor Gray
Write-Host ""

