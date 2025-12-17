"use client";

import { useEffect, useState } from "react";
import { onNetworkStatusChange, NetworkStatus } from "@/lib/network";

export function OfflineIndicator() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({ online: true });

  useEffect(() => {
    const unsubscribe = onNetworkStatusChange((status) => {
      setNetworkStatus(status);
    });

    return unsubscribe;
  }, []);

  if (networkStatus.online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-warning text-warning-content px-4 py-2 text-center text-sm z-50">
      <div className="flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-lg">wifi_off</span>
        <span>You are offline. Data will sync when connection is restored.</span>
      </div>
    </div>
  );
}

