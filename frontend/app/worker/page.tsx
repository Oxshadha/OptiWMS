"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorker } from "@/contexts/WorkerContext";

export default function WorkerHome() {
  const router = useRouter();
  const { role, isLoading } = useWorker();

  // Redirect to role-specific URL if role is available
  useEffect(() => {
    if (!isLoading) {
      if (role) {
        router.replace(`/worker/${role}`);
      } else {
        // If no role, redirect to login
        router.replace("/worker/login");
      }
    }
  }, [role, isLoading, router]);

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center h-64">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  );
}
