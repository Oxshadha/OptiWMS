# Authentication & User Management Guide

## Overview

The OptiWMS system now has a complete authentication system with:
- JWT token-based authentication
- BCrypt password hashing
- Rate limiting (5 attempts/minute)
- Role-based access control
- User management capabilities

## Features Implemented

### 1. Authentication
- **JWT Tokens**: Access tokens (15 minutes) and refresh tokens (7 days)
- **Password Hashing**: BCrypt with strength 12
- **Rate Limiting**: 5 login attempts per minute per IP address
- **Role-Based Access**: Different endpoints require different roles

### 2. User Management
- **Create Users**: Via frontend (Admins page) or API
- **Generate Synthetic Users**: Bulk user generation with hashed passwords
- **Password Migration**: Migrate existing plain text passwords to BCrypt

## How to Use

### Creating Users via Frontend

1. Navigate to `/admin/admins` page
2. Click "Add Manager" button
3. Fill in the form:
   - First Name, Last Name
   - Email (used as username)
   - Password (will be automatically hashed)
   - Role (admin, warehouse_manager, inbound_coordinator)
   - Warehouse (required for warehouse managers)
4. Click "Create Manager"

### Creating Users via API

```bash
curl -X POST http://localhost:8080/api/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john.doe",
    "email": "john.doe@optiwms.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "picker",
    "status": "active"
  }'
```

### Generating Synthetic Users

```bash
curl -X POST http://localhost:8080/api/integration/users/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adminCount": 2,
    "warehouseManagerCount": 5,
    "workerCount": 20
  }'
```

**Default Password**: All generated users have password `password123`

### Migrating Existing Passwords

If you have existing users with plain text passwords:

```bash
curl -X POST http://localhost:8080/api/integration/users/migrate-passwords \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

This will hash all plain text passwords in the database.

## Login

### Admin Login
- URL: `http://localhost:3000/admin/login`
- Uses email/username and password
- Fetches real warehouses from database
- Returns JWT tokens

### Worker Login
- URL: `http://localhost:3000/worker/login`
- Uses Employee ID and password
- Returns JWT tokens
- Redirects to role-specific dashboard

## Role-Based Access Control

### Roles
- **ADMIN**: Full access to all endpoints
- **WAREHOUSE_MANAGER**: Access to warehouse operations, user management
- **INBOUND_COORDINATOR**: Access to inbound operations, master data
- **PICKER, PACKER, PUTAWAY, RECEIVER**: Worker roles with limited access

### Endpoint Access
- `/api/users/**`: ADMIN, WAREHOUSE_MANAGER
- `/api/integration/**`: ADMIN only
- `/api/master/**`: ADMIN, WAREHOUSE_MANAGER, INBOUND_COORDINATOR
- `/api/**`: All authenticated users

## Testing

Run the test script:
```bash
./test-authentication.sh
```

This will test:
1. Login with valid credentials
2. Get current user info
3. Rate limiting
4. Token refresh
5. User creation
6. Synthetic user generation

## Security Notes

1. **Passwords**: Always use the `password` field (not `passwordHash`) when creating users. The system automatically hashes it.

2. **Tokens**: Store JWT tokens securely. Currently using localStorage, but consider httpOnly cookies for production.

3. **Rate Limiting**: Login endpoint is rate-limited to prevent brute force attacks.

4. **Password Policy**: Consider adding password complexity requirements in production.

## Troubleshooting

### "User not found" error
- Ensure user exists in database
- Check username/email spelling
- Verify user status is "active"

### "Invalid credentials" error
- Check password is correct
- If password was recently migrated, ensure migration completed successfully
- Try resetting password via user update endpoint

### Rate limiting triggered
- Wait 1 minute before trying again
- Check if multiple requests are coming from same IP

### Token expired
- Use refresh token to get new access token
- If refresh token expired, user must login again

