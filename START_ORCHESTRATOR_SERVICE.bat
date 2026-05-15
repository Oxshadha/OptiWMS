@echo off
setlocal enabledelayedexpansion
cd /d "c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\ai-services\orchestrator-service"
echo Installing dependencies for Orchestrator Service...
"c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\.venv\Scripts\python.exe" -m pip install -q -r requirements.txt
echo.
echo Starting Orchestrator Service on Port 8084...
echo.
"c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8084
pause
