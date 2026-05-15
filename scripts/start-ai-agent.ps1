param(
    [switch]$SkipInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$agentRoot = Join-Path $repoRoot "ai-services\ai-agent"
$venvRoot = Join-Path $agentRoot ".venv"
$pythonExe = Join-Path $venvRoot "Scripts\python.exe"

Set-Location $agentRoot

if (-not (Test-Path $pythonExe)) {
    Write-Host "Creating AI agent virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
}

if (-not $SkipInstall) {
    Write-Host "Installing AI agent dependencies..." -ForegroundColor Cyan
    & $pythonExe -m pip install -r requirements.txt
}

Write-Host "Starting FastAPI AI agent..." -ForegroundColor Cyan
& $pythonExe -m uvicorn api:app --reload --host 0.0.0.0 --port 8000

