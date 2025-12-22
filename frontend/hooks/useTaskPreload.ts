"use client";

import { useEffect, useState } from "react";
import { isOnline } from "@/lib/network";
import { getAllTasks, saveTask, Task } from "@/lib/indexeddb";
import { apiClient } from "@/lib/api/client";

/**
 * Hook for preloading tasks when online
 * Ensures workers have task data cached for offline use
 */
export function useTaskPreload(workerId?: string) {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadError, setPreloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!workerId || !isOnline()) {
      return;
    }

    const preloadTasks = async () => {
      setIsPreloading(true);
      setPreloadError(null);

      try {
        // Fetch assigned tasks from API
        const tasks = await apiClient.get<Task[]>(`/tasks?workerId=${workerId}&status=pending,in_progress`);
        
        // Save to IndexedDB for offline access
        for (const task of tasks) {
          await saveTask({
            ...task,
            synced: true, // Mark as synced since we just fetched from server
          });
        }

        console.log(`Preloaded ${tasks.length} tasks for worker ${workerId}`);
      } catch (error) {
        console.error("Error preloading tasks:", error);
        setPreloadError(error instanceof Error ? error.message : "Failed to preload tasks");
      } finally {
        setIsPreloading(false);
      }
    };

    // Preload immediately when online
    preloadTasks();

    // Also preload periodically (every 5 minutes when online)
    const interval = setInterval(() => {
      if (isOnline()) {
        preloadTasks();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [workerId]);

  return { isPreloading, preloadError };
}

