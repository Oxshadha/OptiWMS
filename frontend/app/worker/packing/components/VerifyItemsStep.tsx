import { isUUID } from "@/lib/utils/material-display";
import type { Order } from "../types";

interface VerifyItemsStepProps {
  order: Order;
  onBack: () => void;
  onScanItem: (index: number) => void;
}

export function VerifyItemsStep({ order, onBack, onScanItem }: VerifyItemsStepProps) {
  const allVerified = order.items.every((item) => item.verified);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-base-content">{order.orderNumber}</h2>
          <p className="text-sm text-base-content/60">Customer: {order.customer}</p>
        </div>
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          <span className="material-symbols-outlined">arrow_back</span>
          Back
        </button>
      </div>

      <div className="card bg-base-100 border border-base-300 p-6">
        <h3 className="font-semibold text-base-content mb-4">Verify Items</h3>
        <div className="space-y-3">
          {order.items.map((item, index) => (
            <div key={item.id} className={`card p-4 ${item.verified ? "bg-success/10 border-success" : "bg-base-200"}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-base-content">{item.name}</div>
                  {item.sku && item.sku !== "N/A" && !isUUID(item.sku) && (
                    <div className="text-sm text-base-content/60">
                      <span className="font-mono font-semibold text-primary">SKU: {item.sku}</span>
                    </div>
                  )}
                  <div className="text-sm text-base-content/60">Quantity: {item.pickedQuantity} / {item.quantity}</div>
                </div>
                <div className="flex items-center gap-3">
                  {item.verified ? (
                    <span className="material-symbols-outlined text-success text-3xl">check_circle</span>
                  ) : (
                    <button onClick={() => onScanItem(index)} className="btn btn-primary btn-sm">
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

      {allVerified && (
        <div className="alert alert-success">
          <span className="material-symbols-outlined">check_circle</span>
          <span>All items verified! Proceeding to packaging...</span>
        </div>
      )}
    </div>
  );
}
