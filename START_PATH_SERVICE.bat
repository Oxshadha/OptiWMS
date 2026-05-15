@echo off
setlocal enabledelayedexpansion
cd /d "c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\ai-services\path-optimization-service"
echo Installing dependencies for Path Optimization Service...
"c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\.venv\Scripts\python.exe" -m pip install -q -r requirements.txt
echo.
echo Starting Path Optimization Service on Port 8081...
echo.
"c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8081
pause
