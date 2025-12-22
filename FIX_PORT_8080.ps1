# Quick Fix Script for Port 8080 Conflict
# This script automatically finds and stops processes using port 8080

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fixing Port 8080 Conflict" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find processes using port 8080
Write-Host "Checking for processes using port 8080..." -ForegroundColor Yellow
$connections = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue

if ($null -eq $connections -or $connections.Count -eq 0) {
    Write-Host "[OK] Port 8080 is free!" -ForegroundColor Green
    exit 0
}

Write-Host "Found $($connections.Count) process(es) using port 8080" -ForegroundColor Yellow
Write-Host ""

# Get unique process IDs
$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($pid in $pids) {
    try {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Found process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Yellow
            Write-Host "  Path: $($process.Path)" -ForegroundColor Gray
            
            # Stop the process
            Write-Host "  Stopping process..." -ForegroundColor Yellow
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500
            
            # Verify it's stopped
            $stillRunning = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($stillRunning) {
                Write-Host "  [WARN] Process still running, trying again..." -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Start-Sleep -Seconds 1
            }
            
            Write-Host "  [OK] Process stopped successfully" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [ERROR] Could not stop process $pid : $_" -ForegroundColor Red
    }
}

Write-Host ""
# Verify port is now free
Start-Sleep -Seconds 1
$stillInUse = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue

if ($null -eq $stillInUse -or $stillInUse.Count -eq 0) {
    Write-Host "[SUCCESS] Port 8080 is now free!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now start the backend with:" -ForegroundColor Cyan
    Write-Host "  cd backend" -ForegroundColor Yellow
    Write-Host "  .\gradlew :core-api:bootRun" -ForegroundColor Yellow
} else {
    Write-Host "[WARN] Port 8080 is still in use. Manual intervention required." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run this command to see what's using it:" -ForegroundColor Cyan
    Write-Host "  netstat -ano | findstr :8080" -ForegroundColor Yellow
}

