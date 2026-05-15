@echo off
REM OptiWMS Full Project Startup Script
REM This script starts all three components of the OptiWMS system

echo.
echo ==========================================
echo OptiWMS Full Project Launcher
echo ==========================================
echo.

REM Check if we're in the right directory
if not exist "backend\gradlew.bat" (
    echo ERROR: Please run this script from the OptiWMS root directory
    pause
    exit /b 1
)

echo Starting OptiWMS components...
echo.

REM Check PostgreSQL is running
echo Checking PostgreSQL connection...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U optiwms -h 127.0.0.1 -p 5434 optiwms -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Cannot connect to PostgreSQL on port 5434
    echo Please ensure PostgreSQL is running and the optiwms database exists
    pause
    exit /b 1
)
echo  ✓ PostgreSQL connected

REM Start Backend in new window
echo.
echo Starting Backend (Spring Boot on port 8080)...
start "OptiWMS Backend" cmd /k "cd backend && .\gradlew.bat :core-api:bootRun"
timeout /t 3 /nobreak

REM Start Frontend in new window
echo.
echo Starting Frontend (Next.js on port 3000)...
start "OptiWMS Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 2 /nobreak

echo.
echo ==========================================
echo OptiWMS is starting...
echo ==========================================
echo.
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:8080
echo Database:  localhost:5434
echo.
echo Admin credentials:
echo   Email:    admin@optiwms.com
echo   Password: admin123
echo.
echo NOTE: Three terminal windows will open:
echo   - Backend (Gradle/Java)
echo   - Frontend (Node.js/npm)
echo   - This launcher window
echo.
echo Close any window to stop that component.
echo.
pause
