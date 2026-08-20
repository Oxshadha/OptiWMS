"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { operationsApi } from "@/lib/api/operations";
import { tasksApi } from "@/lib/api/tasks-api";
import { ordersApi } from "@/lib/api/orders";
import { orderItemsApi, PutawayItem } from "@/lib/api/orderItems";
import { addToSyncQueue } from "@/lib/indexeddb";
import { useWorker } from "@/contexts/WorkerContext";
import { validateLocationCode } from "@/lib/utils/validation";
import { validateLocationExists } from "@/lib/utils/location-helpers";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { PutawayOrderSelection } from "./components/PutawayOrderSelection";
import { PutawayOrderWorkflow } from "./components/PutawayOrderWorkflow";

/**
 * Identity of a row in the putaway list. A row is one pallet move, so the task is its identity.
 * The only rows without a task are lines the planner has not reached yet, which fall back to the
 * line id so they still key uniquely.
 */
const rowKey = (item: PutawayItem): string => item.taskId ?? `line:${item.itemId}`;

/** Units this pallet still owes. The backend rejects anything above this. */
const remainingForRow = (item: PutawayItem): number =>
  Math.max(item.palletQuantity - item.completedQuantity, 0);

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Makes a row safe to render whatever the server sent.
 *
 * A worker must never be shown "NaN" in a quantity box they are about to submit. That is exactly
 * what happened when the app was newer than the API it was talking to: the pallet-level fields were
 * absent, the arithmetic produced NaN, and the screen offered it as a real value. Missing numbers
 * now fall back to the line quantity and missing counts to a single pallet, so a version skew
 * degrades to something sensible and obviously incomplete rather than something broken.
 */
const normalizeRow = (raw: PutawayItem): PutawayItem => {
  const lineQuantity = finiteOr(raw.lineReceivedQuantity, 0);
  const palletQuantity = finiteOr(raw.palletQuantity, lineQuantity);
  return {
    ...raw,
    handlingUnitSeq: finiteOr(raw.handlingUnitSeq, 1),
    totalHandlingUnits: Math.max(finiteOr(raw.totalHandlingUnits, 1), 1),
    palletQuantity,
    completedQuantity: finiteOr(raw.completedQuantity, 0),
    lineReceivedQuantity: lineQuantity || palletQuantity,
  };
};

export type AlternativeLocation = { locationCode: string; allocatableQuantity: number; reason: string };

/**
 * Bins the server offered when it refused the chosen one. Carried on the error body by the API
 * client; absent for every other kind of failure.
 */
