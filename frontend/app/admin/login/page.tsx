"use client";

import { useState } from "react";
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
    role: "admin" as AdminRole,
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // TODO: API call for authentication
    if (formData.email && formData.password) {
      // Validate role
      if (!isValidAdminRole(formData.role)) {
        setError("Invalid role selected");
        return;
      }

      // Mock admin data - in production, this would come from API
      const mockAdminData = {
        id: `admin-${formData.email}`,
        name: formData.email.split("@")[0],
        email: formData.email,
        role: formData.role,
        avatar: "/assets/avatars/Henry Kual.jpg",
      };

      // Store admin data
      await setAdmin(mockAdminData);

      router.push("/admin/dashboard");
    } else {
      setError("Please enter email and password");
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
            <div className="form-control">
              <label className="label">
                <span className="label-text">Role (for testing)</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as AdminRole,
                  })
                }
              >
                <option value="admin">System Administrator</option>
                <option value="warehouse_manager">Warehouse Manager</option>
              </select>
            </div>
            <div className="form-control mt-6">
              <button type="submit" className="btn btn-primary w-full">
                Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
