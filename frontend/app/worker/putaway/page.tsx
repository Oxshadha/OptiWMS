"use client";

import { useState, useEffect } from "react";
import { operationsApi } from "@/lib/api/operations";
import { tasksApi } from "@/lib/api/tasks-api";
import { ordersApi } from "@/lib/api/orders";
import { orderItemsApi, PutawayItem } from "@/lib/api/orderItems";
import { useWorker } from "@/contexts/WorkerContext";
import { validateLocationCode } from "@/lib/utils/validation";
import { validateLocationExists } from "@/lib/utils/location-helpers";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { PutawayOrderSelection } from "./components/PutawayOrderSelection";
import { PutawayOrderWorkflow } from "./components/PutawayOrderWorkflow";

const parsePutawayProgress = (notes?: string | null): { completed: number; required: number } | null => {
  if (!notes) return null;
  const match = notes.match(/PUTAWAY_PROGRESS=(\d+)\/(\d+)/i);
  if (!match) return null;
  const completed = Number(match[1]);
  const required = Number(match[2]);
  if (Number.isNaN(completed) || Number.isNaN(required)) return null;
  return { completed, required };
};

const parsePutawaySkipReason = (notes?: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/PUTAWAY_SKIP_REASON=([^\n\r;]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const isItemFullyPutAway = (status?: string, completed?: number, required?: number): boolean => {
  if ((status || "").toLowerCase() === "completed") return true;
  if (typeof completed === "number" && typeof required === "number") {
    return completed >= required && required > 0;
  }
  return false;
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.message === "string") return errObj.message;
    if (typeof errObj.error === "string") return errObj.error;
    if (errObj.response && typeof errObj.response === "object") {
      const response = errObj.response as Record<string, unknown>;
      if (typeof response.message === "string") return response.message;
    }
  }
  return "Unknown error";
};

