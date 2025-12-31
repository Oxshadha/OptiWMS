"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  WorkerRole,
  isValidRole,
  getAllWorkerRoles,
  ROLE_DISPLAY_NAMES,
} from "@/lib/worker-roles";
import { useWorker } from "@/contexts/WorkerContext";

export default function WorkerLoginPage() {
  const router = useRouter();
  const { setWorker, clearWorker } = useWorker();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Clear worker state (but not IndexedDB) when navigating to login page
  // This ensures a fresh login but doesn't delete data until we actually log in
  useEffect(() => {
    // Only clear if we have worker data in state
    // We don't call clearWorker() here because that would delete from IndexedDB
    // Instead, we'll let the WorkerContext handle clearing state on navigation
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!employeeId || !password) {
        setError("Please enter Employee ID and Password");
        setIsLoading(false);
        return;
      }

      // CRITICAL: Clear any existing admin/worker contexts before login
      // This prevents token conflicts when switching between worker and admin
      console.log("[WorkerLogin] Clearing existing contexts before login");
      try {
        const { initDB, deleteFromStore, STORES } = await import("@/lib/indexeddb");
        await initDB();
        await deleteFromStore(STORES.ADMIN_DATA, "current_admin");
        console.log("[WorkerLogin] Admin context cleared");
      } catch (err) {
        console.warn("[WorkerLogin] Could not clear admin context (non-critical):", err);
      }
      
      // Call authentication API - try employee ID as username first
      // (authApi.login will also clear tokens before login)
      const { authApi } = await import("@/lib/api/auth");
      let loginResponse;
      
      try {
        loginResponse = await authApi.login({
          username: employeeId, // Try employee ID as username
          password: password,
        });
      } catch (err) {
        // If employee ID doesn't work, try as email
        if (employeeId.includes("@")) {
          loginResponse = await authApi.login({
            username: employeeId,
            password: password,
          });
        } else {
          throw err;
        }
      }

      if (!loginResponse.success) {
        setError(loginResponse.message || "Invalid Employee ID or password");
        setIsLoading(false);
        return;
      }

      // Get user details from API
      const userInfo = await authApi.getCurrentUser();

      // Build worker data from API response
      // Remove "ROLE_" prefix if present and convert to lowercase
      let workerRole = userInfo.role.toLowerCase();
      if (workerRole.startsWith("role_")) {
        workerRole = workerRole.substring(5); // Remove "role_" prefix
      }
      const normalizedRole = workerRole as WorkerRole;
      
      // Log for debugging
      console.log("[WorkerLogin] User role from API:", userInfo.role);
      console.log("[WorkerLogin] Normalized role:", normalizedRole);
      console.log("[WorkerLogin] Is valid role:", isValidRole(normalizedRole));
      
      // Validate role is a valid worker role
      if (!isValidRole(normalizedRole)) {
        console.error("[WorkerLogin] Invalid role:", {
          original: userInfo.role,
          normalized: normalizedRole,
          validRoles: getAllWorkerRoles()
        });
        setError(`Access denied. This account (role: ${userInfo.role}) is not authorized for worker portal. Valid worker roles: ${getAllWorkerRoles().join(", ")}`);
        setIsLoading(false);
        return;
      }

      // Get warehouse name if available (non-blocking - don't fail login if this fails)
      let warehouseName = "Unknown Warehouse";
      if (loginResponse.warehouseId || userInfo.warehouseId) {
        const warehouseId = loginResponse.warehouseId || userInfo.warehouseId;
        // Try to fetch warehouse name, but don't block login if it fails
        // Workers may not have permission to access warehouse API
        try {
          const { warehousesApi } = await import("@/lib/api/warehouses");
          if (warehouseId) {
            const warehouse = await warehousesApi.getById(warehouseId);
            warehouseName = warehouse.name;
          }
        } catch (err) {
          // Log but don't fail - workers may not have permission to access warehouse API
          console.warn("[WorkerLogin] Could not fetch warehouse name (this is OK for workers):", err);
          // Use warehouse ID as fallback
          warehouseName = warehouseId ? `Warehouse ${warehouseId.substring(0, 8)}...` : "Unknown Warehouse";
        }
      }

      const workerData = {
        id: loginResponse.userId || userInfo.userId,
        workerId: employeeId,
        name: loginResponse.name || userInfo.name || "Worker",
        warehouse: warehouseName,
        role: normalizedRole,
        avatar: "/assets/avatars/Jhon Doe.jpg",
        email: loginResponse.email || userInfo.email || "",
        phone: "",
        deviceId: "e8b5d4",
      };

      // Update worker data in context (this also saves to IndexedDB)
      // Don't await - setWorker updates state immediately and saves in background
      setWorker(workerData);

      // Small delay to ensure state propagation before navigation
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Redirect to role-specific worker home
      router.replace(`/worker/${workerData.role}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      // Show user-friendly error messages
      if (errorMessage.includes("Invalid") || errorMessage.includes("credentials") || errorMessage.includes("401")) {
        setError("Invalid Employee ID or password");
      } else if (errorMessage.includes("Not authenticated")) {
        setError("Invalid Employee ID or password");
      } else {
        setError("Login failed. Please try again.");
      }
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
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Employee ID</span>
              </label>
              <input
                className="input input-bordered w-full"
                placeholder="Enter your Employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Password</span>
              </label>
              <input
                className="input input-bordered w-full"
                placeholder="Enter your password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
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
