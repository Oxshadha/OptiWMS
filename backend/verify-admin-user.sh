#!/bin/bash

# Script to verify and fix admin user in database

echo "🔍 Verifying Admin User..."
echo ""

# Check if PostgreSQL is running (try both ports)
DB_PORT=5434  # Default to Docker port
if pg_isready -h localhost -p 5434 -U optiwms > /dev/null 2>&1; then
    DB_PORT=5434
    echo "✅ PostgreSQL found on port 5434 (Docker)"
elif pg_isready -h localhost -p 5432 -U optiwms > /dev/null 2>&1; then
    DB_PORT=5432
    echo "✅ PostgreSQL found on port 5432 (Local)"
elif pg_isready -h localhost -p 5434 > /dev/null 2>&1; then
    DB_PORT=5434
    echo "✅ PostgreSQL found on port 5434 (Docker - no user check)"
elif pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    DB_PORT=5432
    echo "✅ PostgreSQL found on port 5432 (Local - no user check)"
else
    echo "❌ PostgreSQL is not running. Please start it first."
    echo ""
    echo "To start PostgreSQL:"
    echo "  cd infra && docker-compose up -d db"
    echo ""
    echo "Checking Docker container status..."
    docker ps | grep optiwms-db || echo "  Container optiwms-db is not running"
    exit 1
fi

# Database connection details
DB_NAME="optiwms"
DB_USER="optiwms"
DB_PASSWORD="optiwms"

# Check if admin user exists
echo "Checking if admin user exists..."
ADMIN_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users WHERE email = 'admin@optiwms.com' OR username = 'admin';" 2>/dev/null | tr -d ' ')

if [ "$ADMIN_EXISTS" -gt 0 ]; then
    echo "✅ Admin user found in database"
    echo ""
    echo "User details:"
    PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT username, email, role, status, LEFT(password_hash, 20) as password_hash_preview FROM users WHERE email = 'admin@optiwms.com' OR username = 'admin';"
else
    echo "❌ Admin user NOT found in database"
    echo ""
    echo "The DefaultUserSeeder should create this on backend startup."
    echo "Please restart the backend to trigger user creation."
fi

echo ""
echo "💡 To fix password issues, restart the backend - it will update the password hash automatically."

