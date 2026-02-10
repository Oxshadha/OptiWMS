"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { saveScanRecord, addToSyncQueue } from "@/lib/indexeddb";
import { LocationPicker } from "@/components/LocationPicker";
import { QRScanner } from "@/components/QRScanner";
import { warehousesApi } from "@/lib/api/warehouses";
import { operationsApi } from "@/lib/api/operations";
import { logger } from "@/lib/utils/logger";

type TransferType = "intra_warehouse" | "inter_warehouse";
type TransferStatus = "draft" | "in_transit" | "received" | "cancelled";

interface TransferData {
  id: string;
  transferNumber: string;
  transferType: TransferType;
  sourceWarehouseId?: string;
  sourceLocationCode: string;
  destWarehouseId?: string;
  destLocationCode: string;
  itemId?: string;
  sku: string;
  quantity: number;
  status: TransferStatus;
  notes?: string;
  dispatchedAt?: string;
  receivedAt?: string;
}

export default function StockTransferPage() {
  const { isOnline } = useOffline();
  const [step, setStep] = useState<"type" | "source" | "item" | "destination" | "confirm" | "dispatch" | "receive">("type");
  const [transferType, setTransferType] = useState<TransferType | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerFor, setLocationPickerFor] = useState<"source" | "destination">("source");
  const [showItemScanner, setShowItemScanner] = useState(false);
  
  const [formData, setFormData] = useState<Partial<TransferData>>({
    sourceLocationCode: "",
    destLocationCode: "",
    sku: "",
    quantity: 0,
    notes: "",
  });

  const [transfers, setTransfers] = useState<TransferData[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferData | null>(null);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Load warehouses from API
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setLoading(true);
        const warehousesData = await warehousesApi.getAll();
        setWarehouses(warehousesData.map(wh => ({ id: wh.id, name: wh.name })));
      } catch (error) {
        logger.error("Error loading warehouses:", error);
        setWarehouses([]);
      } finally {
        setLoading(false);
      }
    };
    loadWarehouses();
  }, []);

  const handleLocationSelect = (locationCode: string) => {
    if (locationPickerFor === "source") {
      setFormData({ ...formData, sourceLocationCode: locationCode });
    } else {
      setFormData({ ...formData, destLocationCode: locationCode });
    }
    setShowLocationPicker(false);
  };

  const handleItemScan = (code: string) => {
    setFormData({ ...formData, sku: code });
    setShowItemScanner(false);
    // TODO: Fetch item details from API/IndexedDB
  };

  const handleDispatch = async () => {
    if (!formData.sourceLocationCode || !formData.destLocationCode || !formData.sku || !formData.quantity) {
      alert("Please complete all required fields");
      return;
    }

    const transfer: TransferData = {
      id: `tf-${Date.now()}`,
      transferNumber: `TF-${Date.now()}`,
      transferType: transferType!,
      sourceLocationCode: formData.sourceLocationCode,
      destLocationCode: formData.destLocationCode,
      sku: formData.sku,
      quantity: formData.quantity,
      status: "in_transit",
      notes: formData.notes,
      dispatchedAt: new Date().toISOString(),
    };

    // Save to IndexedDB
    await saveScanRecord({
      taskId: transfer.id,
      location: transfer.sourceLocationCode,
      sku: transfer.sku,
      qty: transfer.quantity,
    });

    // Add to sync queue
    await addToSyncQueue({
      type: "operation",
      action: "create",
      data: {
        operationType: "stock_transfer",
        action: "dispatch",
        ...transfer,
      },
    });

    setTransfers([...transfers, transfer]);
    alert(`Transfer ${transfer.transferNumber} dispatched successfully!`);
    setStep("type");
    setFormData({
      sourceLocationCode: "",
      destLocationCode: "",
      sku: "",
      quantity: 0,
      notes: "",
    });
  };

  const handleReceive = async (transfer: TransferData) => {
    if (transfer.status !== "in_transit") {
      alert("This transfer cannot be received");
      return;
    }

    const updatedTransfer = {
      ...transfer,
      status: "received" as TransferStatus,
      receivedAt: new Date().toISOString(),
    };

    // Update in IndexedDB and sync queue
    await addToSyncQueue({
      type: "operation",
      action: "update",
      data: {
        operationType: "stock_transfer",
        action: "receive",
        ...updatedTransfer,
      },
    });

    setTransfers(transfers.map(t => t.id === transfer.id ? updatedTransfer : t));
    alert(`Transfer ${transfer.transferNumber} received successfully!`);
  };

  const pendingReceipts = transfers.filter(t => t.status === "in_transit");

  return (
    <div className="p-6 space-y-6">
      {/* Step 1: Transfer Type Selection */}
      {step === "type" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-base-content">Select Transfer Type</h2>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => {
                setTransferType("intra_warehouse");
                setStep("source");
              }}
              className="card bg-base-100 border border-base-300 p-6 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-4xl text-primary">swap_horiz</span>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-base-content">Intra-Warehouse Transfer</h3>
                  <p className="text-sm text-base-content/60">Transfer within the same warehouse</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                setTransferType("inter_warehouse");
                setStep("source");
              }}
              className="card bg-base-100 border border-base-300 p-6 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-4xl text-primary">warehouse</span>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-base-content">Inter-Warehouse Transfer</h3>
                  <p className="text-sm text-base-content/60">Transfer between different warehouses</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Source Location */}
      {step === "source" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-base-content">Source Location</h2>
            <button onClick={() => setStep("type")} className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </button>
          </div>
          
          {transferType === "inter_warehouse" && (
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Source Warehouse</span>
              </label>
              <select className="select select-bordered">
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="card bg-base-100 border border-base-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base-content">Location Code</h3>
              <button
                onClick={() => {
                  setLocationPickerFor("source");
                  setShowLocationPicker(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Select Location
              </button>
            </div>
            {formData.sourceLocationCode ? (
              <div className="text-2xl font-mono font-bold text-primary">
                {formData.sourceLocationCode}
              </div>
            ) : (
              <div className="text-base-content/50">No location selected</div>
            )}
          </div>

          <button
            onClick={() => setStep("item")}
            disabled={!formData.sourceLocationCode}
            className="btn btn-primary w-full"
          >
            Next: Select Item
          </button>
        </div>
      )}

      {/* Step 3: Item Selection */}
      {step === "item" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-base-content">Select Item</h2>
            <button onClick={() => setStep("source")} className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </button>
          </div>

          <div className="card bg-base-100 border border-base-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base-content">Item SKU</h3>
              <button
                onClick={() => setShowItemScanner(true)}
                className="btn btn-primary btn-sm"
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Scan Item
              </button>
            </div>
            <input
              type="text"
              placeholder="Enter or scan SKU"
              className="input input-bordered w-full"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            />
            {formData.sku && (
              <div className="mt-4 p-4 bg-base-200 rounded-lg">
                <div className="text-sm text-base-content/60">Available Stock:</div>
                <div className="text-2xl font-bold text-base-content">150 units</div>
                <div className="text-xs text-base-content/50 mt-1">At {formData.sourceLocationCode}</div>
              </div>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Quantity *</span>
            </label>
            <input
              type="number"
              min="1"
              className="input input-bordered w-full"
              value={formData.quantity || ""}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
            />
          </div>

          <button
            onClick={() => setStep("destination")}
            disabled={!formData.sku || !formData.quantity}
            className="btn btn-primary w-full"
          >
            Next: Select Destination
          </button>
        </div>
      )}

      {/* Step 4: Destination Location */}
      {step === "destination" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-base-content">Destination Location</h2>
            <button onClick={() => setStep("item")} className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </button>
          </div>

          {transferType === "inter_warehouse" && (
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Destination Warehouse</span>
              </label>
              <select className="select select-bordered">
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="card bg-base-100 border border-base-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base-content">Location Code</h3>
              <button
                onClick={() => {
                  setLocationPickerFor("destination");
                  setShowLocationPicker(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Select Location
              </button>
            </div>
            {formData.destLocationCode ? (
              <div className="text-2xl font-mono font-bold text-primary">
                {formData.destLocationCode}
              </div>
            ) : (
              <div className="text-base-content/50">No location selected</div>
            )}
            {formData.destLocationCode === formData.sourceLocationCode && (
              <div className="alert alert-warning mt-4">
                <span>Source and destination cannot be the same!</span>
              </div>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Notes (Optional)</span>
            </label>
            <textarea
              className="textarea textarea-bordered"
              rows={3}
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes or reason for transfer..."
            />
          </div>

          <button
            onClick={() => setStep("confirm")}
            disabled={!formData.destLocationCode || formData.destLocationCode === formData.sourceLocationCode}
            className="btn btn-primary w-full"
          >
            Review & Confirm
          </button>
        </div>
      )}

      {/* Step 5: Confirmation */}
      {step === "confirm" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-base-content">Transfer Summary</h2>
            <button onClick={() => setStep("destination")} className="btn btn-ghost btn-sm">
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </button>
          </div>

          <div className="card bg-base-100 border border-base-300 p-6 space-y-4">
            <div>
              <div className="text-sm text-base-content/60">Transfer Type</div>
              <div className="text-lg font-semibold text-base-content">
                {transferType === "intra_warehouse" ? "Intra-Warehouse" : "Inter-Warehouse"}
              </div>
            </div>
            <div>
              <div className="text-sm text-base-content/60">Item SKU</div>
              <div className="text-lg font-semibold text-base-content">{formData.sku}</div>
            </div>
            <div>
              <div className="text-sm text-base-content/60">Quantity</div>
              <div className="text-lg font-semibold text-base-content">{formData.quantity} units</div>
            </div>
            <div>
              <div className="text-sm text-base-content/60">From</div>
              <div className="text-lg font-mono font-bold text-primary">{formData.sourceLocationCode}</div>
            </div>
            <div>
              <div className="text-sm text-base-content/60">To</div>
              <div className="text-lg font-mono font-bold text-primary">{formData.destLocationCode}</div>
            </div>
            {formData.notes && (
              <div>
                <div className="text-sm text-base-content/60">Notes</div>
                <div className="text-base text-base-content">{formData.notes}</div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("destination")} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button onClick={() => setStep("dispatch")} className="btn btn-primary flex-1">
              Dispatch Transfer
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Dispatch */}
      {step === "dispatch" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-base-content">Dispatch Transfer</h2>
          <div className="alert alert-info">
            <span className="material-symbols-outlined">info</span>
            <span>This will mark the transfer as "In Transit" and deduct stock from source location.</span>
          </div>
          <button onClick={handleDispatch} className="btn btn-primary w-full">
            Confirm Dispatch
          </button>
        </div>
      )}

      {/* Pending Receipts */}
      {pendingReceipts.length > 0 && (
        <div className="card bg-base-100 border border-base-300 p-6">
          <h3 className="text-lg font-bold text-base-content mb-4">Pending Receipts</h3>
          <div className="space-y-3">
            {pendingReceipts.map((transfer) => (
              <div key={transfer.id} className="card bg-base-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-base-content">{transfer.transferNumber}</div>
                    <div className="text-sm text-base-content/60">
                      {transfer.sku} × {transfer.quantity}
                    </div>
                    <div className="text-xs text-base-content/50">
                      {transfer.sourceLocationCode} → {transfer.destLocationCode}
                    </div>
                  </div>
                  <button
                    onClick={() => handleReceive(transfer)}
                    className="btn btn-success btn-sm"
                  >
                    Receive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPicker
          onLocationSelect={handleLocationSelect}
          onClose={() => setShowLocationPicker(false)}
          title={locationPickerFor === "source" ? "Select Source Location" : "Select Destination Location"}
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

