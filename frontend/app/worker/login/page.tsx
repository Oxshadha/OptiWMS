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
import { logger } from "@/lib/utils/logger";

export default function WorkerLoginPage() {
  const router = useRouter();
  const { setWorker, clearWorker } = useWorker();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      logger.debug("[WorkerLogin] Clearing existing contexts before login");
      try {
        const { initDB, deleteFromStore, STORES } = await import("@/lib/indexeddb");
        await initDB();
        await deleteFromStore(STORES.ADMIN_DATA, "current_admin");
        logger.debug("[WorkerLogin] Admin context cleared");
      } catch (err) {
        logger.warn("[WorkerLogin] Could not clear admin context (non-critical):", err);
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
      logger.debug("[WorkerLogin] User role from API:", userInfo.role);
      logger.debug("[WorkerLogin] Normalized role:", normalizedRole);
      logger.debug("[WorkerLogin] Is valid role:", isValidRole(normalizedRole));
      
      // Validate role is a valid worker role
      if (!isValidRole(normalizedRole)) {
        logger.error("[WorkerLogin] Invalid role:", {
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
          logger.warn("[WorkerLogin] Could not fetch warehouse name (this is OK for workers):", err);
          // Use warehouse ID as fallback
          warehouseName = warehouseId ? `Warehouse ${warehouseId.substring(0, 8)}...` : "Unknown Warehouse";
        }
      }

      const workerData = {
        id: loginResponse.userId || userInfo.userId,
        workerId: employeeId,
        name: loginResponse.name || userInfo.name || "Worker",
        warehouse: warehouseName,
        warehouseId: loginResponse.warehouseId || userInfo.warehouseId,
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
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-base-100 overflow-hidden">
      
      {/* Top Header Shape with Worker Image */}
      <div className="absolute top-0 left-0 w-full h-[40vh] sm:h-[45vh] z-0 rounded-b-[3rem] sm:rounded-b-[4rem] overflow-hidden shadow-md">
        <Image
          src="/assets/logos/wroker app image.png"
          alt="Warehouse Worker"
          fill
          className="object-cover object-top"
          priority
        />
        {/* Shading overlay (no blur) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/80"></div>
      </div>

      <div className="w-full max-w-[520px] relative z-10 flex flex-col justify-center px-6 pb-20">
        {/* Logo and System Name */}
        <div className="flex flex-col items-center mb-10 space-y-4">
          <div className="bg-neutral w-36 h-36 rounded-[2rem] shadow-xl flex items-center justify-center transition-all">
            <Image
              src="/assets/logos/OptiWMS Logo.png?v=5"
              alt="OptiWMS Logo"
              width={220}
              height={110}
              className="object-contain w-[85%] h-auto drop-shadow-md"
              priority
            />
          </div>
          <h2 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide">Worker Login</h2>
        </div>

        {/* Login Form */}
        <div className="card w-full shadow-2xl border border-base-200/60 bg-base-100 p-10 sm:p-12 space-y-8 rounded-[2rem] relative z-20">
          {error && (
            <div className="alert alert-error py-3 text-base rounded-lg shadow-sm">
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control">
              <label className="label pb-2">
                <span className="label-text font-medium text-base text-base-content/80">Employee ID</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-base-content/40">
                  <span className="material-symbols-outlined text-[22px]">badge</span>
                </div>
                <input
                  className="input input-bordered w-full pl-14 h-16 text-lg hover:border-primary focus:border-primary transition-colors bg-base-100"
                  placeholder="Enter your Employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
            
            <div className="form-control">
              <label className="label pb-2">
                <span className="label-text font-medium text-base text-base-content/80">Password</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-base-content/40">
                  <span className="material-symbols-outlined text-[22px]">lock</span>
                </div>
                <input
                  className="input input-bordered w-full pl-14 pr-14 h-16 text-lg hover:border-primary focus:border-primary transition-colors bg-base-100"
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/70"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary w-full mt-4 text-base font-semibold shadow-md shadow-primary/20 hover:shadow-primary/40 rounded-xl transition-all"
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

      {/* Footer Art Image */}
      <div className="absolute bottom-0 w-full z-0 pointer-events-none opacity-[0.25]">
         <Image
           src="/assets/logos/admin login page art.png"
           alt="Login Art"
           width={800}
           height={300}
           className="w-full h-auto object-contain object-bottom"
         />
      </div>
    </div>
  );
}
