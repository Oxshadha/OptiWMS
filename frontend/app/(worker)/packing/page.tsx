"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { saveScanRecord, addToSyncQueue } from "@/lib/indexeddb";
import { QRScanner } from "@/components/QRScanner";
import { packingApi } from "@/lib/api/packing";

interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  pickedQuantity: number;
  verified: boolean;
}

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  priority: "normal" | "express";
  items: OrderItem[];
  status: "ready_to_pack" | "in_progress" | "packed";
}

interface PackingData {
  orderId: string;
  orderNumber: string;
  packagingType: string;
  boxDimensions?: { length: number; width: number; height: number };
  dunnageMaterials: string[];
  hasFragileItems: boolean;
  actualWeight: number;
  dimensionalWeight: number;
  packingNotes: string;
  photos: string[];
}

export default function PackingPage() {
  const { isOnline } = useOffline();
  const [step, setStep] = useState<"select" | "verify" | "package" | "weight" | "complete">("select");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderScanner, setShowOrderScanner] = useState(false);
  const [showItemScanner, setShowItemScanner] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  
  const [packingData, setPackingData] = useState<Partial<PackingData>>({
    packagingType: "",
    dunnageMaterials: [],
    hasFragileItems: false,
    actualWeight: 0,
    packingNotes: "",
    photos: [],
  });

  // Mock orders ready to pack
  const [orders, setOrders] = useState<Order[]>([
    {
      id: "ord-1",
      orderNumber: "ORD-2025-001",
      customer: "John Smith",
      priority: "express",
      status: "ready_to_pack",
      items: [
        { id: "item-1", sku: "SKU-001", name: "Product A", quantity: 2, pickedQuantity: 2, verified: false },
        { id: "item-2", sku: "SKU-002", name: "Product B", quantity: 1, pickedQuantity: 1, verified: false },
      ],
    },
    {
      id: "ord-2",
      orderNumber: "ORD-2025-002",
      customer: "Jane Doe",
      priority: "normal",
      status: "ready_to_pack",
      items: [
        { id: "item-3", sku: "SKU-003", name: "Product C", quantity: 3, pickedQuantity: 3, verified: false },
      ],
    },
  ]);

  const packagingTypes = [
    { id: "small", name: "Small Box", dimensions: { length: 20, width: 15, height: 10 }, maxWeight: 5 },
    { id: "medium", name: "Medium Box", dimensions: { length: 30, width: 25, height: 20 }, maxWeight: 15 },
    { id: "large", name: "Large Box", dimensions: { length: 40, width: 35, height: 30 }, maxWeight: 30 },
    { id: "polymailer", name: "Poly Mailer", dimensions: { length: 25, width: 20, height: 2 }, maxWeight: 2 },
    { id: "crate", name: "Crate", dimensions: { length: 50, width: 40, height: 40 }, maxWeight: 50 },
  ];

  const dunnageOptions = ["Bubble Wrap", "Air Pillows", "Peanuts", "Foam", "Paper"];

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order);
    setStep("verify");
  };

  const handleOrderScan = (code: string) => {
    const order = orders.find(o => o.orderNumber === code || o.id === code);
    if (order) {
      handleOrderSelect(order);
      setShowOrderScanner(false);
    } else {
      alert("Order not found");
    }
  };

  const handleItemScan = (code: string) => {
    if (!selectedOrder) return;
    
    const itemIndex = selectedOrder.items.findIndex(item => item.sku === code);
    if (itemIndex !== -1) {
      const updatedItems = [...selectedOrder.items];
      updatedItems[itemIndex].verified = true;
      setSelectedOrder({ ...selectedOrder, items: updatedItems });
      
      // Check if all items verified
      if (updatedItems.every(item => item.verified)) {
        setTimeout(() => {
          setStep("package");
        }, 500);
      }
    } else {
      alert("Item not found in this order");
    }
    setShowItemScanner(false);
  };

  const handlePackageSelect = (pkgType: typeof packagingTypes[0]) => {
    setPackingData({
      ...packingData,
      packagingType: pkgType.id,
      boxDimensions: pkgType.dimensions,
    });
  };

  const handleDunnageToggle = (material: string) => {
    const current = packingData.dunnageMaterials || [];
    if (current.includes(material)) {
      setPackingData({
        ...packingData,
        dunnageMaterials: current.filter(m => m !== material),
      });
    } else {
      setPackingData({
        ...packingData,
        dunnageMaterials: [...current, material],
      });
    }
  };

  const calculateDimensionalWeight = () => {
    if (!packingData.boxDimensions) return 0;
    const { length, width, height } = packingData.boxDimensions;
    return (length * width * height) / 5000; // Standard dimensional weight formula
  };

  const handleCompletePacking = async () => {
    if (!selectedOrder || !packingData.packagingType) {
      alert("Please complete all required fields");
      return;
    }

    const dimensionalWeight = calculateDimensionalWeight();
    const chargeableWeight = Math.max(packingData.actualWeight || 0, dimensionalWeight);

    const packingRecord = {
      orderId: selectedOrder.id,
      orderNumber: selectedOrder.orderNumber,
      packagingType: packingData.packagingType,
      boxDimensions: packingData.boxDimensions,
      dunnageMaterials: packingData.dunnageMaterials,
      hasFragileItems: packingData.hasFragileItems,
      actualWeight: packingData.actualWeight,
      dimensionalWeight,
      chargeableWeight,
      packingNotes: packingData.packingNotes,
      photos: packingData.photos,
      trackingNumber: `TRK-${Date.now()}`,
      status: "completed",
      completedAt: new Date().toISOString(),
    };

    // Save to IndexedDB
    await saveScanRecord({
      taskId: selectedOrder.id,
      taskType: "packing",
      locationCode: "",
      sku: "",
      quantity: selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0),
      timestamp: new Date().toISOString(),
    });

    // Add to sync queue
    await addToSyncQueue({
      type: "packing",
      action: "complete",
      data: packingRecord,
      timestamp: new Date().toISOString(),
    });

    // If online, also call API directly
    if (isOnline && selectedOrder) {
      try {
        // Find or create packing record
        const packingRecords = await packingApi.getQueue();
        const existingRecord = packingRecords.find(p => p.orderNumber === selectedOrder.orderNumber);
        
        if (existingRecord) {
          await packingApi.complete(existingRecord.id);
        } else {
          // Create new packing record and complete it
          const newRecord = await packingApi.create({
            orderId: selectedOrder.id,
            orderNumber: selectedOrder.orderNumber,
            status: "packed",
            actualWeightKg: packingData.actualWeight,
            packingNotes: packingData.packingNotes,
            hasFragileItems: packingData.hasFragileItems,
          });
          await packingApi.complete(newRecord.id);
        }
      } catch (err) {
        console.error("Error syncing packing to API:", err);
        // Continue anyway since it's in sync queue
      }
    }

    // Update order status
    setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, status: "packed" } : o));
    
    alert(`Order ${selectedOrder.orderNumber} packed successfully!`);
    
    // Reset
    setSelectedOrder(null);
    setStep("select");
    setPackingData({
      packagingType: "",
      dunnageMaterials: [],
      hasFragileItems: false,
      actualWeight: 0,
      packingNotes: "",
      photos: [],
    });
  };

  const handlePrintLabel = () => {
    // TODO: Print shipping label
    alert("Printing shipping label...");
  };

  const handlePrintSlip = () => {
    // TODO: Print packing slip
    alert("Printing packing slip...");
  };

  const readyToPackOrders = orders.filter(o => o.status === "ready_to_pack");

  return (
    <div className="p-6 space-y-6">
      {/* Network Status */}
      <div className={`alert ${isOnline ? "alert-success" : "alert-warning"}`}>
        <span className="material-symbols-outlined">
          {isOnline ? "wifi" : "wifi_off"}
        </span>
        <span>{isOnline ? "Online" : "Offline Mode"}</span>
      </div>

      {/* Step 1: Order Selection */}
      {step === "select" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-base-content">Select Order to Pack</h2>
            <button
              onClick={() => setShowOrderScanner(true)}
              className="btn btn-primary btn-sm"
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
              Scan Order
            </button>
          </div>

          <div className="space-y-3">
            {readyToPackOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => handleOrderSelect(order)}
                className="card bg-base-100 border border-base-300 p-4 hover:border-primary transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base-content">{order.orderNumber}</span>
                      {order.priority === "express" && (
                        <span className="badge badge-error badge-sm">Express</span>
                      )}
                    </div>
                    <div className="text-sm text-base-content/60 mt-1">
                      Customer: {order.customer}
                    </div>
                    <div className="text-sm text-base-content/60">
                      {order.items.length} item(s) to pack
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-primary">arrow_forward</span>
                </div>
              </div>
            ))}
          </div>

          {readyToPackOrders.length === 0 && (
            <div className="card bg-base-100 border border-base-300 p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">inventory</span>
              <h3 className="text-lg font-semibold text-base-content mb-2">No orders ready to pack</h3>
              <p className="text-sm text-base-content/60">All orders have been packed or are in progress</p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Order Verification */}
      {step === "verify" && selectedOrder && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-base-content">{selectedOrder.orderNumber}</h2>
              <p className="text-sm text-base-content/60">Customer: {selectedOrder.customer}</p>
            </div>
            <button onClick={() => setStep("select")} className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </button>
          </div>

          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="font-semibold text-base-content mb-4">Verify Items</h3>
            <div className="space-y-3">
              {selectedOrder.items.map((item, index) => (
                <div
                  key={item.id}
                  className={`card p-4 ${
                    item.verified ? "bg-success/10 border-success" : "bg-base-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-base-content">{item.name}</div>
                      <div className="text-sm text-base-content/60">SKU: {item.sku}</div>
                      <div className="text-sm text-base-content/60">
                        Quantity: {item.pickedQuantity} / {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.verified ? (
                        <span className="material-symbols-outlined text-success text-3xl">check_circle</span>
                      ) : (
                        <button
                          onClick={() => {
                            setCurrentItemIndex(index);
                            setShowItemScanner(true);
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          <span className="material-symbols-outlined">qr_code_scanner</span>
                          Scan
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedOrder.items.every(item => item.verified) && (
            <div className="alert alert-success">
              <span className="material-symbols-outlined">check_circle</span>
              <span>All items verified! Proceeding to packaging...</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Packaging Selection */}
      {step === "package" && selectedOrder && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-base-content">Select Packaging</h2>
            <button onClick={() => setStep("verify")} className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </button>
          </div>

          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="font-semibold text-base-content mb-4">Box Type</h3>
            <div className="grid grid-cols-1 gap-3">
              {packagingTypes.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handlePackageSelect(pkg)}
                  className={`card p-4 text-left ${
                    packingData.packagingType === pkg.id
                      ? "bg-primary text-primary-content border-primary"
                      : "bg-base-200 border-base-300"
                  } border`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{pkg.name}</div>
                      <div className="text-sm opacity-80">
                        {pkg.dimensions.length} × {pkg.dimensions.width} × {pkg.dimensions.height} cm
                      </div>
                      <div className="text-sm opacity-80">Max weight: {pkg.maxWeight} kg</div>
                    </div>
                    {packingData.packagingType === pkg.id && (
                      <span className="material-symbols-outlined">check_circle</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="font-semibold text-base-content mb-4">Dunnage Materials</h3>
            <div className="space-y-2">
              {dunnageOptions.map((material) => (
                <label key={material} className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={packingData.dunnageMaterials?.includes(material) || false}
                    onChange={() => handleDunnageToggle(material)}
                  />
                  <span className="label-text">{material}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={packingData.hasFragileItems || false}
                onChange={(e) => setPackingData({ ...packingData, hasFragileItems: e.target.checked })}
              />
              <span className="label-text font-medium">Contains fragile items</span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Packing Notes (Optional)</span>
            </label>
            <textarea
              className="textarea textarea-bordered"
              rows={3}
              value={packingData.packingNotes || ""}
              onChange={(e) => setPackingData({ ...packingData, packingNotes: e.target.value })}
              placeholder="Add any special instructions or notes..."
            />
          </div>

          <button
            onClick={() => setStep("weight")}
            disabled={!packingData.packagingType}
            className="btn btn-primary w-full"
          >
            Next: Weight & Label
          </button>
        </div>
      )}

      {/* Step 4: Weight & Label */}
      {step === "weight" && selectedOrder && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-base-content">Weight & Label</h2>
            <button onClick={() => setStep("package")} className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </button>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Actual Weight (kg) *</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              className="input input-bordered w-full"
              value={packingData.actualWeight || ""}
              onChange={(e) => setPackingData({ ...packingData, actualWeight: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {packingData.boxDimensions && (
            <div className="card bg-base-200 p-4">
              <div className="text-sm text-base-content/60">Dimensional Weight:</div>
              <div className="text-xl font-bold text-base-content">
                {calculateDimensionalWeight().toFixed(2)} kg
              </div>
              <div className="text-sm text-base-content/50 mt-1">
                Chargeable Weight: {Math.max(packingData.actualWeight || 0, calculateDimensionalWeight()).toFixed(2)} kg
              </div>
            </div>
          )}

          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="font-semibold text-base-content mb-4">Print Labels</h3>
            <div className="flex gap-3">
              <button onClick={handlePrintLabel} className="btn btn-primary flex-1">
                <span className="material-symbols-outlined">print</span>
                Shipping Label
              </button>
              <button onClick={handlePrintSlip} className="btn btn-outline btn-primary flex-1">
                <span className="material-symbols-outlined">print</span>
                Packing Slip
              </button>
            </div>
          </div>

          <button
            onClick={() => setStep("complete")}
            disabled={!packingData.actualWeight || packingData.actualWeight <= 0}
            className="btn btn-primary w-full"
          >
            Complete Packing
          </button>
        </div>
      )}

      {/* Step 5: Completion */}
      {step === "complete" && selectedOrder && (
        <div className="space-y-4">
          <div className="card bg-success/10 border-success p-6 text-center">
            <span className="material-symbols-outlined text-success text-6xl mb-4">check_circle</span>
            <h2 className="text-2xl font-bold text-base-content mb-2">Packing Complete!</h2>
            <p className="text-base-content/60">Order {selectedOrder.orderNumber} is ready for shipment</p>
          </div>

          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="font-semibold text-base-content mb-4">Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-base-content/60">Order Number:</span>
                <span className="font-semibold text-base-content">{selectedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">Packaging:</span>
                <span className="font-semibold text-base-content">
                  {packagingTypes.find(p => p.id === packingData.packagingType)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">Weight:</span>
                <span className="font-semibold text-base-content">
                  {Math.max(packingData.actualWeight || 0, calculateDimensionalWeight()).toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>

          <button onClick={handleCompletePacking} className="btn btn-primary w-full">
            Confirm & Save
          </button>
        </div>
      )}

      {/* Order Scanner Modal */}
      {showOrderScanner && (
        <QRScanner
          isOpen={showOrderScanner}
          onClose={() => setShowOrderScanner(false)}
          onScan={handleOrderScan}
          title="Scan Order QR Code"
        />
      )}

      {/* Item Scanner Modal */}
      {showItemScanner && (
        <QRScanner
          isOpen={showItemScanner}
          onClose={() => setShowItemScanner(false)}
          onScan={handleItemScan}
          title="Scan Item QR Code"
        />
      )}
    </div>
  );
}

