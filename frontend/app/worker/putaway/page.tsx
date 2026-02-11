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
        
        // Reset progress tracking
        const progress = new Map<string, boolean>();
        items.forEach(item => progress.set(item.itemId, false));
        setPutawayProgress(progress);
        setCurrentItemIndex(0);
      } catch (err) {
        logger.error("[Putaway] Failed to load putaway items:", err);
        showToast.error("Failed to load order items. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPutawayItems();
  }, [selectedOrder]);

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
      const tasks = await tasksApi.getAll("putaway", "pending", undefined, worker?.warehouseId, true);
      const itemTask = tasks.find((t: any) => 
        t.referenceType === "order_item" &&
        t.referenceId === currentItem.itemId
      );

      // Backward compatibility for legacy tasks created at order level.
      const fallbackTask = tasks.find((t: any) =>
        t.referenceType === "order" &&
        t.referenceId === selectedOrder.id
      );

      const taskToComplete = itemTask ?? fallbackTask;

      if (!taskToComplete) {
        showToast.error("Putaway task not found for this item. Tasks are created automatically after receiving.");
        return;
      }

      await operationsApi.completePutaway(taskToComplete.id, {
        locationCode: scannedLocation.trim().toUpperCase(),
        lpn: "", // LPN is ignored in backend but kept for backward compatibility
        quantity: currentItem.receivedQuantity, // Pass received quantity explicitly
        materialId: currentItem.materialId, // Pass material ID explicitly
        workerId: worker?.id, // Required for labor productivity attribution
      });
      
      // Mark item as put away
      const newProgress = new Map(putawayProgress);
      newProgress.set(currentItem.itemId, true);
      setPutawayProgress(newProgress);
      
      showToast.success(`Item put away to ${scannedLocation}! Inventory location updated.`);
      
      // Reset form
      setScannedLocation("");
      setLocationError("");
      
      // Move to next item or show completion
      if (currentItemIndex < putawayItems.length - 1) {
        setCurrentItemIndex(currentItemIndex + 1);
      } else {
        // All items done - check if order is complete
        const allDone = Array.from(newProgress.values()).every(done => done);
        if (allDone) {
          showToast.success(`All items in ${selectedOrder.orderNumber} have been put away! Inventory and warehouse layout will update automatically.`);
          // Reload orders to refresh list
          setTimeout(() => {
            setSelectedOrder(null);
            setPutawayItems([]);
          }, 2000);
        }
      }
    } catch (error) {
      logger.error("Error confirming putaway:", error);
      showToast.error("Failed to complete putaway. Please try again.");
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
