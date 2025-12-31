#!/bin/bash

# Test Authentication Flow
# This script tests the complete authentication system

API_URL="http://localhost:8080/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 Testing OptiWMS Authentication System"
echo "========================================"
echo ""

# Test 1: Login with valid credentials
echo "Test 1: Login with valid credentials"
echo "-----------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
  echo -e "${GREEN}✅ Login successful${NC}"
  ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
  REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.refreshToken')
  echo "Access Token: ${ACCESS_TOKEN:0:50}..."
  echo "Refresh Token: ${REFRESH_TOKEN:0:50}..."
else
  echo -e "${RED}❌ Login failed${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo "Test 2: Get current user info"
echo "-------------------------------"
USER_INFO=$(curl -s -X GET "$API_URL/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$USER_INFO" | grep -q "username"; then
  echo -e "${GREEN}✅ User info retrieved${NC}"
  echo "$USER_INFO" | jq '.'
else
  echo -e "${RED}❌ Failed to get user info${NC}"
  echo "$USER_INFO"
fi

echo ""
echo "Test 3: Test rate limiting (make 6 requests)"
echo "--------------------------------------------"
for i in {1..6}; do
  RATE_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"wrong","password":"wrong"}')
  HTTP_CODE=$(echo "$RATE_TEST" | grep "HTTP_CODE" | cut -d: -f2)
  if [ "$HTTP_CODE" = "429" ]; then
    echo -e "${YELLOW}⚠️  Rate limit triggered on attempt $i${NC}"
    break
  fi
done

echo ""
echo "Test 4: Refresh token"
echo "---------------------"
REFRESH_RESPONSE=$(curl -s -X POST "$API_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

if echo "$REFRESH_RESPONSE" | grep -q "accessToken"; then
  echo -e "${GREEN}✅ Token refresh successful${NC}"
  NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.accessToken')
  echo "New Access Token: ${NEW_ACCESS_TOKEN:0:50}..."
else
  echo -e "${RED}❌ Token refresh failed${NC}"
  echo "$REFRESH_RESPONSE"
fi

echo ""
echo "Test 5: Create a new user (requires admin token)"
echo "-------------------------------------------------"
CREATE_USER_RESPONSE=$(curl -s -X POST "$API_URL/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_'$(date +%s)'",
    "email": "testuser@optiwms.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "picker",
    "status": "active"
  }')

if echo "$CREATE_USER_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✅ User created successfully${NC}"
  USER_ID=$(echo "$CREATE_USER_RESPONSE" | jq -r '.id')
  echo "User ID: $USER_ID"
else
  echo -e "${RED}❌ User creation failed${NC}"
  echo "$CREATE_USER_RESPONSE"
fi

echo ""
echo "Test 6: Generate synthetic users (requires admin token)"
echo "-------------------------------------------------------"
GENERATE_RESPONSE=$(curl -s -X POST "$API_URL/integration/users/generate" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adminCount": 1,
    "warehouseManagerCount": 2,
    "workerCount": 5
  }')

if echo "$GENERATE_RESPONSE" | grep -q "success"; then
  echo -e "${GREEN}✅ Users generated successfully${NC}"
  echo "$GENERATE_RESPONSE" | jq '.'
else
  echo -e "${RED}❌ User generation failed${NC}"
  echo "$GENERATE_RESPONSE"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ Authentication tests completed!${NC}"

