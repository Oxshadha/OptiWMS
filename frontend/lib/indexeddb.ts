/**
 * IndexedDB Utility for Offline-First PWA
 * 
 * This module provides a wrapper around IndexedDB for storing all worker PWA data locally.
 * All data persists even when app is closed, killed, or device restarted.
 */

const DB_NAME = "OptiWMS_Worker";
const DB_VERSION = 1;

// Store names
export const STORES = {
  TASKS: "tasks",
  OPTIMAL_PATHS: "optimal_paths",
  SCAN_RECORDS: "scan_records",
  OPERATION_LOGS: "operation_logs",
  SYNC_QUEUE: "sync_queue",
  WORKER_DATA: "worker_data",
  ADMIN_DATA: "admin_data",
} as const;

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB database
 */
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Tasks store
      if (!database.objectStoreNames.contains(STORES.TASKS)) {
        const taskStore = database.createObjectStore(STORES.TASKS, { keyPath: "id" });
        taskStore.createIndex("status", "status", { unique: false });
        taskStore.createIndex("type", "type", { unique: false });
        taskStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Optimal paths store
      if (!database.objectStoreNames.contains(STORES.OPTIMAL_PATHS)) {
        const pathStore = database.createObjectStore(STORES.OPTIMAL_PATHS, { keyPath: "taskId" });
        pathStore.createIndex("calculatedAt", "calculatedAt", { unique: false });
      }

      // Scan records store
      if (!database.objectStoreNames.contains(STORES.SCAN_RECORDS)) {
        const scanStore = database.createObjectStore(STORES.SCAN_RECORDS, { keyPath: "id", autoIncrement: true });
        scanStore.createIndex("taskId", "taskId", { unique: false });
        scanStore.createIndex("timestamp", "timestamp", { unique: false });
        scanStore.createIndex("location", "location", { unique: false });
      }

      // Operation logs store
      if (!database.objectStoreNames.contains(STORES.OPERATION_LOGS)) {
        const logStore = database.createObjectStore(STORES.OPERATION_LOGS, { keyPath: "id", autoIncrement: true });
        logStore.createIndex("timestamp", "timestamp", { unique: false });
        logStore.createIndex("type", "type", { unique: false });
      }

      // Sync queue store
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, { keyPath: "id", autoIncrement: true });
        syncStore.createIndex("status", "status", { unique: false });
        syncStore.createIndex("createdAt", "createdAt", { unique: false });
        syncStore.createIndex("retryCount", "retryCount", { unique: false });
      }

      // Worker data store
      if (!database.objectStoreNames.contains(STORES.WORKER_DATA)) {
        database.createObjectStore(STORES.WORKER_DATA, { keyPath: "key" });
      }

      // Admin data store
      if (!database.objectStoreNames.contains(STORES.ADMIN_DATA)) {
        database.createObjectStore(STORES.ADMIN_DATA, { keyPath: "key" });
      }
    };
  });
}

/**
 * Generic function to add data to a store
 */
export async function addToStore<T>(storeName: string, data: T): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.add(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to get data from a store
 */
export async function getFromStore<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to get all data from a store
 */
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to update data in a store
 */
export async function updateInStore<T>(storeName: string, data: T & { id: IDBValidKey }): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to delete data from a store
 */
export async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Query data by index
 */
export async function queryByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Task-specific functions
export interface Task {
  id: string;
  type: "picking" | "putaway" | "receiving" | "cycle_count" | "shipment" | "return";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  data: any;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  workerId?: string; // Worker assigned to this task
  assignedTo?: string; // Alternative field name for worker assignment
  warehouseId?: string; // Warehouse where task is located
  startedAt?: number; // Task start time for productivity tracking
  completedAt?: number; // Task completion time for productivity tracking
  version?: number; // Version number for conflict resolution
}

export async function saveTask(task: Task): Promise<void> {
  return updateInStore(STORES.TASKS, {
    ...task,
    updatedAt: Date.now(),
    synced: false,
  });
}

export async function getTask(taskId: string): Promise<Task | undefined> {
  return getFromStore<Task>(STORES.TASKS, taskId);
}

export async function getAllTasks(): Promise<Task[]> {
  return getAllFromStore<Task>(STORES.TASKS);
}

export async function getTasksByStatus(status: Task["status"]): Promise<Task[]> {
  return queryByIndex<Task>(STORES.TASKS, "status", status);
}

// Optimal Path functions
export interface OptimalPath {
  taskId: string;
  route: Array<{
    location: string;
    item?: string;
    sku?: string;
    qty: number;
    scanned: boolean;
    scannedAt?: number;
  }>;
  totalLocations: number;
  completedLocations: number;
  estimatedTime: number;
  calculatedAt: number;
}

export async function saveOptimalPath(path: OptimalPath): Promise<void> {
  return updateInStore(STORES.OPTIMAL_PATHS, {
    ...path,
    id: path.taskId, // Use taskId as the id since it's the keyPath
    calculatedAt: Date.now(),
  });
}

export async function getOptimalPath(taskId: string): Promise<OptimalPath | undefined> {
  return getFromStore<OptimalPath>(STORES.OPTIMAL_PATHS, taskId);
}

// Scan Record functions
export interface ScanRecord {
  id?: number;
  taskId: string;
  location: string;
  item?: string;
  sku?: string;
  qty?: number;
  timestamp: number;
  synced: boolean;
}

export async function saveScanRecord(record: Omit<ScanRecord, "id" | "timestamp" | "synced">): Promise<number> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SCAN_RECORDS], "readwrite");
    const store = transaction.objectStore(STORES.SCAN_RECORDS);
    const request = store.add({
      ...record,
      timestamp: Date.now(),
      synced: false,
    });

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getScanRecordsByTask(taskId: string): Promise<ScanRecord[]> {
  return queryByIndex<ScanRecord>(STORES.SCAN_RECORDS, "taskId", taskId);
}

// Sync Queue functions
export interface SyncItem {
  id?: number;
  type: "task" | "scan" | "operation";
  action: "create" | "update" | "delete";
  data: any;
  status: "pending" | "syncing" | "completed" | "failed";
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export async function addToSyncQueue(item: Omit<SyncItem, "id" | "status" | "createdAt" | "retryCount">): Promise<number> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SYNC_QUEUE], "readwrite");
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.add({
      ...item,
      status: "pending",
      createdAt: Date.now(),
      retryCount: 0,
    });

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingSyncItems(): Promise<SyncItem[]> {
  return queryByIndex<SyncItem>(STORES.SYNC_QUEUE, "status", "pending");
}

export async function updateSyncItemStatus(id: number, status: SyncItem["status"], error?: string): Promise<void> {
  const item = await getFromStore<SyncItem>(STORES.SYNC_QUEUE, id);
  if (!item) return;

  return updateInStore(STORES.SYNC_QUEUE, {
    ...item,
    id,
    status,
    retryCount: status === "failed" ? item.retryCount + 1 : item.retryCount,
    lastError: error,
  });
}

