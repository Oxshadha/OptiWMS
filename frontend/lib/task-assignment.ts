/**
 * Task Assignment Validation Service
 * 
 * Validates task assignments based on worker role permissions,
 * availability, and other business rules.
 */

import { canAccessOperation, WorkerRole, Operation, OPERATIONS } from "./worker-roles";
import { getTasksByStatus, Task } from "./indexeddb";

export interface Worker {
  id: string;
  workerId: string;
  name: string;
  role: WorkerRole;
  warehouseId?: string;
  warehouseName?: string;
  shiftStart?: string;
  shiftEnd?: string;
  availabilityStatus?: "available" | "busy" | "offline";
}

export interface TaskAssignmentData {
  taskType: string;
  warehouseId?: string;
  zone?: string;
  equipmentRequired?: string;
  priority?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Map task types to operations
 */
const TASK_TYPE_TO_OPERATION: Record<string, Operation> = {
  receiving: OPERATIONS.RECEIVING,
  putaway: OPERATIONS.PUTAWAY,
  picking: OPERATIONS.PICKING,
  "cycle_count": OPERATIONS.CYCLE_COUNT,
  "cycle-count": OPERATIONS.CYCLE_COUNT,
  packing: OPERATIONS.PACKING,
  shipment: OPERATIONS.SHIPMENTS,
  shipments: OPERATIONS.SHIPMENTS,
  returns: OPERATIONS.RETURNS,
  "stock-transfer": OPERATIONS.STOCK_TRANSFER,
  "stock_transfer": OPERATIONS.STOCK_TRANSFER,
  relocation: OPERATIONS.STOCK_TRANSFER,
  "quality_check": OPERATIONS.RECEIVING, // Quality check is part of receiving
  "quality-check": OPERATIONS.RECEIVING,
};

/**
 * Convert task type to operation
 */
function taskTypeToOperation(taskType: string): Operation | null {
  const normalized = taskType.toLowerCase().replace(/_/g, "-");
  return TASK_TYPE_TO_OPERATION[normalized] || null;
}

/**
 * Check if a worker can perform a task based on their role
 */
export function canWorkerPerformTask(
  workerRole: WorkerRole | null | undefined,
  taskType: string
): boolean {
  if (!workerRole) {
    return false;
  }

  const operation = taskTypeToOperation(taskType);
  if (!operation) {
    return false;
  }

  return canAccessOperation(workerRole, operation);
}

/**
 * Check if worker is in their shift
 */
export function isWorkerInShift(
  worker: Worker,
  currentTime: Date = new Date()
): boolean {
  if (!worker.shiftStart || !worker.shiftEnd) {
    return true; // If no shift defined, assume always available
  }

  const [startHour, startMin] = worker.shiftStart.split(":").map(Number);
  const [endHour, endMin] = worker.shiftEnd.split(":").map(Number);

  const shiftStart = new Date(currentTime);
  shiftStart.setHours(startHour, startMin, 0, 0);

  const shiftEnd = new Date(currentTime);
  shiftEnd.setHours(endHour, endMin, 0, 0);

  // Handle overnight shifts
  if (shiftEnd < shiftStart) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  return currentTime >= shiftStart && currentTime <= shiftEnd;
}

/**
 * Get worker's current active tasks
 */
export async function getWorkerCurrentTasks(workerId: string): Promise<Task[]> {
  try {
    const allTasks = await getTasksByStatus("in_progress");
    // Filter tasks assigned to this worker
    // Note: This assumes tasks have a workerId field
    return allTasks.filter(
      (task: any) => task.workerId === workerId || task.assignedTo === workerId
    );
  } catch (error) {
    console.error("Error getting worker current tasks:", error);
    return [];
  }
}

/**
 * Check if worker is available (not busy with other tasks)
 */
export async function checkWorkerAvailability(workerId: string): Promise<boolean> {
  const currentTasks = await getWorkerCurrentTasks(workerId);
  // Worker is available if they have no active tasks
  return currentTasks.length === 0;
}

/**
 * Validate task assignment
 */
export async function validateTaskAssignment(
  worker: Worker,
  taskType: string,
  taskData?: TaskAssignmentData
): Promise<ValidationResult> {
  const warnings: string[] = [];

  // 1. Check role permission
  if (!canWorkerPerformTask(worker.role, taskType)) {
    return {
      valid: false,
      error: `Worker role "${worker.role}" does not have permission for task type "${taskType}"`,
    };
  }

  // 2. Check warehouse match (if specified)
  if (taskData?.warehouseId && worker.warehouseId) {
    if (taskData.warehouseId !== worker.warehouseId) {
      warnings.push(
        `Task is for warehouse ${taskData.warehouseId}, but worker is assigned to ${worker.warehouseId}`
      );
    }
  }

  // 3. Check shift
  if (!isWorkerInShift(worker)) {
    warnings.push("Worker is not currently in their shift");
  }

  // 4. Check availability
  const isAvailable = await checkWorkerAvailability(worker.id);
  if (!isAvailable) {
    warnings.push("Worker has active tasks and may be busy");
  }

  // 5. Check equipment requirements (if specified)
  if (taskData?.equipmentRequired) {
    const equipmentRoles = [
      "forklift_operator",
      "stacker_operator",
      "powered_pallet_truck_operator",
    ];
    if (!equipmentRoles.includes(worker.role)) {
      warnings.push(
        `Task requires ${taskData.equipmentRequired}, but worker may not have equipment access`
      );
    }
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Get available workers for a task type
 */
export async function getAvailableWorkersForTask(
  workers: Worker[],
  taskType: string,
  warehouseId?: string
): Promise<Worker[]> {
  const operation = taskTypeToOperation(taskType);
  if (!operation) {
    return [];
  }

  const availableWorkers: Worker[] = [];

  for (const worker of workers) {
    // Filter by warehouse if specified
    if (warehouseId && worker.warehouseId && worker.warehouseId !== warehouseId) {
      continue;
    }

    // Check role permission
    if (!canAccessOperation(worker.role, operation)) {
      continue;
    }

    // Check availability status
    if (worker.availabilityStatus === "offline") {
      continue;
    }

    // Check if worker is available (no active tasks)
    const isAvailable = await checkWorkerAvailability(worker.id);
    if (!isAvailable && worker.availabilityStatus !== "busy") {
      // Still include but mark as potentially busy
      availableWorkers.push(worker);
    } else if (isAvailable) {
      availableWorkers.push(worker);
    }
  }

  return availableWorkers;
}

/**
 * Get workers who can perform a task type (regardless of availability)
 */
export function getWorkersForTaskType(
  workers: Worker[],
  taskType: string,
  warehouseId?: string
): Worker[] {
  const operation = taskTypeToOperation(taskType);
  if (!operation) {
    return [];
  }

  return workers.filter((worker) => {
    // Filter by warehouse if specified
    if (warehouseId && worker.warehouseId && worker.warehouseId !== warehouseId) {
      return false;
    }

    // Check role permission
    return canAccessOperation(worker.role, operation);
  });
}

