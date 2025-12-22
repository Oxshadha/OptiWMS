"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  WorkerRole,
  canAccessOperation,
  getAllowedOperations,
  getRoleDisplayName,
} from "@/lib/worker-roles";
import { getFromStore, updateInStore, STORES } from "@/lib/indexeddb";

export interface WorkerData {
  id: string;
  workerId: string;
  name: string;
  warehouse: string;
  role: WorkerRole | null;
  avatar?: string;
  email?: string;
  phone?: string;
  deviceId?: string;
}

interface WorkerContextType {
  worker: WorkerData | null;
  setWorker: (worker: WorkerData | null) => void;
  role: WorkerRole | null;
  canAccess: (operation: string) => boolean;
  allowedOperations: string[];
  isLoading: boolean;
  clearWorker: () => void;
}

const WorkerContext = createContext<WorkerContextType | undefined>(undefined);

const WORKER_DATA_KEY = "current_worker";

export function WorkerProvider({ children }: { children: ReactNode }) {
  const [worker, setWorkerState] = useState<WorkerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const prevPathnameRef = React.useRef<string | null>(null);

  // Load worker data from IndexedDB on mount
  useEffect(() => {
    loadWorkerFromStorage();
  }, []);

  // Clear worker state (but not IndexedDB) when navigating TO login page
  // Only clear when we first arrive at login from another page, not when we're already on it
  useEffect(() => {
    const prevPathname = prevPathnameRef.current;

    // Only clear if we're navigating TO login page from a non-login page
    // This prevents clearing when we're already on login and setting worker data
    if (
      pathname === "/worker/login" &&
      prevPathname !== "/worker/login" &&
      prevPathname !== null &&
      worker
    ) {
      console.log(
        "[WorkerContext] Clearing worker state on navigation to login page (keeping IndexedDB)",
        {
          from: prevPathname,
          to: pathname,
        }
      );
      setWorkerState(null);
    }

    // Always update the ref to track pathname changes
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
    }
  }, [pathname, worker]);

  // Reload worker data when navigating away from login page (after login)
  // Only reload if we don't have worker data in state (e.g., page refresh)
  // Add a small delay to avoid race conditions with state updates from setWorker
  useEffect(() => {
    if (
      pathname?.startsWith("/worker") &&
      pathname !== "/worker/login" &&
      !worker &&
      !isLoading
    ) {
      // Add a small delay to allow setWorker state updates to complete
      const timeoutId = setTimeout(() => {
        console.log(
          "[WorkerContext] No worker in state after delay, reloading from storage"
        );
        loadWorkerFromStorage();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [pathname, worker, isLoading]);

  const loadWorkerFromStorage = async () => {
    try {
      console.log(
        "[WorkerContext] Attempting to load worker with key:",
        WORKER_DATA_KEY
      );
      const stored = await getFromStore<WorkerData & { key: string }>(
        STORES.WORKER_DATA,
        WORKER_DATA_KEY
      );
      console.log("[WorkerContext] Raw data from IndexedDB:", stored);
      if (stored) {
        console.log("[WorkerContext] Loaded worker from storage:", {
          role: stored.role,
          name: stored.name,
          key: stored.key,
          id: stored.id,
        });
        // Remove the 'key' property before setting state (key is only for IndexedDB)
        const { key, ...workerData } = stored;
        setWorkerState(workerData);
      } else {
        console.log(
          "[WorkerContext] No worker data found in storage for key:",
          WORKER_DATA_KEY
        );
        setWorkerState(null);
      }
    } catch (error) {
      console.error(
        "[WorkerContext] Error loading worker from storage:",
        error
      );
      setWorkerState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setWorker = async (newWorker: WorkerData | null) => {
    if (newWorker) {
      try {
        // Save to IndexedDB first
        const dataToSave = {
          key: WORKER_DATA_KEY,
          id: newWorker.id,
          workerId: newWorker.workerId,
          name: newWorker.name,
          warehouse: newWorker.warehouse,
          role: newWorker.role,
          avatar: newWorker.avatar,
          email: newWorker.email,
          phone: newWorker.phone,
          deviceId: newWorker.deviceId,
        };
        console.log("[WorkerContext] Saving worker to storage:", {
          key: dataToSave.key,
          role: dataToSave.role,
          name: dataToSave.name,
        });

        await updateInStore(STORES.WORKER_DATA, dataToSave);

        // Verify the data was saved by reading it back
        const verification = await getFromStore<WorkerData & { key: string }>(
          STORES.WORKER_DATA,
          WORKER_DATA_KEY
        );

        if (verification) {
          console.log("[WorkerContext] Verified worker saved to storage:", {
            role: verification.role,
            name: verification.name,
          });
        } else {
          console.warn(
            "[WorkerContext] Warning: Could not verify worker data was saved"
          );
        }

        // Update state after successful save
        setWorkerState(newWorker);
      } catch (error) {
        console.error("Error saving worker to storage:", error);
        // Still update state even if save fails (for offline scenarios)
        setWorkerState(newWorker);
      }
    } else {
      try {
        // Clear worker data from IndexedDB
        const { deleteFromStore } = await import("@/lib/indexeddb");
        await deleteFromStore(STORES.WORKER_DATA, WORKER_DATA_KEY);
        console.log("[WorkerContext] Cleared worker from storage");
      } catch (error) {
        console.error("Error clearing worker from storage:", error);
      }
      // Clear state
      setWorkerState(null);
    }
  };

  const clearWorker = () => {
    setWorker(null);
  };

  const canAccess = (operation: string): boolean => {
    return canAccessOperation(worker?.role || null, operation);
  };

  const allowedOperations = worker?.role
    ? getAllowedOperations(worker.role)
    : [];

  const value: WorkerContextType = {
    worker,
    setWorker,
    role: worker?.role || null,
    canAccess,
    allowedOperations,
    isLoading,
    clearWorker,
  };

  return (
    <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>
  );
}

export function useWorker(): WorkerContextType {
  const context = useContext(WorkerContext);
  if (context === undefined) {
    throw new Error("useWorker must be used within a WorkerProvider");
  }
  return context;
}
