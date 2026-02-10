"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { useWorker } from "@/contexts/WorkerContext";
import { saveScanRecord, getScanRecordsByTask, addToSyncQueue } from "@/lib/indexeddb";
import { QRScanner } from "@/components/QRScanner";
import { operationsApi } from "@/lib/api/operations";
import { tasksApi } from "@/lib/api/tasks-api";
import { showToast } from "@/lib/utils/toast";
import { formatMaterialDisplay } from "@/lib/utils/material-display";
import { logger } from "@/lib/utils/logger";
import { Pick } from "./types";
import { CurrentPickCard } from "./components/CurrentPickCard";
import {
  NetworkStatusCard,
  QuickActionsCard,
  SavedPicksCard,
  UpcomingPicksCard,
} from "./components/PickingPanels";

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

  const transformTasksToPicks = async (tasks: any[]): Promise<Pick[]> => {
    const transformedPicks: Pick[] = await Promise.all(
      tasks.map(async (task, index) => {
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

        if (task.referenceType === "order" && task.referenceId) {
          try {
            const { orderItemsApi } = await import("@/lib/api/orderItems");
            const orderItems = await orderItemsApi.getByOrderId(task.referenceId);
            if (orderItems.length > 0 && orderItems[0].quantity) {
              qty = Math.ceil(parseFloat(orderItems[0].quantity.toString())) || qty;
            }
          } catch (err) {
            // keep parsed qty
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
          status: (index === 0 ? "current" : "upcoming") as "current" | "upcoming",
          pickedLocations: [],
        };
      })
    );

    return transformedPicks;
  };

  const loadPicksForWorker = async (warehouseId: string, workerId?: string) => {
    const tasks = await tasksApi.getAll("picking", "pending", undefined, warehouseId, true);
    const myTasks = workerId
      ? await tasksApi.getAll("picking", undefined, workerId, warehouseId, false)
      : [];
    const myActiveTasks = myTasks.filter(
      (t) => t.assignedTo === workerId && (t.status === "assigned" || t.status === "in_progress")
    );
    const allTasks = [...tasks, ...myActiveTasks];
    const uniqueTasks = Array.from(new Map(allTasks.map((t) => [t.id, t])).values());
    return transformTasksToPicks(uniqueTasks);
  };

  // Load picking tasks from API - filtered by warehouse and only available (unassigned) tasks
  useEffect(() => {
    const loadPickingTasks = async () => {
      if (!worker?.warehouseId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const transformedPicks = await loadPicksForWorker(worker.warehouseId, worker.id);
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
      const transformedPicks = await loadPicksForWorker(worker.warehouseId, worker.id);
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
      <NetworkStatusCard isOnline={isOnline} isLoading={isLoading} onRefresh={handleRefresh} />

      {/* Current Pick */}
      {currentPick && (
        <CurrentPickCard
          currentPick={currentPick}
          upcomingPicks={upcomingPicks}
          pickedQty={pickedQty}
          scannedLocation={scannedLocation}
          locationVerified={locationVerified}
          saveStatus={saveStatus}
          dbReady={dbReady}
          onOpenLocationScanner={() => setShowLocationScanner(true)}
          onScannedLocationChange={(entered) => {
            setScannedLocation(entered);
            if (entered && currentPick.location) {
              const normalizedEntered = entered.toUpperCase().replace(/[^A-Z0-9]/g, "");
              const normalizedTask = currentPick.location.toUpperCase().replace(/[^A-Z0-9]/g, "");
              if (
                normalizedEntered === normalizedTask ||
                normalizedEntered.includes(normalizedTask) ||
                normalizedTask.includes(normalizedEntered)
              ) {
                setLocationVerified(true);
                showToast.success("Location verified!");
              } else {
                setLocationVerified(false);
              }
            }
          }}
          onPickedQtyChange={setPickedQty}
          onConfirmPick={handleConfirmPick}
        />
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
      <UpcomingPicksCard upcomingPicks={upcomingPicks} />

      {/* Saved Picks (from IndexedDB) */}
      <SavedPicksCard savedPicks={savedPicks} />

      {/* Quick Actions */}
      <QuickActionsCard onOpenLocationScanner={() => setShowLocationScanner(true)} onRefreshSaved={loadSavedPicks} />

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
