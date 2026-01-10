# Login System Guide

## ✅ All Changes Completed

### 1. Default Admin User
- **Auto-created on first backend startup** via `DefaultUserSeeder`
- **Credentials:**
  - Email: `admin@optiwms.com`
  - Password: `admin123`
  - Username: `admin`

### 2. Admin Login Page (`/admin/login`)
**Removed:**
- ❌ "Role (for testing)" dropdown
- ❌ Warehouse selection dropdown
- ❌ All testing/demo text

**Now:**
- ✅ Login by **email and password only**
- ✅ Error message: "Invalid email or password" (user-friendly)
- ✅ Loading state during login
- ✅ Email format validation
- ✅ Role auto-detected from user account

### 3. Worker Login Page (`/worker/login`)
**Removed:**
- ❌ "optional for demo" placeholders
- ❌ "Select Role (for testing)" dropdown
- ❌ "choose different roles to test permissions" text

**Now:**
- ✅ Login by **Employee ID and password**
- ✅ Error message: "Invalid Employee ID or password" (user-friendly)
- ✅ Loading state during login
- ✅ Role auto-detected from user account

### 4. Authentication Features
- ✅ Login by email, username, or employee ID
- ✅ Password verification with BCrypt
- ✅ Account status checking (active/inactive)
- ✅ User-friendly error messages (no technical details)
- ✅ JWT token generation and storage

## How to Use

### First Time Setup

1. **Start the backend:**
   ```bash
   cd backend
   ./gradlew bootRun
   ```
   - Default admin user will be created automatically
   - Check console for: "✅ Default admin user created"

2. **Login to Admin Panel:**
   - Go to: `http://localhost:3000/admin/login`
   - Email: `admin@optiwms.com`
   - Password: `admin123`
   - Click "Login"

3. **Create More Users:**
   - After login, go to `/admin/admins`
   - Click "Add Manager"
   - Fill the form (password will be auto-hashed)
   - Submit

### Creating Users

**Option 1: Via Frontend (Recommended)**
1. Login as admin
2. Go to `/admin/admins`
3. Click "Add Manager"
4. Fill form and submit

**Option 2: Generate Synthetic Users**
```bash
# After logging in and getting token:
curl -X POST http://localhost:8080/api/integration/users/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adminCount": 1,
    "warehouseManagerCount": 2,
    "workerCount": 10
  }'
```
Default password: `password123`

**Option 3: Create Single User via API**
```bash
curl -X POST http://localhost:8080/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
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

## Error Messages

### Admin Login
- **Empty fields**: "Please enter email and password"
- **Invalid email format**: "Please enter a valid email address"
- **Wrong credentials**: "Invalid email or password"
- **Account inactive**: "Account is inactive. Please contact administrator."

### Worker Login
- **Empty fields**: "Please enter Employee ID and Password"
- **Wrong credentials**: "Invalid Employee ID or password"
- **Account inactive**: "Account is inactive. Please contact administrator."
- **Wrong role**: "Access denied. This account is not authorized for worker portal."

## Empty Database Handling

If the database is empty:
1. **DefaultUserSeeder** will automatically create the admin user on backend startup
2. You can login immediately with the default credentials
3. After login, create more users via the frontend

## Security Notes

- ✅ Passwords are automatically hashed with BCrypt (strength 12)
- ✅ JWT tokens stored in localStorage
- ✅ Token expiration: 15 minutes (access), 7 days (refresh)
- ✅ Rate limiting: 5 login attempts per minute per IP
- ✅ All error messages are user-friendly (no technical details exposed)

## Troubleshooting

**"Invalid email or password" error:**
- Check if user exists in database
- Verify password is correct
- Ensure user status is "active"

**401 Unauthorized on dashboard:**
- Make sure you're logged in
- Check if token exists: `localStorage.getItem('accessToken')`
- If null, login again

**Default admin not created:**
- Check backend console for errors
- Verify database connection
- Check if users table exists

