@echo off
setlocal enabledelayedexpansion
cd /d "c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\ai-services\forecast-service"
echo Installing dependencies for Forecast Service...
"c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\.venv\Scripts\python.exe" -m pip install -q -r requirements.txt
echo.
echo Starting Forecast Service on Port 8082...
echo.
"c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8082
pause
