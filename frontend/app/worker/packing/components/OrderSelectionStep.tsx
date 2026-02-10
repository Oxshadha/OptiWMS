import type { Order } from "../types";

interface OrderSelectionStepProps {
  loading: boolean;
  readyToPackOrders: Order[];
  onSelectOrder: (order: Order) => void;
  onOpenScanner: () => void;
}

export function OrderSelectionStep({
  loading,
  readyToPackOrders,
  onSelectOrder,
  onOpenScanner,
}: OrderSelectionStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-base-content">Select Order to Pack</h2>
        <button onClick={onOpenScanner} className="btn btn-primary btn-sm">
          <span className="material-symbols-outlined">qr_code_scanner</span>
          Scan Order
        </button>
      </div>

      <div className="space-y-3">
        {readyToPackOrders.map((order) => (
          <div
            key={order.id}
            onClick={() => onSelectOrder(order)}
            className="card bg-base-100 border border-base-300 p-4 hover:border-primary transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base-content">{order.orderNumber}</span>
                  {order.priority === "express" && <span className="badge badge-error badge-sm">Express</span>}
                </div>
                <div className="text-sm text-base-content/60 mt-1">Customer: {order.customer}</div>
                <div className="text-sm text-base-content/60">{order.items.length} item(s) to pack</div>
              </div>
              <span className="material-symbols-outlined text-primary">arrow_forward</span>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card bg-base-100 border border-base-300 p-12 text-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : readyToPackOrders.length === 0 ? (
        <div className="card bg-base-100 border border-base-300 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">inventory</span>
          <h3 className="text-lg font-semibold text-base-content mb-2">No orders ready to pack</h3>
          <p className="text-sm text-base-content/60">All orders have been packed or are in progress</p>
        </div>
      ) : null}
    </div>
  );
}
