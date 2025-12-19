/**
 * Admin Role-Based Access Control
 * 
 * Defines admin roles, permissions, and permission checking utilities
 * for the OptiWMS admin UI.
 */

/**
 * Admin role types
 */
export type AdminRole = 'admin' | 'warehouse_manager' | 'procurement_manager';

/**
 * Permission types for granular access control
 */
export type Permission = 'view' | 'create' | 'edit' | 'delete' | 'approve';

/**
 * Route constants matching admin paths
 */
export const ADMIN_ROUTES = {
  DASHBOARD: '/admin/dashboard',
  WAREHOUSES: '/admin/warehouses',
  ORDERS: '/admin/orders',
  SHIPMENTS: '/admin/shipments',
  DELIVERY_PARTNERS: '/admin/delivery-partners',
  INVENTORY: '/admin/inventory',
  PRODUCTS: '/admin/products',
  SUPPLIERS: '/admin/suppliers',
  WORKERS: '/admin/workers',
  ADMINS: '/admin/admins',
  TASKS: '/admin/tasks',
  CYCLE_COUNTS: '/admin/cycle-counts',
  STOCK_TRANSFERS: '/admin/stock-transfers',
  PACKING: '/admin/packing',
  QUALITY_CHECKS: '/admin/quality-checks',
  RETURNS: '/admin/returns',
  ANOMALIES: '/admin/anomalies',
  CUSTOMERS: '/admin/customers',
  REPORTS: '/admin/reports',
  SETTINGS: '/admin/settings',
  DASHBOARD_SETTINGS: '/admin/dashboard-settings',
  HELP: '/admin/help',
} as const;

export type AdminRoute = typeof ADMIN_ROUTES[keyof typeof ADMIN_ROUTES];

/**
 * Permission matrix mapping roles to allowed permissions per route
 */
const PERMISSION_MATRIX: Record<AdminRole, Record<string, Set<Permission>>> = {
  admin: {
    // Admin has all permissions on all routes
    [ADMIN_ROUTES.DASHBOARD]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.WAREHOUSES]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.ORDERS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.SHIPMENTS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.DELIVERY_PARTNERS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.INVENTORY]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.PRODUCTS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.SUPPLIERS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.WORKERS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.ADMINS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.TASKS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.CYCLE_COUNTS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.STOCK_TRANSFERS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.PACKING]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.QUALITY_CHECKS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.RETURNS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.ANOMALIES]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.CUSTOMERS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.REPORTS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.SETTINGS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.DASHBOARD_SETTINGS]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
    [ADMIN_ROUTES.HELP]: new Set(['view', 'create', 'edit', 'delete', 'approve']),
  },
  warehouse_manager: {
    // Warehouse Manager: view-only on system management, full access on operational, approve on returns/suppliers
    [ADMIN_ROUTES.DASHBOARD]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.WAREHOUSES]: new Set(['view']), // View only
    [ADMIN_ROUTES.ORDERS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.SHIPMENTS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.DELIVERY_PARTNERS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.INVENTORY]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.PRODUCTS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.SUPPLIERS]: new Set(['view', 'create', 'edit', 'approve']), // Can approve PO
    [ADMIN_ROUTES.WORKERS]: new Set(['view']), // View only
    [ADMIN_ROUTES.ADMINS]: new Set([]), // No access
    [ADMIN_ROUTES.TASKS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.CYCLE_COUNTS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.STOCK_TRANSFERS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.PACKING]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.QUALITY_CHECKS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.RETURNS]: new Set(['view', 'create', 'edit', 'approve']), // Can approve returns
    [ADMIN_ROUTES.ANOMALIES]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.CUSTOMERS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.REPORTS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.SETTINGS]: new Set([]), // No access
    [ADMIN_ROUTES.DASHBOARD_SETTINGS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.HELP]: new Set(['view']),
  },
  procurement_manager: {
    // Procurement Manager: focused on suppliers, orders, and inventory management
    [ADMIN_ROUTES.DASHBOARD]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.WAREHOUSES]: new Set(['view']), // View only
    [ADMIN_ROUTES.ORDERS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.SHIPMENTS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.DELIVERY_PARTNERS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.INVENTORY]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.PRODUCTS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.SUPPLIERS]: new Set(['view', 'create', 'edit', 'approve']), // Can approve PO
    [ADMIN_ROUTES.WORKERS]: new Set(['view']), // View only
    [ADMIN_ROUTES.ADMINS]: new Set([]), // No access
    [ADMIN_ROUTES.TASKS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.CYCLE_COUNTS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.STOCK_TRANSFERS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.PACKING]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.QUALITY_CHECKS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.RETURNS]: new Set(['view', 'create', 'edit', 'approve']), // Can approve returns
    [ADMIN_ROUTES.ANOMALIES]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.CUSTOMERS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.REPORTS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.SETTINGS]: new Set([]), // No access
    [ADMIN_ROUTES.DASHBOARD_SETTINGS]: new Set(['view', 'create', 'edit']),
    [ADMIN_ROUTES.HELP]: new Set(['view']),
  },
};

