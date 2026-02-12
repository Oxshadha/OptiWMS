"use client";

import { useEffect, useMemo, useState } from "react";
import { QRScanner } from "@/components/QRScanner";
import { Modal } from "@/components/Modal";
import { useWorker } from "@/contexts/WorkerContext";
import { ordersApi, Order } from "@/lib/api/orders";
import { returnsApi, Return as ReturnRecord } from "@/lib/api/returns";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

type ScannedProduct = { sku: string; qty: number };

export default function ReturnsPage() {
  const { worker } = useWorker();
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [ordersMap, setOrdersMap] = useState<Record<string, Order>>({});
  const [loading, setLoading] = useState(true);

  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showOrderScanner, setShowOrderScanner] = useState(false);
  const [showProductScanner, setShowProductScanner] = useState(false);

  const [scannedOrderNumber, setScannedOrderNumber] = useState("");
  const [returnReason, setReturnReason] = useState("Customer return intake");
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [returnsData, outboundOrders] = await Promise.all([
        returnsApi.getAll(),
        ordersApi.getAllOutbound(),
      ]);

      const orderById: Record<string, Order> = {};
      outboundOrders.forEach((order) => {
        orderById[order.id] = order;
      });

      const relevantReturns = returnsData.filter((ret) => {
        if (!ret.originalOrderId) return false;
        const order = orderById[ret.originalOrderId];
        if (!order || order.orderType !== "outbound") return false;
        if (worker?.warehouseId && ret.warehouseId && ret.warehouseId !== worker.warehouseId) return false;
        return true;
      });

      setOrdersMap(orderById);
      setReturns(relevantReturns);
    } catch (error) {
      logger.error("Failed to load returns data:", error);
      showToast.error("Failed to load returns");
    } finally {
      setLoading(false);
    }
  };

  const queueReturns = useMemo(
    () =>
      returns.filter((ret) => {
        const status = (ret.status || "").toLowerCase();
        return ["pending", "received", "inspecting"].includes(status);
      }),
    [returns]
  );

  const processReturn = (ret: ReturnRecord) => {
    const order = ret.originalOrderId ? ordersMap[ret.originalOrderId] : null;
    setSelectedReturn(ret);
    setScannedOrderNumber(order?.orderNumber || "");
    setReturnReason(ret.reason || "Customer return intake");
    setScannedProducts([]);
    setShowProcessModal(true);
  };

  const handleOrderScan = (result: string) => {
    setScannedOrderNumber(result.trim());
    setShowOrderScanner(false);
  };

  const handleProductScan = (result: string) => {
    const raw = result.trim();
    const sku = raw.includes(":") ? raw.split(":")[1] : raw;
    setScannedProducts((current) => {
      const existing = current.find((p) => p.sku === sku);
      if (!existing) return [...current, { sku, qty: 1 }];
      return current.map((p) => (p.sku === sku ? { ...p, qty: p.qty + 1 } : p));
    });
    setShowProductScanner(false);
  };

  const intakeByOrderNumber = async () => {
    if (!scannedOrderNumber.trim()) {
      showToast.error("Scan or enter outbound order number");
      return;
    }

    try {
      const productsSummary =
        scannedProducts.length > 0
          ? ` [Scanned: ${scannedProducts.map((p) => `${p.sku}x${p.qty}`).join(", ")}]`
          : "";
      const reasonWithProducts = `${returnReason || "Customer return intake"}${productsSummary}`;

      await returnsApi.intakeOutbound({
        orderNumber: scannedOrderNumber.trim(),
        reason: reasonWithProducts,
        workerId: worker?.id,
      });

      showToast.success("Outbound return received and sent to quality review queue");
      setShowProcessModal(false);
      setSelectedReturn(null);
      setScannedOrderNumber("");
      setScannedProducts([]);
      await loadData();
    } catch (error) {
      logger.error("Outbound return intake failed:", error);
      showToast.error(error instanceof Error ? error.message : "Failed to intake return");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-2">Outbound Returns Intake</h2>
        <p className="text-sm text-base-content/60">
          Standard flow: receive return by outbound order number, then admin/manager does quality review in Returns.
        </p>
      </div>

      <div className="bg-base-100 rounded-xl p-4 border border-base-300 space-y-3">
        <div className="text-sm font-medium text-base-content">Quick Intake by Order Number</div>
        <div className="flex gap-2">
          <input
            type="text"
            className="input input-bordered flex-1"
            placeholder="Scan/enter outbound order number (e.g. SO-1001)"
            value={scannedOrderNumber}
            onChange={(e) => setScannedOrderNumber(e.target.value)}
          />
          <button onClick={() => setShowOrderScanner(true)} className="btn btn-primary btn-square">
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="input input-bordered flex-1"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Return reason"
          />
          <button className="btn btn-success" onClick={intakeByOrderNumber}>
            Receive Return
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="space-y-3">
          {queueReturns.map((ret) => {
            const order = ret.originalOrderId ? ordersMap[ret.originalOrderId] : null;
            return (
              <div key={ret.id} className="bg-base-100 rounded-xl p-4 border border-base-300">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-base-content">{ret.returnNumber}</div>
                    <div className="text-sm text-base-content/60">Order: {order?.orderNumber || "N/A"}</div>
                  </div>
                  <span className="badge badge-warning">{ret.status || "pending"}</span>
                </div>
                <div className="text-sm text-base-content/70 mb-3">{ret.reason || "No reason provided"}</div>
                <button className="btn btn-primary btn-sm w-full" onClick={() => processReturn(ret)}>
                  Process Return Receipt
                </button>
              </div>
            );
          })}
          {queueReturns.length === 0 && (
            <div className="bg-base-100 rounded-xl p-8 border border-base-300 text-center text-base-content/60">
              No outbound returns in worker queue
            </div>
          )}
        </div>
      )}

      {showProcessModal && (
        <Modal
          isOpen={showProcessModal}
          onClose={() => setShowProcessModal(false)}
          title={`Process Return ${selectedReturn?.returnNumber || ""}`}
          size="lg"
        >
          <div className="p-6 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder="Outbound order number"
                value={scannedOrderNumber}
                onChange={(e) => setScannedOrderNumber(e.target.value)}
              />
              <button onClick={() => setShowOrderScanner(true)} className="btn btn-primary btn-square">
                <span className="material-symbols-outlined">qr_code_scanner</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder="Reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />
              <button onClick={() => setShowProductScanner(true)} className="btn btn-outline">
                Scan Product
              </button>
            </div>

            {scannedProducts.length > 0 && (
              <div className="bg-base-200 rounded-lg p-3 text-sm">
                <div className="font-medium mb-2">Scanned Products</div>
                <div className="space-y-1">
                  {scannedProducts.map((p) => (
                    <div key={p.sku} className="flex justify-between">
                      <span>{p.sku}</span>
                      <span>x{p.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-ghost" onClick={() => setShowProcessModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={intakeByOrderNumber}>
                Confirm Receipt
              </button>
            </div>
          </div>
        </Modal>
      )}

      <QRScanner
        isOpen={showOrderScanner}
        onClose={() => setShowOrderScanner(false)}
        onScan={handleOrderScan}
        title="Scan Outbound Order Number"
        description="Point camera at outbound order QR code"
      />

      <QRScanner
        isOpen={showProductScanner}
        onClose={() => setShowProductScanner(false)}
        onScan={handleProductScan}
        title="Scan Returned Product"
        description="Point camera at returned product QR code"
      />
    </div>
  );
}

