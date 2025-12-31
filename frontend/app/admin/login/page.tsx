"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAdmin } from "@/contexts/AdminContext";
import { AdminRole, isValidAdminRole } from "@/lib/admin-roles";

export default function LoginPage() {
  const router = useRouter();
  const { setAdmin } = useAdmin();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const [availableWarehouses, setAvailableWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);

  // Load warehouses from API
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setLoadingWarehouses(true);
        const { warehousesApi } = await import("@/lib/api/warehouses");
        const warehouses = await warehousesApi.getAll();
        setAvailableWarehouses(warehouses.map(w => ({ id: w.id, name: w.name })));
      } catch (error) {
        console.error("Failed to load warehouses:", error);
        // Fallback to empty array if API fails
        setAvailableWarehouses([]);
      } finally {
        setLoadingWarehouses(false);
      }
    };
    loadWarehouses();
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!formData.email || !formData.password) {
      setError("Please enter email and password");
      setIsLoading(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    try {
      // CRITICAL: Clear any existing admin/worker contexts before login
      // This prevents token conflicts when switching between worker and admin
      console.log("[AdminLogin] Clearing existing contexts before login");
      try {
        const { initDB, deleteFromStore, STORES } = await import("@/lib/indexeddb");
        const db = await initDB();
        await deleteFromStore(STORES.WORKER_DATA, "current_worker");
        console.log("[AdminLogin] Worker context cleared");
      } catch (err) {
        console.warn("[AdminLogin] Could not clear worker context (non-critical):", err);
      }
      
      // Call authentication API (this will also clear tokens before login)
      const { authApi } = await import("@/lib/api/auth");
      const loginResponse = await authApi.login({
        username: formData.email, // Use email for login
        password: formData.password,
      });

      if (!loginResponse.success) {
        setError(loginResponse.message || "Invalid email or password");
        setIsLoading(false);
        return;
      }

      // CRITICAL: Verify the user is actually an admin role before proceeding
      const userRole = loginResponse.role?.toLowerCase();
      const adminRoles = ['admin', 'warehouse_manager', 'inbound_coordinator'];
      
      if (!userRole || !adminRoles.includes(userRole)) {
        // User logged in but is not an admin role - clear tokens and show error
        console.error("[AdminLogin] User is not an admin role:", userRole);
        await authApi.logout();
        setError(`Access denied. This account (role: ${userRole || 'unknown'}) is not authorized for admin portal.`);
        setIsLoading(false);
        return;
      }
      
      // Get warehouse name if user has warehouseId
      let warehouseName = "All Warehouses";
      if (loginResponse.warehouseId) {
        try {
          const selectedWarehouse = availableWarehouses.find(w => w.id === loginResponse.warehouseId);
          if (selectedWarehouse) {
            warehouseName = selectedWarehouse.name;
          }
        } catch (err) {
          console.error("Error fetching warehouse:", err);
        }
      }
      
      // Store admin data in context
      const adminData = {
        id: loginResponse.userId || `admin-${formData.email}`,
        name: loginResponse.name || formData.email.split("@")[0],
        email: loginResponse.email || formData.email,
        role: (loginResponse.role as AdminRole) || "admin",
        avatar: "/assets/avatars/Henry Kual.jpg",
        ...(loginResponse.warehouseId && {
          warehouseId: loginResponse.warehouseId,
          warehouseName: warehouseName,
        }),
      };

      // Store admin data (updates state immediately)
      setAdmin(adminData);
      
      // Ensure state is updated and token is saved
      setIsLoading(false);
      
      // Use router.replace to avoid back button issues
      // Small delay to ensure state propagation
      setTimeout(() => {
        router.replace("/admin/dashboard");
      }, 150);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      // Show user-friendly error messages
      if (errorMessage.includes("Invalid") || errorMessage.includes("credentials")) {
        setError("Invalid email or password");
      } else if (errorMessage.includes("401")) {
        setError("Invalid email or password");
      } else {
        setError("Login failed. Please try again.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-xl w-full max-w-md">
        <div className="card-body">
          <div className="flex items-center justify-center mb-6">
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center overflow-hidden"
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
            <span className="text-3xl font-bold ml-3">OptiWMS</span>
          </div>
          <h2 className="text-2xl font-bold text-center mb-6">Admin Login</h2>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                className="input input-bordered w-full"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
            {formData.role === "warehouse_manager" && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Select Warehouse *</span>
                </label>
                {loadingWarehouses ? (
                  <div className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm"></span>
                    <span className="text-sm text-base-content/60">Loading warehouses...</span>
                  </div>
                ) : (
                  <select
                    className="select select-bordered w-full"
                    value={formData.warehouse}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        warehouse: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Choose a warehouse...</option>
                    {availableWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="form-control mt-6">
              <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