/**
 * Human-readable role display names
 */
export const ROLE_DISPLAY_NAMES: Record<AdminRole, string> = {
  admin: 'System Administrator',
  warehouse_manager: 'Warehouse Manager',
  procurement_manager: 'Procurement Manager',
};

/**
 * Check if a role has a specific permission on a route
 * 
 * @param role - The admin's role
 * @param route - The route to check
 * @param permission - The permission to check
 * @returns true if the role has the permission, false otherwise
 */
export function hasPermission(
  role: AdminRole | null | undefined,
  route: string,
  permission: Permission
): boolean {
  if (!role) {
    return false;
  }

  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) {
    return false;
  }

  // Check exact route match first
  if (rolePermissions[route]) {
    return rolePermissions[route].has(permission);
  }

  // Check if route starts with any route in permissions (for nested routes)
  for (const [permittedRoute, permissions] of Object.entries(rolePermissions)) {
    if (route.startsWith(permittedRoute)) {
      return permissions.has(permission);
    }
  }

  return false;
}

/**
 * Check if a role can access a route (has at least view permission)
 * 
 * @param role - The admin's role
 * @param route - The route to check
 * @returns true if the role can access the route, false otherwise
 */
export function canAccessRoute(role: AdminRole | null | undefined, route: string): boolean {
  // Strip query parameters for route checking
  const routePath = route.split('?')[0];
  return hasPermission(role, routePath, 'view');
}

/**
 * Get all permissions for a role on a specific route
 * 
 * @param role - The admin's role
 * @param route - The route to check
 * @returns Array of permissions, or empty array if role is invalid or route not found
 */
export function getRoutePermissions(
  role: AdminRole | null | undefined,
  route: string
): Permission[] {
  if (!role) {
    return [];
  }

  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) {
    return [];
  }

  // Check exact route match first
  if (rolePermissions[route]) {
    return Array.from(rolePermissions[route]);
  }

  // Check if route starts with any route in permissions (for nested routes)
  for (const [permittedRoute, permissions] of Object.entries(rolePermissions)) {
    if (route.startsWith(permittedRoute)) {
      return Array.from(permissions);
    }
  }

  return [];
}

/**
 * Get the display name for an admin role
 * 
 * @param role - The admin role
 * @returns Human-readable role name, or the role string if not found
 */
export function getRoleDisplayName(role: AdminRole | null | undefined): string {
  if (!role) {
    return 'Unknown Role';
  }

  return ROLE_DISPLAY_NAMES[role] || role;
}

/**
 * Get all available admin roles
 * 
 * @returns Array of all admin role types
 */
export function getAllAdminRoles(): AdminRole[] {
  return Object.keys(PERMISSION_MATRIX) as AdminRole[];
}

/**
 * Check if a role is valid
 * 
 * @param role - The role to validate
 * @returns true if the role is valid, false otherwise
 */
export function isValidAdminRole(role: string | null | undefined): role is AdminRole {
  if (!role) {
    return false;
  }
  return role in PERMISSION_MATRIX;
}

/**
 * Filter routes based on admin role permissions
 * 
 * @param routes - Array of routes to filter
 * @param role - The admin's role
 * @returns Array of routes that the role has permission to access
 */
export function filterRoutesByRole<T extends { href?: string; subItems?: { href: string }[] }>(
  routes: T[],
  role: AdminRole | null | undefined
): T[] {
  if (!role) {
    return [];
  }

  return routes.filter((route) => {
    // Check if user can access the main route
    if (route.href && canAccessRoute(role, route.href)) {
      return true;
    }
    
    // Check if user can access any sub-item
    if (route.subItems && route.subItems.length > 0) {
      const hasAccessibleSubItem = route.subItems.some((subItem) =>
        canAccessRoute(role, subItem.href)
      );
      if (hasAccessibleSubItem) {
        return true;
      }
    }
    
    return false;
  }).map((route) => {
    // Filter sub-items to only include accessible ones
    if (route.subItems && route.subItems.length > 0) {
      return {
        ...route,
        subItems: route.subItems.filter((subItem) =>
          canAccessRoute(role, subItem.href)
        ),
      };
    }
    return route;
  });
}

