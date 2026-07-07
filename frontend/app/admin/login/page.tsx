"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { logger } from "@/lib/utils/logger";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isAdmin, refreshAuth } = useAuth();
  const { setAdmin } = useAdmin();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
        logger.error("Failed to load warehouses:", error);
        // Fallback to empty array if API fails
        setAvailableWarehouses([]);
      } finally {
        setLoadingWarehouses(false);
      }
    };
    loadWarehouses();
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (isAdmin && user) {
      router.replace("/admin/dashboard");
    }
  }, [isAdmin, user, router]);

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
      // Use centralized auth login
      const result = await login(formData.email, formData.password);
      
      if (!result.success) {
        setError(result.error || "Invalid email or password");
        setIsLoading(false);
        return;
      }

      // Refresh auth state to get updated user info
      await refreshAuth();
      
      // Wait a bit for auth state to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Check if user is admin - we need to check the role from the login response
      // Since we can't access user state immediately, we'll check via API
      try {
        const { authApi } = await import("@/lib/api/auth");
        const userInfo = await authApi.getCurrentUser();
        // Normalize role (remove ROLE_ prefix if present, like "role_admin" -> "admin")
        let userRole = userInfo.role?.toLowerCase() || '';
        if (userRole.startsWith('role_')) {
          userRole = userRole.substring(5); // Remove "role_" prefix
        }
        const adminRoles = ['admin', 'warehouse_manager', 'inbound_coordinator'];
        
        if (!userRole || !adminRoles.includes(userRole)) {
          // Logout the non-admin user
          const { authApi } = await import("@/lib/api/auth");
          await authApi.logout();
          setError(`Access denied. This account (role: ${userRole || 'unknown'}) is not authorized for admin portal.`);
          setIsLoading(false);
          return;
        }

        // Get full user details and update admin context
        const { usersApi } = await import("@/lib/api/users");
        const fullUser = await usersApi.getById(userInfo.userId);
        
        let warehouseName: string | undefined;
        if (fullUser.warehouseId) {
          try {
            const selectedWarehouse = availableWarehouses.find(w => w.id === fullUser.warehouseId);
            if (selectedWarehouse) {
              warehouseName = selectedWarehouse.name;
            }
          } catch (err) {
            logger.error("Error fetching warehouse:", err);
          }
        }

        const adminData = {
          id: fullUser.id,
          name: `${fullUser.firstName || ''} ${fullUser.lastName || ''}`.trim() || fullUser.username,
          email: fullUser.email || userInfo.email,
          role: fullUser.role as any,
          avatar: fullUser.avatarUrl || "/assets/avatars/Henry Kual.jpg",
          ...(fullUser.warehouseId && {
            warehouseId: fullUser.warehouseId,
            warehouseName: warehouseName,
          }),
        };
        setAdmin(adminData);
      } catch (apiError) {
        logger.error("Error verifying admin role:", apiError);
        setError("Failed to verify user role. Please try again.");
        setIsLoading(false);
        return;
      }
      
      setIsLoading(false);
      
      // Redirect to dashboard
      router.replace("/admin/dashboard");
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
          <div className="flex justify-center mb-6">
            <Image
              src="/assets/logos/OptiWMS Logo.png?v=5"
              alt="OptiWMS Logo"
              width={240}
              height={80}
              className="object-contain h-16 w-auto"
              priority
            />
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input input-bordered w-full pr-12"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-base">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
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
