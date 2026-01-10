# Role Normalization Fix

## Issue
Backend returns roles with `role_` prefix (e.g., `role_admin`, `role_forklift_operator`), but frontend was checking for roles without the prefix (e.g., `admin`, `forklift_operator`).

## Error Message
```
Access denied. This account (role: role_admin) is not authorized for admin portal.
```

## Solution
Added role normalization to strip the `role_` prefix before role validation.

## Files Fixed

### 1. `/lib/auth/AuthContext.tsx`
- Added `normalizeRole()` helper function
- Normalizes role in `loadAuthState()` before checking admin/worker roles
- Normalizes role in `checkRouteAccess()`, `isAdmin`, and `isWorker` checks

### 2. `/app/admin/login/page.tsx`
- Normalizes role before checking if user is admin
- Prevents false "Access denied" errors

### 3. `/contexts/AdminContext.tsx`
- Normalizes role in `loadAdminFromStorage()` before checking admin roles

## How It Works

```typescript
// Before normalization
const role = "role_admin"; // From backend
const isAdmin = ADMIN_ROLES.includes(role); // false ❌

// After normalization
let normalizedRole = role.toLowerCase(); // "role_admin"
if (normalizedRole.startsWith('role_')) {
  normalizedRole = normalizedRole.substring(5); // "admin"
}
const isAdmin = ADMIN_ROLES.includes(normalizedRole); // true ✅
```

## Testing

1. Login as admin with role `role_admin` → Should work ✅
2. Login as worker with role `role_forklift_operator` → Should work ✅
3. Direct access to `/admin/dashboard` without login → Should redirect to login ✅
4. Worker trying to access admin routes → Should redirect to worker dashboard ✅

## Backend Role Format

The backend returns roles in the format:
- `role_admin`
- `role_warehouse_manager`
- `role_forklift_operator`
- `role_picker`
- etc.

The frontend now handles both formats:
- With prefix: `role_admin` → normalized to `admin`
- Without prefix: `admin` → stays as `admin`
