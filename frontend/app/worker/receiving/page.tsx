"use client";

import { useState, useEffect } from "react";
import { QRScanner } from "@/components/QRScanner";
import { operationsApi } from "@/lib/api/operations";
import { useOffline } from "@/hooks/useOffline";
import { addToSyncQueue } from "@/lib/indexeddb";
import { showToast } from "@/lib/utils/toast";
import { ordersApi } from "@/lib/api/orders";
import { orderItemsApi } from "@/lib/api/orderItems";
import { materialsApi } from "@/lib/api/materials";
import { useWorker } from "@/contexts/WorkerContext";
import { authApi } from "@/lib/api/auth";

export default function ReceivingPage() {
  const { worker } = useWorker();
  const [scannedValue, setScannedValue] = useState("");
  const [receivedQty, setReceivedQty] = useState(0);
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
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);

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
          console.warn("Could not fetch user details (workers may not have permission):", err);
        }
      } catch (error) {
        console.error("Failed to load blind receiving preference:", error);
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
      console.warn("Could not save blind receiving preference (will work for this session only):", error);
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
          order = await ordersApi.getByOrderNumber(scannedValue);
        } catch (err) {
          // If that fails, try the operations API
          order = await operationsApi.getOrderByNumber(scannedValue);
        }
        
        setOrderDetails(order);
        
        // Load order items
        const orderItems = await orderItemsApi.getByOrderId(order.id);
        
        // Load material details for each item
        const itemsWithDetails = await Promise.all(
          orderItems.map(async (orderItem) => {
            try {
              const material = await materialsApi.getById(orderItem.materialId);
              return {
                id: orderItem.id,
                sku: material.materialCode,
                name: material.description || material.materialCode,
                expected: orderItem.quantity,
                received: 0,
                materialId: orderItem.materialId,
              };
            } catch (err) {
              // If material fetch fails, use order item data
              return {
                id: orderItem.id,
                sku: orderItem.materialId,
                name: `Material ${orderItem.materialId}`,
                expected: orderItem.quantity,
                received: 0,
                materialId: orderItem.materialId,
              };
            }
          })
        );
        
        setItems(itemsWithDetails);
        setSelectedItemIndex(0);
        setReceivedQty(0);
      } catch (error) {
        console.error("Failed to load order details:", error);
        showToast.error("Failed to load order. Please check the PO/ASN number.");
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
  }, [scannedValue, isOnline, blindMode]);

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
    setReceivedQty(Math.max(0, quantity));
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
      const invalidItems = items.filter(item => item.received > 0 && (!item.materialId || item.materialId.trim() === ""));
      if (invalidItems.length > 0) {
        showToast.error("Please enter SKU/Material ID for all received items");
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
    const receivedItems = items
      .filter(item => item.received > 0)
      .map(item => ({
        materialId: item.materialId || item.sku,
        quantity: item.received.toString(),
        locationCode: "", // Can be set later in putaway
      }));

    try {
      if (blindMode) {
        // Use blind receiving API
        if (isOnline) {
          await operationsApi.blindReceive({
            orderNumber: scannedValue.trim(),
            items: receivedItems,
            notes: notes || undefined,
            photos: photos.length > 0 ? photos : undefined,
          });
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
        if (isOnline) {
          await operationsApi.receive({
            orderNumber: scannedValue.trim(),
            items: receivedItems,
            notes: notes || undefined,
            photos: photos.length > 0 ? photos : undefined,
          });
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
      setReceivedQty(0);
      setItems([]);
      setOrderDetails(null);
      setSelectedItemIndex(0);
      setNotes("");
      setPhotos([]);
    } catch (error: any) {
      console.error("Error confirming receipt:", error);
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
          <div key={item.id || index} className="bg-base-100 rounded-xl p-4 border border-base-300 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-bold text-lg text-base-content mb-1">
                  {item.name || "Unknown Item"}
                </div>
                <div className="text-sm text-base-content/60">
                  SKU: {item.sku || item.materialId || "N/A"}
                </div>
              </div>
              {!blindMode && (
                <div className="text-right">
                  <div className="text-xs text-base-content/60">Expected</div>
                  <div className="font-bold text-base-content">{item.expected}</div>
                </div>
              )}
            </div>

            {/* Quantity Control */}
            <div className="bg-base-200 rounded-lg p-4">
              <div className="text-sm text-base-content/60 mb-3">Received Quantity</div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => updateItemQuantity(index, item.received - 1)}
                  className="btn btn-circle btn-outline btn-sm"
                >
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <div className="flex-1 text-center">
                  <input
                    type="number"
                    className={`input input-bordered w-full text-center text-2xl font-bold ${
                      !blindMode && item.received > item.expected ? "input-warning" : ""
                    }`}
                    value={item.received}
                    onChange={(e) => {
                      const qty = Math.max(0, parseInt(e.target.value) || 0);
                      updateItemQuantity(index, qty);
                    }}
                    min="0"
                    required
                  />
                </div>
                <button
                  onClick={() => updateItemQuantity(index, item.received + 1)}
                  className="btn btn-circle btn-outline btn-sm"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
              {!blindMode && (
                <div className="text-center mt-3">
                  <div className={`text-xs ${
                    item.expected - item.received > 0
                      ? "text-base-content/60"
                      : item.received > item.expected
                      ? "text-warning font-semibold"
                      : "text-success font-semibold"
                  }`}>
                    {item.expected - item.received > 0
                      ? `${item.expected - item.received} remaining`
                      : item.received > item.expected
                      ? `${item.received - item.expected} over expected`
                      : "Complete"}
                  </div>
                </div>
              )}
            </div>

            {/* SKU Input for Blind Mode */}
            {blindMode && (!item.materialId || item.materialId === "") && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                <label className="label">
                  <span className="label-text text-sm font-semibold">SKU / Material ID *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Enter SKU or Material ID"
                  value={item.sku}
                  onChange={(e) => {
                    setItems(prev => {
                      const updated = [...prev];
                      updated[index] = {
                        ...updated[index],
                        sku: e.target.value,
                        materialId: e.target.value,
                      };
                      return updated;
                    });
                  }}
                  required
                />
              </div>
            )}
          </div>
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

      {/* Quick Actions */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => setShowPhotoModal(true)}
            className="btn btn-outline btn-sm"
          >
            <span className="material-symbols-outlined">photo_camera</span>
            Take Photo
          </button>
          <button 
            onClick={() => setShowNoteModal(true)}
            className="btn btn-outline btn-sm"
          >
            <span className="material-symbols-outlined">note_add</span>
            Add Note
          </button>
        </div>
        {notes && (
          <div className="mt-3 p-3 bg-base-200 rounded-lg">
            <div className="text-xs text-base-content/60 mb-1">Note:</div>
            <div className="text-sm text-base-content">{notes}</div>
          </div>
        )}
        {photos.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-base-content/60 mb-2">Photos ({photos.length}):</div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative">
                  <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                  <button
                    onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 btn btn-circle btn-xs btn-error"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
