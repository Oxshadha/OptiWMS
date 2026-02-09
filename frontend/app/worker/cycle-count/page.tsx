"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { saveScanRecord, getScanRecordsByTask, addToSyncQueue } from "@/lib/indexeddb";
import { saveTask, getTask, getAllTasks } from "@/lib/indexeddb";
import { QRScanner } from "@/components/QRScanner";
import { operationsApi, CycleCount } from "@/lib/api/operations";
import { materialsApi } from "@/lib/api/materials";
import { formatMaterialDisplay, isUUID } from "@/lib/utils/material-display";

interface CycleCountTask {
  id: string;
  location: string;
  sku: string;
  item: string;
  expected: number;
  counted: number;
}

export default function CycleCountPage() {
  const { isOnline, dbReady } = useOffline();
  const [scannedLocation, setScannedLocation] = useState("");
  const [scannedSKU, setScannedSKU] = useState("");
  const [countedQty, setCountedQty] = useState(0);
  const [savedCounts, setSavedCounts] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [showSKUScanner, setShowSKUScanner] = useState(false);
  const [cycleCountTasks, setCycleCountTasks] = useState<CycleCountTask[]>([]);
  const [loading, setLoading] = useState(true);

  const handleScanLocation = () => {
    setShowLocationScanner(true);
  };

  const handleScanSKU = () => {
    setShowSKUScanner(true);
  };

  const handleLocationScan = (result: string) => {
    setScannedLocation(result);
    setShowLocationScanner(false);
  };

  const handleSKUScan = (result: string) => {
    setScannedSKU(result);
    setShowSKUScanner(false);
  };

  // Load cycle count tasks from API
  useEffect(() => {
    const loadCycleCountTasks = async () => {
      if (!isOnline) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const counts = await operationsApi.getCycleCounts();
        // Filter for assigned/pending tasks
        const activeCounts = counts.filter(c => c.status === "assigned" || c.status === "pending" || c.status === "in_progress");
        
        // Fetch material names for each count
        const tasksWithNames = await Promise.all(
          activeCounts.map(async (count) => {
            if (!count.materialId) {
              return {
                id: count.id,
                location: count.locationCode,
                sku: "N/A",
                item: "Material details not available",
                expected: parseInt(count.expectedQuantity || "0", 10) || 0,
                counted: parseInt(count.countedQuantity || "0", 10) || 0,
              };
            }
            try {
              const material = await materialsApi.getById(count.materialId);
              const display = formatMaterialDisplay(
                material.materialCode,
                material.description,
                material.id
              );
              return {
                id: count.id,
                location: count.locationCode,
                sku: display.sku,
                item: display.name,
                expected: parseInt(count.expectedQuantity || "0", 10) || 0,
                counted: parseInt(count.countedQuantity || "0", 10) || 0,
              };
            } catch (error) {
              console.error(`Error fetching material ${count.materialId}:`, error);
              // Don't show UUID, show user-friendly message
              return {
                id: count.id,
                location: count.locationCode,
                sku: "N/A",
                item: "Material details not available",
                expected: parseInt(count.expectedQuantity || "0", 10) || 0,
                counted: parseInt(count.countedQuantity || "0", 10) || 0,
              };
            }
          })
        );
        setCycleCountTasks(tasksWithNames);
      } catch (error) {
        console.error("Error loading cycle count tasks:", error);
        setCycleCountTasks([]);
      } finally {
        setLoading(false);
      }
    };
    loadCycleCountTasks();
  }, [isOnline]);

  // Load saved counts on mount
  useEffect(() => {
    if (dbReady) {
      loadSavedCounts();
    }
  }, [dbReady]);

  const loadSavedCounts = async () => {
    try {
      const records = await getScanRecordsByTask("cycle-count");
      setSavedCounts(records);
    } catch (error) {
      console.error("Error loading saved counts:", error);
    }
  };

  const handleConfirm = async () => {
    if (!scannedLocation || !scannedSKU || countedQty === 0) return;

    setSaveStatus("saving");

    try {
      // Save scan record to IndexedDB (works offline)
      const recordId = await saveScanRecord({
        taskId: "cycle-count",
        location: scannedLocation,
        sku: scannedSKU,
        qty: countedQty,
      });

      // Add to sync queue (will sync when online)
      await addToSyncQueue({
        type: "scan",
        action: "create",
        data: {
          taskId: "cycle-count",
          location: scannedLocation,
          sku: scannedSKU,
          qty: countedQty,
          timestamp: Date.now(),
        },
      });

      setSaveStatus("saved");
      
      // Reload saved counts
      await loadSavedCounts();

      // Reset form
      setTimeout(() => {
        setScannedLocation("");
        setScannedSKU("");
        setCountedQty(0);
        setSaveStatus("idle");
      }, 1500);
    } catch (error) {
      console.error("Error saving cycle count:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-base-content">Cycle Count</h2>
            <p className="text-sm text-base-content/60">
              Count items at each location to verify inventory accuracy.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-success" : "bg-warning animate-pulse"}`}></div>
            <span className={`text-xs font-medium ${isOnline ? "text-success" : "text-warning"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        {!isOnline && (
          <div className="bg-warning/10 border border-warning rounded-lg p-2 text-xs text-warning-content">
            <span className="material-symbols-outlined text-sm align-middle">info</span>
            <span className="ml-1">Working offline. Data will sync when connection is restored.</span>
          </div>
        )}
      </div>

      {/* Scan Location */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm font-medium text-base-content mb-2">Scan Location</div>
        <div className="flex gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="Scan or enter location"
            value={scannedLocation}
            onChange={(e) => setScannedLocation(e.target.value)}
          />
          <button
            onClick={handleScanLocation}
            className="btn btn-primary btn-square"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
      </div>

      {/* Count Items */}
      {scannedLocation && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300 space-y-4">
          <div className="text-sm font-medium text-base-content mb-2">Scan SKU</div>
          <div className="flex gap-2">
            <input
              className="input input-bordered flex-1"
              placeholder="Scan or enter SKU"
              value={scannedSKU}
              onChange={(e) => setScannedSKU(e.target.value)}
            />
            <button
              onClick={handleScanSKU}
              className="btn btn-primary btn-square"
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
          </div>

          {scannedSKU && (
            <div className="bg-base-200 rounded-lg p-4">
              <div className="text-sm text-base-content/60 mb-2">Counted Quantity</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCountedQty(Math.max(0, countedQty - 1))}
                  className="btn btn-circle btn-outline btn-sm"
                >
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <input
                  type="number"
                  className="input input-bordered flex-1 text-center text-xl font-bold"
                  value={countedQty}
                  onChange={(e) => setCountedQty(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                />
                <button
                  onClick={() => setCountedQty(countedQty + 1)}
                  className="btn btn-circle btn-outline btn-sm"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleConfirm}
            className="btn btn-primary w-full"
            disabled={!scannedLocation || !scannedSKU || countedQty === 0 || saveStatus === "saving" || !dbReady}
          >
            {saveStatus === "saving" ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : saveStatus === "saved" ? (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                Saved!
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                Confirm Count
              </>
            )}
          </button>
          {saveStatus === "saved" && (
            <div className="text-xs text-success text-center">
              ✓ Saved to local storage {!isOnline && "(will sync when online)"}
            </div>
          )}
          {saveStatus === "error" && (
            <div className="text-xs text-error text-center">
              ✗ Error saving. Please try again.
            </div>
          )}
        </div>
      )}

      {/* Saved Counts (from IndexedDB) */}
      {savedCounts.length > 0 && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base-content">Saved Counts</h3>
            <span className="badge badge-outline">{savedCounts.length}</span>
          </div>
          <div className="space-y-2">
            {savedCounts.slice(-5).reverse().map((record, idx) => (
              <div
                key={record.id || idx}
                className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div>
                  <div className="font-semibold text-sm text-base-content">
                    {record.location} • {record.sku}
                  </div>
                  <div className="text-xs text-base-content/60">
                    Qty: {record.qty} • {new Date(record.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!record.synced && (
                    <span className="badge badge-warning badge-sm">Pending Sync</span>
                  )}
                  {record.synced && (
                    <span className="badge badge-success badge-sm">Synced</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Cycle Count Tasks */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Active Tasks</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        ) : cycleCountTasks.length === 0 ? (
          <div className="text-center py-8 text-base-content/60">
            <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
            <p>No active cycle count tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cycleCountTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div>
                  <div className="font-semibold text-sm text-base-content">
                    {task.item}
                  </div>
                  {task.sku && task.sku !== "N/A" && !isUUID(task.sku) && (
                    <div className="text-xs text-base-content/60">
                      <span className="font-mono font-semibold text-primary">SKU: {task.sku}</span>
                    </div>
                  )}
                  <div className="text-xs text-base-content/60">
                    Location: {task.location} • Expected: {task.expected}
                  </div>
                </div>
                <span className="material-symbols-outlined text-base-content/40">chevron_right</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Scanners */}
      <QRScanner
        isOpen={showLocationScanner}
        onClose={() => setShowLocationScanner(false)}
        onScan={handleLocationScan}
        title="Scan Location QR Code"
        description="Point camera at location QR code or enter manually"
      />

      <QRScanner
        isOpen={showSKUScanner}
        onClose={() => setShowSKUScanner(false)}
        onScan={handleSKUScan}
        title="Scan SKU QR Code"
        description="Point camera at product SKU QR code or enter manually"
      />
    </div>
  );
}
