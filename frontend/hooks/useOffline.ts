"use client";

import { useState, useEffect } from "react";
import { onNetworkStatusChange, NetworkStatus, isOnline, getNetworkStatus } from "@/lib/network";
import { initDB } from "@/lib/indexeddb";

/**
 * Hook for offline-first functionality
 * Provides network status and ensures IndexedDB is initialized
 */
export function useOffline() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() => {
    // Initialize with current status
    if (typeof window !== "undefined") {
      return getNetworkStatus();
    }
    return { online: true };
  });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Initialize IndexedDB
    initDB()
      .then(() => setDbReady(true))
      .catch(console.error);

    // Subscribe to network changes
    const unsubscribe = onNetworkStatusChange((status) => {
      console.log("Network status updated in hook:", status.online ? "Online" : "Offline");
      setNetworkStatus(status);
    });

    // Also check status periodically as fallback
    const interval = setInterval(() => {
      const currentStatus = getNetworkStatus();
      if (currentStatus.online !== networkStatus.online) {
        console.log("Network status changed (polling):", currentStatus.online ? "Online" : "Offline");
        setNetworkStatus(currentStatus);
      }
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [networkStatus.online]);

  return {
    isOnline: networkStatus.online,
    networkStatus,
    dbReady,
  };
}

