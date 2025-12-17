"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function CreateCustomerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Replace with real API call to create customer
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSubmitting(false);
    router.push("/admin/customers");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Add Customer</h1>
          <p className="text-base-content/60 text-sm mt-1">
            Capture key customer details to start tracking their orders and
            activity.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push("/admin/customers")}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Customers</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
      >
        {/* Left: Customer details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title text-base-content">Customer Details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Name</span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="Customer name"
                    required
                  />
                </label>

                {/* Customer ID / Code */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Customer Code
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="Optional internal code"
                  />
                </label>

                {/* Email */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Contact Email
                    </span>
                  </div>
                  <input
                    type="email"
                    className="input input-bordered"
                    placeholder="name@company.com"
                    required
                  />
                </label>

                {/* Phone */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Phone</span>
                  </div>
                  <input
                    type="tel"
                    className="input input-bordered"
                    placeholder="+1 234-567-8900"
                  />
                </label>

                {/* Status */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Status</span>
                  </div>
                  <select className="select select-bordered">
                    <option>Active</option>
                    <option>On Hold</option>
                    <option>Inactive</option>
                  </select>
                </label>

                {/* Payment terms */}
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">
                      Payment Terms
                    </span>
                  </div>
                  <select className="select select-bordered">
                    <option>Prepaid</option>
                    <option>Net 15</option>
                    <option>Net 30</option>
                    <option>Net 45</option>
                  </select>
                </label>
              </div>

              {/* Address & notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <label className="form-control w-full md:col-span-2">
                  <div className="label">
                    <span className="label-text font-medium">
                      Billing / Primary Address
                    </span>
                  </div>
                  <textarea
                    className="textarea textarea-bordered min-h-[80px]"
                    placeholder="Street, city, state, postal code, country"
                  />
                </label>

                <label className="form-control w-full md:col-span-2">
                  <div className="label">
                    <span className="label-text font-medium">
                      Notes (optional)
                    </span>
                  </div>
                  <textarea
                    className="textarea textarea-bordered min-h-[60px]"
                    placeholder="Any special handling, credit info, or instructions"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary / meta */}
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title text-base-content">Account Overview</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-content/60">Initial Status</span>
                  <span className="font-medium">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Credit Limit</span>
                  <span className="font-medium">Not set</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Currency</span>
                  <span className="font-medium">Default</span>
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
                    I confirm these customer details are correct.
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
                    {isSubmitting ? "Creating Customer..." : "Create Customer"}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => router.push("/admin/customers")}
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
