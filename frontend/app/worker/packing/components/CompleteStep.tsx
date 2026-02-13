import { packagingTypes } from "../constants";
import type { Order, PackingData } from "../types";

interface CompleteStepProps {
  order: Order;
  packingData: Partial<PackingData>;
  dimensionalWeight: number;
  onConfirm: () => void;
}

export function CompleteStep({ order, packingData, dimensionalWeight, onConfirm }: CompleteStepProps) {
  return (
    <div className="space-y-4">
      <div className="card bg-success/10 border-success p-6 text-center">
        <span className="material-symbols-outlined text-success text-6xl mb-4">check_circle</span>
        <h2 className="text-2xl font-bold text-base-content mb-2">Packing Complete!</h2>
        <p className="text-base-content/60">Order {order.orderNumber} is ready for shipment</p>
      </div>

      <div className="card bg-base-100 border border-base-300 p-6">
        <h3 className="font-semibold text-base-content mb-4">Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-base-content/60">Order Number:</span>
            <span className="font-semibold text-base-content">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Packaging:</span>
            <span className="font-semibold text-base-content">
              {packagingTypes.find((packagingType) => packagingType.id === packingData.packagingType)?.name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Weight:</span>
            <span className="font-semibold text-base-content">
              {Math.max(packingData.actualWeight || 0, dimensionalWeight).toFixed(2)} kg
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Packed Label:</span>
            <span className="font-semibold text-base-content">{packingData.trackingNumber || "Auto-generate"}</span>
          </div>
        </div>
      </div>

      <button onClick={onConfirm} className="btn btn-primary w-full">
        Confirm Packing & Move to Shipment
      </button>
    </div>
  );
}
