"use client";

import { useState, useEffect, useCallback } from "react";
import {
  validateTaskAssignment,
  getAvailableWorkersForTask,
  getWorkersForTaskType,
  Worker,
  TaskAssignmentData,
  ValidationResult,
} from "@/lib/task-assignment";

/**
 * Custom hook for task assignment utilities
 */
export function useTaskAssignment() {
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(
    async (
      worker: Worker,
      taskType: string,
      taskData?: TaskAssignmentData
    ): Promise<ValidationResult> => {
      setIsValidating(true);
      try {
        return await validateTaskAssignment(worker, taskType, taskData);
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  return {
    validate,
    isValidating,
  };
}

/**
 * Hook to get available workers for a task type
 */
export function useAvailableWorkers(
  workers: Worker[],
  taskType: string | null,
  warehouseId?: string
) {
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!taskType || workers.length === 0) {
      setAvailableWorkers([]);
      return;
    }

    const fetchAvailableWorkers = async () => {
      setIsLoading(true);
      try {
        const available = await getAvailableWorkersForTask(
          workers,
          taskType,
          warehouseId
        );
        setAvailableWorkers(available);
      } catch (error) {
        console.error("Error fetching available workers:", error);
        setAvailableWorkers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailableWorkers();
  }, [workers, taskType, warehouseId]);

  return {
    availableWorkers,
    isLoading,
  };
}

/**
 * Hook to get workers who can perform a task type (regardless of availability)
 */
export function useWorkersForTaskType(
  workers: Worker[],
  taskType: string | null,
  warehouseId?: string
) {
  const [eligibleWorkers, setEligibleWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    if (!taskType || workers.length === 0) {
      setEligibleWorkers([]);
      return;
    }

    const eligible = getWorkersForTaskType(workers, taskType, warehouseId);
    setEligibleWorkers(eligible);
  }, [workers, taskType, warehouseId]);

  return eligibleWorkers;
}

/**
 * Hook to validate task assignment
 */
export function useTaskValidation(
  worker: Worker | null,
  taskType: string | null,
  taskData?: TaskAssignmentData
) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!worker || !taskType) {
      setValidation(null);
      return;
    }

    const validate = async () => {
      setIsValidating(true);
      try {
        const result = await validateTaskAssignment(worker, taskType, taskData);
        setValidation(result);
      } catch (error) {
        console.error("Error validating task assignment:", error);
        setValidation({
          valid: false,
          error: "Validation error occurred",
        });
      } finally {
        setIsValidating(false);
      }
    };

    validate();
  }, [worker, taskType, taskData]);

  return {
    validation,
    isValidating,
  };
}

