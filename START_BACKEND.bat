@echo off
cd /d "ai-services\path-optimization-service"
echo Installing dependencies...
python.exe -m pip install -q uvicorn fastapi pydantic
echo.
echo Starting Backend on Port 8081...
echo.
python.exe -m uvicorn app.main:app --reload --port 8081
pause
