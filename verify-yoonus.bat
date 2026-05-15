@echo off
REM YOONUS Implementation - Quick Verification Script
REM Run this to verify all components are working

setlocal enabledelayedexpansion

cls
echo ============================================
echo YOONUS Implementation Verification
echo Student ID: 235548G
echo ============================================
echo.

REM Test 1: Check Backend Files
echo [1/6] Checking Backend Files...
if exist "backend\core-app\src\main\java\com\optiwms\coreapp\notifications\AlertType.java" (
    echo   ✓ AlertType.java found
) else (
    echo   ✗ AlertType.java NOT FOUND
)

if exist "backend\core-app\src\main\java\com\optiwms\coreapp\notifications\AlertSeverity.java" (
    echo   ✓ AlertSeverity.java found
) else (
    echo   ✗ AlertSeverity.java NOT FOUND
)
echo.

REM Test 2: Check Frontend Components
echo [2/6] Checking Frontend Components...
set components=AdminLoginForm WorkerLoginForm NotificationBell ProfileMenu PickingRouteGuide
for %%C in (%components%) do (
    if exist "frontend\components\%%C.tsx" (
        echo   ✓ %%C.tsx found
    ) else (
        echo   ✗ %%C.tsx NOT FOUND
    )
)
echo.

REM Test 3: Check CSS Modules
echo [3/6] Checking CSS Modules...
for %%C in (%components%) do (
    if exist "frontend\components\%%C.module.css" (
        echo   ✓ %%C.module.css found
    ) else (
        echo   ✗ %%C.module.css NOT FOUND
    )
)
echo.

REM Test 4: Check Documentation
echo [4/6] Checking Documentation Files...
set docs=YOONUS_IMPLEMENTATION_PLAN.md YOONUS_IMPLEMENTATION_SUMMARY.md YOONUS_QUICK_REFERENCE.md YOONUS_FILE_INVENTORY.md
for %%D in (%docs%) do (
    if exist "%%D" (
        echo   ✓ %%D found
    ) else (
        echo   ✗ %%D NOT FOUND
    )
)
echo.

REM Test 5: Build Backend
echo [5/6] Building Backend...
cd backend
call gradlew.bat clean build > NUL 2>&1
if errorlevel 0 (
    echo   ✓ Backend builds successfully
) else (
    echo   ✗ Backend build failed - check errors manually
)
cd ..
echo.

REM Test 6: Node Modules and Dependencies
echo [6/6] Checking Frontend Dependencies...
cd frontend
if exist "node_modules" (
    echo   ✓ node_modules directory found
) else (
    echo   ⚠ node_modules not found - run 'npm install'
)
cd ..
echo.

echo ============================================
echo Verification Complete
echo ============================================
echo.
echo Next Steps:
echo 1. Review detailed results above
echo 2. Check YOONUS_VERIFICATION_CHECKLIST.md for detailed tests
echo 3. Run: npm install (if needed)
echo 4. Run: npm run build (frontend)
echo 5. Run: npm run dev (to test in browser)
echo.
pause
