import type { PackingData } from "../types";

interface WeightStepProps {
  packingData: Partial<PackingData>;
  dimensionalWeight: number;
  onBack: () => void;
  onWeightChange: (weight: number) => void;
  onPrintLabel: () => void;
  onPrintSlip: () => void;
  onNext: () => void;
}

export function WeightStep({
  packingData,
  dimensionalWeight,
  onBack,
  onWeightChange,
  onPrintLabel,
  onPrintSlip,
  onNext,
}: WeightStepProps) {
  const chargeableWeight = Math.max(packingData.actualWeight || 0, dimensionalWeight);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-base-content">Weight & Label</h2>
        <button onClick={onBack} className="btn btn-ghost btn-sm">
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
          onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
        />
      </div>

      {packingData.boxDimensions && (
        <div className="card bg-base-200 p-4">
          <div className="text-sm text-base-content/60">Dimensional Weight:</div>
          <div className="text-xl font-bold text-base-content">{dimensionalWeight.toFixed(2)} kg</div>
          <div className="text-sm text-base-content/50 mt-1">Chargeable Weight: {chargeableWeight.toFixed(2)} kg</div>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 p-6">
        <h3 className="font-semibold text-base-content mb-4">Print Labels</h3>
        <div className="flex gap-3">
          <button onClick={onPrintLabel} className="btn btn-primary flex-1">
            <span className="material-symbols-outlined">print</span>
            Shipping Label
          </button>
          <button onClick={onPrintSlip} className="btn btn-outline btn-primary flex-1">
            <span className="material-symbols-outlined">print</span>
            Packing Slip
          </button>
        </div>
      </div>

      <button onClick={onNext} disabled={!packingData.actualWeight || packingData.actualWeight <= 0} className="btn btn-primary w-full">
        Complete Packing
      </button>
    </div>
  );
}
