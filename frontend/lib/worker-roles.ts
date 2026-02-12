/**
 * Worker Role-Based Access Control
 * 
 * Defines worker roles, operations, and permission checking utilities
 * for the OptiWMS worker PWA.
 */

/**
 * Worker role types based on SOP documents
 */
export type WorkerRole =
  | 'forklift_operator'
  | 'stacker_operator'
  | 'powered_pallet_truck_operator'
  | 'unloading_worker'
  | 'cycle_count_worker'
  | 'picker'
  | 'packer'
  | 'shipment_worker'
  | 'returns_worker'
  | 'vehicle_inspector'
  | 'warehouse_safekeeping_worker';

/**
 * Operation constants matching route paths
 */
export const OPERATIONS = {
  RECEIVING: 'receiving',
  PUTAWAY: 'putaway',
  PICKING: 'picking',
  CYCLE_COUNT: 'cycle-count',
  STOCK_TRANSFER: 'stock-transfer',
  PACKING: 'packing',
  SHIPMENTS: 'shipments',
  RETURNS: 'returns',
} as const;

export type Operation = typeof OPERATIONS[keyof typeof OPERATIONS];

/**
 * Permission matrix mapping roles to allowed operations
 * Based on the permission matrix from the implementation plan
 */
const PERMISSION_MATRIX: Record<WorkerRole, Set<Operation>> = {
  forklift_operator: new Set([
    OPERATIONS.RECEIVING,
    OPERATIONS.PUTAWAY,
    OPERATIONS.STOCK_TRANSFER,
  ]),
  stacker_operator: new Set([
    OPERATIONS.RECEIVING,
    OPERATIONS.PUTAWAY,
    OPERATIONS.STOCK_TRANSFER,
  ]),
  powered_pallet_truck_operator: new Set([
    OPERATIONS.RECEIVING,
    OPERATIONS.PUTAWAY,
    OPERATIONS.STOCK_TRANSFER,
  ]),
  unloading_worker: new Set([
    OPERATIONS.RECEIVING,
    OPERATIONS.PUTAWAY,
  ]),
  cycle_count_worker: new Set([
    OPERATIONS.CYCLE_COUNT,
  ]),
  picker: new Set([
    OPERATIONS.PICKING,
  ]),
  packer: new Set([
    OPERATIONS.PACKING,
  ]),
  shipment_worker: new Set([
    OPERATIONS.SHIPMENTS,
  ]),
  returns_worker: new Set([
    OPERATIONS.RETURNS,
  ]),
  vehicle_inspector: new Set([
    OPERATIONS.RECEIVING, // Limited to inspection operations only
  ]),
  warehouse_safekeeping_worker: new Set([
    OPERATIONS.CYCLE_COUNT,
  ]),
};

/**
 * Human-readable role display names
 */
export const ROLE_DISPLAY_NAMES: Record<WorkerRole, string> = {
  forklift_operator: 'Forklift Operator',
  stacker_operator: 'Stacker Operator',
  powered_pallet_truck_operator: 'Powered Pallet Truck Operator',
  unloading_worker: 'Unloading Worker',
  cycle_count_worker: 'Cycle Count Worker',
  picker: 'Picker',
  packer: 'Packer',
  shipment_worker: 'Shipment Worker',
  returns_worker: 'Returns Worker',
  vehicle_inspector: 'Vehicle Inspector',
  warehouse_safekeeping_worker: 'Warehouse Safekeeping Worker',
};

/**
 * Human-readable operation display names
 */
export const OPERATION_DISPLAY_NAMES: Record<Operation, string> = {
  [OPERATIONS.RECEIVING]: 'Receiving',
  [OPERATIONS.PUTAWAY]: 'Putaway',
  [OPERATIONS.PICKING]: 'Picking',
  [OPERATIONS.CYCLE_COUNT]: 'Cycle Count',
  [OPERATIONS.STOCK_TRANSFER]: 'Stock Transfer',
  [OPERATIONS.PACKING]: 'Packing',
  [OPERATIONS.SHIPMENTS]: 'Shipments',
  [OPERATIONS.RETURNS]: 'Returns',
};

/**
 * Check if a worker role has permission to access an operation
 * 
 * @param role - The worker's role
 * @param operation - The operation to check access for
 * @returns true if the role has permission, false otherwise
 */
export function canAccessOperation(role: WorkerRole | null | undefined, operation: Operation | string): boolean {
  if (!role) {
    return false;
  }

  const allowedOperations = PERMISSION_MATRIX[role];
  if (!allowedOperations) {
    return false;
  }

  return allowedOperations.has(operation as Operation);
}

/**
 * Get all allowed operations for a worker role
 * 
 * @param role - The worker's role
 * @returns Array of allowed operations, or empty array if role is invalid
 */
export function getAllowedOperations(role: WorkerRole | null | undefined): Operation[] {
  if (!role) {
    return [];
  }

  const allowedOperations = PERMISSION_MATRIX[role];
  if (!allowedOperations) {
    return [];
  }

  return Array.from(allowedOperations);
}

/**
 * Get the display name for a worker role
 * 
 * @param role - The worker's role
 * @returns Human-readable role name, or the role string if not found
 */
export function getRoleDisplayName(role: WorkerRole | null | undefined): string {
  if (!role) {
    return 'Unknown Role';
  }

  return ROLE_DISPLAY_NAMES[role] || role;
}

/**
 * Get the display name for an operation
 * 
 * @param operation - The operation
 * @returns Human-readable operation name, or the operation string if not found
 */
export function getOperationDisplayName(operation: Operation | string): string {
  return OPERATION_DISPLAY_NAMES[operation as Operation] || operation;
}

/**
 * Get all available worker roles
 * 
 * @returns Array of all worker role types
 */
export function getAllWorkerRoles(): WorkerRole[] {
  return Object.keys(PERMISSION_MATRIX) as WorkerRole[];
}

/**
 * Check if a role is valid
 * 
 * @param role - The role to validate
 * @returns true if the role is valid, false otherwise
 */
export function isValidRole(role: string | null | undefined): role is WorkerRole {
  if (!role) {
    return false;
  }
  return role in PERMISSION_MATRIX;
}

// Backward-compatible alias used by auth and route guard modules.
export const isValidWorkerRole = isValidRole;

/**
 * Filter operations based on worker role
 * 
 * @param operations - Array of operations to filter
 * @param role - The worker's role
 * @returns Array of operations that the role has permission to access
 */
export function filterOperationsByRole<T extends { operation?: Operation | string; href?: string }>(
  operations: T[],
  role: WorkerRole | null | undefined
): T[] {
  if (!role) {
    return [];
  }

  return operations.filter((op) => {
    // Check by operation field if available
    if (op.operation) {
      return canAccessOperation(role, op.operation);
    }
    
    // Check by href if available (extract operation from path like /worker/receiving)
    if (op.href) {
      const operation = op.href.replace('/worker/', '').replace(/^\//, '');
      return canAccessOperation(role, operation);
    }

    return false;
  });
}
