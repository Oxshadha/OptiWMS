"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorker } from "@/contexts/WorkerContext";
import { getRoleDisplayName, getOperationDisplayName } from "@/lib/worker-roles";
import { analyticsApi } from "@/lib/api/analytics";
import { logger } from "@/lib/utils/logger";

export default function WorkerProfilePage() {
  const router = useRouter();
  const { worker, allowedOperations } = useWorker();
  const [stats, setStats] = useState([
    { label: "Total Tasks", value: "0", icon: "task" },
    { label: "Completed", value: "0", icon: "check_circle" },
    { label: "Success Rate", value: "0%", icon: "trending_up" },
  ]);
  const [loading, setLoading] = useState(true);

  // Load worker stats from API
  useEffect(() => {
    const loadStats = async () => {
      if (!worker?.id && !worker?.workerId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const workerId = worker.workerId || worker.id;
        const productivityData = await analyticsApi.getWorkerProductivity(workerId);

        if (productivityData.length > 0) {
          const metrics = productivityData[0];
          const totalTasks = metrics.tasksCompleted || 0;
          const completed = totalTasks; // Assuming all tasks in productivity are completed
          const successRate = metrics.errorRate ? (100 - metrics.errorRate).toFixed(1) : "100.0";

          setStats([
            { label: "Total Tasks", value: totalTasks.toLocaleString(), icon: "task" },
            { label: "Completed", value: completed.toLocaleString(), icon: "check_circle" },
            { label: "Success Rate", value: `${successRate}%`, icon: "trending_up" },
          ]);
        }
      } catch (err) {
        logger.error("Failed to load worker stats:", err);
        // Keep default stats on error
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [worker]);

  if (!worker) {
    return (
      <div className="p-4">
        <div className="alert alert-warning">
          <span>Please log in to view your profile.</span>
          <Link href="/worker/login" className="btn btn-sm btn-primary ml-2">
            Login
          </Link>
        </div>
      </div>
    );
  }

  const displayWorker = {
    name: worker.name,
    id: worker.workerId || "N/A", // Use workerId (employeeId), not the UUID
    warehouse: worker.warehouse,
    status: "Online",
    deviceId: worker.deviceId || "N/A",
    avatar: worker.avatar || "/assets/avatars/placeholder.svg",
    email: worker.email || "N/A",
    phone: worker.phone || "N/A",
    role: worker.role,
  };

  return (
    <div className="p-4 space-y-4">
      {/* Profile Header */}
      <div className="bg-base-100 rounded-xl p-6 border border-base-300 text-center">
        <div className="flex justify-center mb-4">
          <Image
            src={displayWorker.avatar}
            alt={displayWorker.name}
            width={100}
            height={100}
            className="rounded-full border-4 border-primary"
          />
        </div>
        <h2 className="text-2xl font-bold text-base-content mb-1">{displayWorker.name}</h2>
        <div className="text-sm text-base-content/60 mb-2">{displayWorker.id}</div>
        {displayWorker.role && (
          <div className="badge badge-primary badge-lg mb-3">
            {getRoleDisplayName(displayWorker.role)}
          </div>
        )}
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-success rounded-full"></div>
          <span className="text-sm text-success font-medium">{displayWorker.status}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          <>
            <div className="bg-base-100 rounded-xl p-4 border border-base-300 text-center">
              <span className="loading loading-spinner loading-md"></span>
            </div>
            <div className="bg-base-100 rounded-xl p-4 border border-base-300 text-center">
              <span className="loading loading-spinner loading-md"></span>
            </div>
            <div className="bg-base-100 rounded-xl p-4 border border-base-300 text-center">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          </>
        ) : (
          stats.map((stat) => (
            <div key={stat.label} className="bg-base-100 rounded-xl p-4 border border-base-300 text-center">
              <div className="text-2xl mb-2">
                <span className="material-symbols-outlined text-primary">{stat.icon}</span>
              </div>
              <div className="text-xl font-bold text-base-content">{stat.value}</div>
              <div className="text-xs text-base-content/60 mt-1">{stat.label}</div>
            </div>
          ))
        )}
      </div>

      {/* Personal Information */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Personal Information</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-base-content/60">email</span>
              <span className="text-sm text-base-content/60">Email</span>
            </div>
            <span className="font-medium text-base-content">{displayWorker.email}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-base-content/60">phone</span>
              <span className="text-sm text-base-content/60">Phone</span>
            </div>
            <span className="font-medium text-base-content">{displayWorker.phone}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-base-content/60">warehouse</span>
              <span className="text-sm text-base-content/60">Warehouse</span>
            </div>
            <span className="font-medium text-base-content">{displayWorker.warehouse}</span>
          </div>
          {displayWorker.role && (
            <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-base-content/60">badge</span>
                <span className="text-sm text-base-content/60">Role</span>
              </div>
              <span className="font-medium text-base-content">{getRoleDisplayName(displayWorker.role)}</span>
            </div>
          )}
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-base-content/60">devices</span>
              <span className="text-sm text-base-content/60">Device ID</span>
            </div>
            <span className="font-medium text-base-content">{displayWorker.deviceId}</span>
          </div>
          {allowedOperations.length > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-primary">verified</span>
                <span className="text-sm font-semibold text-base-content">Allowed Operations</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {allowedOperations.map((op) => (
                  <span key={op} className="badge badge-primary badge-sm">
                    {getOperationDisplayName(op)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button 
          className="btn btn-outline w-full"
          onClick={() => router.push('/worker/account-settings')}
        >
          <span className="material-symbols-outlined">edit</span>
          Edit Profile
        </button>
        <button 
          className="btn btn-outline w-full"
          onClick={() => router.push('/worker/app-settings')}
        >
          <span className="material-symbols-outlined">settings</span>
          Settings
        </button>
        <button
          className="btn btn-error w-full"
          onClick={async () => {
            try {
              // Clear worker context
              const { useWorker } = await import("@/contexts/WorkerContext");
              // Note: We can't use hooks here, so we'll use authApi.logout which handles IndexedDB
              const { authApi } = await import("@/lib/api/auth");
              // Clear tokens and IndexedDB
              await authApi.logout();
              // Redirect to login
              window.location.href = "/worker/login";
            } catch (error) {
              logger.error("Error during logout:", error);
              // Still redirect even if logout fails
              window.location.href = "/worker/login";
            }
          }}
        >
          <span className="material-symbols-outlined">logout</span>
          Logout
        </button>
      </div>
    </div>
  );
}

