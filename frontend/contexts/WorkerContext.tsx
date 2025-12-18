"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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

  // Load worker data from IndexedDB on mount
  useEffect(() => {
    loadWorkerFromStorage();
  }, []);

  // Reload worker data when navigating to worker routes (e.g., after login)
  useEffect(() => {
    if (pathname?.startsWith("/worker") && pathname !== "/worker/login") {
      loadWorkerFromStorage();
    }
  }, [pathname]);

  const loadWorkerFromStorage = async () => {
    try {
      const stored = await getFromStore<WorkerData>(
        STORES.WORKER_DATA,
        WORKER_DATA_KEY
      );
      if (stored) {
        console.log("[WorkerContext] Loaded worker from storage:", {
          role: stored.role,
          name: stored.name,
        });
        setWorkerState(stored);
      } else {
        console.log("[WorkerContext] No worker data found in storage");
      }
    } catch (error) {
      console.error("Error loading worker from storage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setWorker = async (newWorker: WorkerData | null) => {
    setWorkerState(newWorker);
    if (newWorker) {
      try {
        await updateInStore(STORES.WORKER_DATA, {
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
        });
      } catch (error) {
        console.error("Error saving worker to storage:", error);
      }
    } else {
      try {
        // Clear worker data
        const { deleteFromStore } = await import("@/lib/indexeddb");
        await deleteFromStore(STORES.WORKER_DATA, WORKER_DATA_KEY);
      } catch (error) {
        console.error("Error clearing worker from storage:", error);
      }
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
