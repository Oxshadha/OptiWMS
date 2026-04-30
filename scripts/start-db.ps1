Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Starting PostgreSQL via Docker Compose..." -ForegroundColor Cyan
docker compose -f infra/docker-compose.yml up -d db

Write-Host ""
Write-Host "PostgreSQL should now be available on localhost:5434" -ForegroundColor Green

