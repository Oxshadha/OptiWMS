"use client";

import {
  WorkerRole,
  getAllowedOperations,
  getRoleDisplayName,
  OPERATION_DISPLAY_NAMES,
} from "@/lib/worker-roles";

interface RolePermissionsProps {
  role: WorkerRole | null | undefined;
  showTitle?: boolean;
  className?: string;
}

/**
 * Role Permissions Display Component
 *
 * Displays worker role permissions in a visual format
 */
export function RolePermissions({
  role,
  showTitle = true,
  className = "",
}: RolePermissionsProps) {
  if (!role) {
    return (
      <div className={`text-base-content/50 ${className}`}>
        <p>No role assigned</p>
      </div>
    );
  }

  const allowedOperations = getAllowedOperations(role);

  return (
    <div className={`space-y-2 ${className}`}>
      {showTitle && (
        <div>
          <h4 className="font-semibold text-base-content">
            Role: {getRoleDisplayName(role)}
          </h4>
        </div>
      )}
      <div>
        <p className="text-sm text-base-content/70 mb-2">Allowed Operations:</p>
        {allowedOperations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allowedOperations.map((operation) => (
              <span
                key={operation}
                className="badge badge-primary badge-outline"
              >
                {OPERATION_DISPLAY_NAMES[operation] || operation}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-base-content/50">No operations allowed</p>
        )}
      </div>
      <div className="text-xs text-base-content/60">
        <p>Equipment Access: {getEquipmentAccess(role)}</p>
      </div>
    </div>
  );
}

/**
 * Get equipment access description for role
 */
function getEquipmentAccess(role: WorkerRole): string {
  const equipmentRoles: Record<WorkerRole, string> = {
    forklift_operator: "Forklift",
    stacker_operator: "Stacker",
    powered_pallet_truck_operator: "Powered Pallet Truck",
    unloading_worker: "Manual Equipment",
    receiver: "Manual Equipment",
    putaway: "Manual Equipment",
    quality_checker: "None (Manual)",
    cycle_count_worker: "None (Manual)",
    picker: "None (Manual)",
    packer: "None (Manual)",
    shipment_worker: "None (Manual)",
    returns_worker: "None (Manual)",
    vehicle_inspector: "None (Manual)",
    warehouse_safekeeping_worker: "None (Manual)",
  };

  return equipmentRoles[role] || "None";
}
