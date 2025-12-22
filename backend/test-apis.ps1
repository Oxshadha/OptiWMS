# Test API Endpoints from backend directory
# This script runs the main test script from the project root

$scriptPath = Join-Path $PSScriptRoot ".." "TEST_API_ENDPOINTS.ps1"
$scriptPath = Resolve-Path $scriptPath -ErrorAction SilentlyContinue

if ($scriptPath) {
    Write-Host "Running API endpoint tests..." -ForegroundColor Cyan
    Write-Host ""
    & $scriptPath
} else {
    Write-Host "Error: Could not find TEST_API_ENDPOINTS.ps1" -ForegroundColor Red
    Write-Host "Please run from project root: .\TEST_API_ENDPOINTS.ps1" -ForegroundColor Yellow
}

