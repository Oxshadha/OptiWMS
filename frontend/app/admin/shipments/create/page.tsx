"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const carriers = ["DHL", "FedEx", "UPS", "USPS", "Other"];

export default function CreateShipmentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Replace with real API call to create shipment
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSubmitting(false);
    router.push("/admin/shipments");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Create Shipment
          </h1>
          <p className="text-base-content/60 text-sm mt-1">
            Configure carrier, destination, and package details before
            generating the shipment.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push("/admin/shipments")}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Shipments</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
      >
        {/* Left: Shipment details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title text-base-content">Shipment Details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Carrier */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Carrier</span>
                  </div>
                  <select className="select select-bordered" required>
                    <option value="">Select carrier</option>
                    {carriers.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Service level */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Service Level
                    </span>
                  </div>
                  <select className="select select-bordered">
                    <option>Standard</option>
                    <option>Expedited</option>
                    <option>Overnight</option>
                  </select>
                </label>

                {/* Ship date */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Ship Date</span>
                  </div>
                  <input
                    type="date"
                    className="input input-bordered"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </label>

                {/* Expected delivery */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Expected Delivery
                    </span>
                  </div>
                  <input type="date" className="input input-bordered" />
                </label>
              </div>

              {/* Destination */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <label className="form-control w-full md:col-span-2">
                  <div className="label">
                    <span className="label-text font-medium">
                      Destination Address
                    </span>
                  </div>
                  <textarea
                    className="textarea textarea-bordered min-h-[80px]"
                    placeholder="Street, city, state, postal code, country"
                  />
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Contact Name</span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="Recipient name"
                  />
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Contact Phone
                    </span>
                  </div>
                  <input
                    type="tel"
                    className="input input-bordered"
                    placeholder="Contact phone"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Package details (placeholder for now) */}
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-base-content">
                  Package Details
                </h2>
                <button type="button" className="btn btn-sm btn-outline">
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Add Package</span>
                </button>
              </div>

              <div className="alert alert-info bg-info/5 border border-info/40 text-info">
                <span className="material-symbols-outlined">info</span>
                <span>
                  Package and item management is a placeholder. Connect this to
                  your cartonization or picking logic when ready.
                </span>
              </div>

              <div className="overflow-x-auto border border-dashed border-base-300 rounded-xl p-4 text-sm text-base-content/60">
                <p>No packages added yet.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title text-base-content">Review & Confirm</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-content/60">Packages</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Total Weight</span>
                  <span className="font-medium">0.0 kg</span>
                </div>
                <div className="flex justify-between border-t border-base-300 pt-2 mt-2">
                  <span className="font-semibold">Status</span>
                  <span className="font-semibold text-primary">
                    Label Created
                  </span>
                </div>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    required
                  />
                  <span className="label-text text-sm text-base-content/70">
                    I confirm the shipment details are correct.
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <span className="loading loading-spinner loading-sm" />
                  )}
                  <span>
                    {isSubmitting ? "Creating Shipment..." : "Create Shipment"}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => router.push("/admin/shipments")}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
