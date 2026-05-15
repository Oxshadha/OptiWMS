@echo off
setlocal enabledelayedexpansion
cd /d "c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\ai-services\slotting-service"
echo Installing dependencies for Slotting Service...
"c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\.venv\Scripts\python.exe" -m pip install -q -r requirements.txt
echo.
echo Starting Slotting Service on Port 8083...
echo.
"c:\Users\VICTUS\OneDrive\Desktop\New folder\OptiWMS\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8083
pause
