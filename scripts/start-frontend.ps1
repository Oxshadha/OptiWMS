param(
    [switch]$ForceInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repoRoot "frontend"
Set-Location $frontendRoot

if ($ForceInstall -or -not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    npm install
}

Write-Host "Starting Next.js frontend..." -ForegroundColor Cyan
npm run dev

