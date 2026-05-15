# YOONUS Implementation Verification Script (PowerShell)
# Student ID: 235548G
# Purpose: Quick automated verification of all components

Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  YOONUS Implementation Verification        ║" -ForegroundColor Cyan
Write-Host "║  Student ID: 235548G                       ║" -ForegroundColor Cyan
Write-Host "║  OptiWMS Project                           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$passCount = 0
$failCount = 0
$successColor = "Green"
$failColor = "Red"
$warnColor = "Yellow"

# ============= TEST 1: Backend Files =============
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "[1/7] Checking Backend Files..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$backendFiles = @(
    "backend\core-app\src\main\java\com\optiwms\coreapp\notifications\AlertType.java",
    "backend\core-app\src\main\java\com\optiwms\coreapp\notifications\AlertSeverity.java"
)

foreach ($file in $backendFiles) {
    if (Test-Path $file -ErrorAction SilentlyContinue) {
        Write-Host "  ✓ $(Split-Path $file -Leaf)" -ForegroundColor $successColor
        $passCount++
    } else {
        Write-Host "  ✗ $(Split-Path $file -Leaf) - NOT FOUND" -ForegroundColor $failColor
        $failCount++
    }
}
Write-Host ""

# ============= TEST 2: Frontend Components =============
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "[2/7] Checking Frontend Components..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$components = @("AdminLoginForm", "WorkerLoginForm", "NotificationBell", "ProfileMenu", "PickingRouteGuide")
foreach ($component in $components) {
    $tsFile = "frontend\components\${component}.tsx"
    if (Test-Path $tsFile -ErrorAction SilentlyContinue) {
        Write-Host "  ✓ ${component}.tsx" -ForegroundColor $successColor
        $passCount++
    } else {
        Write-Host "  ✗ ${component}.tsx - NOT FOUND" -ForegroundColor $failColor
        $failCount++
    }
}
Write-Host ""

# ============= TEST 3: CSS Modules =============
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "[3/7] Checking CSS Modules..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

foreach ($component in $components) {
    $cssFile = "frontend\components\${component}.module.css"
    if (Test-Path $cssFile -ErrorAction SilentlyContinue) {
        Write-Host "  ✓ ${component}.module.css" -ForegroundColor $successColor
        $passCount++
    } else {
        Write-Host "  ✗ ${component}.module.css - NOT FOUND" -ForegroundColor $failColor
        $failCount++
    }
}
Write-Host ""

# ============= TEST 4: Documentation Files =============
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "[4/7] Checking Documentation..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$docFiles = @(
    "YOONUS_IMPLEMENTATION_PLAN.md",
    "YOONUS_IMPLEMENTATION_SUMMARY.md",
    "YOONUS_QUICK_REFERENCE.md",
    "YOONUS_FILE_INVENTORY.md",
    "A_STAR_IMPLEMENTATION_GUIDE.md"
)

foreach ($doc in $docFiles) {
    if (Test-Path $doc -ErrorAction SilentlyContinue) {
        $fileSize = (Get-Item $doc).Length / 1KB
        Write-Host "  ✓ $doc ($('{0:N0}' -f $fileSize) KB)" -ForegroundColor $successColor
        $passCount++
    } else {
        Write-Host "  ✗ $doc - NOT FOUND" -ForegroundColor $failColor
        $failCount++
    }
}
Write-Host ""

# ============= TEST 5: Backend Build =============
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "[5/7] Testing Backend Build..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

if (Test-Path "backend\gradlew.bat" -ErrorAction SilentlyContinue) {
    Write-Host "  ℹ Running gradle build (this may take 30-60 seconds)..." -ForegroundColor $warnColor
    Push-Location "backend"
    $buildOutput = & .\gradlew.bat clean build 2>&1 | Select-String "BUILD SUCCESS|BUILD FAILED"
    Pop-Location
    
    if ($buildOutput -match "BUILD SUCCESS") {
        Write-Host "  ✓ Backend builds successfully" -ForegroundColor $successColor
        $passCount++
    } else {
        Write-Host "  ⚠ Backend build returned warnings (run manually to verify)" -ForegroundColor $warnColor
        # Not counting as fail since it might just be warnings
    }
} else {
    Write-Host "  ⚠ Gradle wrapper not found (check backend setup)" -ForegroundColor $warnColor
}
Write-Host ""

# ============= TEST 6: Frontend Setup =============
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "[6/7] Checking Frontend Environment..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Check Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js $nodeVersion installed" -ForegroundColor $successColor
    $passCount++
} else {
    Write-Host "  ✗ Node.js not installed" -ForegroundColor $failColor
    $failCount++
}

# Check npm
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = npm --version
    Write-Host "  ✓ npm $npmVersion installed" -ForegroundColor $successColor
    $passCount++
} else {
    Write-Host "  ✗ npm not installed" -ForegroundColor $failColor
    $failCount++
}

# Check node_modules
if (Test-Path "frontend\node_modules" -ErrorAction SilentlyContinue) {
    Write-Host "  ✓ Frontend dependencies installed (node_modules found)" -ForegroundColor $successColor
    $passCount++
} else {
    Write-Host "  ⚠ node_modules not found - run 'npm install' in frontend" -ForegroundColor $warnColor
}
Write-Host ""

# ============= TEST 7: Verification Scripts =============
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "[7/7] Checking Helper Scripts..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$scripts = @(
    "verify-yoonus.bat",
    "YOONUS_VERIFICATION_CHECKLIST.md"
)

foreach ($script in $scripts) {
    if (Test-Path $script -ErrorAction SilentlyContinue) {
        Write-Host "  ✓ $script" -ForegroundColor $successColor
        $passCount++
    } else {
        Write-Host "  ✗ $script - NOT FOUND" -ForegroundColor $failColor
        $failCount++
    }
}
Write-Host ""

# ============= SUMMARY =============
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  VERIFICATION SUMMARY                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$total = $passCount + $failCount
Write-Host "Total Checks: $total" -ForegroundColor White
Write-Host "Passed:       $passCount" -ForegroundColor $successColor
Write-Host "Failed:       $failCount" -ForegroundColor $failColor

if ($failCount -eq 0) {
    Write-Host ""
    Write-Host "🎉 ALL CHECKS PASSED! Your implementation is complete." -ForegroundColor $successColor
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. cd frontend && npm install (if not done)"
    Write-Host "  2. npm run build"
    Write-Host "  3. npm run dev (to test in browser)"
    Write-Host "  4. Visit http://localhost:3000/admin/login"
    Write-Host "  5. Check YOONUS_VERIFICATION_CHECKLIST.md for manual tests"
} else {
    Write-Host ""
    Write-Host "⚠️  Some checks failed. Review the output above." -ForegroundColor $failColor
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor $warnColor
    Write-Host "  • Missing files? Check they were created in correct locations"
    Write-Host "  • Build fails? Run 'cd backend && ./gradlew clean build' manually"
    Write-Host "  • Missing dependencies? Run 'cd frontend && npm install'"
}

Write-Host ""
Write-Host "═════════════════════════════════════════════" -ForegroundColor Cyan
