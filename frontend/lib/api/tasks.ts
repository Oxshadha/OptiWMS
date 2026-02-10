import { logger } from "@/lib/utils/logger";
/**
 * Task Assignment API Utilities
 * 
 * Provides functions for task assignment operations with validation
 */

import { validateTaskAssignment, getAvailableWorkersForTask, Worker, TaskAssignmentData } from "../task-assignment";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

/**
 * Validate task assignment before making API call
 */
export async function validateTaskAssignmentAPI(
  workerId: string,
  taskId: string,
  workers: Worker[]
): Promise<{ valid: boolean; error?: string; warnings?: string[] }> {
  // Find worker
  const worker = workers.find((w) => w.id === workerId);
  if (!worker) {
    return {
      valid: false,
      error: "Worker not found",
    };
  }

  // Get task details (would normally come from API)
  // For now, we'll need task type passed separately
  // This is a placeholder - in real implementation, fetch task from API
  return {
    valid: true,
  };
}

/**
 * Assign task to worker with validation
 */
export async function assignTaskToWorker(
  taskId: string,
  workerId: string,
  worker: Worker,
  taskType: string,
  taskData?: TaskAssignmentData
): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  // Validate assignment
  const validation = await validateTaskAssignment(worker, taskType, taskData);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      warnings: validation.warnings,
    };
  }

  try {
    // Make API call to assign task
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workerId,
        assignedBy: "current_admin", // Would come from context
        warnings: validation.warnings,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `Failed to assign task: ${response.statusText}`,
      };
    }

    return {
      success: true,
      warnings: validation.warnings,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get workers eligible for a task type
 */
export async function getWorkersForTaskTypeAPI(
  taskType: string,
  warehouseId?: string
): Promise<Worker[]> {
  try {
    // In a real implementation, this would fetch from API
    // For now, return empty array - workers should be passed from component
    const response = await fetch(
      `${API_BASE_URL}/workers?taskType=${taskType}${warehouseId ? `&warehouseId=${warehouseId}` : ""}`
    );

    if (!response.ok) {
      logger.error("Failed to fetch workers:", response.statusText);
      return [];
    }

    const data = await response.json();
    return data.workers || [];
  } catch (error) {
    logger.error("Error fetching workers:", error);
    return [];
  }
}

/**
 * Pre-assignment validation
 */
export async function validateTaskAssignmentPre(
  workerId: string,
  taskType: string,
  worker: Worker,
  taskData?: TaskAssignmentData
): Promise<{ valid: boolean; error?: string; warnings?: string[] }> {
  return await validateTaskAssignment(worker, taskType, taskData);
}

