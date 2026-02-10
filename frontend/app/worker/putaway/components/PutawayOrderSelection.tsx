"use client";

import { Modal } from "@/components/Modal";
import { QRScanner } from "@/components/QRScanner";

type OrderOption = { id: string; orderNumber: string; status: string };

export function PutawayOrderSelection({
  orders,
  scannedPONumber,
  isLoadingOrders,
  showPOScanner,
  onPOChange,
  onOpenScanner,
  onCloseScanner,
  onPOScan,
  onSelectOrder,
}: {
  orders: OrderOption[];
  scannedPONumber: string;
  isLoadingOrders: boolean;
  showPOScanner: boolean;
  onPOChange: (value: string) => void;
  onOpenScanner: () => void;
  onCloseScanner: () => void;
  onPOScan: (result: string) => void;
  onSelectOrder: (order: { id: string; orderNumber: string }) => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold mb-4">Select Purchase Order</h2>

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
              onChange={(e) => onPOChange(e.target.value)}
            />
            <button className="btn btn-primary" onClick={onOpenScanner}>
              <span className="material-symbols-outlined">qr_code_scanner</span>
              Scan
            </button>
          </div>
        </div>

        {isLoadingOrders ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner"></span>
          </div>
        ) : orders.length === 0 ? (
          <div className="alert alert-info">
            <span className="material-symbols-outlined">info</span>
            <div>
              <p className="font-semibold">No orders need putaway</p>
              <p className="text-sm mt-1">Orders will appear here after items are received.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-base-content/60 mb-2">
              {orders.length} order{orders.length !== 1 ? "s" : ""} need putaway:
            </p>
            {orders.map((order) => (
              <button
                key={order.id}
                className="btn btn-outline w-full justify-start"
                onClick={() => onSelectOrder({ id: order.id, orderNumber: order.orderNumber })}
              >
                <span className="material-symbols-outlined">receipt</span>
                <span className="font-mono font-bold">{order.orderNumber}</span>
                <span className="badge badge-sm ml-auto">{order.status}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showPOScanner && (
        <Modal isOpen={showPOScanner} onClose={onCloseScanner} title="Scan PO Number">
          <QRScanner isOpen={showPOScanner} onClose={onCloseScanner} onScan={onPOScan} />
        </Modal>
      )}
    </div>
  );
}
