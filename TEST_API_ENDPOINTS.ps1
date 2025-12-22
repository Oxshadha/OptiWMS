# TEST_API_ENDPOINTS.ps1
# Quick test script for API endpoints

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing OptiWMS API Endpoints" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8080"
$username = "admin"
$password = "admin123"
$cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$authHeader = @{Authorization = "Basic $cred"}

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Method = "GET"
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $Headers -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  [OK] Status: $($response.StatusCode)" -ForegroundColor Green
            try {
                $json = $response.Content | ConvertFrom-Json
                $count = if ($json -is [Array]) { $json.Count } else { 1 }
                Write-Host "  [OK] Response: $count item(s)" -ForegroundColor Green
            } catch {
                Write-Host "  [OK] Response received" -ForegroundColor Green
            }
            return $true
        } else {
            Write-Host "  [WARN] Status: $($response.StatusCode)" -ForegroundColor Yellow
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401) {
            Write-Host "  [AUTH] 401 Unauthorized (auth required)" -ForegroundColor Yellow
            return $false
        } elseif ($statusCode -eq 404) {
            Write-Host "  [ERROR] 404 Not Found" -ForegroundColor Red
            return $false
        } else {
            Write-Host "  [ERROR] $statusCode - $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    }
    Write-Host ""
}

# Test Health Check (No Auth)
Write-Host "1. Testing Health Check (No Auth Required)" -ForegroundColor Cyan
Test-Endpoint -Name "Health Check" -Url "$baseUrl/actuator/health"
Write-Host ""

# Test API Endpoints (With Auth)
Write-Host "2. Testing API Endpoints (With Auth)" -ForegroundColor Cyan
Write-Host ""

# Master Data
Test-Endpoint -Name "Warehouses" -Url "$baseUrl/api/master/warehouses" -Headers $authHeader
Test-Endpoint -Name "Materials" -Url "$baseUrl/api/master/materials" -Headers $authHeader
Test-Endpoint -Name "Customers" -Url "$baseUrl/api/customers" -Headers $authHeader
Test-Endpoint -Name "Suppliers" -Url "$baseUrl/api/suppliers" -Headers $authHeader
Test-Endpoint -Name "Workers" -Url "$baseUrl/api/workers" -Headers $authHeader
Test-Endpoint -Name "Delivery Partners" -Url "$baseUrl/api/delivery-partners" -Headers $authHeader

Write-Host ""

# Operations
Test-Endpoint -Name "Orders" -Url "$baseUrl/api/orders" -Headers $authHeader
Test-Endpoint -Name "Tasks" -Url "$baseUrl/api/tasks" -Headers $authHeader
Test-Endpoint -Name "Inventory" -Url "$baseUrl/api/inventory" -Headers $authHeader

Write-Host ""

# Logistics
Test-Endpoint -Name "Shipments" -Url "$baseUrl/api/shipments" -Headers $authHeader
Test-Endpoint -Name "Returns" -Url "$baseUrl/api/returns" -Headers $authHeader
Test-Endpoint -Name "Packing" -Url "$baseUrl/api/packing" -Headers $authHeader

Write-Host ""

# Reports & Quality
Test-Endpoint -Name "Reports" -Url "$baseUrl/api/reports" -Headers $authHeader
Test-Endpoint -Name "Quality Checks" -Url "$baseUrl/api/quality-checks" -Headers $authHeader
Test-Endpoint -Name "Anomalies" -Url "$baseUrl/api/anomalies" -Headers $authHeader

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: 401 Unauthorized means auth is required (this is normal)" -ForegroundColor Yellow
Write-Host "      Try the endpoints with authentication in Postman or browser" -ForegroundColor Yellow
Write-Host ""

