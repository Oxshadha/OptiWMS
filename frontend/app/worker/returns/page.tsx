"use client";

import { useState } from "react";
import { QRScanner } from "@/components/QRScanner";
import { Modal } from "@/components/Modal";

export default function ReturnsPage() {
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showReturnScanner, setShowReturnScanner] = useState(false);
  const [showProductScanner, setShowProductScanner] = useState(false);
  const [scannedReturnId, setScannedReturnId] = useState("");
  const [scannedProducts, setScannedProducts] = useState<Array<{ sku: string; qty: number }>>([]);
  const [currentProductQty, setCurrentProductQty] = useState(0);

  const returns = [
    {
      id: "RET-1001",
      returnNumber: "RET-1001",
      orderNumber: "SO-1001",
      item: "Wireless Earbuds",
      sku: "SKU-1001",
      reason: "Defective",
      qty: 2,
      status: "Pending",
    },
    {
      id: "RET-1002",
      returnNumber: "RET-1002",
      orderNumber: "SO-1002",
      item: "Smart Projector",
      sku: "SKU-1002",
      reason: "Customer Request",
      qty: 1,
      status: "Pending",
    },
  ];

  const handleProcessReturn = (returnItem: typeof returns[0]) => {
    setSelectedReturn(returnItem);
    setShowProcessModal(true);
  };

  const handleScanReturn = () => {
    setShowReturnScanner(true);
  };

  const handleReturnScan = (result: string) => {
    setScannedReturnId(result);
    setShowReturnScanner(false);
    // Find return by scanned ID
    const foundReturn = returns.find(r => r.returnNumber === result || r.id === result);
    if (foundReturn) {
      setSelectedReturn(foundReturn);
      setShowProcessModal(true);
    } else {
      alert("Return not found. Please scan a valid return QR code.");
    }
  };

  const handleScanProduct = () => {
    setShowProductScanner(true);
  };

  const handleProductScan = (result: string) => {
    // Extract SKU from QR code (format: PRODUCT:{product_id}:{batch_number} or just SKU)
    const sku = result.includes(":") ? result.split(":")[1] : result;
    const existingProduct = scannedProducts.find(p => p.sku === sku);
    
    if (existingProduct) {
      // Update quantity
      setScannedProducts(scannedProducts.map(p => 
        p.sku === sku ? { ...p, qty: p.qty + 1 } : p
      ));
    } else {
      // Add new product
      setScannedProducts([...scannedProducts, { sku, qty: 1 }]);
    }
    setShowProductScanner(false);
  };

  const handleConfirmReturn = async () => {
    if (scannedProducts.length === 0) {
      alert("Please scan at least one product");
      return;
    }
    
    try {
      // Save to IndexedDB for offline-first
      const returnData = {
        returnId: selectedReturn?.id,
        returnNumber: selectedReturn?.returnNumber,
        scannedProducts,
        receivedAt: new Date().toISOString(),
        status: "received",
      };
      
      // TODO: Save to IndexedDB and sync queue
      console.log("Processing return:", returnData);
      
      // Show success message
      alert("Return processed successfully! Items have been received and will be inspected.");
      
      // Update return status to 'received'
      setShowProcessModal(false);
      setScannedProducts([]);
      setScannedReturnId("");
    } catch (error) {
      console.error("Error processing return:", error);
      alert("Error processing return. Please try again.");
    }
  };

  const removeScannedProduct = (sku: string) => {
    setScannedProducts(scannedProducts.filter(p => p.sku !== sku));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-4">Returns</h2>
        <p className="text-sm text-base-content/60">
          Process returned items. Scan return QR code and product QR codes to confirm receipt.
        </p>
      </div>

      <div className="space-y-3">
        {returns.map((returnItem) => (
          <div
            key={returnItem.id}
            className="bg-base-100 rounded-xl p-4 border border-base-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-base-content">{returnItem.returnNumber}</div>
                <div className="text-sm text-base-content/60">Order: {returnItem.orderNumber}</div>
              </div>
              <span className="badge badge-warning">{returnItem.status}</span>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">inventory</span>
                <span className="text-base-content/70">{returnItem.item}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">tag</span>
                <span className="text-base-content/70">SKU: {returnItem.sku}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">info</span>
                <span className="text-base-content/70">Reason: {returnItem.reason}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">numbers</span>
                <span className="text-base-content/70">Qty: {returnItem.qty}</span>
              </div>
            </div>
            <button
              onClick={() => handleProcessReturn(returnItem)}
              className="btn btn-primary btn-sm w-full"
            >
              <span className="material-symbols-outlined">check_circle</span>
              Process Return
            </button>
          </div>
        ))}
      </div>

      {/* Process Return Modal */}
      {selectedReturn && (
        <Modal
          isOpen={showProcessModal}
          onClose={() => {
            setShowProcessModal(false);
            setScannedProducts([]);
            setScannedReturnId("");
          }}
          title={`Process Return: ${selectedReturn.returnNumber}`}
          size="lg"
        >
          <div className="p-6 space-y-4">
            {/* Return Info */}
            <div className="bg-base-200 rounded-lg p-4">
              <h4 className="font-semibold text-base-content mb-2">Return Details</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-content/60">Order:</span>
                  <span className="font-medium">{selectedReturn.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Item:</span>
                  <span className="font-medium">{selectedReturn.item}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">SKU:</span>
                  <span className="font-medium">{selectedReturn.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Expected Qty:</span>
                  <span className="font-medium">{selectedReturn.qty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Reason:</span>
                  <span className="font-medium">{selectedReturn.reason}</span>
                </div>
              </div>
            </div>

            {/* Scan Return QR */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Scan Return QR Code</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1"
                  placeholder="Scan or enter return number"
                  value={scannedReturnId}
                  onChange={(e) => setScannedReturnId(e.target.value)}
                />
                <button
                  onClick={handleScanReturn}
                  className="btn btn-primary btn-square"
                >
                  <span className="material-symbols-outlined">qr_code_scanner</span>
                </button>
              </div>
            </div>

            {/* Scan Products */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Scan Product QR Codes</span>
              </label>
              <button
                onClick={handleScanProduct}
                className="btn btn-outline w-full"
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Scan Product
              </button>
            </div>

            {/* Scanned Products List */}
            {scannedProducts.length > 0 && (
              <div className="bg-base-200 rounded-lg p-4">
                <h4 className="font-semibold text-base-content mb-2">Scanned Products</h4>
                <div className="space-y-2">
                  {scannedProducts.map((product, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-base-100 rounded-lg"
                    >
                      <div>
                        <span className="font-medium">SKU: {product.sku}</span>
                        <span className="text-sm text-base-content/60 ml-2">
                          Qty: {product.qty}
                        </span>
                      </div>
                      <button
                        onClick={() => removeScannedProduct(product.sku)}
                        className="btn btn-ghost btn-xs btn-circle"
                      >
                        <span className="material-symbols-outlined text-error">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="divider"></div>

            <div className="bg-info/10 border border-info/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-info">info</span>
                <div className="text-sm text-base-content/70">
                  <p className="font-medium mb-1">Instructions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Scan the return QR code to verify return</li>
                    <li>Scan each product QR code as you receive them</li>
                    <li>Place items in returns inspection area</li>
                    <li>Confirm when all items are received</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowProcessModal(false);
                  setScannedProducts([]);
                  setScannedReturnId("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmReturn}
                disabled={scannedProducts.length === 0}
              >
                <span className="material-symbols-outlined">check_circle</span>
                Confirm Receipt
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* QR Scanners */}
      <QRScanner
        isOpen={showReturnScanner}
        onClose={() => setShowReturnScanner(false)}
        onScan={handleReturnScan}
        title="Scan Return QR Code"
        description="Point camera at return QR code"
      />

      <QRScanner
        isOpen={showProductScanner}
        onClose={() => setShowProductScanner(false)}
        onScan={handleProductScan}
        title="Scan Product QR Code"
        description="Point camera at product QR code"
      />
    </div>
  );
}
