/**
 * Worker Availability Service
 * 
 * Checks worker availability based on shift schedules,
 * current task assignments, and status.
 */

import { getTasksByStatus, Task } from "./indexeddb";

export interface WorkerShift {
  shiftStart: string; // Format: "HH:mm"
  shiftEnd: string; // Format: "HH:mm"
}

export interface WorkerAvailabilityData {
  id: string;
  shiftStart?: string;
  shiftEnd?: string;
  availabilityStatus?: "available" | "busy" | "offline";
}

export type AvailabilityStatus = "available" | "busy" | "offline" | "out_of_shift";

/**
 * Parse time string (HH:mm) to Date object for today
 */
function parseTime(timeStr: string, baseDate: Date = new Date()): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Check if worker is in their shift
 */
export function isWorkerInShift(
  shiftStart: string | undefined,
  shiftEnd: string | undefined,
  currentTime: Date = new Date()
): boolean {
  if (!shiftStart || !shiftEnd) {
    return true; // If no shift defined, assume always available
  }

  const start = parseTime(shiftStart, currentTime);
  const end = parseTime(shiftEnd, currentTime);

  // Handle overnight shifts (e.g., 22:00 - 06:00)
  if (end < start) {
    end.setDate(end.getDate() + 1);
  }

  return currentTime >= start && currentTime <= end;
}

/**
 * Get worker's current active tasks
 */
export async function getWorkerCurrentTasks(workerId: string): Promise<Task[]> {
  try {
    const allTasks = await getTasksByStatus("in_progress");
    // Filter tasks assigned to this worker
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
export async function isWorkerAvailable(workerId: string): Promise<boolean> {
  const currentTasks = await getWorkerCurrentTasks(workerId);
  // Worker is available if they have no active tasks
  return currentTasks.length === 0;
}

/**
 * Get worker availability status
 */
export async function getWorkerAvailabilityStatus(
  worker: WorkerAvailabilityData
): Promise<AvailabilityStatus> {
  // Check if worker is marked as offline
  if (worker.availabilityStatus === "offline") {
    return "offline";
  }

  // Check if worker is in their shift
  const inShift = isWorkerInShift(worker.shiftStart, worker.shiftEnd);
  if (!inShift) {
    return "out_of_shift";
  }

  // Check if worker has active tasks
  const available = await isWorkerAvailable(worker.id);
  if (!available || worker.availabilityStatus === "busy") {
    return "busy";
  }

  return "available";
}

/**
 * Get worker availability status with details
 */
export async function getWorkerAvailabilityDetails(
  worker: WorkerAvailabilityData
): Promise<{
  status: AvailabilityStatus;
  inShift: boolean;
  hasActiveTasks: boolean;
  activeTaskCount: number;
  message: string;
}> {
  const inShift = isWorkerInShift(worker.shiftStart, worker.shiftEnd);
  const currentTasks = await getWorkerCurrentTasks(worker.id);
  const hasActiveTasks = currentTasks.length > 0;

  let status: AvailabilityStatus;
  let message: string;

  if (worker.availabilityStatus === "offline") {
    status = "offline";
    message = "Worker is offline";
  } else if (!inShift) {
    status = "out_of_shift";
    message = `Worker is out of shift (${worker.shiftStart} - ${worker.shiftEnd})`;
  } else if (hasActiveTasks || worker.availabilityStatus === "busy") {
    status = "busy";
    message = `Worker is busy (${currentTasks.length} active task${currentTasks.length !== 1 ? "s" : ""})`;
  } else {
    status = "available";
    message = "Worker is available";
  }

  return {
    status,
    inShift,
    hasActiveTasks,
    activeTaskCount: currentTasks.length,
    message,
  };
}

