# Authentication & Security Implementation Plan

## Current Issues

1. **Warehouses**: Login pages use hardcoded "Warehouse 1" and "Warehouse 2" instead of real warehouses from database
2. **Authentication**: No real authentication - using mock data
3. **Security**: 
   - Passwords stored as plain text (`{noop}` prefix)
   - No JWT tokens
   - No rate limiting
   - APIs exposed in console
   - No password hashing

## Implementation Steps

### Phase 1: Fix Login Pages (Quick Fix)
- ✅ Update admin login to fetch real warehouses from API
- ⏳ Update worker login (if needed)
- ⏳ Connect login forms to actual authentication endpoints

### Phase 2: Implement Spring Security with JWT
1. Add JWT dependencies to `build.gradle.kts`
2. Create JWT utility classes (JwtTokenProvider, JwtAuthenticationFilter)
3. Update SecurityConfig to use JWT instead of Basic Auth
4. Create CustomUserDetailsService to load users from database
5. Implement password hashing with BCrypt

### Phase 3: Authentication Endpoints
1. Create proper `/api/auth/login` endpoint that:
   - Validates credentials
   - Returns JWT token
   - Updates last login time
2. Create `/api/auth/refresh` endpoint for token refresh
3. Create `/api/auth/logout` endpoint
4. Update `/api/auth/me` to return full user details

### Phase 4: Rate Limiting
1. Add Spring Boot Starter Cache
2. Implement rate limiting for login endpoints (e.g., 5 attempts per minute per IP)

### Phase 5: Frontend Integration
1. Update frontend API client to use JWT tokens
2. Store tokens in httpOnly cookies or localStorage
3. Implement token refresh logic
4. Update all API calls to include JWT token

### Phase 6: Password Migration
1. Create migration script to hash existing passwords
2. Update user creation/update to hash passwords

## Files to Create/Modify

### Backend
- `backend/core-api/build.gradle.kts` - Add JWT dependencies
- `backend/core-api/src/main/java/com/optiwms/coreapi/config/SecurityConfig.java` - Update security config
- `backend/core-api/src/main/java/com/optiwms/coreapi/auth/JwtTokenProvider.java` - NEW
- `backend/core-api/src/main/java/com/optiwms/coreapi/auth/JwtAuthenticationFilter.java` - NEW
- `backend/core-api/src/main/java/com/optiwms/coreapi/auth/CustomUserDetailsService.java` - NEW
- `backend/core-api/src/main/java/com/optiwms/coreapi/auth/AuthController.java` - Update with real authentication
- `backend/core-app/src/main/java/com/optiwms/coreapp/users/UserService.java` - Add password hashing

### Frontend
- `frontend/app/admin/login/page.tsx` - ✅ Fixed to fetch real warehouses
- `frontend/app/worker/login/page.tsx` - Update to use real authentication
- `frontend/lib/api/client.ts` - Update to use JWT tokens
- `frontend/lib/api/auth.ts` - NEW - Authentication API client

## Security Best Practices
- Use BCrypt for password hashing (strength 12)
- JWT tokens with 15-minute expiration
- Refresh tokens with 7-day expiration
- Rate limiting: 5 login attempts per minute per IP
- Store tokens in httpOnly cookies (more secure than localStorage)
- Implement CSRF protection for state-changing operations
