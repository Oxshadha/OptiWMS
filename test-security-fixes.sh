#!/bin/bash

# Security Fixes Verification Script
# Run this after restarting backend to verify all security measures are working

echo "🔒 OptiWMS Security Verification"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Security Headers
echo "Test 1: Security Headers"
echo "------------------------"
RESPONSE=$(curl -sI http://localhost:8080/api/auth/login)

if echo "$RESPONSE" | grep -q "Content-Security-Policy"; then
    echo -e "${GREEN}✅ Content-Security-Policy header present${NC}"
else
    echo -e "${RED}❌ Content-Security-Policy header missing${NC}"
fi

if echo "$RESPONSE" | grep -q "X-Frame-Options"; then
    echo -e "${GREEN}✅ X-Frame-Options header present${NC}"
else
    echo -e "${RED}❌ X-Frame-Options header missing${NC}"
fi

if echo "$RESPONSE" | grep -q "X-Content-Type-Options"; then
    echo -e "${GREEN}✅ X-Content-Type-Options header present${NC}"
else
    echo -e "${RED}❌ X-Content-Type-Options header missing${NC}"
fi

if echo "$RESPONSE" | grep -q "X-XSS-Protection"; then
    echo -e "${GREEN}✅ X-XSS-Protection header present${NC}"
else
    echo -e "${RED}❌ X-XSS-Protection header missing${NC}"
fi

if echo "$RESPONSE" | grep -q "Referrer-Policy"; then
    echo -e "${GREEN}✅ Referrer-Policy header present${NC}"
else
    echo -e "${RED}❌ Referrer-Policy header missing${NC}"
fi

if echo "$RESPONSE" | grep -q "Permissions-Policy"; then
    echo -e "${GREEN}✅ Permissions-Policy header present${NC}"
else
    echo -e "${RED}❌ Permissions-Policy header missing${NC}"
fi

echo ""

# Test 2: CORS Configuration
echo "Test 2: CORS Configuration"
echo "--------------------------"
CORS_RESPONSE=$(curl -sI -H "Origin: http://localhost:3000" \
                      -H "Access-Control-Request-Method: POST" \
                      -X OPTIONS \
                      http://localhost:8080/api/auth/login)

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo -e "${GREEN}✅ CORS headers present${NC}"
else
    echo -e "${RED}❌ CORS headers missing${NC}"
fi

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Credentials"; then
    echo -e "${GREEN}✅ CORS credentials enabled${NC}"
else
    echo -e "${RED}❌ CORS credentials not enabled${NC}"
fi

echo ""

# Test 3: Rate Limiting
echo "Test 3: Rate Limiting"
echo "---------------------"
echo "Testing 6 rapid failed login attempts..."

RATE_LIMIT_PASSED=true
for i in {1..6}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"test","password":"wrong"}')
    
    if [ $i -le 5 ]; then
        if [ "$HTTP_CODE" = "401" ]; then
            echo -e "  Attempt $i: ${GREEN}✅ 401 (as expected)${NC}"
        else
            echo -e "  Attempt $i: ${RED}❌ $HTTP_CODE (expected 401)${NC}"
            RATE_LIMIT_PASSED=false
        fi
    else
        if [ "$HTTP_CODE" = "429" ]; then
            echo -e "  Attempt $i: ${GREEN}✅ 429 Too Many Requests (rate limiting works!)${NC}"
        else
            echo -e "  Attempt $i: ${RED}❌ $HTTP_CODE (expected 429)${NC}"
            RATE_LIMIT_PASSED=false
        fi
    fi
    sleep 0.5
done

echo ""

# Test 4: JWT Configuration
echo "Test 4: JWT Configuration"
echo "-------------------------"
if grep -q "jwt.accessTokenExpirationMs=900000" backend/core-api/src/main/resources/application.properties; then
    echo -e "${GREEN}✅ Access token expiration: 15 minutes${NC}"
else
    echo -e "${YELLOW}⚠️  Access token expiration not set to 15 minutes${NC}"
fi

if grep -q "jwt.refreshTokenExpirationMs=604800000" backend/core-api/src/main/resources/application.properties; then
    echo -e "${GREEN}✅ Refresh token expiration: 7 days${NC}"
else
    echo -e "${YELLOW}⚠️  Refresh token expiration not set to 7 days${NC}"
fi

echo ""

# Test 5: Production Logger
echo "Test 5: Production Logger"
echo "-------------------------"
if [ -f "frontend/lib/utils/logger.ts" ]; then
    echo -e "${GREEN}✅ Logger utility exists${NC}"
    
    if grep -q "import { logger } from '@/lib/utils/logger'" frontend/lib/api/auth.ts; then
        echo -e "${GREEN}✅ Auth API uses logger${NC}"
    else
        echo -e "${RED}❌ Auth API not using logger${NC}"
    fi
    
    if grep -q "import { logger } from '@/lib/utils/logger'" frontend/lib/api/client.ts; then
        echo -e "${GREEN}✅ API client uses logger${NC}"
    else
        echo -e "${RED}❌ API client not using logger${NC}"
    fi
else
    echo -e "${RED}❌ Logger utility not found${NC}"
fi

echo ""

# Test 6: Backend Running
echo "Test 6: Backend Health"
echo "----------------------"
HEALTH_RESPONSE=$(curl -s http://localhost:8080/actuator/health)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"UP"'; then
    echo -e "${GREEN}✅ Backend is running and healthy${NC}"
else
    echo -e "${RED}❌ Backend is not healthy or not running${NC}"
    echo "   Start backend with: cd backend && ./gradlew bootRun"
fi

echo ""

# Summary
echo "================================"
echo "📊 Security Verification Summary"
echo "================================"
echo ""
echo "If all tests pass ✅, your security fixes are working correctly!"
echo ""
echo "Next steps:"
echo "1. Test frontend: cd frontend && npm run dev"
echo "2. Login and verify token refresh works (wait 16 minutes after login)"
echo "3. Check browser console - should be empty in production mode"
echo "4. Deploy to staging!"
echo ""
echo "For production deployment:"
echo "- Generate secure JWT secret: openssl rand -base64 64"
echo "- Change default admin password"
echo "- Set environment variables (FRONTEND_URL, JWT_SECRET)"
echo "- Configure HTTPS"
echo ""