export default function PutawayPage() {
  const { worker, isLoading: workerContextLoading } = useWorker();
  
  // Order selection state
  const [orders, setOrders] = useState<Array<{ id: string; orderNumber: string; status: string }>>([]);
  const [selectedOrder, setSelectedOrder] = useState<{ id: string; orderNumber: string } | null>(null);
  const [putawayItems, setPutawayItems] = useState<PutawayItem[]>([]);
  const [scannedPONumber, setScannedPONumber] = useState("");
  const [showPOScanner, setShowPOScanner] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  
  // Item putaway state
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [scannedLocation, setScannedLocation] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Changed to false - only set to true when loading items
  const [locationError, setLocationError] = useState<string>("");
  const [validatingLocation, setValidatingLocation] = useState(false);
  const [putawayProgress, setPutawayProgress] = useState<Map<string, boolean>>(new Map()); // Track which items are put away
  const [allocatedByItem, setAllocatedByItem] = useState<Map<string, number>>(new Map());
  const [skippedReasonsByItem, setSkippedReasonsByItem] = useState<Map<string, string>>(new Map());
  const [allocationQuantity, setAllocationQuantity] = useState<number>(0);
  
  const getFirstPendingItemIndex = (
    items: PutawayItem[],
    progress: Map<string, boolean>,
    skipped: Map<string, string>
  ) => {
    const nonSkippedPending = items.findIndex(
      (item) => !(progress.get(item.itemId) || false) && !skipped.has(item.itemId)
    );
    if (nonSkippedPending >= 0) return nonSkippedPending;
    const pendingIndex = items.findIndex((item) => !(progress.get(item.itemId) || false));
    return pendingIndex >= 0 ? pendingIndex : 0;
  };

  // Load orders needing putaway
  useEffect(() => {
    if (workerContextLoading || !worker?.warehouseId) {
      setIsLoadingOrders(false); // Ensure loading state is cleared
      return;
    }

    const loadOrders = async () => {
      try {
        setIsLoadingOrders(true);
        const ordersList = await ordersApi.getOrdersNeedingPutaway(worker.warehouseId!);
        setOrders(ordersList.map(o => ({ id: o.id, orderNumber: o.orderNumber, status: o.status })));
        logger.debug("[Putaway] Orders needing putaway:", ordersList.length);
      } catch (err) {
        logger.error("[Putaway] Failed to load orders:", err);
        showToast.error("Failed to load orders. Please try again.");
      } finally {
        setIsLoadingOrders(false);
      }
    };

    loadOrders();
    // Refresh every 5 seconds
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [workerContextLoading, worker?.warehouseId]);

  // Load putaway items when order is selected
  useEffect(() => {
    if (!selectedOrder) {
      setPutawayItems([]);
      return;
    }

    const loadPutawayItems = async () => {
      try {
        setIsLoading(true);
        const items = await orderItemsApi.getPutawayItems(selectedOrder.id);
        setPutawayItems(items);
        logger.debug("[Putaway] Putaway items for order:", selectedOrder.orderNumber, items.length);
        
        // Initialize progress from persisted task status/progress, not only local session state.
        const progress = new Map<string, boolean>();
        const allocated = new Map<string, number>();
        const skipped = new Map<string, string>();

        items.forEach(item => {
          progress.set(item.itemId, false);
          allocated.set(item.itemId, 0);
        });

        try {
          const tasks = await tasksApi.getAll("putaway", undefined, undefined, worker?.warehouseId, false);
          const relevantTasks = tasks.filter(
            (task) =>
              task.referenceType === "order_item" &&
              items.some((item) => item.itemId === task.referenceId)
          );

          for (const item of items) {
            const itemTasks = relevantTasks.filter((task) => task.referenceId === item.itemId);
            const completedTask = itemTasks.find((task) => task.status === "completed");
            const activeTask = itemTasks.find((task) => task.status === "in_progress" || task.status === "pending");
            const taskForProgress = completedTask ?? activeTask;
            const progressInfo = parsePutawayProgress(taskForProgress?.notes);
            const skipReason = parsePutawaySkipReason(taskForProgress?.notes);
            if (skipReason) {
              skipped.set(item.itemId, skipReason);
            }

            if (completedTask) {
              allocated.set(item.itemId, item.receivedQuantity);
            } else if (progressInfo) {
              allocated.set(item.itemId, Math.min(progressInfo.completed, item.receivedQuantity));
            }

            const done = isItemFullyPutAway(
              completedTask?.status ?? item.status,
              progressInfo?.completed,
              progressInfo?.required
            );
            progress.set(item.itemId, done);
          }
        } catch (taskError) {
          logger.warn("[Putaway] Could not hydrate progress from tasks, using defaults.", taskError);
        }

        setPutawayProgress(progress);
        setAllocatedByItem(allocated);
        setSkippedReasonsByItem(skipped);
        const firstPendingIndex = getFirstPendingItemIndex(items, progress, skipped);
        setCurrentItemIndex(firstPendingIndex);
        if (items.length > 0) {
          const firstItem = items[firstPendingIndex];
          const alreadyAllocated = allocated.get(firstItem.itemId) || 0;
          const remaining = Math.max(firstItem.receivedQuantity - alreadyAllocated, 0);
          setAllocationQuantity(Math.max(remaining, 1));
        }
      } catch (err) {
        logger.error("[Putaway] Failed to load putaway items:", err);
        showToast.error("Failed to load order items. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPutawayItems();
  }, [selectedOrder]);

  useEffect(() => {
    const currentItem = putawayItems[currentItemIndex];
    if (!currentItem) {
      return;
    }
    const alreadyAllocated = allocatedByItem.get(currentItem.itemId) || 0;
    const remaining = Math.max(currentItem.receivedQuantity - alreadyAllocated, 0);
    setAllocationQuantity(Math.max(remaining, 1));
  }, [currentItemIndex, putawayItems, allocatedByItem]);

  useEffect(() => {
    const currentItem = putawayItems[currentItemIndex];
    if (!currentItem) {
      return;
    }

    // If current item is already complete (e.g., resumed order), jump to first pending item.
    if (putawayProgress.get(currentItem.itemId)) {
      const nextIndex = getFirstPendingItemIndex(putawayItems, putawayProgress, skippedReasonsByItem);
      if (nextIndex !== currentItemIndex) {
        setCurrentItemIndex(nextIndex);
      }
    }
  }, [currentItemIndex, putawayItems, putawayProgress, skippedReasonsByItem]);

  const handleLocationSelect = async (locationCode: string) => {
    setValidatingLocation(true);
    setLocationError("");
    
    // Validate location exists in database (this handles format + existence check)
    const validation = await validateLocationExists(locationCode, worker?.warehouseId);
    
    if (!validation.valid) {
      setLocationError(validation.error || "Invalid location");
      setValidatingLocation(false);
      showToast.error(validation.error || "Invalid location");
      return;
    }
    
    // Location is valid and active
    setScannedLocation(locationCode);
    setLocationError("");
    setShowLocationPicker(false);
    setValidatingLocation(false);
  };

  const handleLocationChange = async (value: string) => {
    setScannedLocation(value);
    if (value.trim() !== "") {
      setValidatingLocation(true);
      setLocationError("");
      
      // Validate location exists in database (handles format + existence)
      const validation = await validateLocationExists(value.trim().toUpperCase(), worker?.warehouseId);
      
      if (!validation.valid) {
        setLocationError(validation.error || "Invalid location");
      } else {
        setLocationError(""); // Location is valid and active
      }
      
      setValidatingLocation(false);
    } else {
      setLocationError("");
      setValidatingLocation(false);
    }
  };

  // Handle PO number scan/selection
  const handlePOScan = (result: string) => {
    const poNumber = result.trim().toUpperCase();
    const matchingOrder = orders.find((o: { id: string; orderNumber: string; status: string }) => o.orderNumber === poNumber);
    if (matchingOrder) {
      setSelectedOrder({ id: matchingOrder.id, orderNumber: matchingOrder.orderNumber });
      setScannedPONumber("");
      setShowPOScanner(false);
      showToast.success(`Selected order: ${poNumber}`);
    } else {
      showToast.error(`Order ${poNumber} not found`);
    }
  };

  const handlePOChange = async (value: string) => {
    setScannedPONumber(value);
    if (value.trim() !== "") {
      try {
        const order = await ordersApi.getByOrderNumber(value.trim().toUpperCase());
        setSelectedOrder({ id: order.id, orderNumber: order.orderNumber });
        showToast.success(`Selected order: ${order.orderNumber}`);
      } catch (err) {
        // Order not found - will show error when trying to confirm
      }
    }
  };

  // Handle item putaway confirmation
  const handleConfirmPutaway = async () => {
    if (!selectedOrder || putawayItems.length === 0) {
      showToast.error("No order or items selected");
      return;
    }

    const currentItem = putawayItems[currentItemIndex];
    if (!currentItem) {
      showToast.error("No item to put away");
      return;
    }

    // Validate location
    if (!scannedLocation || scannedLocation.trim() === "") {
      showToast.error("Please enter or select location");
      return;
    }
    
    const locationValidation = validateLocationCode(scannedLocation);
    if (!locationValidation.valid) {
      showToast.error(locationValidation.error || "Invalid location format");
      return;
    }
    
    if (locationError) {
      showToast.error(locationError);
      return;
    }

    try {
      // Find putaway task for this item and order
      const tasks = await tasksApi.getAll("putaway", undefined, undefined, worker?.warehouseId, false);
      const itemTask = tasks.find((t: any) => 
        t.referenceType === "order_item" &&
        t.referenceId === currentItem.itemId &&
        (t.status === "pending" || t.status === "in_progress")
      );

      // Backward compatibility for legacy tasks created at order level.
      const fallbackTask = tasks.find((t: any) =>
        t.referenceType === "order" &&
        t.referenceId === selectedOrder.id &&
        (t.status === "pending" || t.status === "in_progress")
      );

      const taskToComplete = itemTask ?? fallbackTask;

      if (!taskToComplete) {
        showToast.error("Putaway task not found for this item. Tasks are created automatically after receiving.");
        return;
      }

      const alreadyAllocated = allocatedByItem.get(currentItem.itemId) || 0;
      const remaining = Math.max(currentItem.receivedQuantity - alreadyAllocated, 0);
      if (allocationQuantity <= 0 || allocationQuantity > remaining) {
        showToast.error(`Putaway quantity must be between 1 and ${remaining}`);
        return;
      }

      await operationsApi.completePutaway(taskToComplete.id, {
        locationCode: scannedLocation.trim().toUpperCase(),
        lpn: "", // LPN is ignored in backend but kept for backward compatibility
        quantity: allocationQuantity,
        materialId: currentItem.materialId, // Pass material ID explicitly
        workerId: worker?.id, // Required for labor productivity attribution
      });
      
      const nextAllocated = alreadyAllocated + allocationQuantity;
      const isComplete = nextAllocated >= currentItem.receivedQuantity;
      const updatedAllocated = new Map(allocatedByItem);
      updatedAllocated.set(currentItem.itemId, nextAllocated);
      setAllocatedByItem(updatedAllocated);
      if (isComplete) {
        setSkippedReasonsByItem((prev) => {
          const next = new Map(prev);
          next.delete(currentItem.itemId);
          return next;
        });
      }

      // Mark item as put away when fully allocated
      const newProgress = new Map(putawayProgress);
      newProgress.set(currentItem.itemId, isComplete);
      setPutawayProgress(newProgress);
      
      showToast.success(
        isComplete
          ? `Item fully put away to location(s).`
          : `Partial putaway saved (${nextAllocated}/${currentItem.receivedQuantity}).`
      );
      
      // Reset form
      setScannedLocation("");
      setLocationError("");
      
      // Move to next pending item when fully allocated.
      if (isComplete) {
        const allDone = Array.from(newProgress.values()).every((done) => done);
        if (allDone) {
          showToast.success(`All items in ${selectedOrder.orderNumber} have been put away! Inventory and warehouse layout will update automatically.`);
          setTimeout(() => {
            setSelectedOrder(null);
            setPutawayItems([]);
          }, 2000);
        } else {
          const nextIndex = getFirstPendingItemIndex(putawayItems, newProgress, skippedReasonsByItem);
          setCurrentItemIndex(nextIndex);
          const nextItem = putawayItems[nextIndex];
          const nextAllocatedQty = updatedAllocated.get(nextItem.itemId) || 0;
          setAllocationQuantity(Math.max(nextItem.receivedQuantity - nextAllocatedQty, 1));
        }
      } else {
        const nextRemaining = Math.max(currentItem.receivedQuantity - nextAllocated, 0);
        setAllocationQuantity(Math.max(nextRemaining, 1));
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      logger.error("Error confirming putaway:", error);
      showToast.error(`Failed to complete putaway: ${message}`);
    }
  };

  const handleSkipItem = async (reason: string) => {
    if (!selectedOrder || putawayItems.length === 0) {
      showToast.error("No order or item selected");
      return;
    }
    const currentItem = putawayItems[currentItemIndex];
    if (!currentItem) {
      showToast.error("No item selected");
      return;
    }
    if (!reason.trim()) {
      showToast.error("Skip reason is required");
      return;
    }

    try {
      const tasks = await tasksApi.getAll("putaway", undefined, undefined, worker?.warehouseId, false);
      const itemTask = tasks.find(
        (t: any) =>
          t.referenceType === "order_item" &&
          t.referenceId === currentItem.itemId &&
          (t.status === "pending" || t.status === "in_progress")
      );

      if (!itemTask) {
        showToast.error("Item-level putaway task not found. Cannot skip this item safely.");
        return;
      }

      await operationsApi.skipPutaway(itemTask.id, {
        reason: reason.trim(),
        workerId: worker?.id,
      });

      const updatedSkipped = new Map(skippedReasonsByItem);
      updatedSkipped.set(currentItem.itemId, reason.trim());
      setSkippedReasonsByItem(updatedSkipped);
      showToast.success("Item skipped with reason. Continue with next pending item.");

      const nextIndex = getFirstPendingItemIndex(putawayItems, putawayProgress, updatedSkipped);
      if (nextIndex !== currentItemIndex) {
        setCurrentItemIndex(nextIndex);
      }
      setScannedLocation("");
      setLocationError("");
    } catch (error) {
      const message = extractErrorMessage(error);
      logger.error("Error skipping putaway item:", error);
      showToast.error(`Failed to skip item: ${message}`);
    }
  };

  const handleUseSuggestedLocation = async (suggestedLocation: string) => {
    const validation = await validateLocationExists(suggestedLocation, worker?.warehouseId);
    if (validation.valid) {
      setScannedLocation(suggestedLocation);
    } else {
      showToast.error(validation.error || "Suggested location is not valid");
    }
  };

  // Show loading while worker context is loading or items are loading
  if (workerContextLoading || (selectedOrder && isLoading)) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-64 space-y-4">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="text-sm text-base-content/60">
          {workerContextLoading ? "Loading worker information..." : "Loading order items..."}
        </p>
      </div>
    );
  }

  // Show message if no worker or no warehouse
  if (!worker) {
    return (
      <div className="p-4">
        <div className="alert alert-error">
          <span>Worker information not available. Please log in again.</span>
        </div>
      </div>
    );
  }

  // Check warehouseId - be lenient like picking page
  // Only show error if both warehouseId AND warehouse name are missing
  if (!worker?.warehouseId && (!worker?.warehouse || worker.warehouse === "Unknown" || worker.warehouse === "Unassigned")) {
    return (
      <div className="p-4">
        <div className="alert alert-warning">
          <span>No warehouse assigned to your account. Please contact your administrator.</span>
        </div>
      </div>
    );
  }

  // If no order selected, show order list
  if (!selectedOrder) {
    return (
      <PutawayOrderSelection
        orders={orders}
        scannedPONumber={scannedPONumber}
        isLoadingOrders={isLoadingOrders}
        showPOScanner={showPOScanner}
        onPOChange={(value) => {
          void handlePOChange(value);
        }}
        onOpenScanner={() => setShowPOScanner(true)}
        onCloseScanner={() => setShowPOScanner(false)}
        onPOScan={handlePOScan}
        onSelectOrder={setSelectedOrder}
      />
    );
  }

  // If order selected, show items for putaway
  if (selectedOrder && putawayItems.length > 0) {
    const currentItem = putawayItems[currentItemIndex];
    const alreadyAllocated = currentItem ? (allocatedByItem.get(currentItem.itemId) || 0) : 0;
    const remainingQuantity = currentItem ? Math.max(currentItem.receivedQuantity - alreadyAllocated, 0) : 0;
    return (
      <PutawayOrderWorkflow
        selectedOrder={selectedOrder}
        putawayItems={putawayItems}
        currentItemIndex={currentItemIndex}
        putawayProgress={putawayProgress}
        scannedLocation={scannedLocation}
        locationError={locationError}
        validatingLocation={validatingLocation}
        showLocationPicker={showLocationPicker}
        warehouseId={worker?.warehouseId}
        onBack={() => {
          setSelectedOrder(null);
          setPutawayItems([]);
          setCurrentItemIndex(0);
        }}
        onLocationChange={(value) => {
          void handleLocationChange(value);
        }}
        onOpenLocationPicker={() => setShowLocationPicker(true)}
        onCloseLocationPicker={() => setShowLocationPicker(false)}
        onUseSuggestedLocation={handleUseSuggestedLocation}
        onConfirmPutaway={handleConfirmPutaway}
        onLocationSelect={handleLocationSelect}
        onSelectItem={setCurrentItemIndex}
        onSkipItem={handleSkipItem}
        allocationQuantity={allocationQuantity}
        remainingQuantity={remainingQuantity}
        onAllocationQuantityChange={setAllocationQuantity}
        skippedReasonsByItem={skippedReasonsByItem}
      />
    );
  }

  // If order selected but loading items
  if (selectedOrder && isLoading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-64 space-y-4">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="text-sm text-base-content/60">Loading order items...</p>
      </div>
    );
  }

  // Should not reach here - all cases handled above
  return null;
}
