"use client";

import { useState, useEffect } from "react";
import { QRScanner } from "@/components/QRScanner";
import { operationsApi } from "@/lib/api/operations";
import { useOffline } from "@/hooks/useOffline";
import { addToSyncQueue } from "@/lib/indexeddb";
import { showToast } from "@/lib/utils/toast";
import { ordersApi } from "@/lib/api/orders";
import { orderItemsApi, OrderItem } from "@/lib/api/orderItems";
import { materialsApi } from "@/lib/api/materials";
import { tasksApi } from "@/lib/api/tasks-api";
import { useWorker } from "@/contexts/WorkerContext";
import { authApi } from "@/lib/api/auth";
import { formatMaterialDisplay } from "@/lib/utils/material-display";
import { logger } from "@/lib/utils/logger";
import { ReceivingItemCard } from "./components/ReceivingItemCard";
import { ReceivingQuickActions } from "./components/ReceivingQuickActions";

export default function ReceivingPage() {
  const { worker } = useWorker();
  const [scannedValue, setScannedValue] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [blindMode, setBlindMode] = useState(false);
  const [loadingPreference, setLoadingPreference] = useState(true);
  const { isOnline } = useOffline();
  const [items, setItems] = useState<Array<{
    id: string;
    sku: string;
    name: string;
    expected: number;
    received: number;
    materialId: string;
  }>>([]);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [startedReceivingOrderIds, setStartedReceivingOrderIds] = useState<Set<string>>(new Set());

  // Load user preference for blind receiving mode
  useEffect(() => {
    const loadPreference = async () => {
      if (!worker?.id || !isOnline) {
        setLoadingPreference(false);
        return;
      }

      try {
        const userInfo = await authApi.getCurrentUser();
        // Try to get full user details, but fallback to basic info if workers don't have permission
        try {
          const { usersApi } = await import("@/lib/api/users");
          const user = await usersApi.getById(userInfo.userId);
          if (user.blindReceivingMode !== undefined) {
            setBlindMode(user.blindReceivingMode);
          }
        } catch (err) {
          // Workers may not have permission to access /api/users - use default
          logger.warn("Could not fetch user details (workers may not have permission):", err);
        }
      } catch (error) {
        logger.error("Failed to load blind receiving preference:", error);
        // Keep default (false) on error
      } finally {
        setLoadingPreference(false);
      }
    };

    loadPreference();
  }, [worker?.id, isOnline]);

  // Save preference when blind mode changes
  const handleBlindModeChange = async (enabled: boolean) => {
    setBlindMode(enabled);
    
    if (!isOnline) {
      return; // Don't save if offline
    }

    try {
      await authApi.updatePreferences({ blindReceivingMode: enabled });
      showToast.success("Preference saved");
    } catch (error) {
      // Gracefully handle permission errors - preference still works locally
      logger.warn("Could not save blind receiving preference (will work for this session only):", error);
      // Don't revert - let user use the preference locally
      // Don't show error toast - it's not critical
    }
  };

  // Load order details when scanned
  useEffect(() => {
    const loadOrderDetails = async () => {
      if (!scannedValue || !isOnline) {
        setItems([]);
        setOrderDetails(null);
        return;
      }
      
      setLoadingOrder(true);
      try {
        // First, try to get order by number
        let order;
        try {
          order = await ordersApi.getByOrderNumber(scannedValue.trim());
        } catch (err) {
          logger.debug("[Receiving] Order not found via ordersApi, trying operationsApi:", err);
          // If that fails, try the operations API
          try {
            order = await operationsApi.getOrderByNumber(scannedValue.trim());
          } catch (err2) {
            logger.error("[Receiving] Order not found in both APIs:", err2);
            throw new Error(`Order not found: ${scannedValue}`);
          }
        }
        
        logger.debug("[Receiving] Order found:", order);
        setOrderDetails(order);
        if (order?.id && !startedReceivingOrderIds.has(order.id)) {
          try {
            const tasks = await tasksApi.getAll(
              "receiving",
              undefined,
              undefined,
              (worker?.warehouseId || order.warehouseId) ?? undefined,
              false
            );
            const receivingTask = tasks.find(
              (task) =>
                task.referenceType === "order" &&
                task.referenceId === order.id &&
                task.status !== "completed"
            );
            if (receivingTask) {
              await tasksApi.updateStatus(receivingTask.id, "in_progress", worker?.id);
              setStartedReceivingOrderIds((prev) => new Set(prev).add(order.id));
            }
          } catch (taskStartError) {
            logger.warn("[Receiving] Could not mark receiving task in progress:", taskStartError);
          }
        }
        
        // Load order items
        let orderItems: OrderItem[] = [];
        try {
          orderItems = await orderItemsApi.getByOrderId(order.id);
          logger.debug("[Receiving] Order items loaded:", orderItems.length);
        } catch (err) {
          logger.error("[Receiving] Failed to load order items:", err);
          orderItems = [];
        }
        
        // If no items found, show message but allow blind mode
        if (orderItems.length === 0) {
          logger.warn("[Receiving] Order has no items");
          if (blindMode) {
            // Allow blind receiving with unknown item
            setItems([{
              id: "unknown",
              sku: "",
              name: "Unknown Item",
              expected: 0,
              received: 0,
              materialId: "",
            }]);
          } else {
            showToast.error("Order found but has no items. Enable Blind Receiving Mode to receive unknown items.");
          setItems([]);
          }
          return;
        }
        
        // Load material details for each item
        const itemsWithDetails = await Promise.all(
          orderItems.map(async (orderItem: OrderItem) => {
            try {
              const material =
                orderItem.materialCode || orderItem.materialName
                  ? {
                      materialCode: orderItem.materialCode,
                      description: orderItem.materialName,
                    }
                  : await materialsApi.getById(orderItem.materialId);
              const display = formatMaterialDisplay(
                material.materialCode,
                material.description,
                orderItem.materialId
              );
              return {
                id: orderItem.id,
                sku: display.sku,
                name: display.name,
                expected: orderItem.quantity,
                received: 0,
                materialId: orderItem.materialId,
              };
            } catch (err) {
              logger.warn(`[Receiving] Failed to load material ${orderItem.materialId}:`, err);
              // Fallback to order item payload before forcing N/A.
              const display = formatMaterialDisplay(
                orderItem.materialCode || null,
                orderItem.materialName || null,
                orderItem.materialId
              );
              return {
                id: orderItem.id,
                sku: display.sku,
                name: display.name,
                expected: orderItem.quantity,
                received: 0,
                materialId: orderItem.materialId,
              };
            }
          })
        );
        
        setItems(itemsWithDetails);
      } catch (error: any) {
        logger.error("[Receiving] Failed to load order details:", error);
        const errorMessage = error?.message || "Failed to load order. Please check the PO/ASN number.";
        showToast.error(errorMessage);
        setItems([]);
        setOrderDetails(null);
        
        // For blind mode, allow unknown item entry
        if (blindMode) {
          setItems([{
            id: "unknown",
            sku: "",
            name: "Unknown Item",
            expected: 0,
            received: 0,
            materialId: "",
          }]);
        }
      } finally {
        setLoadingOrder(false);
      }
    };
    
    // Debounce the search
    const timeoutId = setTimeout(() => {
      loadOrderDetails();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [scannedValue, isOnline, blindMode, startedReceivingOrderIds, worker?.id, worker?.warehouseId]);

  const handleScan = () => {
    setShowScanner(true);
  };

  const handleBarcodeScan = (result: string) => {
    setScannedValue(result);
    setShowScanner(false);
  };

  // Update received quantity for selected item
  const updateItemQuantity = (itemIndex: number, quantity: number) => {
    setItems(prevItems => {
      const updated = [...prevItems];
      updated[itemIndex] = {
        ...updated[itemIndex],
        received: Math.max(0, quantity),
      };
      return updated;
    });
  };

  const handleConfirm = async () => {
    // Validation
    if (!scannedValue || scannedValue.trim() === "") {
      showToast.error("Please scan or enter a PO/ASN number");
      return;
    }

    if (items.length === 0) {
      showToast.error("No items found for this order");
      return;
    }

    // Check if at least one item has received quantity > 0
    const hasReceivedItems = items.some(item => item.received > 0);
    if (!hasReceivedItems) {
      showToast.error("Please enter received quantity for at least one item");
      return;
    }

    // Validate material IDs for blind mode
    if (blindMode) {
      const invalidItems = items.filter(item => {
        if (item.received <= 0) return false;
        // Check if materialId is empty or if it's not a valid UUID (might be SKU string)
        if (!item.materialId || item.materialId.trim() === "") return true;
        // Check if materialId looks like a UUID (has dashes and proper length)
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(item.materialId)) return true;
        return false;
      });
      
      if (invalidItems.length > 0) {
        const skuList = invalidItems.map(item => item.sku || "Unknown").join(", ");
        showToast.error(`Please enter valid Material Code (SKU) for: ${skuList}. Material not found in system.`);
        return;
      }
    }

    // Validate PO/ASN number format (basic validation)
    if (!scannedValue || scannedValue.trim().length === 0) {
      showToast.error("Please enter or scan a PO/ASN number");
      return;
    }

    // Basic PO/ASN format validation (alphanumeric, dashes, underscores allowed)
    const poPattern = /^[A-Za-z0-9\-_]+$/;
    if (!poPattern.test(scannedValue.trim())) {
      showToast.error("Invalid PO/ASN format. Use only letters, numbers, dashes, and underscores.");
      return;
    }

    // Prepare received items (only items with quantity > 0)
    // For blind mode, materialId must be a valid UUID (looked up from SKU)
    const receivedItems = items
      .filter(item => item.received > 0)
      .map(item => {
        if (!item.materialId || item.materialId.trim() === "") {
          throw new Error(`Material ID not found for SKU: ${item.sku}. Please enter a valid Material Code.`);
        }
        // Validate it's a UUID format
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(item.materialId)) {
          throw new Error(`Invalid Material ID for SKU: ${item.sku}. Please re-enter the Material Code.`);
        }
        return {
          materialId: item.materialId,
          quantity: item.received.toString(),
          locationCode: "", // Can be set later in putaway
        };
      });

    try {
      if (blindMode) {
        // Use blind receiving API with worker's warehouse
        if (isOnline) {
          // Get worker's warehouse ID
          let workerWarehouseId: string | undefined = undefined;
          if (worker?.warehouseId) {
            workerWarehouseId = worker.warehouseId;
          } else if (orderDetails?.warehouseId) {
            // Fallback to order's warehouse if worker warehouse not available
            workerWarehouseId = orderDetails.warehouseId;
          }
          
          await operationsApi.blindReceive(
            {
              orderNumber: scannedValue.trim(),
              items: receivedItems,
              notes: notes || undefined,
              photos: photos.length > 0 ? photos : undefined,
              warehouseId: workerWarehouseId, // Send worker's warehouse ID
            },
            worker?.id // Pass worker ID for tracking
          );
          showToast.success(`Blind receiving confirmed: ${receivedItems.reduce((sum, item) => sum + parseInt(item.quantity), 0)} units received`);
        } else {
          // Queue for sync when offline
          await addToSyncQueue({
            type: "operation",
            action: "create",
            data: {
              type: "blind_receive",
              orderNumber: scannedValue,
              items: receivedItems,
            },
          });
          showToast.success("Receipt queued for sync when online");
        }
        } else {
        // Use regular receiving API
        // Note: Regular receive uses order's warehouse, but we can override with worker's warehouse if needed
        if (isOnline) {
          // Get worker's warehouse ID (for potential override)
          let workerWarehouseId: string | undefined = undefined;
          if (worker?.warehouseId) {
            workerWarehouseId = worker.warehouseId;
          }
          
          await operationsApi.receive(
            {
              orderNumber: scannedValue.trim(),
              items: receivedItems,
              notes: notes || undefined,
              photos: photos.length > 0 ? photos : undefined,
              warehouseId: workerWarehouseId, // Send worker's warehouse (may override order warehouse)
            },
            worker?.id // Pass worker ID for tracking
          );
          const totalQty = receivedItems.reduce((sum, item) => sum + parseInt(item.quantity), 0);
          showToast.success(`Receiving confirmed: ${totalQty} units received`);
        } else {
          // Queue for sync when offline
          await addToSyncQueue({
            type: "operation",
            action: "create",
            data: {
              type: "receive",
              orderNumber: scannedValue,
              items: receivedItems,
            },
          });
          showToast.success("Receipt queued for sync when online");
        }
      }

      // Reset form after successful receipt
      setScannedValue("");
      setItems([]);
      setOrderDetails(null);
      setNotes("");
      setPhotos([]);
      setStartedReceivingOrderIds(new Set());
    } catch (error: any) {
      logger.error("Error confirming receipt:", error);
      const errorMessage = error?.message || "Error confirming receipt. Please try again.";
      showToast.error(errorMessage);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Blind Mode Toggle */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <label className="label cursor-pointer gap-3">
          <div className="flex-1">
            <span className="label-text font-semibold">Blind Receiving Mode</span>
            <div className="text-xs text-base-content/60 mt-1">
              Hide expected quantities to improve accuracy
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={blindMode}
            disabled={loadingPreference}
            onChange={(e) => handleBlindModeChange(e.target.checked)}
          />
        </label>
      </div>

      {/* Scan Section */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm text-base-content/60 mb-2">Scan PO / ASN</div>
        <div className="flex gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="Enter PO number (e.g., PO-2024-001) or ASN number"
            value={scannedValue}
            onChange={(e) => setScannedValue(e.target.value)}
            disabled={loadingOrder}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleScan();
              }
            }}
          />
          <button
            onClick={handleScan}
            className="btn btn-primary btn-square"
            title="Scan Barcode"
            disabled={loadingOrder}
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
        {loadingOrder && (
          <div className="text-xs text-primary mt-2 flex items-center gap-2">
            <span className="loading loading-spinner loading-xs"></span>
            Loading order details...
          </div>
        )}
      </div>

      {/* Item Details */}
      {items.length > 0 ? (
        items.map((item, index) => (
          <ReceivingItemCard
            key={item.id || index}
            item={item}
            index={index}
            blindMode={blindMode}
            onChangeQty={updateItemQuantity}
            onBlindSkuChange={(itemIndex, value) => {
              setItems((prev) => {
                const updated = [...prev];
                updated[itemIndex] = {
                  ...updated[itemIndex],
                  sku: value,
                };
                return updated;
              });

              const trimmedValue = value.trim();
              if (trimmedValue.length >= 1) {
                setTimeout(async () => {
                  try {
                    logger.debug(`[Receiving] Looking up material code: ${trimmedValue}`);
                    const material = await materialsApi.getByCode(trimmedValue);
                    const display = formatMaterialDisplay(
                      material.materialCode,
                      material.description,
                      material.id
                    );
                    setItems((prev) => {
                      const updated = [...prev];
                      updated[itemIndex] = {
                        ...updated[itemIndex],
                        sku: display.sku,
                        materialId: material.id,
                        name: display.name,
                      };
                      return updated;
                    });
                    showToast.success(
                      `Material found: ${display.sku}${display.name !== display.sku ? ` • ${display.name}` : ""}`
                    );
                  } catch (err: any) {
                    logger.error(`[Receiving] Material lookup failed for code: ${trimmedValue}`, err);
                    if (trimmedValue.length >= 3) {
                      logger.warn(
                        `[Receiving] Material not found for: ${trimmedValue}. Error:`,
                        err?.message || err
                      );
                    }
                  }
                }, 500);
              }
            }}
            onBlindSkuBlur={async (itemIndex, value) => {
              const skuValue = value.trim();
              const currentItem = items[itemIndex];
              if (skuValue && currentItem && (!currentItem.materialId || currentItem.materialId === "")) {
                try {
                  const material = await materialsApi.getByCode(skuValue);
                  const display = formatMaterialDisplay(
                    material.materialCode,
                    material.description,
                    material.id
                  );
                  setItems((prev) => {
                    const updated = [...prev];
                    updated[itemIndex] = {
                      ...updated[itemIndex],
                      sku: display.sku,
                      materialId: material.id,
                      name: display.name,
                    };
                    return updated;
                  });
                  showToast.success(
                    `Material found: ${display.sku}${display.name !== display.sku ? ` • ${display.name}` : ""}`
                  );
                } catch (err: any) {
                  logger.error(`Material lookup failed for: ${skuValue}`, err);
                  showToast.error(
                    `Material not found for code: "${skuValue}". Please check the SKU or verify it exists in Materials.`
                  );
                }
              }
            }}
          />
        ))
      ) : scannedValue && !loadingOrder ? (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300 text-center">
          <div className="text-base-content/60">No items found for this order</div>
        </div>
      ) : null}

      {/* Confirm Button - Show once if items exist */}
      {items.length > 0 && items.some(item => item.received > 0) && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <button
            onClick={handleConfirm}
            className="btn btn-primary w-full"
            disabled={!items.some(item => item.received > 0)}
          >
            <span className="material-symbols-outlined">check_circle</span>
            {blindMode ? "Confirm Blind Receipt" : "Confirm Receipt"}
          </button>
        </div>
      )}

      <ReceivingQuickActions
        notes={notes}
        photos={photos}
        onOpenPhotoModal={() => setShowPhotoModal(true)}
        onOpenNoteModal={() => setShowNoteModal(true)}
        onRemovePhoto={(index) => setPhotos((prev) => prev.filter((_, i) => i !== index))}
      />

      {/* Photo Capture Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Take Photo</h3>
            <div className="space-y-4">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="file-input file-input-bordered w-full"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const result = event.target?.result as string;
                      setPhotos([...photos, result]);
                      setShowPhotoModal(false);
                      showToast.success("Photo added");
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Add Note</h3>
            <div className="space-y-4">
              <textarea
                className="textarea textarea-bordered w-full"
                rows={4}
                placeholder="Enter your note here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowNoteModal(false);
                    setNotes("");
                  }}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (notes.trim()) {
                      setShowNoteModal(false);
                      showToast.success("Note added");
                    } else {
                      showToast.error("Please enter a note");
                    }
                  }}
                  className="btn btn-primary flex-1"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan PO / ASN QR Code"
        description="Point camera at PO or ASN QR code"
      />
    </div>
  );
}
