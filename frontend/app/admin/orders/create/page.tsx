"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const customers = [
  "Acme Corp",
  "Bright Retail",
  "Delta Mart",
  "Echo Stores",
  "Falcon Inc",
  "Global Trade",
];

export default function CreateOrderPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Replace with real API call to create order
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSubmitting(false);
    router.push("/admin/orders");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Create Order</h1>
          <p className="text-base-content/60 text-sm mt-1">
            Capture a new customer order and review details before confirming.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push("/admin/orders")}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Orders</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
      >
        {/* Left: Order details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title text-base-content">Order Details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Customer</span>
                  </div>
                  <select className="select select-bordered" required>
                    <option value="">Select customer</option>
                    {customers.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Order date */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Order Date</span>
                  </div>
                  <input
                    type="date"
                    className="input input-bordered"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </label>

                {/* Expected ship date */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Expected Ship Date
                    </span>
                  </div>
                  <input type="date" className="input input-bordered" />
                </label>

                {/* Reference */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Customer Reference
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="PO number or reference"
                  />
                </label>
              </div>

              {/* Shipping address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <label className="form-control w-full md:col-span-2">
                  <div className="label">
                    <span className="label-text font-medium">
                      Shipping Address
                    </span>
                  </div>
                  <textarea
                    className="textarea textarea-bordered min-h-[80px]"
                    placeholder="Street, city, state, postal code, country"
                  />
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Ship Method</span>
                  </div>
                  <select className="select select-bordered">
                    <option value="">Select method</option>
                    <option>Standard Ground</option>
                    <option>Express</option>
                    <option>Overnight</option>
                  </select>
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Priority</span>
                  </div>
                  <select className="select select-bordered">
                    <option>Normal</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Line items (placeholder UI for now) */}
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-base-content">Line Items</h2>
                <button type="button" className="btn btn-sm btn-outline">
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Add Line</span>
                </button>
              </div>

              <div className="alert alert-info bg-info/5 border border-info/40 text-info">
                <span className="material-symbols-outlined">info</span>
                <span>
                  Line item management is a placeholder. Hook this into your
                  products and inventory when the API is ready.
                </span>
              </div>

              <div className="overflow-x-auto border border-dashed border-base-300 rounded-xl p-4 text-sm text-base-content/60">
                <p>No line items added yet.</p>
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
                  <span className="text-base-content/60">Items</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Subtotal</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Tax</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex justify-between border-t border-base-300 pt-2 mt-2">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold text-lg">$0.00</span>
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
                    I confirm the order details are correct.
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
                    {isSubmitting ? "Creating Order..." : "Create Order"}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => router.push("/admin/orders")}
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
