param(
    [switch]$SkipInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$agentRoot = Join-Path $repoRoot "ai-services\ai-agent"
$pythonExe = "C:\Users\User\miniconda3\python.exe"

Set-Location $agentRoot

if (-not $SkipInstall) {
    Write-Host "Installing AI agent dependencies..." -ForegroundColor Cyan
    & $pythonExe -m pip install -r requirements.txt
}

Write-Host "Starting FastAPI AI agent..." -ForegroundColor Cyan
& $pythonExe -m uvicorn api:app --reload --host 0.0.0.0 --port 8000

