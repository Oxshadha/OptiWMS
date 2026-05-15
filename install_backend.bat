@echo off
cd /d "ai-services\path-optimization-service"
python.exe -m pip install uvicorn fastapi pydantic
pause
