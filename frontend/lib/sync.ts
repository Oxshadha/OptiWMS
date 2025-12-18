/**
 * Sync Service for Offline-First PWA
 * 
 * Handles synchronization of local IndexedDB data with backend API
 */

import { getPendingSyncItems, updateSyncItemStatus, SyncItem } from "./indexeddb";
import { isOnline, onNetworkStatusChange } from "./network";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

/**
 * Sync a single item to the backend
 */
async function syncItem(item: SyncItem): Promise<boolean> {
  if (!item.id) return false;

  try {
    // Update status to syncing
    await updateSyncItemStatus(item.id, "syncing");

    // Determine endpoint based on type
    let endpoint = "";
    let method = "POST";

    switch (item.type) {
      case "task":
        endpoint = "/tasks";
        method = item.action === "create" ? "POST" : item.action === "update" ? "PUT" : "DELETE";
        break;
      case "scan":
        endpoint = "/scans";
        method = "POST";
        break;
      case "operation":
        endpoint = "/operations";
        method = "POST";
        break;
    }

    // Make API call
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(item.data),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    // Mark as completed
    await updateSyncItemStatus(item.id, "completed");
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateSyncItemStatus(item.id, "failed", errorMessage);

    // If retry count is too high, mark as permanently failed
    if (item.retryCount >= 5) {
      console.error(`Sync item ${item.id} failed after ${item.retryCount} retries`);
    }

    return false;
  }
}

/**
 * Sync all pending items
 */
export async function syncAll(): Promise<{ success: number; failed: number }> {
  if (!isOnline()) {
    console.log("Offline - skipping sync");
    return { success: 0, failed: 0 };
  }

  const pendingItems = await getPendingSyncItems();
  let success = 0;
  let failed = 0;

  for (const item of pendingItems) {
    const result = await syncItem(item);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Start automatic sync when online
 */
export function startAutoSync(intervalMs: number = 30000): () => void {
  let syncInterval: NodeJS.Timeout | null = null;

  const unsubscribe = onNetworkStatusChange((status) => {
    if (status.online) {
      // Sync immediately when coming online
      syncAll();

      // Then sync periodically
      if (syncInterval) {
        clearInterval(syncInterval);
      }
      syncInterval = setInterval(() => {
        syncAll();
      }, intervalMs);
    } else {
      // Stop syncing when offline
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    }
  });

  return () => {
    if (syncInterval) {
      clearInterval(syncInterval);
    }
    unsubscribe();
  };
}

