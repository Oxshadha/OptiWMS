"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const categories = ["Electronics", "Home", "Appliances", "Sports", "Other"];

export default function CreateInventoryItemPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Replace with real API call to create inventory item
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSubmitting(false);
    router.push("/admin/inventory");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Add Inventory Item
          </h1>
          <p className="text-base-content/60 text-sm mt-1">
            Define SKU, storage location, and stock levels for a new product in
            the warehouse.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push("/admin/inventory")}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Inventory</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
      >
        {/* Left: Item details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title text-base-content">Item Details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SKU */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">SKU</span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="e.g. SKU-1007"
                    required
                  />
                </label>

                {/* Name */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Item Name</span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="Product name"
                    required
                  />
                </label>

                {/* Category */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Category</span>
                  </div>
                  <select className="select select-bordered">
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Status */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Status</span>
                  </div>
                  <select className="select select-bordered">
                    <option>Available</option>
                    <option>Low</option>
                    <option>Out of Stock</option>
                  </select>
                </label>

                {/* Quantity on hand */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Quantity on Hand
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered"
                    placeholder="0"
                  />
                </label>

                {/* Reorder point */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Reorder Point
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered"
                    placeholder="e.g. 20"
                  />
                </label>
              </div>

              {/* Location & dimensions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Primary Location
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="e.g. A1-01-01"
                  />
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Unit of Measure
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="Each, Case, Pallet"
                  />
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Weight (kg)</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input input-bordered"
                    placeholder="e.g. 1.25"
                  />
                </label>

                <label className="form-control w-full md:col-span-3">
                  <div className="label">
                    <span className="label-text font-medium">
                      Description (optional)
                    </span>
                  </div>
                  <textarea
                    className="textarea textarea-bordered min-h-[70px]"
                    placeholder="Short description or handling instructions"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls & summary */}
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title text-base-content">Stock & Alerts</h2>

              <div className="space-y-3 text-sm">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Low Stock Threshold
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered"
                    placeholder="e.g. 10"
                  />
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Putaway Strategy
                    </span>
                  </div>
                  <select className="select select-bordered">
                    <option>Default</option>
                    <option>Fast-moving</option>
                    <option>Bulk storage</option>
                  </select>
                </label>
              </div>

              <div className="space-y-2 text-sm mt-2">
                <div className="flex justify-between">
                  <span className="text-base-content/60">Initial Status</span>
                  <span className="font-medium">Available</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Allocation</span>
                  <span className="font-medium">0 reserved</span>
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
                    I confirm this item configuration is correct.
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
                    {isSubmitting ? "Creating Item..." : "Create Item"}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => router.push("/admin/inventory")}
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
