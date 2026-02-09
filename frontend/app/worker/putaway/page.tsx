"use client";

import { useState, useRef, useEffect } from "react";
import { QRScanner } from "@/components/QRScanner";
import { Modal } from "@/components/Modal";
import { operationsApi } from "@/lib/api/operations";
import { tasksApi } from "@/lib/api/tasks-api";
import { locationsApi } from "@/lib/api/locations";
import { ordersApi } from "@/lib/api/orders";
import { orderItemsApi, PutawayItem } from "@/lib/api/orderItems";
import { LocationPicker } from "@/components/LocationPicker";
import { useWorker } from "@/contexts/WorkerContext";
import { validateLocationCode, formatLocationCodeForDisplay } from "@/lib/utils/validation";
import { validateLocationExists } from "@/lib/utils/location-helpers";
import { showToast } from "@/lib/utils/toast";
import { formatMaterialDisplay, isUUID } from "@/lib/utils/material-display";

// Component to display item details
function ItemDetailsDisplay({ materialId, quantity }: { materialId: string; quantity: number }) {
  const [itemName, setItemName] = useState<string>("Loading...");
  const [itemSku, setItemSku] = useState<string>("N/A");

  useEffect(() => {
    const loadMaterial = async (retryCount = 0) => {
      try {
        const { materialsApi } = await import("@/lib/api/materials");
        const material = await materialsApi.getById(materialId);
        const display = formatMaterialDisplay(
          material.materialCode,
          material.description,
          material.id
        );
        setItemName(display.name || material.description || material.materialCode || "Item");
        setItemSku(display.sku || material.materialCode || "N/A");
      } catch (err) {
        console.error("Failed to load material:", err);
        
        // Retry up to 2 times with exponential backoff
        if (retryCount < 2) {
          setTimeout(() => {
            loadMaterial(retryCount + 1);
          }, 1000 * Math.pow(2, retryCount)); // 1s, 2s delays
          return;
        }
        
        // After retries, show error with material ID for debugging
        setItemName(`Item (Material ID: ${materialId.substring(0, 8)}...)`);
        setItemSku("N/A");
      }
    };
    loadMaterial();
  }, [materialId]);

  return (
    <div className="p-3 bg-base-200 rounded-lg mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-base-content/60">inventory</span>
        <span className="text-sm text-base-content/60">Product</span>
      </div>
      <div className="font-semibold text-base-content">{itemName}</div>
      {itemSku && itemSku !== "N/A" && !isUUID(itemSku) && (
        <div className="text-xs text-base-content/60 mt-1">
          <span className="font-mono font-semibold text-primary">SKU: {itemSku}</span>
        </div>
      )}
    </div>
  );
}

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
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false); // Changed to false - only set to true when loading items
  const [locationError, setLocationError] = useState<string>("");
  const [validatingLocation, setValidatingLocation] = useState(false);
  const [putawayProgress, setPutawayProgress] = useState<Map<string, boolean>>(new Map()); // Track which items are put away

  // OLD TASK-BASED CODE - REMOVED - Now using order-based approach
  // Load putaway tasks from API - filtered by warehouse and only available (unassigned) tasks
  // REMOVED - Now loading orders instead
  /*
  useEffect(() => {
    console.log("[Putaway] useEffect triggered:", {
      workerContextLoading,
      hasWorker: !!worker,
      workerWarehouseId: worker?.warehouseId,
      workerId: worker?.id
    });
    
    // Wait for worker context to finish loading
    if (workerContextLoading) {
      console.log("[Putaway] Worker context still loading, waiting...");
      return;
    }

    const loadPutawayTasks = async () => {
      if (!worker) {
        console.warn("[Putaway] No worker data available");
        setIsLoading(false);
        setTask(null);
        return;
      }

      // Get warehouseId - check multiple sources like picking page does
      let warehouseId = worker.warehouseId;
      
      // If warehouseId is missing, try to get it from warehouse name lookup
      // This handles cases where context hasn't fully loaded warehouseId yet
      if (!warehouseId && worker.warehouse && worker.warehouse !== "Unknown" && worker.warehouse !== "Unassigned") {
        console.warn("[Putaway] warehouseId missing but warehouse name exists:", worker.warehouse);
        console.warn("[Putaway] Attempting to fetch warehouseId from warehouse name...");
        try {
          const { warehousesApi } = await import('@/lib/api/warehouses');
          const warehouses = await warehousesApi.getAll();
          const matchingWarehouse = warehouses.find(w => w.name === worker.warehouse);
          if (matchingWarehouse) {
            warehouseId = matchingWarehouse.id;
            console.log("[Putaway] Found warehouseId from name:", warehouseId);
          }
        } catch (err) {
          console.error("[Putaway] Failed to fetch warehouses:", err);
        }
      }

      if (!warehouseId) {
        console.error("[Putaway] CRITICAL: No warehouseId available after all attempts");
        console.error("[Putaway] Worker data:", { 
          id: worker.id, 
          name: worker.name, 
          warehouse: worker.warehouse,
          warehouseId: worker.warehouseId 
        });
        setIsLoading(false);
        setTask(null);
        return;
      }

      try {
        setIsLoading(true);
        console.log("[Putaway] Loading tasks for warehouse:", warehouseId);
        
        // Get only available (unassigned) tasks for worker's warehouse
        // Status "pending" means unassigned tasks (first come first serve)
        const tasks = await tasksApi.getAll("putaway", "pending", undefined, warehouseId, true);
        console.log("[Putaway] Available tasks:", tasks.length);
        
        // Also include tasks assigned to this worker (in_progress, assigned)
        const myTasks = await tasksApi.getAll("putaway", undefined, worker.id, warehouseId, false);
        const myActiveTasks = myTasks.filter(t => 
          t.assignedTo === worker.id && 
          (t.status === "assigned" || t.status === "in_progress")
        );
        console.log("[Putaway] My active tasks:", myActiveTasks.length);
        
        // Combine: available tasks + my active tasks
        const allTasks = [...tasks, ...myActiveTasks];
        
        // Remove duplicates
        const uniqueTasks = Array.from(
          new Map(allTasks.map(t => [t.id, t])).values()
        );
        
        console.log("[Putaway] Total unique tasks:", uniqueTasks.length);
        
        if (uniqueTasks.length > 0) {
          const firstTask = uniqueTasks[0];
          
          // Fetch full task details to get item information
          try {
            const taskDetails = await tasksApi.getById(firstTask.id);
            console.log("[Putaway] Task details:", {
              taskId: firstTask.id,
              referenceType: taskDetails.referenceType,
              referenceId: taskDetails.referenceId,
              notes: taskDetails.notes
            });
            
            // Try to get item details from reference (order/GRN)
            let itemName = "Item";
            let itemSku = "N/A";
            let itemId: string | undefined;
            let quantity = 0;
            let materialId: string | undefined;
            let orderNumber: string | undefined;
            
            // If task has reference, try to fetch order items and order details
            if (taskDetails.referenceType === "order" && taskDetails.referenceId) {
              console.log("[Putaway] Task is linked to order ID:", taskDetails.referenceId);
              try {
                const { orderItemsApi } = await import("@/lib/api/orderItems");
                const { ordersApi } = await import("@/lib/api/orders");
                
                // Fetch order to get order number and full order details
                try {
                  const order = await ordersApi.getById(taskDetails.referenceId);
                  orderNumber = order.orderNumber || "";
                  console.log("[Putaway] ✅ Linked to order:", {
                    orderNumber: orderNumber,
                    orderId: taskDetails.referenceId,
                    orderType: order.orderType,
                    status: order.status,
                    supplierId: order.supplierId,
                    warehouseId: order.warehouseId
                  });
                  
                  // Verify this is the correct order by checking order number format
                  if (orderNumber && !orderNumber.startsWith("PO-") && !orderNumber.startsWith("IN-")) {
                    console.warn("[Putaway] ⚠️ Order number format unexpected:", orderNumber);
                  }
                } catch (err) {
                  console.error("[Putaway] ❌ Could not fetch order details:", err);
                  console.error("[Putaway] Order ID that failed:", taskDetails.referenceId);
                  orderNumber = undefined;
                }
                
                // Fetch order items - get ALL items, not just first
                const orderItems = await orderItemsApi.getByOrderId(taskDetails.referenceId);
                console.log("[Putaway] Order items found:", orderItems.length);
                console.log("[Putaway] Order items details:", orderItems.map(item => ({
                  materialId: item.materialId,
                  quantity: item.quantity,
                  pickedQuantity: item.pickedQuantity,
                  status: item.status
                })));
                
                if (orderItems.length > 0) {
                  const firstItem = orderItems[0];
                  itemId = firstItem.materialId;
                  materialId = firstItem.materialId;
                  
                  // Use pickedQuantity (received quantity) for inbound orders, not ordered quantity
                  // pickedQuantity stores the actual received quantity for inbound orders
                  quantity = firstItem.pickedQuantity || firstItem.quantity || 0;
                  console.log("[Putaway] Quantity from order item - pickedQuantity:", firstItem.pickedQuantity, "quantity:", firstItem.quantity, "using:", quantity);
                  
                  // Try to get material name and SKU
                  try {
                    const { materialsApi } = await import("@/lib/api/materials");
                    const material = await materialsApi.getById(firstItem.materialId);
                    console.log("[Putaway] Material fetched:", material);
                    
                    const display = formatMaterialDisplay(
                      material.materialCode,
                      material.description,
                      material.id
                    );
                    itemName = display.name || material.description || material.materialCode || "Item";
                    itemSku = display.sku || material.materialCode || "N/A";
                    console.log("[Putaway] ✅ Material details loaded:", { 
                      name: itemName, 
                      sku: itemSku,
                      materialCode: material.materialCode,
                      description: material.description
                    });
                  } catch (err) {
                    console.error("[Putaway] ❌ Could not fetch material details:", err);
                    // Try to use material code from task notes as fallback
                    if (taskDetails.notes) {
                      const notesMatch = taskDetails.notes.match(/Put away \d+ units of ([^(]+)/);
                      if (notesMatch && notesMatch[1]) {
                        itemName = notesMatch[1].trim();
                        itemSku = notesMatch[1].trim();
                        console.log("[Putaway] Using fallback from notes:", itemName);
                      } else {
                        itemName = "Item (Material details unavailable)";
                        itemSku = "N/A";
                      }
                    } else {
                      itemName = "Item (Material details unavailable)";
                      itemSku = "N/A";
                    }
                  }
                } else {
                  console.warn("[Putaway] No order items found for order:", taskDetails.referenceId);
                }
              } catch (err) {
                console.error("[Putaway] Could not fetch order items:", err);
                // Fallback: try to extract info from task notes
                if (taskDetails.notes) {
                  const notesMatch = taskDetails.notes.match(/Put away (\d+) units of ([^(]+)/);
                  if (notesMatch) {
                    quantity = parseInt(notesMatch[1]) || 0;
                    itemName = notesMatch[2].trim() || "Item";
                    itemSku = notesMatch[2].trim() || "N/A";
                  }
                }
              }
            } else {
              // No order reference - try to get info from task notes
              if (taskDetails.notes) {
                const notesMatch = taskDetails.notes.match(/Put away (\d+) units of ([^(]+)/);
                if (notesMatch) {
                  quantity = parseInt(notesMatch[1]) || 0;
                  itemName = notesMatch[2].trim() || "Item";
                  itemSku = notesMatch[2].trim() || "N/A";
                }
              }
            }
            
            // Format location code for display
            const locationCode = taskDetails.locationCode || "";
            const toLocationDisplay = locationCode 
              ? formatLocationCodeForDisplay(locationCode)
              : "Not specified";
            
            setTask({
              id: firstTask.id,
              lpn: firstTask.referenceId || taskDetails.referenceId || "",
              fromLocation: "Stage Area", // Default staging area
              toLocation: toLocationDisplay,
              toLocationCode: locationCode,
              item: itemName,
              itemSku: itemSku,
              itemId,
              qty: quantity || 0,
              materialId,
              orderNumber: orderNumber, // Add order number
            });
            
            console.log("[Putaway] ✅ Task loaded:", {
              taskId: firstTask.id,
              orderNumber: orderNumber,
              itemName: itemName,
              itemSku: itemSku,
              quantity: quantity,
              location: locationCode || "Not specified"
            });
          } catch (err) {
            console.error("Failed to load task details:", err);
            // Use basic task info
            setTask({
              id: firstTask.id,
              lpn: firstTask.referenceId || "",
              fromLocation: "Stage Area",
              toLocation: firstTask.locationCode ? formatLocationCodeForDisplay(firstTask.locationCode) : "Not specified",
              toLocationCode: firstTask.locationCode || "",
              item: firstTask.notes || "Item",
              qty: 0,
              orderNumber: undefined,
            });
          }
        } else {
          console.log("[Putaway] No tasks available");
          setTask(null);
        }
      } catch (error: any) {
        console.error("[Putaway] Failed to load putaway tasks:", error);
        const errorMessage = error?.message || "Failed to load putaway tasks";
        showToast.error(errorMessage);
        setTask(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Load tasks if worker context is ready
    loadPutawayTasks();
    
    // Poll for new tasks every 3 seconds (to catch newly created tasks)
    const pollInterval = setInterval(() => {
      if (worker?.warehouseId) {
        loadPutawayTasks();
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [workerContextLoading, worker, worker?.warehouseId, worker?.id]);
  */

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
        console.log("[Putaway] Orders needing putaway:", ordersList.length);
      } catch (err) {
        console.error("[Putaway] Failed to load orders:", err);
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
        console.log("[Putaway] Putaway items for order:", selectedOrder.orderNumber, items.length);
        
        // Reset progress tracking
        const progress = new Map<string, boolean>();
        items.forEach(item => progress.set(item.itemId, false));
        setPutawayProgress(progress);
        setCurrentItemIndex(0);
      } catch (err) {
        console.error("[Putaway] Failed to load putaway items:", err);
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
        t.referenceId === selectedOrder.id && 
        t.referenceType === "order"
      );

      if (!itemTask) {
        showToast.error("Putaway task not found for this item. Tasks are created automatically after receiving.");
        return;
      }

      await operationsApi.completePutaway(itemTask.id, {
        locationCode: scannedLocation.trim().toUpperCase(),
        lpn: "", // LPN is ignored in backend but kept for backward compatibility
        quantity: currentItem.receivedQuantity, // Pass received quantity explicitly
        materialId: currentItem.materialId, // Pass material ID explicitly
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
      console.error("Error confirming putaway:", error);
      showToast.error("Failed to complete putaway. Please try again.");
    }
  };

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveNote = () => {
    console.log("Note saved:", note);
    setShowNoteModal(false);
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
      <div className="p-4 space-y-4">
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <h2 className="text-xl font-bold mb-4">Select Purchase Order</h2>
          
          {/* PO Scanner/Input */}
          <div className="mb-4">
            <label className="label">
              <span className="label-text font-medium">Scan or Enter PO Number</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder="PO-1768116672193"
                value={scannedPONumber}
                onChange={(e) => handlePOChange(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={() => setShowPOScanner(true)}
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Scan
              </button>
            </div>
          </div>

          {/* Orders List */}
          {isLoadingOrders ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner"></span>
            </div>
          ) : orders.length === 0 ? (
            <div className="alert alert-info">
              <span className="material-symbols-outlined">info</span>
              <div>
                <p className="font-semibold">No orders need putaway</p>
                <p className="text-sm mt-1">
                  Orders will appear here after items are received.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-base-content/60 mb-2">
                {orders.length} order{orders.length !== 1 ? 's' : ''} need putaway:
              </p>
              {orders.map((order) => (
                <button
                  key={order.id}
                  className="btn btn-outline w-full justify-start"
                  onClick={() => setSelectedOrder({ id: order.id, orderNumber: order.orderNumber })}
                >
                  <span className="material-symbols-outlined">receipt</span>
                  <span className="font-mono font-bold">{order.orderNumber}</span>
                  <span className="badge badge-sm ml-auto">{order.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* PO Scanner Modal */}
        {showPOScanner && (
          <Modal isOpen={showPOScanner} onClose={() => setShowPOScanner(false)} title="Scan PO Number">
            <QRScanner 
              isOpen={showPOScanner}
              onClose={() => setShowPOScanner(false)}
              onScan={handlePOScan} 
            />
          </Modal>
        )}
      </div>
    );
  }

  // If order selected, show items for putaway
  if (selectedOrder && putawayItems.length > 0) {
    const currentItem = putawayItems[currentItemIndex];
    const completedCount = Array.from(putawayProgress.values()).filter(done => done).length;
    const isItemDone = putawayProgress.get(currentItem.itemId) || false;

    return (
      <div className="p-4 space-y-4">
        {/* Order Header */}
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <div className="flex items-center justify-between mb-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSelectedOrder(null);
                setPutawayItems([]);
                setCurrentItemIndex(0);
              }}
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Orders
            </button>
            <div className="badge badge-primary badge-lg">
              {selectedOrder.orderNumber}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-base-content/60 mb-1">Putaway Progress</div>
            <div className="flex items-center gap-2">
              <progress 
                className="progress progress-primary flex-1" 
                value={completedCount} 
                max={putawayItems.length}
              />
              <span className="text-sm font-semibold">
                {completedCount}/{putawayItems.length}
              </span>
            </div>
          </div>
        </div>

        {/* Current Item */}
        {currentItem && !isItemDone && (
          <div className="bg-base-100 rounded-xl p-4 border border-base-300">
            <div className="text-sm text-base-content/60 mb-2">
              Item {currentItemIndex + 1} of {putawayItems.length}
            </div>
            <div className="font-bold text-lg mb-4">
              Put Away Item
            </div>

            {/* Item Details */}
            <ItemDetailsDisplay materialId={currentItem.materialId} quantity={currentItem.receivedQuantity} />

            <div className="space-y-3 mb-4">
              <div className="p-3 bg-base-200 rounded-lg">
                <div className="text-sm text-base-content/60">Quantity to Put Away</div>
                <div className="font-semibold">{currentItem.receivedQuantity} units</div>
              </div>
            </div>

            {/* Select Location */}
            <div className="mb-4">
              <label className="label">
                <span className="label-text font-medium">Select Target Location</span>
                {currentItem.suggestedLocation && (
                  <span className="label-text-alt text-primary">
                    Suggested: {currentItem.suggestedLocation}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  className={`input input-bordered flex-1 ${locationError ? "input-error" : ""}`}
                  placeholder={currentItem.suggestedLocation || "Scan or enter location (e.g., C-02-05-3-B or ST-WH-001-01-001-1-A)"}
                  value={scannedLocation}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  disabled={validatingLocation}
                />
                <button
                  onClick={() => setShowLocationPicker(true)}
                  className="btn btn-primary btn-square"
                  title="Browse available locations"
                >
                  <span className="material-symbols-outlined">location_on</span>
                </button>
              </div>
              {validatingLocation && (
                <div className="mt-1 text-xs text-base-content/60 flex items-center gap-1">
                  <span className="loading loading-spinner loading-xs"></span>
                  Validating location...
                </div>
              )}
              {locationError && (
                <div className="mt-1 text-xs text-error">{locationError}</div>
              )}
              {!locationError && !validatingLocation && scannedLocation && (
                <div className="mt-1 text-xs text-success">✓ Location validated and active</div>
              )}
              {currentItem.suggestedLocation && (
                <button
                  className="btn btn-ghost btn-sm mt-2"
                  onClick={async () => {
                    const validation = await validateLocationExists(currentItem.suggestedLocation!, worker?.warehouseId);
                    if (validation.valid) {
                      setScannedLocation(currentItem.suggestedLocation!);
                    } else {
                      showToast.error(validation.error || "Suggested location is not valid");
                    }
                  }}
                >
                  Use Suggested: {currentItem.suggestedLocation}
                </button>
              )}
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirmPutaway}
              className="btn btn-primary w-full btn-lg"
              disabled={!scannedLocation || !!locationError}
            >
              <span className="material-symbols-outlined">check</span>
              Confirm Putaway
            </button>
          </div>
        )}

        {/* Completed Items List */}
        {putawayItems.length > 0 && (
          <div className="bg-base-100 rounded-xl p-4 border border-base-300">
            <div className="text-sm font-medium mb-2">Items in Order</div>
            <div className="space-y-2">
              {putawayItems.map((item, idx) => {
                const isDone = putawayProgress.get(item.itemId) || false;
                const isCurrent = idx === currentItemIndex && !isDone;
                return (
                  <div
                    key={item.itemId}
                    className={`p-3 rounded-lg border ${
                      isDone ? "bg-success/10 border-success" :
                      isCurrent ? "bg-primary/10 border-primary" :
                      "bg-base-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">Item {idx + 1}</div>
                        <div className="text-xs text-base-content/60">
                          Quantity: {item.receivedQuantity}
                        </div>
                      </div>
                      {isDone ? (
                        <span className="badge badge-success">Done</span>
                      ) : isCurrent ? (
                        <span className="badge badge-primary">Current</span>
                      ) : (
                        <span className="badge badge-ghost">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modals */}
        {showLocationPicker && (
          <LocationPicker
            isOpen={showLocationPicker}
            onClose={() => setShowLocationPicker(false)}
            onSelect={handleLocationSelect}
            warehouseId={worker?.warehouseId}
          />
        )}
      </div>
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
