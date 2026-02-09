#!/bin/bash

# Verify admin user via Backend API (no direct database access needed)

echo "🔍 Verifying Admin User via Backend API..."
echo ""

# Check if backend is running
if ! curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo "❌ Backend is not running on port 8080"
    echo ""
    echo "Please start the backend:"
    echo "  cd backend && ./gradlew bootRun"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Test login with admin credentials
echo "🧪 Testing admin login..."
echo ""

LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@optiwms.com","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Admin login successful!"
    echo ""
    echo "User details:"
    echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
    echo ""
    echo "✅ Admin user exists and password is correct!"
    exit 0
elif echo "$LOGIN_RESPONSE" | grep -q '"success":false'; then
    ERROR_MSG=$(echo "$LOGIN_RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    echo "❌ Login failed: $ERROR_MSG"
    echo ""
    echo "Response:"
    echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
    echo ""
    echo "💡 Possible issues:"
    echo "  1. Password hash might be incorrect"
    echo "  2. User might not exist"
    echo "  3. Try restarting backend to update password hash"
    exit 1
else
    echo "❌ Unexpected response from backend"
    echo ""
    echo "Response:"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

