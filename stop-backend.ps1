# OptiWMS Backend Stop Script
# Stops any Java processes running on port 8080

Write-Host "Stopping OptiWMS backend..." -ForegroundColor Yellow

$connections = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue

if ($connections) {
    $processes = $connections | ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } | Where-Object { $_.ProcessName -eq "java" } | Select-Object -Unique
    
    if ($processes) {
        foreach ($process in $processes) {
            Write-Host "Stopping Java process (PID: $($process.Id), Name: $($process.ProcessName))..." -ForegroundColor Cyan
            try {
                Stop-Process -Id $process.Id -Force
                Write-Host "Process $($process.Id) stopped successfully." -ForegroundColor Green
            } catch {
                Write-Host "Could not stop process $($process.Id): $_" -ForegroundColor Red
            }
        }
        Write-Host "`nBackend stopped." -ForegroundColor Green
    } else {
        Write-Host "No Java processes found on port 8080." -ForegroundColor Yellow
    }
} else {
    Write-Host "No processes found on port 8080." -ForegroundColor Green
}

