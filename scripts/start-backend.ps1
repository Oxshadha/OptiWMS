param(
    [switch]$DisableRackSeed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot "backend"
Set-Location $backendRoot

Write-Host "Starting Spring Boot backend..." -ForegroundColor Cyan

if ($DisableRackSeed) {
    & ".\gradlew.bat" ":core-api:bootRun" '--args=--optiwms.seed.racks=false'
} else {
    & ".\gradlew.bat" ":core-api:bootRun"
}

