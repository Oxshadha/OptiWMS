import { logger } from "@/lib/utils/logger";
/**
 * Network Detection and Management
 * 
 * Provides utilities for detecting network status and managing online/offline states
 */

export interface NetworkStatus {
  online: boolean;
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

let networkStatus: NetworkStatus = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
};

const listeners: Array<(status: NetworkStatus) => void> = [];

/**
 * Get current network status
 */
export function getNetworkStatus(): NetworkStatus {
  if (typeof navigator === "undefined") {
    return { online: true };
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  return {
    online: navigator.onLine,
    type: connection?.type,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
  };
}

/**
 * Subscribe to network status changes
 */
export function onNetworkStatusChange(callback: (status: NetworkStatus) => void): () => void {
  listeners.push(callback);
  callback(networkStatus); // Call immediately with current status

  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  return getNetworkStatus().online;
}

/**
 * Initialize network monitoring
 */
export function initNetworkMonitoring(): void {
  if (typeof window === "undefined") return;

  const updateStatus = () => {
    const newStatus = getNetworkStatus();
    // Only update if status actually changed
    if (newStatus.online !== networkStatus.online) {
      networkStatus = newStatus;
      listeners.forEach((callback) => callback(networkStatus));
    } else {
      networkStatus = newStatus;
      listeners.forEach((callback) => callback(networkStatus));
    }
  };

  // Set initial status
  networkStatus = getNetworkStatus();
  listeners.forEach((callback) => callback(networkStatus));

  // Listen to online/offline events
  window.addEventListener("online", () => {
    logger.debug("Network: Online");
    updateStatus();
  });
  window.addEventListener("offline", () => {
    logger.debug("Network: Offline");
    updateStatus();
  });

  // Monitor connection changes (if available)
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (connection) {
    connection.addEventListener("change", () => {
      logger.debug("Network connection changed");
      updateStatus();
    });
  }

  // Poll network status periodically (fallback for browsers that don't fire events properly)
  setInterval(() => {
    const currentStatus = getNetworkStatus();
    if (currentStatus.online !== networkStatus.online) {
      logger.debug(`Network status changed: ${networkStatus.online ? "Online" : "Offline"} → ${currentStatus.online ? "Online" : "Offline"}`);
      updateStatus();
    }
  }, 1000); // Check every second
}

