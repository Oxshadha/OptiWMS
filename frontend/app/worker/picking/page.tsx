"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { useWorker } from "@/contexts/WorkerContext";
import { saveScanRecord, getScanRecordsByTask, addToSyncQueue } from "@/lib/indexeddb";
import { QRScanner } from "@/components/QRScanner";
import { operationsApi } from "@/lib/api/operations";
import { tasksApi } from "@/lib/api/tasks-api";
import { showToast } from "@/lib/utils/toast";
import { formatMaterialDisplay, isUUID } from "@/lib/utils/material-display";
import { logger } from "@/lib/utils/logger";

interface Pick {
  id: string;
  taskId: string;
  order: string;
  location: string;
  item: string;
  sku: string;
  materialId: string;
  qty: number;
  status: "current" | "upcoming" | "completed";
  pickedLocations?: string[]; // Track which locations have been picked (multi-location picking)
}

export default function PickingPage() {
  const { isOnline, dbReady } = useOffline();
  const { worker } = useWorker();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pickedQty, setPickedQty] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedPicks, setSavedPicks] = useState<any[]>([]);
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [scannedLocation, setScannedLocation] = useState("");
  const [locationVerified, setLocationVerified] = useState(false);
  
  const currentPick = picks.find((p) => p.status === "current");
  const upcomingPicks = picks.filter((p) => p.status === "upcoming");

  // Load picking tasks from API - filtered by warehouse and only available (unassigned) tasks
  useEffect(() => {
    const loadPickingTasks = async () => {
      if (!worker?.warehouseId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Get only available (unassigned) tasks for worker's warehouse
        // Status "pending" means unassigned tasks (first come first serve)
        const tasks = await tasksApi.getAll("picking", "pending", undefined, worker.warehouseId, true);
        
        // Also include tasks assigned to this worker (in_progress, assigned)
        const myTasks = await tasksApi.getAll("picking", undefined, worker.id, worker.warehouseId, false);
        const myActiveTasks = myTasks.filter(t => 
          t.assignedTo === worker.id && 
          (t.status === "assigned" || t.status === "in_progress")
        );
        
        // Combine: available tasks + my active tasks
        const allTasks = [...tasks, ...myActiveTasks];
        
        // Remove duplicates
        const uniqueTasks = Array.from(
          new Map(allTasks.map(t => [t.id, t])).values()
        );
        
        // Transform tasks to picks with material details
        const transformedPicks: Pick[] = await Promise.all(
          uniqueTasks.map(async (task, index) => {
            let itemName = task.notes || "Item";
            let sku = "N/A";
            let materialId = "";
            
            // Try to get material details from task reference
            if (task.referenceType === "order" && task.referenceId) {
              try {
                const { orderItemsApi } = await import("@/lib/api/orderItems");
                const { materialsApi } = await import("@/lib/api/materials");
                const orderItems = await orderItemsApi.getByOrderId(task.referenceId);
                if (orderItems.length > 0) {
                  const firstItem = orderItems[0];
                  materialId = firstItem.materialId;
                  try {
                    const material = await materialsApi.getById(firstItem.materialId);
                    const display = formatMaterialDisplay(
                      material.materialCode,
                      material.description,
                      material.id
                    );
                    sku = display.sku;
                    itemName = display.name;
                  } catch (err) {
                    logger.warn("Could not fetch material details:", err);
                  }
                }
              } catch (err) {
                logger.warn("Could not fetch order items:", err);
              }
            }
            
            // Extract quantity from task notes (format: "Pick X units of...")
            let qty = 1;
            if (task.notes) {
              const qtyMatch = task.notes.match(/Pick\s+(\d+)\s+units/i);
              if (qtyMatch) {
                qty = parseInt(qtyMatch[1], 10) || 1;
              }
            }
            
            // Also try to get quantity from order items if available
            if (task.referenceType === "order" && task.referenceId) {
              try {
                const { orderItemsApi } = await import("@/lib/api/orderItems");
                const orderItems = await orderItemsApi.getByOrderId(task.referenceId);
                if (orderItems.length > 0 && orderItems[0].quantity) {
                  // Use order item quantity as fallback
                  qty = Math.ceil(parseFloat(orderItems[0].quantity.toString())) || qty;
                }
              } catch (err) {
                // Ignore errors, use extracted quantity
              }
            }
            
            return {
              id: task.id,
              taskId: task.id,
              order: task.referenceId || `TASK-${task.taskNumber}`,
              location: task.locationCode || "", // ✅ Bin location from task
              item: itemName,
              sku: sku,
              materialId: materialId || task.referenceId || "",
              qty: qty,
              status: "upcoming" as const, // All tasks start as upcoming until claimed
              pickedLocations: [], // Track which locations have been picked (multi-location picking)
            };
          })
        );
        
        // Set first task as current if available
        if (transformedPicks.length > 0) {
          transformedPicks[0].status = "current";
        }
        
        setPicks(transformedPicks);
      } catch (error) {
        logger.error("Failed to load picking tasks:", error);
        showToast.error("Failed to load picking tasks");
        // Fallback to empty array
        setPicks([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isOnline && worker?.warehouseId) {
      loadPickingTasks();
      
      // Poll for new tasks every 3 seconds (to catch newly created orders faster)
      const pollInterval = setInterval(() => {
        loadPickingTasks();
      }, 3000);
      
      return () => clearInterval(pollInterval);
    }
    
    if (dbReady) {
      loadSavedPicks();
    }
  }, [dbReady, isOnline, worker?.warehouseId, worker?.id]);

  const loadSavedPicks = async () => {
    try {
      const records = await getScanRecordsByTask("picking");
      setSavedPicks(records);
    } catch (error) {
      logger.error("Error loading saved picks:", error);
    }
  };

  // Claim a task when worker selects it (first come first serve)
  const handleClaimTask = async (taskId: string) => {
    if (!worker?.id) {
      showToast.error("Worker information not available");
      return;
    }

    try {
      setClaimingTaskId(taskId);
      await tasksApi.claim(taskId, worker.id);
      showToast.success("Task claimed successfully!");
      
      // Reload tasks to refresh the list
      const loadPickingTasks = async () => {
        if (!worker?.warehouseId) return;
        const tasks = await tasksApi.getAll("picking", "pending", undefined, worker.warehouseId, true);
        // Transform and set picks (same logic as in useEffect)
        // ... (will be handled by useEffect dependency)
      };
      
      if (isOnline) {
        await loadPickingTasks();
      }
    } catch (error: any) {
      showToast.error(error?.message || "Failed to claim task. It may have been taken by another worker.");
    } finally {
      setClaimingTaskId(null);
    }
  };

  const handleConfirmPick = async () => {
    if (!currentPick || pickedQty === 0 || pickedQty > currentPick.qty) {
      showToast.error("Please enter a valid quantity");
      return;
    }

    // Claim the task first if not already claimed
    if (isOnline && worker?.id && !currentPick.taskId.includes("claimed")) {
      try {
        await handleClaimTask(currentPick.taskId);
      } catch (error) {
        showToast.error("Failed to claim task. Please try again.");
        return;
      }
    }

    setSaveStatus("saving");

    try {
      if (isOnline) {
        // Complete picking via API (with worker ID for tracking)
        await operationsApi.completePicking(
          currentPick.taskId, 
          {
            items: [{
              materialId: currentPick.materialId,
              quantity: pickedQty.toString(),
              locationCode: currentPick.location,
            }],
          },
          worker?.id
        );
        
        showToast.success("Pick confirmed successfully!");
        
        // Track picked location and mark as completed if all locations picked
        setPicks(prev => {
          const updated: Pick[] = prev.map((p): Pick => {
            if (p.id === currentPick.id) {
              // Track this location as picked
              const pickedLocations = [...(p.pickedLocations || []), currentPick.location];
              
              // Check if this is a multi-location pick (same order, different locations)
              const sameOrderPicks = prev.filter(pp => 
                pp.order === p.order && 
                pp.materialId === p.materialId && 
                pp.status !== "completed"
              );
              
              // If all locations for this material/order are picked, mark as completed
              if (sameOrderPicks.length <= 1 || pickedLocations.length >= sameOrderPicks.length) {
                return { ...p, status: "completed" as const, pickedLocations };
              } else {
                // Still more locations to pick
                return { ...p, pickedLocations, status: "current" as const };
              }
            }
            return p;
          });
          
          // Set next upcoming task as current (if current is completed)
          const current = updated.find(p => p.status === "current");
          if (!current || current.status === "completed") {
            const nextUpcoming = updated.find(p => p.status === "upcoming");
            if (nextUpcoming) {
              return updated.map((p): Pick =>
                p.id === nextUpcoming.id ? { ...p, status: "current" as const } : p
              );
            }
          }
          return updated;
        });
      } else {
        // Save pick record to IndexedDB (works offline)
        const recordId = await saveScanRecord({
          taskId: "picking",
          location: currentPick.location,
          sku: currentPick.sku,
          item: currentPick.item,
          qty: pickedQty,
        });

        // Add to sync queue (will sync when online)
        await addToSyncQueue({
          type: "scan",
          action: "create",
          data: {
            taskId: currentPick.taskId,
            order: currentPick.order,
            location: currentPick.location,
            sku: currentPick.sku,
            item: currentPick.item,
            qty: pickedQty,
            timestamp: Date.now(),
          },
        });
        
        showToast.success("Pick saved offline, will sync when online");
      }

      setSaveStatus("saved");
      
      // Reload saved picks
      await loadSavedPicks();

      // Reset form
      setTimeout(() => {
        setPickedQty(0);
        setSaveStatus("idle");
      }, 1500);
    } catch (error) {
      logger.error("Error saving pick:", error);
      setSaveStatus("error");
      showToast.error("Failed to save pick. Please try again.");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    if (!worker?.warehouseId) return;
    setIsLoading(true);
    try {
      const tasks = await tasksApi.getAll("picking", "pending", undefined, worker.warehouseId, true);
      const myTasks = await tasksApi.getAll("picking", undefined, worker.id, worker.warehouseId, false);
      const myActiveTasks = myTasks.filter(t => 
        t.assignedTo === worker.id && 
        (t.status === "assigned" || t.status === "in_progress")
      );
      const allTasks = [...tasks, ...myActiveTasks];
      const uniqueTasks = Array.from(
        new Map(allTasks.map(t => [t.id, t])).values()
      );
      
      // Transform tasks (same logic as in useEffect)
      const transformedPicks: Pick[] = await Promise.all(
        uniqueTasks.map(async (task) => {
          let itemName = task.notes || "Item";
          let sku = "N/A";
          let materialId = "";
          
          if (task.referenceType === "order" && task.referenceId) {
            try {
              const { orderItemsApi } = await import("@/lib/api/orderItems");
              const { materialsApi } = await import("@/lib/api/materials");
              const orderItems = await orderItemsApi.getByOrderId(task.referenceId);
              if (orderItems.length > 0) {
                const firstItem = orderItems[0];
                materialId = firstItem.materialId;
                try {
                  const material = await materialsApi.getById(firstItem.materialId);
                  const display = formatMaterialDisplay(
                    material.materialCode,
                    material.description,
                    material.id
                  );
                  sku = display.sku;
                  itemName = display.name;
                } catch (err) {
                  logger.warn("Could not fetch material details:", err);
                }
              }
            } catch (err) {
              logger.warn("Could not fetch order items:", err);
            }
          }
          
          let qty = 1;
          if (task.notes) {
            const qtyMatch = task.notes.match(/Pick\s+(\d+)\s+units/i);
            if (qtyMatch) {
              qty = parseInt(qtyMatch[1], 10) || 1;
            }
          }
          
          return {
            id: task.id,
            taskId: task.id,
            order: task.referenceId || `TASK-${task.taskNumber}`,
            location: task.locationCode || "",
            item: itemName,
            sku: sku,
            materialId: materialId || task.referenceId || "",
            qty: qty,
            status: "upcoming" as const,
            pickedLocations: [],
          };
        })
      );
      
      if (transformedPicks.length > 0) {
        transformedPicks[0].status = "current";
      }
      
      setPicks(transformedPicks);
      showToast.success("Tasks refreshed!");
    } catch (error) {
      logger.error("Failed to refresh tasks:", error);
      showToast.error("Failed to refresh tasks");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Network Status and Refresh */}
      <div className="bg-base-100 rounded-xl p-3 border border-base-300">
        <div className="flex items-center justify-between">
          <span className="text-sm text-base-content/60">Network Status</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading || !isOnline}
              className="btn btn-sm btn-outline btn-primary"
              title="Refresh tasks to see newly created orders"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-success" : "bg-warning animate-pulse"}`}></div>
              <span className={`text-sm font-medium ${isOnline ? "text-success" : "text-warning"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>
        {!isOnline && (
          <div className="mt-2 text-xs text-warning-content bg-warning/10 rounded p-2">
            <span className="material-symbols-outlined text-xs align-middle">info</span>
            <span className="ml-1">Working offline. Picks will sync when connection is restored.</span>
          </div>
        )}
      </div>

      {/* Current Pick */}
      {currentPick && (
        <div className="bg-primary/10 border-2 border-primary rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-primary font-medium">Current Pick</div>
            <div className="badge badge-primary">Active</div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-base-content/60">Order</div>
              <div className="font-bold text-lg text-base-content">{currentPick.order}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-base-content/60">Bin Location</div>
                <div className="font-semibold text-base-content text-lg">
                  {currentPick.location || "Not Assigned"}
                </div>
                {currentPick.location && (
                  <button
                    onClick={() => setShowLocationScanner(true)}
                    className="btn btn-sm btn-outline btn-primary mt-2 w-full"
                  >
                    <span className="material-symbols-outlined">qr_code_scanner</span>
                    Scan Location
                  </button>
                )}
              </div>
              <div>
                <div className="text-xs text-base-content/60">Quantity</div>
                <div className="font-semibold text-base-content">{currentPick.qty}</div>
              </div>
            </div>
            
            {/* Optimal Path Display (AI-ready) */}
            {upcomingPicks.length > 0 && (
              <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-info text-sm">route</span>
                  <span className="text-xs font-medium text-info">Optimal Path</span>
                </div>
                <div className="text-xs text-base-content/70">
                  Next locations: {upcomingPicks.slice(0, 3).map(p => p.location || "TBD").join(" → ")}
                  {upcomingPicks.length > 3 && ` (+${upcomingPicks.length - 3} more)`}
                </div>
                <div className="text-xs text-base-content/50 mt-1">
                  {upcomingPicks.length > 0 ? "AI-optimized route available" : "Path calculated based on task order"}
                </div>
              </div>
            )}
            
            {/* Manual Location Input */}
            {currentPick.location && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Or Enter Bin Number Manually</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered input-sm"
                  placeholder="Enter bin location (e.g., B3, A-01-01-1-A)"
                  value={scannedLocation}
                  onChange={(e) => {
                    const entered = e.target.value;
                    setScannedLocation(entered);
                    // Verify location matches
                    if (entered && currentPick.location) {
                      const normalizedEntered = entered.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      const normalizedTask = currentPick.location.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      if (normalizedEntered === normalizedTask || 
                          normalizedEntered.includes(normalizedTask) || 
                          normalizedTask.includes(normalizedEntered)) {
                        setLocationVerified(true);
                        showToast.success("Location verified!");
                      } else {
                        setLocationVerified(false);
                      }
                    }
                  }}
                />
              </div>
            )}
            <div>
              <div className="text-xs text-base-content/60">Item</div>
              <div className="font-semibold text-base-content">{currentPick.item}</div>
              {currentPick.sku && currentPick.sku !== "N/A" && !isUUID(currentPick.sku) && (
                <div className="text-xs text-base-content/60">
                  <span className="font-mono font-semibold text-primary">SKU: {currentPick.sku}</span>
                </div>
              )}
            </div>

            {/* Quantity Picker */}
            <div className="bg-base-100 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-2">Picked Quantity</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPickedQty(Math.max(0, pickedQty - 1))}
                  className="btn btn-circle btn-outline btn-sm"
                >
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <input
                  type="number"
                  className="input input-bordered flex-1 text-center text-xl font-bold"
                  value={pickedQty}
                  onChange={(e) => setPickedQty(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                  max={currentPick.qty}
                />
                <button
                  onClick={() => setPickedQty(Math.min(currentPick.qty, pickedQty + 1))}
                  className="btn btn-circle btn-outline btn-sm"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

            {/* Location Verification Status */}
            {currentPick.location && (
              <div className={`alert ${locationVerified ? "alert-success" : "alert-warning"} mb-3`}>
                {locationVerified ? (
                  <>
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>Location verified: {currentPick.location}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">warning</span>
                    <span>Please scan or verify bin location: {currentPick.location}</span>
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleConfirmPick}
              className="btn btn-primary w-full"
              disabled={
                pickedQty === 0 || 
                pickedQty > currentPick.qty || 
                saveStatus === "saving" || 
                !dbReady ||
                (Boolean(currentPick.location) && !locationVerified && !scannedLocation)
              }
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
                  Confirm Pick
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
        </div>
      )}

      {/* Claim Task Button for Current Pick */}
      {currentPick && isOnline && worker?.id && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <button
            onClick={() => handleClaimTask(currentPick.taskId)}
            className="btn btn-primary w-full"
            disabled={claimingTaskId === currentPick.taskId}
          >
            {claimingTaskId === currentPick.taskId ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Claiming...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">lock</span>
                Claim This Task (First Come First Serve)
              </>
            )}
          </button>
          <p className="text-xs text-base-content/60 mt-2 text-center">
            Claim this task to lock it. Other workers won't see it once claimed.
          </p>
        </div>
      )}

      {/* Upcoming Picks */}
      {upcomingPicks.length > 0 && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base-content">Upcoming Picks</h3>
            <span className="badge badge-outline">{upcomingPicks.length}</span>
          </div>
          <div className="space-y-2">
            {upcomingPicks.map((pick) => (
              <div
                key={pick.id}
                className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-info">location_on</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-base-content">
                      {pick.location} • {pick.item}
                    </div>
                    <div className="text-xs text-base-content/60">Qty: {pick.qty}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-base-content/40">chevron_right</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Picks (from IndexedDB) */}
      {savedPicks.length > 0 && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base-content">Saved Picks</h3>
            <span className="badge badge-outline">{savedPicks.length}</span>
          </div>
          <div className="space-y-2">
            {savedPicks.slice(-5).reverse().map((record, idx) => (
              <div
                key={record.id || idx}
                className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div>
                  <div className="font-semibold text-sm text-base-content">
                    {record.location} • {record.item || record.sku}
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

      {/* Quick Actions */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setShowLocationScanner(true)}
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Scan Location
          </button>
          <button 
            className="btn btn-outline btn-sm"
            onClick={loadSavedPicks}
          >
            <span className="material-symbols-outlined">refresh</span>
            Refresh List
          </button>
        </div>
      </div>

      {/* QR Scanner */}
      <QRScanner
        isOpen={showLocationScanner}
        onClose={() => setShowLocationScanner(false)}
        onScan={(result) => {
          setScannedLocation(result);
          setShowLocationScanner(false);
          
          // Verify location matches task location
          if (currentPick && currentPick.location) {
            const normalizedScanned = result.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const normalizedTask = currentPick.location.toUpperCase().replace(/[^A-Z0-9]/g, '');
            
            if (normalizedScanned === normalizedTask || 
                normalizedScanned.includes(normalizedTask) || 
                normalizedTask.includes(normalizedScanned)) {
              setLocationVerified(true);
              showToast.success(`Location verified: ${currentPick.location}`);
            } else {
              setLocationVerified(false);
              showToast.error(`Location mismatch! Expected: ${currentPick.location}, Scanned: ${result}`);
            }
          }
        }}
        title="Scan Bin Location QR Code"
        description="Point camera at bin location QR code"
      />
    </div>
  );
}
