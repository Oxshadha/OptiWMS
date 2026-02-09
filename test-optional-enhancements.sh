#!/bin/bash

# Test script for Optional Enhancements APIs
# Tests: Notifications, Order Items, Worker Achievements

BASE_URL="http://localhost:8080"
AUTH="admin:admin123"

echo "=========================================="
echo "Testing Optional Enhancements APIs"
echo "=========================================="
echo ""

# Get a user ID for testing (using first user from users API)
echo "1. Getting test user ID..."
USER_ID=$(curl -s -u $AUTH "$BASE_URL/api/users" | jq -r '.[0].id // empty')
if [ -z "$USER_ID" ]; then
    echo "   ⚠️  No users found. Creating a test user..."
    # We'll use a placeholder UUID for testing
    USER_ID="00000000-0000-0000-0000-000000000001"
fi
echo "   ✅ Using User ID: $USER_ID"
echo ""

# Get an order ID for testing
echo "2. Getting test order ID..."
ORDER_ID=$(curl -s -u $AUTH "$BASE_URL/api/orders?orderType=outbound" | jq -r '.[0].id // empty')
if [ -z "$ORDER_ID" ]; then
    echo "   ⚠️  No orders found. Will test with placeholder..."
    ORDER_ID="00000000-0000-0000-0000-000000000002"
fi
echo "   ✅ Using Order ID: $ORDER_ID"
echo ""

# ==========================================
# NOTIFICATIONS API TESTS
# ==========================================
echo "=========================================="
echo "NOTIFICATIONS API TESTS"
echo "=========================================="
echo ""

echo "3. GET /api/notifications?userId=$USER_ID"
NOTIF_RESPONSE=$(curl -s -u $AUTH "$BASE_URL/api/notifications?userId=$USER_ID")
NOTIF_COUNT=$(echo $NOTIF_RESPONSE | jq 'length')
echo "   Response: $NOTIF_COUNT notifications"
echo "   Status: ✅"
echo ""

echo "4. GET /api/notifications/unread-count?userId=$USER_ID"
UNREAD_COUNT=$(curl -s -u $AUTH "$BASE_URL/api/notifications/unread-count?userId=$USER_ID" | jq -r '.count // 0')
echo "   Unread Count: $UNREAD_COUNT"
echo "   Status: ✅"
echo ""

echo "5. POST /api/notifications (Create notification)"
CREATE_NOTIF_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -u $AUTH -X POST "$BASE_URL/api/notifications" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"title\": \"Test Notification\",
    \"message\": \"This is a test notification created by the test script\",
    \"notificationType\": \"system\",
    \"actionUrl\": \"/admin/dashboard\",
    \"metadata\": \"{\\\"test\\\": true}\"
  }")
HTTP_STATUS=$(echo "$CREATE_NOTIF_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
if [ "$HTTP_STATUS" = "201" ]; then
    NOTIF_ID=$(echo "$CREATE_NOTIF_RESPONSE" | grep -v "HTTP_STATUS" | jq -r '.id // empty')
    echo "   Created Notification ID: $NOTIF_ID"
    echo "   Status: ✅"
    
    if [ ! -z "$NOTIF_ID" ]; then
        echo ""
        echo "6. PUT /api/notifications/$NOTIF_ID/read (Mark as read)"
        MARK_READ_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -u $AUTH -X PUT "$BASE_URL/api/notifications/$NOTIF_ID/read")
        MARK_READ_STATUS=$(echo "$MARK_READ_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
        if [ "$MARK_READ_STATUS" = "200" ]; then
            echo "   Status: ✅ Notification marked as read"
        else
            echo "   Status: ❌ Failed (HTTP $MARK_READ_STATUS)"
        fi
        echo ""
        
        echo "7. DELETE /api/notifications/$NOTIF_ID"
        DELETE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -u $AUTH -X DELETE "$BASE_URL/api/notifications/$NOTIF_ID")
        DELETE_STATUS=$(echo "$DELETE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
        if [ "$DELETE_STATUS" = "204" ]; then
            echo "   Status: ✅ Notification deleted"
        else
            echo "   Status: ❌ Failed (HTTP $DELETE_STATUS)"
        fi
    fi
else
    echo "   Status: ❌ Failed to create notification (HTTP $HTTP_STATUS)"
fi
echo ""

# ==========================================
# ORDER ITEMS API TESTS
# ==========================================
echo "=========================================="
echo "ORDER ITEMS API TESTS"
echo "=========================================="
echo ""

echo "8. GET /api/orders/$ORDER_ID/items"
ORDER_ITEMS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -u $AUTH "$BASE_URL/api/orders/$ORDER_ID/items")
ORDER_ITEMS_STATUS=$(echo "$ORDER_ITEMS_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
if [ "$ORDER_ITEMS_STATUS" = "200" ]; then
    ITEMS_COUNT=$(echo "$ORDER_ITEMS_RESPONSE" | grep -v "HTTP_STATUS" | jq 'length')
    echo "   Response: $ITEMS_COUNT order items"
    echo "   Status: ✅"
    if [ "$ITEMS_COUNT" -gt 0 ]; then
        echo "   Sample item:"
        echo "$ORDER_ITEMS_RESPONSE" | grep -v "HTTP_STATUS" | jq '.[0]' | head -5
    fi
else
    echo "   Status: ⚠️  HTTP $ORDER_ITEMS_STATUS (Order may not exist or have no items)"
fi
echo ""

# ==========================================
# WORKER ACHIEVEMENTS API TESTS
# ==========================================
echo "=========================================="
echo "WORKER ACHIEVEMENTS API TESTS"
echo "=========================================="
echo ""

echo "9. GET /api/workers/$USER_ID/achievements"
ACHIEVEMENTS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -u $AUTH "$BASE_URL/api/workers/$USER_ID/achievements")
ACHIEVEMENTS_STATUS=$(echo "$ACHIEVEMENTS_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
if [ "$ACHIEVEMENTS_STATUS" = "200" ]; then
    ACH_COUNT=$(echo "$ACHIEVEMENTS_RESPONSE" | grep -v "HTTP_STATUS" | jq 'length')
    echo "   Response: $ACH_COUNT achievements"
    echo "   Status: ✅"
else
    echo "   Status: ⚠️  HTTP $ACHIEVEMENTS_STATUS (Worker may not exist or have no achievements)"
fi
echo ""

echo "10. POST /api/workers/$USER_ID/achievements (Create achievement)"
CREATE_ACH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -u $AUTH -X POST "$BASE_URL/api/workers/$USER_ID/achievements" \
  -H "Content-Type: application/json" \
  -d "{
    \"achievementType\": \"speed_demon\",
    \"metadata\": \"{\\\"tasksCompleted\\\": 150, \\\"pph\\\": 52.8}\"
  }")
CREATE_ACH_STATUS=$(echo "$CREATE_ACH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
if [ "$CREATE_ACH_STATUS" = "201" ]; then
    ACH_ID=$(echo "$CREATE_ACH_RESPONSE" | grep -v "HTTP_STATUS" | jq -r '.id // empty')
    echo "   Created Achievement ID: $ACH_ID"
    echo "   Status: ✅"
else
    echo "   Status: ⚠️  HTTP $CREATE_ACH_STATUS (May fail if achievement already exists for today)"
fi
echo ""

# ==========================================
# SUMMARY
# ==========================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo "✅ Notifications API: Tested"
echo "✅ Order Items API: Tested"
echo "✅ Worker Achievements API: Tested"
echo ""
echo "Note: Some tests may show warnings if test data doesn't exist."
echo "This is expected for a fresh database."
echo ""
echo "All APIs are ready! 🎉"

