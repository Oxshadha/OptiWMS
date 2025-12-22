"use client";

import { useState } from "react";
import { QRScanner } from "@/components/QRScanner";
import { receivingApi } from "@/lib/api/operations";

export default function ReceivingPage() {
  const [scannedValue, setScannedValue] = useState("");
  const [receivedQty, setReceivedQty] = useState(0);
  const [showScanner, setShowScanner] = useState(false);

  const items = [
    {
      sku: "WB-1001",
      name: "Wireless Earbuds",
      expected: 50,
      received: receivedQty,
    },
  ];

  const handleScan = () => {
    setShowScanner(true);
  };

  const handleBarcodeScan = (result: string) => {
    setScannedValue(result);
    setShowScanner(false);
  };

  const handleConfirm = async () => {
    if (!scannedValue || receivedQty === 0) {
      alert("Please scan an order number and enter received quantity");
      return;
    }
    try {
      const result = await receivingApi.receiveOrder(scannedValue, [{
        materialId: "temp-id", // TODO: Get from scanned item
        quantity: receivedQty.toString(),
        locationCode: "STAGING", // TODO: Get from location picker
      }]);
      if (result.success) {
        alert("Order received successfully!");
        setScannedValue("");
        setReceivedQty(0);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to receive order");
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Scan Section */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm text-base-content/60 mb-2">Scan PO / ASN</div>
        <div className="flex gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="Enter or scan reference"
            value={scannedValue}
            onChange={(e) => setScannedValue(e.target.value)}
          />
          <button
            onClick={handleScan}
            className="btn btn-primary btn-square"
            title="Scan Barcode"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
      </div>

      {/* Item Details */}
      {items.map((item) => (
        <div key={item.sku} className="bg-base-100 rounded-xl p-4 border border-base-300 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-bold text-lg text-base-content mb-1">{item.name}</div>
              <div className="text-sm text-base-content/60">SKU: {item.sku}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-base-content/60">Expected</div>
              <div className="font-bold text-base-content">{item.expected}</div>
            </div>
          </div>

          {/* Quantity Control */}
          <div className="bg-base-200 rounded-lg p-4">
            <div className="text-sm text-base-content/60 mb-3">Received Quantity</div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setReceivedQty(Math.max(0, receivedQty - 1))}
                className="btn btn-circle btn-outline btn-sm"
              >
                <span className="material-symbols-outlined">remove</span>
              </button>
              <div className="flex-1 text-center">
                <input
                  type="number"
                  className="input input-bordered w-full text-center text-2xl font-bold"
                  value={receivedQty}
                  onChange={(e) => setReceivedQty(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                />
              </div>
              <button
                onClick={() => setReceivedQty(receivedQty + 1)}
                className="btn btn-circle btn-outline btn-sm"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
            <div className="text-center mt-3">
              <div className="text-xs text-base-content/60">
                {item.expected - receivedQty > 0
                  ? `${item.expected - receivedQty} remaining`
                  : receivedQty > item.expected
                  ? `${receivedQty - item.expected} over expected`
                  : "Complete"}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setReceivedQty(item.expected)}
              className="btn btn-outline flex-1"
            >
              Set to Expected
            </button>
            <button
              onClick={handleConfirm}
              className="btn btn-primary flex-1"
              disabled={receivedQty === 0}
            >
              <span className="material-symbols-outlined">check_circle</span>
              Confirm Receipt
            </button>
          </div>
        </div>
      ))}

      {/* Quick Actions */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">photo_camera</span>
            Take Photo
          </button>
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">note_add</span>
            Add Note
          </button>
        </div>
      </div>

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
