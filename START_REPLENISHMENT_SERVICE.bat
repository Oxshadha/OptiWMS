@echo off
echo Starting Replenishment Service...
cd ai_services\replenishment-service
call venv\Scripts\activate
uvicorn app.main:app --reload --port 8095
