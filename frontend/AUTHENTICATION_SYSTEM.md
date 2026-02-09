# Centralized Authentication System

## Overview

This document describes the centralized authentication system implemented for OptiWMS. The system provides a unified, industry-standard approach to handling authentication, authorization, and route protection.

## Architecture

### Key Components

1. **AuthContext** (`/lib/auth/AuthContext.tsx`)
   - Single source of truth for authentication state
   - Handles both admin and worker roles
   - Manages JWT tokens in localStorage
   - Provides unified login/logout/refresh methods

2. **RouteGuard** (`/lib/auth/RouteGuard.tsx`)
   - Centralized route protection component
   - Checks authentication and role requirements
   - Handles redirects for unauthorized access
   - Shows loading states during auth checks

3. **AuthProvider** (in root layout)
   - Wraps entire application
   - Provides auth context to all components
   - Handles cross-tab synchronization

## Features

### ✅ Centralized Authentication
- Single `AuthContext` manages all auth state
- No scattered auth logic across components
- Consistent token management

### ✅ Route Protection
- `RouteGuard` component protects routes
- Automatic redirects for unauthorized access
- Role-based access control (admin/worker)

### ✅ JWT Token Management
- Tokens stored in localStorage
- Automatic token refresh on 401 errors
- Cross-tab synchronization via storage events

### ✅ Role-Based Routing
- Admin routes require admin role
- Worker routes require worker role
- Automatic redirects based on user role

### ✅ Login Flow
- Centralized login function
- Role validation on login
- Automatic redirect after successful login
- Prevents access to wrong portal (admin/worker)

## Usage

### Protecting Routes

```tsx
import { RouteGuard } from "@/lib/auth/RouteGuard";

export default function AdminPage() {
  return (
    <RouteGuard requiredRole="admin">
      <div>Admin Content</div>
    </RouteGuard>
  );
}
```

### Using Auth Context

```tsx
import { useAuth } from "@/lib/auth/AuthContext";

export default function MyComponent() {
  const { user, isAuthenticated, isAdmin, login, logout } = useAuth();
  
  // Use auth state...
}
```

### Login Example

```tsx
const { login } = useAuth();

const handleLogin = async () => {
  const result = await login(email, password);
  if (result.success) {
    // Redirect handled automatically
  } else {
    // Show error: result.error
  }
};
```

## Route Protection Flow

1. User navigates to protected route
2. `RouteGuard` checks authentication
3. If not authenticated → redirect to appropriate login page
4. If authenticated but wrong role → redirect to correct dashboard
5. If authenticated and correct role → render content

## Token Management

### Storage
- **Access Token**: `localStorage.getItem('accessToken')`
- **Refresh Token**: `localStorage.getItem('refreshToken')`

### Refresh Flow
1. API call returns 401
2. `apiClient` attempts token refresh
3. If refresh succeeds → retry original request
4. If refresh fails → logout and redirect to login

### Cross-Tab Sync
- Storage events notify other tabs of token changes
- Custom `tokenChanged` event for same-tab notifications
- Automatic auth state reload on token change

## Admin vs Worker Separation

### Monolithic Architecture Solution
Since the application is monolithic (single backend, single frontend), we handle admin/worker separation by:

1. **Single Token Storage**: One token at a time (last login wins)
2. **Role-Based Routing**: Routes check user role and redirect accordingly
3. **Context Separation**: AdminContext and WorkerContext still exist for backward compatibility
4. **Automatic Redirects**: If admin tries to access worker routes (or vice versa), automatic redirect

### Can Admin and Worker Login at the Same Time?

**Short Answer: No, not simultaneously in the same browser/tab.**

**Why:**
- Single token storage (localStorage) - only one token can exist at a time
- Last login wins - when you log in as admin, it replaces the worker token (and vice versa)
- This is by design for security and simplicity

**However:**
- ✅ **Different browsers/tabs**: You CAN be logged in as admin in Chrome and worker in Firefox simultaneously
- ✅ **Different devices**: You CAN be logged in as admin on desktop and worker on mobile
- ✅ **Same browser, different users**: Different users can log in on different tabs (but same user can't be both roles)

**Industry Standard:**
This is actually the standard approach for monolithic applications. Most enterprise systems work this way:
- Single session per browser
- Role-based access control
- Last login replaces previous session

**If You Need Simultaneous Access:**
If you truly need to be logged in as both admin and worker at the same time, you would need:
1. **Separate ports** (e.g., admin on :3000, worker on :3001) - NOT recommended
2. **Separate subdomains** (e.g., admin.optiwms.com, worker.optiwms.com) - Better but more complex
3. **Role switching UI** - Allow users to switch roles without re-login (recommended for same user, different roles)

**Current Implementation:**
The current system is designed for the most common use case: one user, one role, one session. This is secure, simple, and follows industry best practices.

### Industry Best Practices Applied

1. **Centralized Auth**: Single source of truth for auth state
2. **Route Guards**: Declarative route protection
3. **Token Refresh**: Automatic token refresh on expiry
4. **Error Handling**: Graceful handling of auth errors
5. **Loading States**: Proper loading indicators during auth checks

## Migration Notes

### Backward Compatibility
- `AdminContext` and `WorkerContext` still work
- Existing components don't need immediate changes
- Gradual migration to `AuthContext` recommended

### Breaking Changes
- None - system is additive
- Old auth code continues to work
- New code should use `AuthContext`

## Future Improvements

1. **HttpOnly Cookies**: Consider moving tokens to httpOnly cookies for better security
2. **Refresh Token Rotation**: Implement refresh token rotation
3. **Session Management**: Add session timeout warnings
4. **Multi-Device Support**: Handle multiple device logins
5. **Remember Me**: Implement "remember me" functionality

## Troubleshooting

### Issue: Redirects to wrong login page
- **Solution**: Check `RouteGuard` requiredRole prop
- **Solution**: Verify user role in `AuthContext`

### Issue: Token not persisting
- **Solution**: Check localStorage is enabled
- **Solution**: Verify token is saved after login

### Issue: Cross-tab sync not working
- **Solution**: Ensure storage events are properly set up
- **Solution**: Check browser allows localStorage

## Security Considerations

1. **Token Storage**: Currently in localStorage (consider httpOnly cookies)
2. **Token Expiry**: Tokens expire and refresh automatically
3. **HTTPS**: Always use HTTPS in production
4. **CSRF Protection**: Backend should implement CSRF tokens
5. **XSS Protection**: Sanitize user input to prevent XSS
