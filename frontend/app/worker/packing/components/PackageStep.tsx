import { dunnageOptions, packagingTypes } from "../constants";
import type { PackingData } from "../types";

interface PackageStepProps {
  packingData: Partial<PackingData>;
  onBack: () => void;
  onNext: () => void;
  onSelectPackage: (packageId: string) => void;
  onToggleDunnage: (material: string) => void;
  onFragileChange: (value: boolean) => void;
  onNotesChange: (value: string) => void;
}

export function PackageStep({
  packingData,
  onBack,
  onNext,
  onSelectPackage,
  onToggleDunnage,
  onFragileChange,
  onNotesChange,
}: PackageStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-base-content">Select Packaging</h2>
        <button onClick={onBack} className="btn btn-ghost btn-sm">
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
              onClick={() => onSelectPackage(pkg.id)}
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
                {packingData.packagingType === pkg.id && <span className="material-symbols-outlined">check_circle</span>}
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
                onChange={() => onToggleDunnage(material)}
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
            onChange={(e) => onFragileChange(e.target.checked)}
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
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add any special instructions or notes..."
        />
      </div>

      <button onClick={onNext} disabled={!packingData.packagingType} className="btn btn-primary w-full">
        Next: Weight & Label
      </button>
    </div>
  );
}
