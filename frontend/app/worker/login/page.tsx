"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  WorkerRole,
  isValidRole,
  getAllWorkerRoles,
  ROLE_DISPLAY_NAMES,
} from "@/lib/worker-roles";

export default function WorkerLoginPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<WorkerRole>("picker");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      console.log("[Login] Submitting with role:", selectedRole);

      // TODO: Replace with actual API call
      // Mock login - in production, this would be an API call
      const mockWorkerData = {
        id: `worker-${employeeId || "demo"}`,
        workerId: employeeId || "DEMO",
        name: "John Doe",
        warehouse: "Warehouse 1",
        role: selectedRole, // Use selected role for testing
        avatar: "/assets/avatars/Jhon Doe.jpg",
        email: "john.doe@optiwms.com",
        phone: "+1-555-0100",
        deviceId: "e8b5d4",
      };

      console.log("[Login] Worker data to save:", {
        role: mockWorkerData.role,
        selectedRole,
      });

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Validate role
      if (!isValidRole(mockWorkerData.role)) {
        throw new Error("Invalid worker role");
      }

      // Store worker data in IndexedDB
      const { updateInStore, STORES } = await import("@/lib/indexeddb");
      await updateInStore(STORES.WORKER_DATA, {
        key: "current_worker",
        ...mockWorkerData,
      });

      console.log("[Login] Saved worker data:", {
        role: mockWorkerData.role,
        selectedRole,
      });

      // Small delay to ensure storage is written, then redirect
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Redirect to role-specific worker home - the WorkerContext will load the data
      router.push(`/worker/${selectedRole}`);
      // Force a page reload to ensure WorkerContext reloads
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="w-full max-w-md">
        {/* Logo and System Name */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-lg mb-4 flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: "#EEEEEE" }}
          >
            <Image
              src="/assets/logos/OptiWMS Logo.JPG"
              alt="OptiWMS Logo"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-base-content">OptiWMS</h1>
          <p className="text-sm text-base-content/60 mt-2">Worker Portal</p>
        </div>

        {/* Login Form */}
        <div className="card w-full shadow-lg bg-base-100 p-8 space-y-6">
          <h2 className="text-2xl font-semibold text-center text-base-content">
            Worker Login
          </h2>
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="input input-bordered w-full"
              placeholder="Employee ID (optional for demo)"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={isLoading}
            />
            <input
              className="input input-bordered w-full"
              placeholder="Password (optional for demo)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />

            {/* Role Selector for Testing/Demo */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">
                  Select Role (for testing)
                </span>
              </label>
              <select
                className="select select-bordered w-full"
                value={selectedRole}
                onChange={(e) => {
                  const newRole = e.target.value as WorkerRole;
                  console.log("[Login] Role changed:", {
                    old: selectedRole,
                    new: newRole,
                  });
                  setSelectedRole(newRole);
                }}
                disabled={isLoading}
              >
                {getAllWorkerRoles().map((role) => (
                  <option key={role} value={role}>
                    {ROLE_DISPLAY_NAMES[role]}
                  </option>
                ))}
              </select>
              <label className="label">
                <span className="label-text-alt text-base-content/60">
                  Choose a role to test different permissions
                </span>
              </label>
            </div>

            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
