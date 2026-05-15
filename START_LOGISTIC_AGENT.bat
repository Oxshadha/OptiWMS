@echo off
cd /d "%~dp0ai-services\logistic-agent"
echo Installing Logistic Agent dependencies...
python -m pip install --upgrade pip uvicorn fastapi pydantic httpx --quiet
echo.
echo Starting Logistic Agent on port 3001...
python -m uvicorn app.main:app --reload --port 3001
pause