const extractAlternatives = (error: unknown): AlternativeLocation[] => {
  const body = (error as { body?: { alternatives?: AlternativeLocation[] } } | null)?.body;
  return Array.isArray(body?.alternatives) ? body.alternatives : [];
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
  const { isOnline } = useOffline();
  
  // Order selection state
  const [orders, setOrders] = useState<Array<{ id: string; orderNumber: string; status: string }>>([]);
  // Status is carried so "Start Putaway" can move a quality_approved order to putaway_in_progress.
  // It was read but never set, so that transition silently never happened.
  const [selectedOrder, setSelectedOrder] = useState<
    { id: string; orderNumber: string; status?: string } | null
  >(null);
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
  // Keyed by rowKey (the task), not by order line: a line is several pallets, each its own move.
  const [putawayProgress, setPutawayProgress] = useState<Map<string, boolean>>(new Map());
  const [allocatedByRow, setAllocatedByRow] = useState<Map<string, number>>(new Map());
  const [skippedReasonsByRow, setSkippedReasonsByRow] = useState<Map<string, string>>(new Map());
  const [allocationQuantity, setAllocationQuantity] = useState<number>(0);
  const [fallbackOrderTaskId, setFallbackOrderTaskId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isOrderStarted, setIsOrderStarted] = useState(false);
  const [isStartingOrder, setIsStartingOrder] = useState(false);
  // Bins the server offered after refusing the one the worker tried.
  const [suggestedAlternatives, setSuggestedAlternatives] = useState<AlternativeLocation[]>([]);

  const getFirstPendingItemIndex = (
    items: PutawayItem[],
    progress: Map<string, boolean>,
    skipped: Map<string, string>
  ) => {
    const nonSkippedPending = items.findIndex(
      (item) => !(progress.get(rowKey(item)) || false) && !skipped.has(rowKey(item))
    );
    if (nonSkippedPending >= 0) return nonSkippedPending;
    const pendingIndex = items.findIndex((item) => !(progress.get(rowKey(item)) || false));
    return pendingIndex >= 0 ? pendingIndex : 0;
  };

  // Load orders needing putaway
  useEffect(() => {
    if (workerContextLoading || !worker?.warehouseId) {
      setIsLoadingOrders(false); // Ensure loading state is cleared
      return;
    }

    let isFirstLoad = true;
    const loadOrders = async () => {
      try {
        if (isFirstLoad) setIsLoadingOrders(true);
        const ordersList = await ordersApi.getOrdersNeedingPutaway(worker.warehouseId!);
        setOrders(ordersList.map(o => ({ id: o.id, orderNumber: o.orderNumber, status: o.status })));
        logger.debug("[Putaway] Orders needing putaway:", ordersList.length);
        isFirstLoad = false;
      } catch (err) {
        logger.error("[Putaway] Failed to load orders:", err);
        showToast.error("Failed to load orders. Please try again.");
      } finally {
        setIsLoadingOrders(false);
      }
    };

    void loadOrders();
    // Refresh every 5 seconds
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [workerContextLoading, worker?.warehouseId]);

  // Load putaway items when order is selected
  useEffect(() => {
    if (!selectedOrder) {
      setPutawayItems([]);
      setIsOrderStarted(false);
      return;
    }

    const loadPutawayItems = async () => {
      try {
        setIsLoading(true);
        setFallbackOrderTaskId(null);
        const items = (await orderItemsApi.getPutawayItems(selectedOrder.id, worker?.id)).map(normalizeRow);
        setPutawayItems(items);
        logger.debug("[Putaway] Pallet moves for order:", selectedOrder.orderNumber, items.length);

        // Each row already carries its own task state, so progress is read straight off the row
        // rather than reconstructed by scanning every task in the warehouse and guessing which
        // one belonged to which line.
        const progress = new Map<string, boolean>();
        const allocated = new Map<string, number>();
        const skipped = new Map<string, string>();

        items.forEach((item) => {
          const key = rowKey(item);
          const done = item.status === "completed" || remainingForRow(item) <= 0;
          progress.set(key, done);
          allocated.set(key, item.completedQuantity);
          if (item.skipReason) skipped.set(key, item.skipReason);
        });

        try {
          // Only still needed for legacy order-level tasks and for resuming a started order.
          const tasks = await tasksApi.getAll("putaway", undefined, undefined, worker?.warehouseId, false);
          setFallbackOrderTaskId(
            tasks.find(
              (task) => task.referenceType === "order" && task.referenceId === selectedOrder.id
            )?.id || null
          );
          const resumable = tasks.some(
            (t) =>
              t.status === "in_progress" &&
              t.assignedTo === worker?.id &&
              items.some((item) => item.taskId === t.id)
          );
          if (resumable) setIsOrderStarted(true);
        } catch (taskError) {
          logger.warn("[Putaway] Could not check for resumable tasks.", taskError);
        }

        setPutawayProgress(progress);
        setAllocatedByRow(allocated);
        setSkippedReasonsByRow(skipped);
        const firstPendingIndex = getFirstPendingItemIndex(items, progress, skipped);
        setCurrentItemIndex(firstPendingIndex);
        if (items.length > 0) {
          setAllocationQuantity(remainingForRow(items[firstPendingIndex]));
        }
      } catch (err) {
        logger.error("[Putaway] Failed to load putaway items:", err);
        showToast.error("Failed to load order items. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPutawayItems();
  }, [selectedOrder, refreshTrigger]);

  useEffect(() => {
    const currentItem = putawayItems[currentItemIndex];
    if (!currentItem) {
      return;
    }
    // Default to what THIS pallet owes. Defaulting to the whole line's remainder was rejected by
    // the backend every time, because a task will not accept more than its own pallet quantity.
    setAllocationQuantity(remainingForRow(currentItem));

    // Direct the move rather than interview the driver: the planned bin is already capacity
    // checked, so put it in the field and let them confirm it or scan a different one. Making
    // them enter by hand what the system already decided is pure cognitive load on a forklift.
    if (currentItem.plannedLocation) {
      setScannedLocation(currentItem.plannedLocation);
      setLocationError("");
    }
  }, [currentItemIndex, putawayItems]);

  useEffect(() => {
    const currentItem = putawayItems[currentItemIndex];
    if (!currentItem) {
      return;
    }

    // If the current pallet is already away (e.g. resumed order), jump to the first pending one.
    if (putawayProgress.get(rowKey(currentItem))) {
      const nextIndex = getFirstPendingItemIndex(putawayItems, putawayProgress, skippedReasonsByRow);
      if (nextIndex !== currentItemIndex) {
        setCurrentItemIndex(nextIndex);
      }
    }
  }, [currentItemIndex, putawayItems, putawayProgress, skippedReasonsByRow]);

  const handleStartOrder = async () => {
    if (!isOnline || !selectedOrder || putawayItems.length === 0) return;
    setIsStartingOrder(true);
    try {
      const tasks = await tasksApi.getAll("putaway", undefined, undefined, worker?.warehouseId, false);
      const orderTasks = tasks.filter(
        (t: any) =>
          (
            (t.referenceType === "order_item" && putawayItems.some((item) => item.itemId === t.referenceId)) ||
            (t.referenceType === "order" && t.referenceId === selectedOrder.id)
          ) &&
          (t.status === "pending" || t.status === "assigned") &&
          (!t.assignedTo || t.assignedTo === worker?.id)
      );

      if (orderTasks.length > 0) {
        await Promise.all(
          orderTasks.map((task) => tasksApi.updateStatus(task.id, "in_progress", worker?.id))
        );
      }

      if (selectedOrder.status === "quality_approved") {
        await ordersApi.updateStatus(selectedOrder.id, "putaway_in_progress");
      }

      setIsOrderStarted(true);
      showToast.success(`Started putaway for ${selectedOrder.orderNumber}`);
    } catch (error) {
      logger.error("[Putaway] Could not start order:", error);
      showToast.error("Failed to start order. Please try again.");
    } finally {
      setIsStartingOrder(false);
    }
  };

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
      setSelectedOrder({ id: matchingOrder.id, orderNumber: matchingOrder.orderNumber, status: matchingOrder.status });
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
        setSelectedOrder({ id: order.id, orderNumber: order.orderNumber, status: order.status });
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
      // The row IS the task, so there is nothing to search for and nothing to guess. Picking the
      // first matching pending task used to complete an arbitrary pallet of the line.
      const taskToCompleteId = currentItem.taskId ?? fallbackOrderTaskId;

      if (!taskToCompleteId) {
        showToast.error("Putaway task not found for this pallet. Tasks are created automatically after receiving.");
        return;
      }

      const alreadyAllocated = currentItem.completedQuantity;
      const remaining = remainingForRow(currentItem);
      if (allocationQuantity <= 0 || allocationQuantity > remaining) {
        showToast.error(`Putaway quantity for this pallet must be between 1 and ${remaining}`);
        return;
      }

      const putawayPayload = {
        locationCode: scannedLocation.trim().toUpperCase(),
        lpn: "", // LPN is ignored in backend but kept for backward compatibility
        quantity: allocationQuantity,
        materialId: currentItem.materialId, // Pass material ID explicitly
        workerId: worker?.id, // Required for labor productivity attribution
      };

      if (isOnline) {
        await operationsApi.completePutaway(taskToCompleteId, putawayPayload);
      } else {
        await addToSyncQueue({
          type: "operation",
          action: "create",
          data: {
            type: "putaway_complete",
            taskId: taskToCompleteId,
            payload: putawayPayload,
          },
        });
      }

      const key = rowKey(currentItem);
      const nextAllocated = alreadyAllocated + allocationQuantity;
      const isComplete = nextAllocated >= currentItem.palletQuantity;
      const updatedAllocated = new Map(allocatedByRow);
      updatedAllocated.set(key, nextAllocated);
      setAllocatedByRow(updatedAllocated);
      if (isComplete) {
        setSkippedReasonsByRow((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }

      const newProgress = new Map(putawayProgress);
      newProgress.set(key, isComplete);
      setPutawayProgress(newProgress);

      const palletLabel = `Pallet ${currentItem.handlingUnitSeq} of ${currentItem.totalHandlingUnits}`;
      showToast.success(
        isComplete
          ? isOnline
            ? `${palletLabel} put away to ${putawayPayload.locationCode}.`
            : `${palletLabel} queued for ${putawayPayload.locationCode}.`
          : isOnline
          ? `Partial putaway saved (${nextAllocated}/${currentItem.palletQuantity} of ${palletLabel.toLowerCase()}).`
          : `Partial putaway queued (${nextAllocated}/${currentItem.palletQuantity} of ${palletLabel.toLowerCase()}).`
      );
      
      if (isOnline) {
        setRefreshTrigger(t => t + 1);
      }
      
      // Reset form
      setScannedLocation("");
      setLocationError("");
      setSuggestedAlternatives([]);
      
      // Move to the next pallet once this one is fully away.
      if (isComplete) {
        const allDone = Array.from(newProgress.values()).every((done) => done);
        if (allDone) {
          showToast.success(`Every pallet in ${selectedOrder.orderNumber} is away. Inventory and warehouse layout will update automatically.`);
          setTimeout(() => {
            setSelectedOrder(null);
            setPutawayItems([]);
          }, 2000);
        } else {
          const nextIndex = getFirstPendingItemIndex(putawayItems, newProgress, skippedReasonsByRow);
          setCurrentItemIndex(nextIndex);
          const nextItem = putawayItems[nextIndex];
          const nextAllocatedQty = updatedAllocated.get(rowKey(nextItem)) ?? nextItem.completedQuantity;
          setAllocationQuantity(Math.max(nextItem.palletQuantity - nextAllocatedQty, 1));
        }
      } else {
        setAllocationQuantity(Math.max(currentItem.palletQuantity - nextAllocated, 1));
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      logger.error("Error confirming putaway:", error);

      // A capacity refusal now comes back with bins that would work. Offering the nearest one
      // turns a dead end into the next move; without it the worker was left at a full rack.
      const alternatives = extractAlternatives(error);
      setSuggestedAlternatives(alternatives);
      if (alternatives.length > 0) {
        showToast.error(message);
      } else {
        showToast.error(`Failed to complete putaway: ${message}`);
      }
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
      const itemTaskId = currentItem.taskId;

      if (!itemTaskId) {
        showToast.error("No putaway task for this pallet yet. Cannot skip it safely.");
        return;
      }

      const skipPayload = {
        reason: reason.trim(),
        workerId: worker?.id,
      };

      if (isOnline) {
        await operationsApi.skipPutaway(itemTaskId, skipPayload);
      } else {
        await addToSyncQueue({
          type: "operation",
          action: "create",
          data: {
            type: "putaway_skip",
            taskId: itemTaskId,
            payload: skipPayload,
          },
        });
      }

      const updatedSkipped = new Map(skippedReasonsByRow);
      updatedSkipped.set(rowKey(currentItem), reason.trim());
      setSkippedReasonsByRow(updatedSkipped);
      showToast.success(
        isOnline
          ? "Pallet skipped with reason. Continue with the next one."
          : "Skip queued. Continue with the next pallet."
      );

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

  // If order selected but not explicitly started yet
  if (selectedOrder && putawayItems.length > 0 && !isOrderStarted) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-base-100 rounded-xl p-6 border border-base-300 text-center flex flex-col items-center justify-center space-y-4 h-64">
          <div className="material-symbols-outlined text-5xl text-primary">play_circle</div>
          <h2 className="text-xl font-bold">Start Putaway Order {selectedOrder.orderNumber}?</h2>
          <p className="text-sm text-base-content/60">
            This will lock all pending putaway tasks for this order to you, so no other worker can claim them.
          </p>
          <div className="flex gap-4 w-full justify-center mt-4">
            <button
              className="btn btn-outline"
              onClick={() => {
                setSelectedOrder(null);
                setPutawayItems([]);
              }}
              disabled={isStartingOrder}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStartOrder}
              disabled={isStartingOrder}
            >
              {isStartingOrder ? <span className="loading loading-spinner"></span> : null}
              Start Putaway
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If order selected, started, and has items
  if (selectedOrder && putawayItems.length > 0 && isOrderStarted) {
    const currentItem = putawayItems[currentItemIndex];
    // The cap the backend enforces is this pallet's, not the whole line's.
    const remainingQuantity = currentItem ? remainingForRow(currentItem) : 0;
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
        skippedReasonsByRow={skippedReasonsByRow}
        suggestedAlternatives={suggestedAlternatives}
        onUseAlternative={(code) => {
          setSuggestedAlternatives([]);
          void handleLocationChange(code);
        }}
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
