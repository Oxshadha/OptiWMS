@echo off
cd /d "frontend"
echo Installing dependencies...
call npm install
echo.
echo Starting Frontend on Port 3000...
echo.
call npm run dev
pause
